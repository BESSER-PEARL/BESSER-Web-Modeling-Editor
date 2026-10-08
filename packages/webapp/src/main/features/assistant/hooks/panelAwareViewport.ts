/**
 * Fit the diagram into the part of the canvas the open assistant panel leaves
 * visible. React Flow 12.3's `fitView` only takes a uniform padding and always
 * centres in the whole pane, so the floating widget (520 px on the right) or a
 * half-open drawer covered the result of the change the user just asked for.
 */

export type Rect = { x: number; y: number; width: number; height: number };
export type Viewport = { x: number; y: number; zoom: number };

/** The assistant surfaces that float over the canvas (ids set in their components). */
const PANEL_SELECTORS = ['#assistant-widget-panel', '#assistant-drawer-panel'];

/** Smallest strip worth fitting into; below this the panel covers the canvas. */
const MIN_STRIP = { width: 240, height: 160 };

const toRect = (r: DOMRect | Rect): Rect => ({ x: r.x, y: r.y, width: r.width, height: r.height });

/** Client rect of the open assistant panel, or null when none is open. */
export function openAssistantPanelRect(doc: Document = document): Rect | null {
  for (const selector of PANEL_SELECTORS) {
    const el = doc.querySelector<HTMLElement>(selector);
    if (!el || el.getAttribute('aria-hidden') === 'true') continue;
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return toRect(rect);
  }
  return null;
}

/** Client rect of the editor canvas (the largest React Flow pane on the page). */
export function canvasRect(doc: Document = document): Rect | null {
  let best: Rect | null = null;
  let bestArea = 0;
  for (const el of Array.from(doc.querySelectorAll<HTMLElement>('.react-flow'))) {
    const rect = toRect(el.getBoundingClientRect());
    if (rect.width * rect.height > bestArea) {
      best = rect;
      bestArea = rect.width * rect.height;
    }
  }
  return best;
}

/**
 * The largest strip of `pane` that `cover` leaves visible, in pane-relative
 * coordinates. The whole pane when they do not overlap; null when no strip is
 * big enough to show a diagram in.
 */
export function visibleStrip(pane: Rect, cover: Rect): Rect | null {
  const left = Math.max(pane.x, cover.x);
  const top = Math.max(pane.y, cover.y);
  const right = Math.min(pane.x + pane.width, cover.x + cover.width);
  const bottom = Math.min(pane.y + pane.height, cover.y + cover.height);
  if (right <= left || bottom <= top) return { x: 0, y: 0, width: pane.width, height: pane.height };

  const strips: Rect[] = [
    { x: 0, y: 0, width: left - pane.x, height: pane.height },
    { x: right - pane.x, y: 0, width: pane.x + pane.width - right, height: pane.height },
    { x: 0, y: 0, width: pane.width, height: top - pane.y },
    { x: 0, y: bottom - pane.y, width: pane.width, height: pane.y + pane.height - bottom },
  ].filter((s) => s.width >= MIN_STRIP.width && s.height >= MIN_STRIP.height);
  if (strips.length === 0) return null;
  return strips.reduce((a, b) => (b.width * b.height > a.width * a.height ? b : a));
}

/** React Flow's fit math (`getViewportForBounds`), centred on `area` instead of the whole pane. */
export function viewportForArea(
  bounds: Rect,
  area: Rect,
  { padding = 0.1, minZoom = 0.1, maxZoom = 1 }: { padding?: number; minZoom?: number; maxZoom?: number } = {},
): Viewport {
  const zoomX = area.width / (Math.max(bounds.width, 1) * (1 + padding));
  const zoomY = area.height / (Math.max(bounds.height, 1) * (1 + padding));
  const zoom = Math.min(Math.max(Math.min(zoomX, zoomY), minZoom), maxZoom);
  return {
    x: area.x + area.width / 2 - (bounds.x + bounds.width / 2) * zoom,
    y: area.y + area.height / 2 - (bounds.y + bounds.height / 2) * zoom,
    zoom,
  };
}

const FIT = { padding: 0.1, maxZoom: 1.0 };

/**
 * Fit the editor's diagram into the canvas area the assistant panel leaves
 * free. `fitView` runs first: it takes over the editor's pending post-load fit
 * and resolves once the new model has rendered; the panel-aware viewport is
 * applied on top through the editor's React Flow instance. Without an open
 * panel, or an editor build without that instance, it is a plain `fitView`.
 */
export async function fitEditorAroundAssistantPanel(editor: any, doc: Document = document): Promise<void> {
  if (!editor || typeof editor.fitView !== 'function') return;
  const panel = openAssistantPanelRect(doc);
  const instance = editor.reactFlowInstance;
  const pane = panel ? canvasRect(doc) : null;
  const area = panel && pane ? visibleStrip(pane, panel) : null;
  const partlyCovered = !!area && !!pane && (area.width < pane.width || area.height < pane.height);
  if (!partlyCovered || typeof instance?.setViewport !== 'function') {
    await editor.fitView({ ...FIT, duration: 300 });
    return;
  }
  await editor.fitView({ ...FIT, duration: 0 });
  const nodes = instance.getNodes?.() ?? [];
  if (nodes.length === 0) return;
  const bounds: Rect = instance.getNodesBounds(nodes);
  await instance.setViewport(viewportForArea(bounds, area!, FIT), { duration: 300 });
}

/** True while an assistant panel covers part of the page. */
export function isAssistantPanelOpen(doc: Document = document): boolean {
  return openAssistantPanelRect(doc) !== null;
}
