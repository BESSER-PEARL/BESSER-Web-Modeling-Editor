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

const bookSelling = {
  action: 'inject_complete_system' as const,
  message: 'Built the Book Selling Process.',
  diagramType: 'BPMN',
  systemSpec: {
    nodes: [
      { id: 'start', type: 'start', name: 'Customer arrives' },
      { id: 'pay', type: 'task', name: 'Take payment' },
    ],
    flows: [{ source: 'start', target: 'pay' }],
  },
};

/** The open diagram is `openType`; `landsOn` is where the switch ends up. */
const renderFromClassDiagram = (landsOn: string, openType = 'ClassDiagram') => {
  const dispatched: Array<{ type: string; payload?: { model?: { type: string } } }> = [];
  const dispatch = vi.fn((action: (typeof dispatched)[number]) => {
    dispatched.push(action);
    return { unwrap: () => Promise.resolve(action) };
  });
  const currentDiagramTypeRef = { current: openType as string | undefined };
  const setMessages = vi.fn();
  const { result } = renderHook(() =>
    useModelInjection({
      dispatch: dispatch as unknown as Parameters<typeof useModelInjection>[0]['dispatch'],
      editor: null,
      modelingServiceRef: { current: null },
      currentModelRef: { current: { type: 'ClassDiagram', elements: {}, relationships: {} } },
      currentProjectRef: { current: null },
      currentDiagramTypeRef,
      switchDiagramRef: {
        current: async () => {
          currentDiagramTypeRef.current = landsOn;
          return true;
        },
      },
      setMessages,
      setMessageMeta: vi.fn(),
      setProgressMessage: vi.fn(),
    }),
  );
  const written = () => dispatched.filter((a) => a.type === 'updateDiagramModel');
  return { result, written, setMessages };
};

describe('useModelInjection target diagram', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes a generated BPMN model once the BPMN diagram is open', async () => {
    const { result, written } = renderFromClassDiagram('BPMN');
    await act(async () => {
      await result.current.handleInjection(bookSelling);
    });
    expect(written()).toHaveLength(1);
    expect(written()[0].payload?.model?.type).toBe('BPMNDiagram');
  });

  // Issue #653: the switch ended on the class diagram and the BPMN model replaced it.
  it('does not overwrite the open diagram when the switch lands elsewhere', async () => {
    const { result, written, setMessages } = renderFromClassDiagram('ClassDiagram');
    await act(async () => {
      await result.current.handleInjection(bookSelling);
    });
    expect(written()).toHaveLength(0);
    const added = setMessages.mock.calls.map(([update]) => (typeof update === 'function' ? update([]) : update)).flat();
    expect(added.some((m: { isError?: boolean }) => m.isError)).toBe(true);
  });

  it('never writes into an open Knowledge Graph, which it has no converter or modifier for', async () => {
    const { result, written, setMessages } = renderFromClassDiagram('KnowledgeGraphDiagram', 'KnowledgeGraphDiagram');
    await act(async () => {
      await result.current.handleInjection({
        action: 'inject_complete_system',
        message: 'Here is your model.',
        model: { type: 'ClassDiagram', elements: {}, relationships: {} },
      } as unknown as Parameters<typeof result.current.handleInjection>[0]);
    });
    expect(written()).toHaveLength(0);
    const added = setMessages.mock.calls.map(([update]) => (typeof update === 'function' ? update([]) : update)).flat();
    expect(added.some((m: { isError?: boolean }) => m.isError)).toBe(true);
  });

  it('still builds another diagram the user asks for while a Knowledge Graph is open', async () => {
    const { result, written } = renderFromClassDiagram('BPMN', 'KnowledgeGraphDiagram');
    await act(async () => {
      await result.current.handleInjection(bookSelling);
    });
    expect(written()).toHaveLength(1);
    expect(written()[0].payload?.model?.type).toBe('BPMNDiagram');
  });
});
