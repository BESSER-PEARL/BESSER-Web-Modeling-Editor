/**
 * After an assistant change the editor fitted the diagram to the WHOLE canvas
 * (React Flow centres on the pane), so with the floating widget open — 520 px
 * wide on the right of a ~1060 px canvas — the change the user just asked for
 * sat behind the chat panel. The fit must use the strip the panel leaves free.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  fitEditorAroundAssistantPanel,
  viewportForArea,
  visibleStrip,
  type Rect,
} from '../panelAwareViewport';

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

describe('viewportForArea', () => {
  it('centres the diagram in the free strip, not in the pane', () => {
    const bounds = { x: -400, y: -300, width: 800, height: 600 };
    const area = { x: 0, y: 0, width: 476, height: 804 };
    const vp = viewportForArea(bounds, area);
    // The diagram's centre (0, 0) lands in the middle of the free strip.
    expect(vp.x).toBeCloseTo(238);
    expect(vp.y).toBeCloseTo(402);
    // Its right edge stays left of the widget.
    expect(bounds.x * vp.zoom + vp.x + bounds.width * vp.zoom).toBeLessThanOrEqual(476);
    expect(vp.zoom).toBeLessThanOrEqual(1);
  });
});

describe('fitEditorAroundAssistantPanel', () => {
  const editorWithInstance = () => {
    const instance = {
      getNodes: vi.fn(() => [{ id: 'a' }]),
      getNodesBounds: vi.fn(() => ({ x: 0, y: 0, width: 600, height: 300 })),
      setViewport: vi.fn(() => Promise.resolve(true)),
    };
    const editor = { fitView: vi.fn(() => Promise.resolve(true)), reactFlowInstance: instance };
    return { editor, instance };
  };

  it('fits into the strip the open widget leaves free', async () => {
    mount('pane', PANE, { class: 'react-flow' });
    mount('assistant-widget-panel', WIDGET, { 'aria-hidden': 'false' });
    const { editor, instance } = editorWithInstance();

    await fitEditorAroundAssistantPanel(editor);

    expect(instance.setViewport).toHaveBeenCalledTimes(1);
    const [vp] = instance.setViewport.mock.calls[0] as unknown as [{ x: number; y: number; zoom: number }];
    const rightEdge = vp.x + 600 * vp.zoom;
    expect(rightEdge).toBeLessThanOrEqual(WIDGET.x - PANE.x);
  });

  it('is a plain fitView when the panel is hidden', async () => {
    mount('pane', PANE, { class: 'react-flow' });
    mount('assistant-widget-panel', WIDGET, { 'aria-hidden': 'true' });
    const { editor, instance } = editorWithInstance();

    await fitEditorAroundAssistantPanel(editor);

    expect(editor.fitView).toHaveBeenCalledWith(expect.objectContaining({ duration: 300, maxZoom: 1 }));
    expect(instance.setViewport).not.toHaveBeenCalled();
  });

  it('falls back to fitView on an editor without a reachable instance', async () => {
    mount('pane', PANE, { class: 'react-flow' });
    mount('assistant-widget-panel', WIDGET);
    const editor = { fitView: vi.fn(() => Promise.resolve(true)) };

    await fitEditorAroundAssistantPanel(editor);

    expect(editor.fitView).toHaveBeenCalledTimes(1);
  });
});
