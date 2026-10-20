/**
 * After an assistant change the editor fitted the diagram to the WHOLE canvas
 * (React Flow centres on the pane), so with the floating widget open — 520 px
 * wide on the right of a ~1060 px canvas — the change the user just asked for
 * sat behind the chat panel. The fit must use the strip the panel leaves free.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fitEditorAroundAssistantPanel, visibleStrip, type Rect } from '../panelAwareViewport';

// Live editor geometry (1440x900 window, 380 px sidebar + palette).
const PANE: Rect = { x: 380, y: 96, width: 1060, height: 804 };
const WIDGET: Rect = { x: 856, y: 128, width: 520, height: 700 };

function mount(id: string, rect: Rect, attrs: Record<string, string> = {}): HTMLElement {
  const el = document.createElement('div');
  el.id = id;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.getBoundingClientRect = () => ({ ...rect, top: rect.y, left: rect.x, right: rect.x + rect.width, bottom: rect.y + rect.height, toJSON: () => ({}) }) as DOMRect;
  document.body.appendChild(el);
  return el;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('visibleStrip', () => {
  it('is the whole pane when nothing overlaps it', () => {
    expect(visibleStrip(PANE, { x: 0, y: 0, width: 100, height: 100 })).toEqual({ x: 0, y: 0, width: 1060, height: 804 });
  });

  it('is the strip left of the floating widget', () => {
    expect(visibleStrip(PANE, WIDGET)).toEqual({ x: 0, y: 0, width: 476, height: 804 });
  });

  it('is the strip above a half-open drawer', () => {
    const drawer = { x: 380, y: 500, width: 1060, height: 800 };
    expect(visibleStrip(PANE, drawer)).toEqual({ x: 0, y: 0, width: 1060, height: 404 });
  });

  it('is null when the panel covers the canvas', () => {
    expect(visibleStrip(PANE, { x: 300, y: 50, width: 1200, height: 900 })).toBeNull();
  });
});

describe('fitEditorAroundAssistantPanel', () => {
  // The editor's own fitViewInto measures its canvas and applies the viewport;
  // this side only decides which part of the canvas is free.
  const editorWithFitInto = () => {
    const fitViewInto = vi.fn(
      async (area: Rect | ((canvas: Rect) => Rect | null), _options?: unknown) =>
        typeof area === 'function' ? area(PANE) : area,
    );
    return { fitViewInto, fitView: vi.fn(async () => true) };
  };

  it('fits into the strip the open widget leaves free, capped at 100%', async () => {
    mount('assistant-widget-panel', WIDGET, { 'aria-hidden': 'false' });
    const editor = editorWithFitInto();

    await fitEditorAroundAssistantPanel(editor);

    expect(editor.fitViewInto).toHaveBeenCalledTimes(1);
    const area = await editor.fitViewInto.mock.results[0].value;
    expect(area).toEqual({ x: PANE.x, y: PANE.y, width: WIDGET.x - PANE.x, height: PANE.height });
    expect(editor.fitViewInto.mock.calls[0][1]).toEqual(expect.objectContaining({ maxZoom: 1 }));
    expect(editor.fitView).not.toHaveBeenCalled();
  });

  it('fits the whole canvas when the panel is hidden', async () => {
    mount('assistant-widget-panel', WIDGET, { 'aria-hidden': 'true' });
    const editor = editorWithFitInto();

    await fitEditorAroundAssistantPanel(editor);

    expect(await editor.fitViewInto.mock.results[0].value).toEqual(PANE);
  });

  it('hands no area (a plain fit) when the panel covers the canvas', async () => {
    mount('assistant-widget-panel', { x: 300, y: 50, width: 1200, height: 900 });
    const editor = editorWithFitInto();

    await fitEditorAroundAssistantPanel(editor);

    expect(await editor.fitViewInto.mock.results[0].value).toBeNull();
  });

  it('falls back to fitView on an editor without fitViewInto', async () => {
    mount('assistant-widget-panel', WIDGET);
    const editor = { fitView: vi.fn(() => Promise.resolve(true)) };

    await fitEditorAroundAssistantPanel(editor);

    expect(editor.fitView).toHaveBeenCalledWith(expect.objectContaining({ duration: 300, maxZoom: 1 }));
  });
});
