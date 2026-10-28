/** Build a self-contained HTML viewer for a Cytoscape KG snapshot.
 *  The output opens in any modern browser and renders the same graph the
 *  user sees in the editor — drag, pan, zoom, and select all work via
 *  Cytoscape's built-in defaults. Cytoscape and fcose load from a CDN so
 *  the file stays small (~5–20 KB).
 *
 *  The exported file runs on the recipient's machine with whatever labels the
 *  author typed in it, so everything that reaches it is treated as hostile:
 *  data is embedded with every markup character escaped, messages are written
 *  as text, and the CDN scripts are pinned and integrity-checked. */

/** Chrome rendered by the exported file's own runtime. The template can't call
 *  `t()` -- it runs standalone, outside the app -- so the caller resolves these
 *  first and passes them in. That is what makes a downloaded file match the
 *  language it was exported in. */
export interface StandaloneHtmlStrings {
  /** Document title when the diagram has no title of its own. */
  fallbackTitle: string;
  /** Shown when the Cytoscape CDN script fails to load. */
  cdnFailed: string;
  /** Prefix for a render failure; the underlying error text is appended. */
  renderFailedPrefix: string;
}

interface BuildArgs {
  title: string;
  /** Output of `cy.json()`. Includes `elements` (with positions),
   *  optional `pan` and `zoom`. */
  cyJson: Record<string, unknown>;
  /** The KG editor stylesheet (`kgStylesheet`). JSON-serializable. */
  stylesheet: unknown;
  /** Layout name used when the snapshot lacks node positions. */
  fallbackLayout: string;
  /** Translated runtime chrome (see `StandaloneHtmlStrings`). */
  strings: StandaloneHtmlStrings;
  /** BCP-47 tag for the document's `lang` attribute. */
  lang: string;
}

export interface CdnScript {
  url: string;
  /** Subresource-integrity hash of exactly that file. */
  integrity: string;
}

/** The viewer's libraries, in load order: fcose is a UMD bundle that expects
 *  `coseBase`, which in turn expects `layoutBase`, as globals. Each is pinned to
 *  an exact version with its integrity hash, so a compromised or changed CDN
 *  file is refused instead of run. The versions are the ones the editor itself
 *  installs; a test compares every hash with the installed file and fails after
 *  an upgrade until these are updated. */
export const CDN_SCRIPTS: readonly CdnScript[] = [
  {
    url: 'https://cdn.jsdelivr.net/npm/cytoscape@3.34.3/dist/cytoscape.umd.js',
    integrity: 'sha384-9JjlirG5QFu0QsJOmmMpYIs4HmjkL9bL4Osqwnxg0kS7XdcREDmc4b8ZOWxis3k3',
  },
  {
    url: 'https://cdn.jsdelivr.net/npm/layout-base@2.0.1/layout-base.js',
    integrity: 'sha384-5E2lB9AIGE6LRCnOOSTnZRlYZFZ01iMeN2fw97Z1r4Z/kXALxKw2AC+ZzQqoeDsG',
  },
  {
    url: 'https://cdn.jsdelivr.net/npm/cose-base@2.2.0/cose-base.js',
    integrity: 'sha384-RswRBkrMsPUYpJLbZ1CVA08zbNzAkykE2oGJTujBwfjWNdfxv2WVjLJNqv1LhAOp',
  },
  {
    url: 'https://cdn.jsdelivr.net/npm/cytoscape-fcose@2.2.0/cytoscape-fcose.js',
    integrity: 'sha384-uk5Wbjq1+KqUdHO30w7N7GrEGdzBhaJeW9o/ANF6v9+yx3M/cBmoX51C000JNCUf',
  },
];

/** Inline a value as a JSON literal inside a `<script>` tag. Every character
 *  the HTML parser could act on is written as a \u escape (still the same
 *  string to JavaScript): `</script>` would close the block, and `<!--` followed
 *  by `<script` switches the parser into a mode that swallows the closing tag.
 *  U+2028/U+2029 are escaped as well, for older engines. */
function inlineJson(value: unknown): string {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildStandaloneHtml({
  title,
  cyJson,
  stylesheet,
  fallbackLayout,
  strings,
  lang,
}: BuildArgs): string {
  const safeTitle = escapeHtml(title || strings.fallbackTitle);
  const cyJsonLiteral = inlineJson(cyJson);
  const styleLiteral = inlineJson(stylesheet);
  const layoutLiteral = inlineJson(fallbackLayout);
  // Translated copy goes through `inlineJson` for the same reason the graph
  // data does: it becomes a JS string literal inside `<script>`, and an
  // apostrophe or a stray `</` in a translation would otherwise break the
  // file. Never interpolate these raw.
  const cdnFailedLiteral = inlineJson(strings.cdnFailed);
  const renderFailedLiteral = inlineJson(strings.renderFailedPrefix);

  return `<!doctype html>
<html lang="${escapeHtml(lang)}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${safeTitle}</title>
<style>
  html, body { margin: 0; padding: 0; height: 100%; background: #ffffff; }
  body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #1f2937; }
  #cy { position: absolute; inset: 0; }
  .kg-error {
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
    padding: 1rem; text-align: center; color: #991b1b;
  }
</style>
${CDN_SCRIPTS.map((s) => `<script src="${s.url}" integrity="${s.integrity}" crossorigin="anonymous"></script>`).join('\n')}
</head>
<body>
<div id="cy"></div>
<script>
(function () {
  var container = document.getElementById('cy');
  function showError(msg) {
    // Text, never markup: the message can carry an error from the page or a
    // translation, and neither is trusted.
    var box = document.createElement('div');
    box.className = 'kg-error';
    box.textContent = msg;
    container.textContent = '';
    container.appendChild(box);
  }
  try {
    if (typeof cytoscape !== 'function') {
      showError(${cdnFailedLiteral});
      return;
    }
    if (typeof cytoscapeFcose === 'function') {
      try { cytoscape.use(cytoscapeFcose); } catch (e) { /* already registered */ }
    }
    var snapshot = ${cyJsonLiteral};
    var stylesheet = ${styleLiteral};
    var fallbackLayout = ${layoutLiteral};
    var elements = (snapshot && snapshot.elements) || [];
    var nodeArray = Array.isArray(elements)
      ? elements
      : (elements.nodes || []).concat(elements.edges || []);
    var hasPositions = nodeArray.some(function (el) {
      return el && el.position && (el.position.x !== undefined || el.position.y !== undefined);
    });
    var layoutOpts = hasPositions
      ? { name: 'preset', fit: true, padding: 40 }
      : { name: fallbackLayout || 'fcose', fit: true, padding: 50 };
    var cy = cytoscape({
      container: container,
      elements: elements,
      style: stylesheet,
      layout: layoutOpts,
      wheelSensitivity: 0.2,
    });
    if (snapshot && typeof snapshot.zoom === 'number') cy.zoom(snapshot.zoom);
    if (snapshot && snapshot.pan && typeof snapshot.pan.x === 'number' && typeof snapshot.pan.y === 'number') {
      cy.pan(snapshot.pan);
    }
    if (!hasPositions) cy.fit(undefined, 40);
  } catch (err) {
    showError(${renderFailedLiteral} + (err && err.message ? err.message : String(err)));
  }
})();
</script>
</body>
</html>
`;
}
