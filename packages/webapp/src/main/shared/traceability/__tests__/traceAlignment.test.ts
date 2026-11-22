/**
 * What the editor records is aligned with what the backend builds: elements with no backend counterpart are history
 * only (never a gap in the coverage), and a trace an earlier version recorded differently is brought in line with
 * the diagram's next recorded edit, without duplicate artifacts for one element.
 */
import { describe, expect, it } from 'vitest';
import { alignDiagramArtifacts, diffDiagramModel, snapshotDiagramModel } from '../diagramModelDiff';
import { recordElementChanges } from '../traceRecorder';
import { coverageMatrix, indexTrace, isDeleted } from '../traceQueries';
import { emptyTraceFile, isModelArtifact } from '../../types/traceability';
import type { ModelArtifact, TraceFile } from '../../types/traceability';

const now = (minute: number) => new Date(Date.UTC(2026, 10, 1, 10, minute)).toISOString();
const el = (id: string, type: string, name = '', extra: Record<string, unknown> = {}) => ({ id, type, name, owner: null, ...extra });
const rel = (id: string, type: string, source: string, target: string) => ({ id, type, name: '', source: { element: source }, target: { element: target } });
const agentModel = (stateType = 'standard', action = 'Hello') => ({
  elements: {
    init: el('init', 'StateInitialNode'),
    s: el('s', 'AgentState', 'Greet', { stateType }),
    b: el('b', 'AgentStateBody', action, { owner: 's' }),
  },
  relationships: { t0: rel('t0', 'AgentStateTransitionInit', 'init', 's') },
});
const ctx = (minute: number) => ({ diagramId: 'ag', diagramTitle: 'Bot', modelType: 'Agent', actorName: 'Ada', source: 'user' as const, now: now(minute) });
const artifactsOf = (trace: TraceFile, elementId: string) =>
  trace.artifacts.filter((a): a is ModelArtifact => isModelArtifact(a) && a.elementId === elementId);

/** What an earlier version recorded for the agent above: the action as a `Body`, the init transition as a `Transition`. */
function legacyTrace(): TraceFile {
  const trace = emptyTraceFile('p');
  recordElementChanges(trace, [
    { kind: 'CREATED', elementId: 's', elementType: 'AgentState', name: 'Greet', parentElementId: null, newValue: 'Greet' },
    { kind: 'CREATED', elementId: 'b', elementType: 'Body', name: 'Hello', parentElementId: 's', newValue: 'Hello', parent: { elementType: 'AgentState', name: 'Greet' } },
    { kind: 'CREATED', elementId: 't0', elementType: 'Transition', name: '? → Greet', parentElementId: null, newValue: '? → Greet' },
  ], ctx(0));
  return trace;
}

describe('a trace recorded by an earlier version', () => {
  it('is brought in line with the diagram’s next edit: relabelled, and what is no longer traced deleted', () => {
    const trace = legacyTrace();
    const before = snapshotDiagramModel('AgentDiagram', agentModel(), 'ag');
    const after = snapshotDiagramModel('AgentDiagram', agentModel('reasoning', 'Hi'), 'ag');
    const changes = diffDiagramModel('AgentDiagram', agentModel(), agentModel('reasoning', 'Hi'), 'ag');
    recordElementChanges(trace, [...changes, ...alignDiagramArtifacts(trace, 'ag', after, before)], ctx(60));
    const index = indexTrace(trace);
    expect(artifactsOf(trace, 's')).toHaveLength(1);
    expect(artifactsOf(trace, 's')[0].elementType).toBe('ReasoningState');
    expect(isDeleted(index, artifactsOf(trace, 's')[0].id)).toBe(false);
    expect(isDeleted(index, artifactsOf(trace, 'b')[0].id)).toBe(true);
    expect(isDeleted(index, artifactsOf(trace, 't0')[0].id)).toBe(true);
    // In line now: the next edit finds nothing more to align.
    expect(alignDiagramArtifacts(trace, 'ag', after, after)).toEqual([]);
  });

  it('leaves the model artifacts a generation’s trace brought alone', () => {
    const trace = legacyTrace();
    const root = artifactsOf(trace, 'ag')[0];
    trace.artifacts.push({ id: 'backend', type: 'ModelArtifact', name: 'Greet_body', elementId: 'backend-only', elementType: 'Body', parentId: root.id, timestamp: now(1) });
    const snapshot = snapshotDiagramModel('AgentDiagram', agentModel(), 'ag');
    expect(alignDiagramArtifacts(trace, 'ag', snapshot, snapshot).map((c) => c.elementId).sort()).toEqual(['b', 't0']);
  });
});

describe('elements with no backend counterpart', () => {
  it('are no rows of the coverage; the gates of a circuit’s qubits are', () => {
    const trace = emptyTraceFile('p');
    const circuit = { cols: [['H', '•']], initialStates: ['0', '0'] };
    recordElementChanges(trace, diffDiagramModel('QuantumCircuitDiagram', undefined, circuit, 'qc'),
      { diagramId: 'qc', diagramTitle: 'Circuit', modelType: 'QuantumCircuit', actorName: 'Ada', source: 'user', now: now(0) });
    trace.operations.push({ id: 'g', type: 'CodeGeneration', status: 'SUCCEEDED', startedAt: now(5), performedBy: [], toolCalls: [], reads: [], writes: [] });
    const gate = artifactsOf(trace, 'qc:gate:0:0')[0];
    trace.traceLinks.push({ id: 'l', sourceId: gate.id, targetId: gate.id, operationId: 'g', timestamp: now(5), evidence: [] });
    const [group] = coverageMatrix(indexTrace(trace), 5).groups;
    expect(group.elements.map((row) => row.element.elementType)).toEqual(['HadamardGate']);
  });
});
