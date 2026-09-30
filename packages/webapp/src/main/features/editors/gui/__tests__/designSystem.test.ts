/**
 * The baseline ds-* stylesheet is only for projects that have none. GrapesJS
 * `getCss()` drops rules no component on the page uses, so an agent-themed
 * project whose open page has no `.ds-card` looked unthemed and got its own
 * `.ds-*` rules overwritten by the baseline on every load.
 */
import { afterEach, describe, expect, it } from 'vitest';
import grapesjs, { type Editor } from 'grapesjs';

import { ensureDesignSystemStyles, hasDesignSystemStyles } from '../designSystem';

let editor: Editor | null = null;

afterEach(() => {
  editor?.destroy();
  editor = null;
});

const makeEditor = (): Editor => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  editor = grapesjs.init({ container, headless: true, storageManager: false });
  return editor;
};

describe('design system baseline', () => {
  it('sees an agent theme even when the open page uses no .ds-card', () => {
    const ed = makeEditor();
    ed.setComponents('<div class="ds-btn">Go</div>');
    ed.Css.addRules('.ds-card { background-color: #111111; } .ds-btn { color: #ff0000; }');

    expect(hasDesignSystemStyles(ed)).toBe(true);
  });

  it('keeps the project\'s own ds-* rules on load', () => {
    const ed = makeEditor();
    ed.setComponents('<div class="ds-btn">Go</div>');
    ed.Css.addRules('.ds-card { background-color: #111111; } .ds-btn { color: #ff0000; }');

    ensureDesignSystemStyles(ed);

    expect(ed.Css.getRule('.ds-btn')?.getStyle()).toEqual({ color: '#ff0000' });
  });

  it('injects the baseline into a project without one', () => {
    const ed = makeEditor();
    ed.setComponents('<div>plain</div>');

    ensureDesignSystemStyles(ed);

    expect(ed.Css.getRule('.ds-card')).toBeTruthy();
  });
});
