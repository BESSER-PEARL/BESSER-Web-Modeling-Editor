/**
 * A model update the editor cannot apply is handed to `onModelApplyFailed`
 * first: an auto-fix repair reports it on its own status line, and the
 * generic "Try rephrasing your request" reply is for a request the user wrote.
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useModelInjection } from '../useModelInjection';

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn() },
}));

vi.mock('../../../../app/store/workspaceSlice', () => ({
  updateDiagramModelThunk: Object.assign((payload: unknown) => ({ type: 'updateDiagramModel', payload }), {
    rejected: { match: () => false },
  }),
  switchDiagramIndexThunk: (payload: unknown) => ({ type: 'switchDiagramIndex', payload }),
  addDiagramThunk: (payload: unknown) => ({ type: 'addDiagram', payload }),
  bumpEditorRevision: () => ({ type: 'bumpEditorRevision' }),
}));

// Every op is unsupported, so nothing applies and the injection fails.
const unappliable = {
  action: 'modify_model' as const,
  message: 'Renamed first-name.',
  diagramType: 'ClassDiagram',
  modifications: [{ action: 'not_a_real_action', target: { className: 'Person' }, changes: {} }],
  turnId: 'turn_2',
};

function render(onModelApplyFailed?: (info: { action: string; diagramType?: string; turnId?: string }) => boolean) {
  const setMessages = vi.fn();
  const { result } = renderHook(() =>
    useModelInjection({
      dispatch: vi.fn(() => ({ unwrap: () => Promise.resolve() })) as unknown as Parameters<
        typeof useModelInjection
      >[0]['dispatch'],
      editor: null,
      modelingServiceRef: { current: null },
      currentModelRef: { current: { type: 'ClassDiagram', elements: {}, relationships: {} } },
      currentProjectRef: { current: null },
      currentDiagramTypeRef: { current: 'ClassDiagram' },
      switchDiagramRef: { current: async () => true },
      setMessages,
      setMessageMeta: vi.fn(),
      setProgressMessage: vi.fn(),
      onModelApplyFailed,
    }),
  );
  const added = () =>
    setMessages.mock.calls.map(([update]) => (typeof update === 'function' ? update([]) : update)).flat();
  return { result, added };
}

describe('useModelInjection when the update cannot be applied', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lets onModelApplyFailed report it instead of the generic reply', async () => {
    const onModelApplyFailed = vi.fn(() => true);
    const { result, added } = render(onModelApplyFailed);
    await act(async () => {
      await result.current.handleInjection(unappliable);
    });
    expect(onModelApplyFailed).toHaveBeenCalledWith({
      action: 'modify_model',
      diagramType: 'ClassDiagram',
      turnId: 'turn_2',
    });
    expect(added().some((m: { content?: string }) => m.content?.includes('Try rephrasing'))).toBe(false);
  });

  it('keeps the generic reply when the failure is not reported elsewhere', async () => {
    const { result, added } = render(() => false);
    await act(async () => {
      await result.current.handleInjection(unappliable);
    });
    const reply = added().find((m: { content?: string }) => m.content?.includes('Try rephrasing'));
    expect(reply?.isError).toBe(true);
  });
});
