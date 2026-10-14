import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApollonEditor, UMLModel } from '@besser/wme';
import { toast } from 'react-toastify';
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks';
import { ProjectStorageRepository } from '../../../shared/services/storage/ProjectStorageRepository';
import { BesserProject, createDefaultProject } from '../../../shared/types/project';
import { hashUmlModel } from '../../../shared/utils/lineageHash';
import { useAgentDiagramLinker } from '../useAgentDiagramLinker';
import minimalAgentic from './fixtures/minimal-agentic.json';

vi.mock('../../../app/store/hooks', () => ({
  useAppDispatch: vi.fn(),
  useAppSelector: vi.fn(),
}));

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), warn: vi.fn(), warning: vi.fn(), success: vi.fn() },
}));

interface TaggedAction {
  type: string;
  payload?: unknown;
}

vi.mock('../../../app/store/workspaceSlice', () => ({
  addDiagramThunk: (payload: unknown) => ({ type: 'addDiagram', payload }),
  bumpEditorRevision: () => ({ type: 'bumpEditorRevision' }),
  openDiagramThunk: (payload: unknown) => ({ type: 'openDiagram', payload }),
  refreshProjectStateThunk: () => ({ type: 'refreshProjectState' }),
  setElementLineageThunk: (payload: unknown) => ({ type: 'setElementLineage', payload }),
  switchDiagramTypeThunk: (payload: unknown) => ({ type: 'switchDiagramType', payload }),
  updateDiagramModelThunk: (payload: unknown) => ({ type: 'updateDiagramModel', payload }),
  selectActiveDiagram: (state: { workspace: { activeDiagram: unknown } }) => state.workspace.activeDiagram,
  selectActiveDiagramType: (state: { workspace: { activeDiagramType: unknown } }) => state.workspace.activeDiagramType,
}));

const bpmnModel = minimalAgentic as unknown as UMLModel;
const laneId = Object.values(bpmnModel.elements).find((el) => el.type === 'BPMNSwimlane')!.id;

let project: BesserProject;
let failingActions: Set<string>;
let dispatched: TaggedAction[];

const setup = () => {
  project = createDefaultProject('P', '', '');
  project.diagrams.BPMN[0].model = bpmnModel;
  vi.spyOn(ProjectStorageRepository, 'getCurrentProject').mockImplementation(() => project);
  vi.spyOn(ProjectStorageRepository, 'saveProject').mockImplementation((saved) => {
    project = saved;
  });

  const dispatch = vi.fn((action: TaggedAction) => {
    dispatched.push(action);
    let result: unknown = action;
    if (action.type === 'addDiagram') {
      const diagram = { ...project.diagrams.AgentDiagram[0], id: 'agent-new' };
      project.diagrams.AgentDiagram.push(diagram);
      result = { diagram, index: project.diagrams.AgentDiagram.length - 1 };
    }
    const outcome = failingActions.has(action.type)
      ? Promise.reject(new Error(`${action.type} failed`))
      : Promise.resolve(result);
    return { unwrap: () => outcome };
  });
  vi.mocked(useAppDispatch).mockReturnValue(dispatch as unknown as ReturnType<typeof useAppDispatch>);
  const state = { workspace: { activeDiagramType: 'BPMN', activeDiagram: project.diagrams.BPMN[0] } };
  vi.mocked(useAppSelector).mockImplementation((selector) =>
    selector(state as unknown as Parameters<typeof selector>[0]),
  );

  const editor = { model: bpmnModel } as unknown as ApollonEditor;
  return renderHook(() => useAgentDiagramLinker({ current: editor }));
};

describe('useAgentDiagramLinker.createForLane', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    failingActions = new Set();
    dispatched = [];
  });

  it('flushes the editor before deriving and links the lane with a post-link lineage hash', async () => {
    const { result } = setup();
    let created: string | null = null;
    await act(async () => {
      created = await result.current.createForLane('Agent', laneId);
    });

    expect(created).toBe('agent-new');
    expect(dispatched.map((a) => a.type)).toEqual([
      'updateDiagramModel',
      'addDiagram',
      'refreshProjectState',
      'switchDiagramType',
      'updateDiagramModel',
      'setElementLineage',
      'bumpEditorRevision',
    ]);
    const linkedBpmn = project.diagrams.BPMN[0].model as UMLModel;
    expect(linkedBpmn.elements[laneId]).toMatchObject({ agentDiagramRef: 'agent-new' });
    const agent = project.diagrams.AgentDiagram.find((d) => d.id === 'agent-new');
    expect(agent?.derivedFrom?.sourceModelHash).toBe(hashUmlModel(linkedBpmn));
  });

  it('stops before writing any model when the switch to the Agent diagram fails', async () => {
    failingActions.add('switchDiagramType');
    const { result } = setup();
    let created: string | null = 'unset';
    await act(async () => {
      created = await result.current.createForLane('Agent', laneId);
    });

    expect(created).toBeNull();
    const types = dispatched.map((a) => a.type);
    expect(types.slice(types.indexOf('switchDiagramType'))).toEqual(['switchDiagramType']);
    expect(toast.error).toHaveBeenCalled();
  });

  it('does not create a diagram when the editor flush fails', async () => {
    failingActions.add('updateDiagramModel');
    const { result } = setup();
    await act(async () => {
      await result.current.createForLane('Agent', laneId);
    });

    expect(dispatched.map((a) => a.type)).toEqual(['updateDiagramModel']);
    expect(toast.error).toHaveBeenCalled();
  });
});
