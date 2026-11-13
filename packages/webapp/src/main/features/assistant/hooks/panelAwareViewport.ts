/**
 * Fit the diagram into the part of the canvas the open assistant panel leaves
 * visible. React Flow 12.3's `fitView` only takes a uniform padding and always
 * centres in the whole pane, so the floating widget (520 px on the right) or a
 * half-open drawer covered the result of the change the user just asked for.
 */

export type Rect = { x: number; y: number; width: number; height: number };

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

const FIT = { padding: 0.1, maxZoom: 1.0, duration: 300 };

/**
 * Fit the editor's diagram into the canvas area the assistant panel leaves
 * free, through `BesserEditor.fitViewInto` (queued behind a model load like
 * `fitView`, so it replaces the editor's own post-load fit). Without an open
 * panel it fits the whole canvas; an editor build without `fitViewInto`
 * gets a plain `fitView`.
 */
export async function fitEditorAroundAssistantPanel(editor: any, doc: Document = document): Promise<void> {
  if (!editor) return;
  if (typeof editor.fitViewInto !== 'function') {
    if (typeof editor.fitView === 'function') await editor.fitView(FIT);
    return;
  }
  const panel = openAssistantPanelRect(doc);
  await editor.fitViewInto((canvas: Rect) => {
    if (!panel) return canvas;
    const strip = visibleStrip(canvas, panel);
    return strip && { ...strip, x: canvas.x + strip.x, y: canvas.y + strip.y };
  }, FIT);
}

/** True while an assistant panel covers part of the page. */
export function isAssistantPanelOpen(doc: Document = document): boolean {
  return openAssistantPanelRect(doc) !== null;
}
