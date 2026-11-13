import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { UMLModel } from '@besser/wme';
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks';
import { bpmnModelToComponentModel } from '../bpmn-to-component';
import { useGenerateDeploymentDiagram } from '../useGenerateDeploymentDiagram';
import minimalAgentic from './fixtures/minimal-agentic.json';

vi.mock('../../../app/store/hooks', () => ({
  useAppDispatch: vi.fn(),
  useAppSelector: vi.fn(),
}));

vi.mock('../../../app/store/workspaceSlice', () => ({
  addDiagramThunk: (payload: unknown) => ({ type: 'addDiagram', payload }),
  bumpEditorRevision: () => ({ type: 'bumpEditorRevision' }),
  setElementLineageThunk: (payload: unknown) => ({ type: 'setElementLineage', payload }),
  switchDiagramTypeThunk: (payload: unknown) => ({ type: 'switchDiagramType', payload }),
  updateDiagramModelThunk: (payload: unknown) => ({ type: 'updateDiagramModel', payload }),
}));

describe('useGenerateDeploymentDiagram', () => {
  it('stamps the swarm size of the source BPMN lane on the derived Artifact', async () => {
    const bpmn = structuredClone(minimalAgentic) as unknown as UMLModel;
    bpmn.nodes = bpmn.nodes.map((n) => (n.id === 'lane-worker' ? { ...n, data: { ...n.data, multiplicity: 3 } } : n));
    const component = bpmnModelToComponentModel(bpmn);
    if (!component.ok) throw new Error('component derivation refused');

    const actions: Array<{ type: string; payload?: unknown }> = [];
    const dispatch = vi.fn((action: { type: string; payload?: unknown }) => {
      actions.push(action);
      const result = action.type === 'addDiagram' ? { diagram: { id: 'deployment-1' } } : action;
      return { unwrap: () => Promise.resolve(result) };
    });
    const componentDiagram = {
      id: 'cmp',
      title: 'Components',
      model: component.model,
      derivedFrom: { sourceDiagramId: 'bpmn' },
    };
    const state = {
      workspace: {
        activeDiagramType: 'ComponentDiagram',
        activeDiagram: componentDiagram,
        project: {
          diagrams: { BPMN: [{ id: 'bpmn', model: bpmn }] },
          elementLineage: { cmp: component.elementMapping },
        },
      },
    };
    vi.mocked(useAppDispatch).mockReturnValue(dispatch as unknown as ReturnType<typeof useAppDispatch>);
    vi.mocked(useAppSelector).mockImplementation((selector) =>
      selector(state as unknown as Parameters<typeof selector>[0]),
    );

    const { result } = renderHook(() => useGenerateDeploymentDiagram());
    let outcome: Awaited<ReturnType<typeof result.current>> | undefined;
    await act(async () => {
      outcome = await result.current();
    });

    expect(outcome?.ok).toBe(true);
    const stored = actions.find((a) => a.type === 'updateDiagramModel')?.payload as { model: UMLModel };
    const artifacts = stored.model.nodes.filter((n) => n.type === 'deploymentArtifact').map((n) => n.data.name);
    expect(artifacts.sort()).toEqual(['Manager', 'Worker [3]']);
  });
});
