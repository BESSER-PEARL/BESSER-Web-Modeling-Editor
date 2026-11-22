import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UMLModel } from '@besser/wme';
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks';
import { addDiagramThunk } from '../../../app/store/workspaceSlice';
import { MODEL_GENERATORS } from '../../../shared/traceability/traceStore';
import { bpmnModelToComponentModel } from '../bpmn-to-component';
import { useGenerateComponentDiagram } from '../useGenerateComponentDiagram';
import minimalAgentic from './fixtures/minimal-agentic.json';

vi.mock('../../../app/store/hooks', () => ({
  useAppDispatch: vi.fn(),
  useAppSelector: vi.fn(),
}));

vi.mock('../bpmn-to-component', () => ({ bpmnModelToComponentModel: vi.fn() }));

vi.mock('../../../app/store/workspaceSlice', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../app/store/workspaceSlice')>()),
  addDiagramThunk: vi.fn((arg: unknown) => ({ type: 'addDiagram', arg })),
}));

describe('useGenerateComponentDiagram', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates the derived diagram as the derivation, not as the user', async () => {
    // Live: an empty Pizza Store derivation was recorded as the user's modeling session.
    const dispatch = vi.fn(() => ({ unwrap: async () => ({ diagram: { id: 'cp' }, index: 0 }) }));
    const state = { workspace: { activeDiagramType: 'BPMN', activeDiagram: { id: 'bpmn', title: 'Pizza', model: minimalAgentic }, project: { diagrams: {} } } };
    vi.mocked(useAppDispatch).mockReturnValue(dispatch as never);
    vi.mocked(useAppSelector).mockImplementation((selector) => selector(state as unknown as Parameters<typeof selector>[0]));
    vi.mocked(bpmnModelToComponentModel).mockReturnValue({
      ok: true, model: { elements: {}, relationships: {} } as unknown as UMLModel, elementMapping: {}, warnings: [],
    } as unknown as ReturnType<typeof bpmnModelToComponentModel>);

    const { result } = renderHook(() => useGenerateComponentDiagram());
    await act(async () => { await result.current(); });

    expect(vi.mocked(addDiagramThunk)).toHaveBeenCalledWith(
      expect.objectContaining({ diagramType: 'ComponentDiagram', traceSource: { generator: MODEL_GENERATORS.bpmnToComponent } }),
    );
  });

  it('passes the saved per-agent default LLM name to capability derivation', async () => {
    const model = {
      version: '3.0.0', type: 'AgentDiagram', size: { width: 800, height: 600 },
      elements: {}, relationships: {}, interactive: { elements: {}, relationships: {} }, assessments: {},
      components: { llm: { id: 'llm', type: 'AgentLLM', name: 'gpt-6-luna', owner: null } },
    } as unknown as UMLModel;
    const dispatch = vi.fn();
    const state = {
      workspace: {
        activeDiagramType: 'BPMN',
        activeDiagram: { id: 'bpmn', model: minimalAgentic },
        project: { diagrams: { AgentDiagram: [
          { id: 'agent-1', model, agentConfigForm: { default_llm_name: 'gpt-6-luna' } },
        ] } },
      },
    };
    vi.mocked(useAppDispatch).mockReturnValue(dispatch);
    vi.mocked(useAppSelector).mockImplementation((selector) =>
      selector(state as unknown as Parameters<typeof selector>[0]));
    vi.mocked(bpmnModelToComponentModel).mockReturnValue({ ok: false, reason: 'no-pools', warnings: [] });

    const { result } = renderHook(() => useGenerateComponentDiagram());
    await act(async () => { await result.current(); });

    const options = vi.mocked(bpmnModelToComponentModel).mock.calls[0][1]!;
    expect(options.defaultLlmNamesByAgentId?.get('agent-1')).toBe('gpt-6-luna');
    expect(options.agentDiagramsById?.get('agent-1')?.components?.llm.name).toBe('gpt-6-luna');
    expect(dispatch).not.toHaveBeenCalled();
  });
});
