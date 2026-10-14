/* @vitest-environment jsdom */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

import { CDN_SCRIPTS, buildStandaloneHtml, type StandaloneHtmlStrings } from '../standaloneHtmlTemplate';

const STRINGS: StandaloneHtmlStrings = {
  fallbackTitle: 'Knowledge graph',
  cdnFailed: 'Could not load the viewer library.',
  renderFailedPrefix: 'Could not draw the graph: ',
};

const build = (overrides: { title?: string; cyJson?: Record<string, unknown>; strings?: StandaloneHtmlStrings } = {}) =>
  buildStandaloneHtml({
    title: overrides.title ?? 'People',
    cyJson: overrides.cyJson ?? { elements: [{ data: { id: 'a', label: 'A' }, position: { x: 1, y: 2 } }] },
    stylesheet: [],
    fallbackLayout: 'fcose',
    strings: overrides.strings ?? STRINGS,
    lang: 'en',
  });

const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html');

/** Run the file's own inline script, as a browser would, against its parsed DOM. */
function run(html: string, cytoscapeStub: unknown) {
  const doc = parse(html);
  const inline = [...doc.querySelectorAll('script:not([src])')].map((s) => s.textContent ?? '').join('\n');
  new Function('document', 'cytoscape', 'cytoscapeFcose', inline)(doc, cytoscapeStub, undefined);
  return doc;
}

const HOSTILE = [
  '</script><img src=x onerror=alert(1)>',
  '<!--<script>',
  '"quoted" & <b>bold</b>',
  'line separator here',
  "it's",
];

describe('the CDN scripts', () => {
  const doc = parse(build());
  const tags = [...doc.querySelectorAll<HTMLScriptElement>('script[src]')];

  it('are loaded in dependency order: cytoscape, then fcose with the two libraries it needs', () => {
    expect(tags.map((t) => t.src.split('/npm/')[1].split('@')[0])).toEqual([
      'cytoscape',
      'layout-base',
      'cose-base',
      'cytoscape-fcose',
    ]);
  });

  it('are all pinned to an exact version and carry a subresource-integrity hash', () => {
    expect(tags).toHaveLength(CDN_SCRIPTS.length);
    for (const tag of tags) {
      expect(tag.src).toMatch(/\/npm\/[a-z-]+@\d+\.\d+\.\d+\//);
      expect(tag.getAttribute('integrity')).toMatch(/^sha384-[A-Za-z0-9+/]{64}$/);
      expect(tag.getAttribute('crossorigin')).toBe('anonymous');
    }
  });

  // Offline: the installed npm packages are byte-identical to what jsDelivr
  // serves for the same version, so they pin the hashes. If a dependency is
  // upgraded this fails until the template is updated to match.
  describe.each(CDN_SCRIPTS.map((s) => [s.url, s] as const))('%s', (_url, script) => {
    const require = createRequire(import.meta.url);
    const [, pkg, version, file] = script.url.match(/npm\/([a-z-]+)@([\d.]+)\/(.+)$/)!;
    // Some packages restrict `exports`, so find the folder from the entry point.
    const entry = require.resolve(pkg);
    const dir = entry.slice(0, entry.indexOf(`node_modules/${pkg}/`) + `node_modules/${pkg}`.length);

    it('is the version the editor has installed', () => {
      expect(JSON.parse(readFileSync(`${dir}/package.json`, 'utf8')).version).toBe(version);
    });

    it('has the integrity hash of that installed file', () => {
      const installed = readFileSync(`${dir}/${file}`);
      expect(script.integrity).toBe(`sha384-${createHash('sha384').update(installed).digest('base64')}`);
    });
  });
});

describe('data embedded in the page', () => {
  it.each(HOSTILE)('cannot break out of the script block: %j', (label) => {
    const html = build({ cyJson: { elements: [{ data: { id: 'a', label } }] } });
    const doc = parse(html);

    expect(doc.querySelectorAll('img, b')).toHaveLength(0);
    // 4 library scripts + the page's own.
    expect(doc.querySelectorAll('script')).toHaveLength(CDN_SCRIPTS.length + 1);
  });

  it.each(HOSTILE)('reaches the viewer exactly as written: %j', (label) => {
    let received: any;
    run(build({ cyJson: { elements: [{ data: { id: 'a', label } }] } }), (options: any) => {
      received = options;
      return { zoom() {}, pan() {}, fit() {} };
    });

    expect(received.elements[0].data.label).toBe(label);
  });

  it('does not leave raw "<" or ">" in the inline script', () => {
    const html = build({ cyJson: { elements: [{ data: { id: 'a', label: '<!--<script></script>' } }] } });
    const inline = parse(html).querySelector('script:not([src])')!.textContent!;
    const data = inline.slice(inline.indexOf('var snapshot'), inline.indexOf('var elements'));

    expect(data).not.toMatch(/[<>]/);
  });

  it('keeps a hostile title and language out of the markup', () => {
    const html = buildStandaloneHtml({
      title: '</title><img src=x onerror=1>',
      cyJson: { elements: [] },
      stylesheet: [],
      fallbackLayout: 'fcose',
      strings: STRINGS,
      lang: 'en"><img src=x>',
    });
    const doc = parse(html);

    expect(doc.querySelectorAll('img')).toHaveLength(0);
    expect(doc.title).toBe('</title><img src=x onerror=1>');
  });
});

describe('error messages shown in the page', () => {
  it('are text, even when the error message contains markup', () => {
    const doc = run(build(), () => {
      throw new Error('<img src=x onerror=alert(1)>');
    });

    const box = doc.querySelector('.kg-error')!;
    expect(box.textContent).toBe('Could not draw the graph: <img src=x onerror=alert(1)>');
    expect(doc.querySelectorAll('img')).toHaveLength(0);
  });

  it('are text when the library failed to load, whatever the translation contains', () => {
    const doc = run(build({ strings: { ...STRINGS, cdnFailed: 'Offline <b>now</b>' } }), undefined);

    expect(doc.querySelector('.kg-error')!.textContent).toBe('Offline <b>now</b>');
    expect(doc.querySelectorAll('b')).toHaveLength(0);
  });
});

describe('a normal graph', () => {
  it('is drawn with its stored positions and fit to the page', () => {
    let received: any;
    run(build(), (options: any) => {
      received = options;
      return { zoom() {}, pan() {}, fit() {} };
    });

    expect(received.layout).toMatchObject({ name: 'preset', fit: true });
    expect(received.elements).toHaveLength(1);
  });
});
