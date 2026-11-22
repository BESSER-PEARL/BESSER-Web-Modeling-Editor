import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ModelModification } from '../../services';
import { useModelInjection } from '../useModelInjection';
import { ComponentDiagramConverter } from '../../services/converters/ComponentDiagramConverter';
import { DeploymentDiagramConverter } from '../../services/converters/DeploymentDiagramConverter';

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

interface TaggedAction {
  type: string;
  payload?: { model?: { type: string; elements: Record<string, { type: string; name: string }> } };
}

const renderInjection = (diagramType: string, currentModel: unknown) => {
  const dispatched: TaggedAction[] = [];
  const dispatch = vi.fn((action: TaggedAction) => {
    dispatched.push(action);
    return { unwrap: () => Promise.resolve(action) };
  });
  const setMessages = vi.fn();
  const { result } = renderHook(() =>
    useModelInjection({
      dispatch: dispatch as unknown as Parameters<typeof useModelInjection>[0]['dispatch'],
      editor: null,
      modelingServiceRef: { current: null },
      currentModelRef: { current: currentModel },
      currentProjectRef: { current: null },
      currentDiagramTypeRef: { current: diagramType },
      switchDiagramRef: { current: () => Promise.resolve(true) },
      setMessages,
      setMessageMeta: vi.fn(),
      setProgressMessage: vi.fn(),
    }),
  );
  const appliedModel = () => dispatched.find((a) => a.type === 'updateDiagramModel')?.payload?.model;
  return { result, appliedModel, setMessages };
};

const elementNames = (model: { elements: Record<string, { type: string; name: string }> } | undefined, type: string) =>
  Object.values(model?.elements ?? {})
    .filter((el) => el.type === type)
    .map((el) => el.name);

describe('useModelInjection for Component and Deployment diagrams', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('injects a complete Component diagram', async () => {
    const { result, appliedModel } = renderInjection('ComponentDiagram', null);
    await act(async () => {
      await result.current.handleInjection({
        action: 'inject_complete_system',
        message: 'Done.',
        diagramType: 'ComponentDiagram',
        systemSpec: {
          subsystems: [{ id: 's1', name: 'Core' }],
          components: [{ id: 'c1', name: 'Planner', owner: 's1', stereotype: 'solution' }],
          dependencies: [],
        },
      });
    });

    expect(appliedModel()?.type).toBe('ComponentDiagram');
    expect(elementNames(appliedModel(), 'Component')).toEqual(['Planner']);
  });

  it('modifies a Component diagram', async () => {
    const current = new ComponentDiagramConverter().convertCompleteSystem({
      subsystems: [],
      components: [{ id: 'c1', name: 'Planner', owner: null }],
      dependencies: [],
    });
    const { result, appliedModel } = renderInjection('ComponentDiagram', current);
    const modification: ModelModification = {
      action: 'add_component',
      target: { elementName: 'Reviewer' },
      changes: { stereotype: 'supervision' },
    };
    await act(async () => {
      await result.current.handleInjection({
        action: 'modify_model',
        message: 'Done.',
        diagramType: 'ComponentDiagram',
        modifications: [modification],
      });
    });

    expect(elementNames(appliedModel(), 'Component').sort()).toEqual(['Planner', 'Reviewer']);
  });

  it('injects a complete Deployment diagram', async () => {
    const { result, appliedModel } = renderInjection('DeploymentDiagram', null);
    await act(async () => {
      await result.current.handleInjection({
        action: 'inject_complete_system',
        message: 'Done.',
        diagramType: 'DeploymentDiagram',
        systemSpec: {
          nodes: [{ id: 'n1', name: 'Server', stereotype: 'node' }],
          artifacts: [{ id: 'a1', name: 'planner.jar', owner: 'n1' }],
          deployComponents: [],
          dependencies: [],
        },
      });
    });

    expect(appliedModel()?.type).toBe('DeploymentDiagram');
    expect(elementNames(appliedModel(), 'DeploymentNode')).toEqual(['Server']);
  });

  it('modifies a Deployment diagram', async () => {
    const current = new DeploymentDiagramConverter().convertCompleteSystem({
      nodes: [{ id: 'n1', name: 'Server', stereotype: 'node' }],
      artifacts: [],
      deployComponents: [],
      dependencies: [],
    });
    const { result, appliedModel } = renderInjection('DeploymentDiagram', current);
    const modification: ModelModification = {
      action: 'add_node',
      target: { elementName: 'Database host' },
      changes: {},
    };
    await act(async () => {
      await result.current.handleInjection({
        action: 'modify_model',
        message: 'Done.',
        diagramType: 'DeploymentDiagram',
        modifications: [modification],
      });
    });

    expect(elementNames(appliedModel(), 'DeploymentNode').sort()).toEqual(['Database host', 'Server']);
  });
});
