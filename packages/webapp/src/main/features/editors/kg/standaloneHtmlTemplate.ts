/** Build a self-contained HTML viewer for a Cytoscape KG snapshot.
 *  The output opens in any modern browser and renders the same graph the
 *  user sees in the editor — drag, pan, zoom, and select all work via
 *  Cytoscape's built-in defaults. Cytoscape and fcose load from a CDN so
 *  the file stays small (~5–20 KB). */

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

const CYTOSCAPE_CDN = 'https://cdn.jsdelivr.net/npm/cytoscape@3.33.2/dist/cytoscape.umd.js';
const FCOSE_CDN = 'https://cdn.jsdelivr.net/npm/cytoscape-fcose@2.2.0/dist/cytoscape-fcose.umd.js';

/** Inline a value as a JSON literal inside a `<script>` tag. The `</`
 *  escape prevents an attacker-controlled label from prematurely closing
 *  the script element. */
function inlineJson(value: unknown): string {
  return JSON.stringify(value).replace(/<\//g, '<\\/');
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
<script src="${CYTOSCAPE_CDN}"></script>
<script src="${FCOSE_CDN}"></script>
</head>
<body>
<div id="cy"></div>
<script>
(function () {
  var container = document.getElementById('cy');
  function showError(msg) {
    container.innerHTML = '<div class="kg-error">' + msg + '</div>';
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
