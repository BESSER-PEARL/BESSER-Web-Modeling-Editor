/**
 * Live report: an assistant-created diagram could not be undone (Ctrl+Z was
 * disabled right after the create), and the first create on an empty class
 * diagram zoomed to ~220% with half the result under the assistant panel.
 * Both came from the create path: it wrote the model to storage and re-created
 * the editor (fresh undo history), whose post-mount auto-layout then fitted
 * the view without a zoom cap, after the panel-aware fit.
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const layoutModel = vi.hoisted(() => vi.fn(async (model: any) => ({ ...model, laidOut: true })));
vi.mock('@besser/wme', async (importOriginal) => ({ ...(await importOriginal<object>()), layoutModel }));
vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

import { useModelInjection } from '../useModelInjection';
import { bumpEditorRevision } from '../../../../app/store/workspaceSlice';

const systemSpec = {
  systemName: 'Library',
  classes: [
    { className: 'Book', attributes: [{ name: 'title', type: 'str' }], methods: [] },
    { className: 'Author', attributes: [{ name: 'name', type: 'str' }], methods: [] },
  ],
  relationships: [],
};

const project = {
  id: 'p',
  currentDiagramIndices: { ClassDiagram: 0 },
  diagrams: { ClassDiagram: [{ id: 'cd-1' }, { id: 'cd-2' }] },
};

const liveEditor = () => ({
  applyModel: vi.fn(),
  fitViewInto: vi.fn(async (_area: unknown, _options?: unknown) => true),
  fitView: vi.fn(async () => true),
});

function setup(editor: any) {
  const dispatch: any = vi.fn(() => ({ unwrap: () => Promise.resolve() }));
  const injectToEditor = vi.fn().mockResolvedValue(true);
  const options = {
    dispatch,
    modelingServiceRef: { current: { injectToEditor } } as any,
    currentModelRef: { current: { version: '4.0.0', type: 'ClassDiagram', nodes: [], edges: [] } } as any,
    currentProjectRef: { current: project } as any,
    currentDiagramTypeRef: { current: 'ClassDiagram' } as any,
    switchDiagramRef: { current: vi.fn().mockResolvedValue(true) } as any,
    setMessages: vi.fn(),
    setMessageMeta: vi.fn(),
    setProgressMessage: vi.fn(),
  };
  const hook = renderHook((props: { editor: any }) => useModelInjection({ ...options, editor: props.editor }), {
    initialProps: { editor },
  });
  const bumped = () => dispatch.mock.calls.some(([action]: any[]) => action?.type === bumpEditorRevision.type);
  return { hook, dispatch, injectToEditor, bumped };
}

afterEach(() => {
  vi.useRealTimers();
  layoutModel.mockClear();
});

describe('assistant create on the diagram on the canvas', () => {
  it('is applied in place as one undoable step, laid out, without re-creating the editor', async () => {
    vi.useFakeTimers();
    const editor = liveEditor();
    const { hook, injectToEditor, bumped } = setup(editor);

    await act(async () => {
      await hook.result.current.handleInjection({
        action: 'inject_complete_system',
        diagramType: 'ClassDiagram',
        systemSpec,
      } as any);
    });

    expect(injectToEditor).toHaveBeenCalledTimes(1);
    const [update] = injectToEditor.mock.calls[0];
    expect(update.type).toBe('modification');
    expect(update.data.laidOut).toBe(true);
    expect(update.data.nodes.map((n: any) => n.data?.name).sort()).toEqual(['Author', 'Book']);
    expect(bumped()).toBe(false);

    // The fit around the assistant panel is the only viewport move, capped at 100%.
    await act(async () => {
      vi.advanceTimersByTime(250);
    });
    expect(editor.fitViewInto).toHaveBeenCalledTimes(1);
    expect(editor.fitViewInto.mock.calls[0][1]).toEqual(expect.objectContaining({ maxZoom: 1 }));
  });
});

describe('assistant create on another tab', () => {
  it('re-creates the editor and fits the new one, not the one it replaces', async () => {
    // The tab switch waits two animation frames; only timeouts are faked.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const oldEditor = liveEditor();
    const { hook, injectToEditor, bumped } = setup(oldEditor);

    await act(async () => {
      await hook.result.current.handleInjection({
        action: 'inject_complete_system',
        diagramType: 'ClassDiagram',
        diagramId: 'cd-2',
        systemSpec,
      } as any);
    });

    expect(injectToEditor).not.toHaveBeenCalled();
    expect(bumped()).toBe(true);
    expect(layoutModel).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(450);
    });
    expect(oldEditor.fitViewInto).not.toHaveBeenCalled();

    const newEditor = liveEditor();
    hook.rerender({ editor: newEditor });
    await act(async () => {
      vi.advanceTimersByTime(250);
    });
    expect(newEditor.fitViewInto).toHaveBeenCalledTimes(1);
    expect(oldEditor.fitViewInto).not.toHaveBeenCalled();
  });
});
