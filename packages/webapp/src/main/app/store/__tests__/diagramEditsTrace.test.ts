import { beforeEach, describe, expect, it } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import {
  addDiagramThunk,
  createProjectThunk,
  setElementLineageThunk,
  setTraceabilityEnabledThunk,
  switchDiagramTypeThunk,
  updateDiagramModelThunk,
  updateQuantumDiagramThunk,
  workspaceReducer,
} from '../workspaceSlice';
import { flushTraceSaves, loadProjectTrace, MODEL_GENERATORS, setTraceStorage } from '../../../shared/traceability/traceStore';
import { memoryTraceStorage } from '../../../shared/traceability/traceDatabase';
import { isModelArtifact, isModelingSession } from '../../../shared/types/traceability';
import type { TraceFile } from '../../../shared/types/traceability';

const bounds = { x: 0, y: 0, width: 10, height: 10 };
const apollon = (type: string, elements: Array<{ id: string; type: string; name: string; owner?: string | null }>) => ({
  version: '3.0.0', type, size: { width: 0, height: 0 }, interactive: { elements: {}, relationships: {} },
  elements: Object.fromEntries(elements.map((e) => [e.id, { owner: null, bounds, ...e }])), relationships: {}, assessments: {},
});

async function recordingProject() {
  const store = configureStore({ reducer: { workspace: workspaceReducer } });
  await store.dispatch(createProjectThunk({ name: 'Shop', description: '', owner: 'Ada' })).unwrap();
  await store.dispatch(setTraceabilityEnabledThunk(true)).unwrap();
  return { store, projectId: store.getState().workspace.project!.id };
}

async function trace(projectId: string): Promise<TraceFile> {
  await flushTraceSaves();
  return loadProjectTrace(projectId);
}

const sessionTools = (t: TraceFile) =>
  t.operations.filter(isModelingSession).map((o) => o.toolCalls.map((c) => t.tools.find((tool) => tool.id === c.toolId)!.name));

describe('the workspace store records edits of every diagram type', () => {
  beforeEach(() => {
    localStorage.clear();
    setTraceStorage(memoryTraceStorage());
  });

  it('records a state machine edit made on the canvas', async () => {
    const { store, projectId } = await recordingProject();
    await store.dispatch(switchDiagramTypeThunk({ diagramType: 'StateMachineDiagram' })).unwrap();
    await store.dispatch(updateDiagramModelThunk({ model: apollon('StateMachineDiagram', [{ id: 's1', type: 'State', name: 'Idle' }]) as never })).unwrap();
    const t = await trace(projectId);
    expect(t.artifacts.find((a) => isModelArtifact(a) && a.elementId === 's1')).toMatchObject({ elementType: 'State', name: 'Idle' });
  });

  it('records a template written through the store as the template library’s, and a user undo as the user’s', async () => {
    const { store, projectId } = await recordingProject();
    const shop = apollon('ClassDiagram', [{ id: 'c1', type: 'Class', name: 'Order' }]);
    await store.dispatch(updateDiagramModelThunk({ model: shop as never, traceSource: { generator: MODEL_GENERATORS.template } })).unwrap();
    await store.dispatch(updateDiagramModelThunk({ model: apollon('ClassDiagram', []) as never, traceSource: 'user' })).unwrap();
    const t = await trace(projectId);
    expect(sessionTools(t)).toEqual([[MODEL_GENERATORS.template], ['BESSER Web Modeling Editor']]);
    const sessions = t.operations.filter(isModelingSession);
    expect(sessions[1].performedBy).toHaveLength(1); // the user alone: an undo is not the assistant's edit
  });

  it('records a quantum circuit written through the store', async () => {
    const { store, projectId } = await recordingProject();
    await store.dispatch(updateQuantumDiagramThunk({ model: { cols: [['H']], gates: [] } })).unwrap();
    const t = await trace(projectId);
    expect(t.artifacts.some((a) => isModelArtifact(a) && a.elementType === 'HadamardGate')).toBe(true);
  });

  it('records a derivation and links its elements through the element lineage', async () => {
    const { store, projectId } = await recordingProject();
    await store.dispatch(switchDiagramTypeThunk({ diagramType: 'BPMNDiagram' })).unwrap();
    await store.dispatch(updateDiagramModelThunk({ model: apollon('BPMNDiagram', [{ id: 'task', type: 'BPMNTask', name: 'Pay' }]) as never })).unwrap();
    const bpmnId = store.getState().workspace.project!.diagrams.BPMN[0].id;
    const generator = MODEL_GENERATORS.bpmnToComponent;
    const added = await store.dispatch(addDiagramThunk({
      diagramType: 'ComponentDiagram', title: 'Components',
      derivedFrom: { sourceDiagramId: bpmnId, sourceDiagramType: 'BPMN', derivationKind: 'bpmn-to-component', derivedAt: '', sourceModelHash: '' },
    })).unwrap();
    await store.dispatch(switchDiagramTypeThunk({ diagramType: 'ComponentDiagram' })).unwrap();
    await store.dispatch(updateDiagramModelThunk({
      model: apollon('ComponentDiagram', [{ id: 'comp', type: 'Component', name: 'Payment' }]) as never, traceSource: { generator },
    })).unwrap();
    await store.dispatch(setElementLineageThunk({ derivedDiagramId: added.diagram.id, mapping: { comp: 'task' }, generator })).unwrap();
    const t = await trace(projectId);
    const idOf = (elementId: string) => t.artifacts.find((a) => isModelArtifact(a) && a.elementId === elementId)!.id;
    const link = t.traceLinks.find((l) => l.sourceId === idOf('task') && l.targetId === idOf('comp'));
    const session = t.operations.find((o) => o.id === link?.operationId)!;
    expect(session.toolCalls.map((c) => t.tools.find((tool) => tool.id === c.toolId)!.name)).toEqual([generator]);
  });
});
