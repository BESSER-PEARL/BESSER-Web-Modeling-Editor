/**
 * Re-centre after a reframing assistant update (develop re-centred the
 * scroll container after inject_complete_system and large modifications).
 *
 * The assistant client's handlers are registered once, so they call the
 * `handleInjection` from the FIRST render: the viewport fit must reach the
 * editor that is live when it fires, not the one captured back then.
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useModelInjection } from '../useModelInjection';

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

function classNode(id: string, x: number): any {
  return {
    id,
    type: 'class',
    position: { x, y: 0 },
    width: 220,
    height: 90,
    data: { name: id, attributes: [], methods: [] },
  };
}

function setup(initialEditor: any) {
  const dispatch: any = vi.fn(() => ({ unwrap: () => Promise.resolve() }));
  const injectToEditor = vi.fn().mockResolvedValue(true);
  const options = {
    dispatch,
    modelingServiceRef: { current: { injectToEditor } } as any,
    currentModelRef: {
      current: { version: '4.0.0', type: 'ClassDiagram', nodes: [classNode('A', 0)], edges: [] },
    } as any,
    currentProjectRef: { current: null } as any,
    currentDiagramTypeRef: { current: 'ClassDiagram' } as any,
    switchDiagramRef: { current: vi.fn().mockResolvedValue(true) } as any,
    setMessages: vi.fn(),
    setMessageMeta: vi.fn(),
    setProgressMessage: vi.fn(),
  };
  const hook = renderHook((props: { editor: any }) => useModelInjection({ ...options, editor: props.editor }), {
    initialProps: { editor: initialEditor },
  });
  return { hook, injectToEditor };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('useModelInjection viewport re-centre', () => {
  it('fits the live editor after a large in-place modification, even from a first-render handler', async () => {
    vi.useFakeTimers();
    const { hook, injectToEditor } = setup(undefined);
    const firstRenderHandle = hook.result.current.handleInjection;

    const liveEditor = { fitView: vi.fn() };
    hook.rerender({ editor: liveEditor });

    await act(async () => {
      await firstRenderHandle({
        action: 'modify_model',
        diagramType: 'ClassDiagram',
        modifications: [
          { action: 'add_class', target: { className: 'B' }, changes: { className: 'B' } },
          { action: 'add_class', target: { className: 'C' }, changes: { className: 'C' } },
        ],
      } as any);
    });
    expect(injectToEditor).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(250);
    });
    expect(liveEditor.fitView).toHaveBeenCalledTimes(1);
  });

  it('does not re-centre after a small local modification', async () => {
    vi.useFakeTimers();
    const liveEditor = { fitView: vi.fn() };
    const { hook } = setup(liveEditor);

    await act(async () => {
      await hook.result.current.handleInjection({
        action: 'modify_model',
        diagramType: 'ClassDiagram',
        modifications: [
          { action: 'add_attribute', target: { className: 'A' }, changes: { name: 'x', type: 'str' } },
        ],
      } as any);
    });
    await act(async () => {
      vi.advanceTimersByTime(250);
    });
    expect(liveEditor.fitView).not.toHaveBeenCalled();
  });

  it('is a silent no-op on an editor build without fitView', async () => {
    vi.useFakeTimers();
    const { hook } = setup({});
    await act(async () => {
      await hook.result.current.handleInjection({
        action: 'modify_model',
        diagramType: 'ClassDiagram',
        modifications: [
          { action: 'add_class', target: { className: 'B' }, changes: { className: 'B' } },
          { action: 'add_class', target: { className: 'C' }, changes: { className: 'C' } },
        ],
      } as any);
    });
    expect(() => vi.advanceTimersByTime(250)).not.toThrow();
  });
});
