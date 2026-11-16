import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DERIVATION_RULE,
  endAssistantConversation,
  flushTraceSaves,
  loadProjectTrace,
  MODEL_GENERATORS,
  readLlmUsage,
  recordAssistantReply,
  recordAssistantRequest,
  recordDiagramCreated,
  recordDiagramUpdate,
  recordElementLineage,
  recordGuiDiagramUpdate,
  recordSpecDrivenOutcome,
  setGuiBaseline,
  setTraceStorage,
  traceFileProblem,
  TURN_GRACE_MS,
} from '../traceStore';
import { memoryTraceStorage } from '../traceDatabase';
import {
  KEPT_GENERATION_RECORDS_PER_GENERATOR,
  KEPT_GENERATIONS_PER_GENERATOR,
  mergeTraceFragment,
  pruneOldGenerations,
  recordConversationReply,
  recordConversationRequest,
  recordSpecDrivenRun,
  SPEC_DRIVEN_AGENT_NAME,
  specDrivenOperationId,
  UNKNOWN_ASSISTANT_LLM_NAME,
} from '../traceRecorder';
import { downgradeTraceFile, migrateTraceFile } from '../traceMigration';
import { emptyTraceFile, isModelArtifact, TRACE_SCHEMA_VERSION } from '../../types/traceability';
import type { CodeArtifact, TraceFile, TraceOperation } from '../../types/traceability';
import type { BesserProject, ProjectDiagram } from '../../types/project';

const at = (second: number) => new Date(Date.UTC(2026, 10, 1, 10, 0, second)).toISOString();

const el = (id: string, type: string, name: string, owner: string | null = null) => ({ id, type, name, owner, bounds: { x: 0, y: 0, width: 1, height: 1 } });
const apollon = (...elements: ReturnType<typeof el>[]) => ({ elements: Object.fromEntries(elements.map((e) => [e.id, e])), relationships: {} });

function projectWith(diagrams: Partial<Record<string, ProjectDiagram[]>>, id = `p-${Math.random()}`): BesserProject {
  return { id, name: 'P', owner: 'Ada', settings: { traceabilityEnabled: true }, currentDiagramIndices: {}, diagrams } as unknown as BesserProject;
}

async function traceOf(project: BesserProject): Promise<TraceFile> {
  await flushTraceSaves();
  return loadProjectTrace(project.id);
}

const toolNamesOf = (trace: TraceFile, operation: TraceOperation) =>
  operation.toolCalls.map((call) => trace.tools.find((t) => t.id === call.toolId)!.name);

beforeEach(() => setTraceStorage(memoryTraceStorage()));
afterEach(() => vi.useRealTimers());

describe('recording edits of any diagram type', () => {
  it('records an object diagram edit as a session of the editor, under an ObjectModel', async () => {
    const diagram = { id: 'od', title: 'Objects', lastUpdate: at(0) } as ProjectDiagram;
    const project = projectWith({ ObjectDiagram: [diagram] });
    recordDiagramUpdate(project, 'ObjectDiagram', diagram, apollon(), apollon(el('o1', 'ObjectName', 'b : Book')), 'user');
    const trace = await traceOf(project);
    const root = trace.artifacts.find((a) => isModelArtifact(a) && a.elementId === 'od');
    expect(root).toMatchObject({ elementType: 'ObjectModel', name: 'Objects' });
    expect(trace.artifacts.find((a) => isModelArtifact(a) && a.elementId === 'o1')).toMatchObject({ elementType: 'Object', parentId: root!.id });
    expect(toolNamesOf(trace, trace.operations[0])).toEqual(['BESSER Web Modeling Editor']);
  });

  it('records a model generator’s write as its own session, not merged with the user’s next edit', async () => {
    const diagram = { id: 'sm', title: 'Flow', lastUpdate: at(0) } as ProjectDiagram;
    const project = projectWith({ StateMachineDiagram: [diagram] });
    const template = apollon(el('s1', 'State', 'Idle'));
    recordDiagramUpdate(project, 'StateMachineDiagram', diagram, apollon(), template, { generator: MODEL_GENERATORS.template });
    recordDiagramUpdate(project, 'StateMachineDiagram', diagram, template, apollon(el('s1', 'State', 'Ready')), 'user');
    const trace = await traceOf(project);
    expect(trace.operations.map((o) => toolNamesOf(trace, o))).toEqual([[MODEL_GENERATORS.template], ['BESSER Web Modeling Editor']]);
    expect(trace.tools.find((t) => t.name === MODEL_GENERATORS.template)?.type).toBe('ModelGenerator');
  });

  it('records the creation of a diagram', async () => {
    const diagram = { id: 'bp', title: 'Order', lastUpdate: at(0) } as ProjectDiagram;
    const project = projectWith({ BPMN: [diagram] });
    recordDiagramCreated(project, 'BPMN', diagram);
    const trace = await traceOf(project);
    const root = trace.artifacts.find((a) => isModelArtifact(a) && a.elementId === 'bp')!;
    expect(root).toMatchObject({ elementType: 'BPMNModel' });
    expect(trace.operations[0]).toMatchObject({ type: 'ModelingSession', changes: [expect.objectContaining({ kind: 'CREATED', artifactId: root.id })] });
  });

  it('links derived elements from their source elements (the element lineage) through the generator’s session', async () => {
    const bpmn = { id: 'bp', title: 'Order', lastUpdate: at(0), model: apollon(el('task', 'BPMNTask', 'Pay')) } as ProjectDiagram;
    const derivedModel = apollon(el('comp', 'Component', 'Payment'));
    const components = {
      id: 'cp', title: 'Order — Components', lastUpdate: at(0), model: derivedModel,
      derivedFrom: { sourceDiagramId: 'bp', sourceDiagramType: 'BPMN', derivationKind: 'bpmn-to-component', derivedAt: at(0), sourceModelHash: 'h' },
    } as ProjectDiagram;
    const project = projectWith({ BPMN: [bpmn], ComponentDiagram: [components] });
    const generator = MODEL_GENERATORS.bpmnToComponent;
    recordDiagramUpdate(project, 'ComponentDiagram', components, apollon(), derivedModel, { generator });
    recordElementLineage(project, 'cp', { comp: 'task' }, generator);
    const trace = await traceOf(project);
    const [session] = trace.operations;
    expect(toolNamesOf(trace, session)).toEqual([generator]);
    const task = trace.artifacts.find((a) => isModelArtifact(a) && a.elementId === 'task')!;
    const comp = trace.artifacts.find((a) => isModelArtifact(a) && a.elementId === 'comp')!;
    expect(task).toMatchObject({ elementType: 'Task' });
    expect(trace.traceLinks).toEqual([
      expect.objectContaining({ sourceId: task.id, targetId: comp.id, operationId: session.id, evidence: [expect.objectContaining({ rule: DERIVATION_RULE })] }),
    ]);
    expect(session.reads).toContain(task.id);
    recordElementLineage(project, 'cp', { comp: 'task' }, generator); // again: no second link
    expect((await traceOf(project)).traceLinks).toHaveLength(1);
  });

  it('links a generator’s elements from the source elements it names (a KG converted to a class diagram)', async () => {
    const kg = { id: 'kg', title: 'Graph', lastUpdate: at(0), model: { nodes: [{ id: 'n1', nodeType: 'class', label: 'Book' }], edges: [] } } as unknown as ProjectDiagram;
    const cd = { id: 'cd', title: 'Graph (classes)', lastUpdate: at(0) } as ProjectDiagram;
    const project = projectWith({ KnowledgeGraphDiagram: [kg], ClassDiagram: [cd] });
    const classes = { elements: { c: { id: 'c', type: 'Class', name: 'Book' } }, relationships: {} };
    recordDiagramUpdate(project, 'ClassDiagram', cd, undefined, classes, { generator: MODEL_GENERATORS.kgToClass, source: { diagramId: 'kg', elements: { c: 'n1' } } });
    const trace = await traceOf(project);
    const node = trace.artifacts.find((a) => isModelArtifact(a) && a.elementId === 'n1');
    expect(node).toMatchObject({ elementType: 'KGClass' });
    expect(trace.traceLinks).toEqual([expect.objectContaining({ sourceId: node!.id, evidence: [expect.objectContaining({ rule: DERIVATION_RULE })] })]);
  });
});

describe('the GUI baseline shared by the GUI editor and the store', () => {
  const page = (id: string, name: string) => ({ id, name, frames: [{ component: { type: 'wrapper', components: [] } }] });

  it('does not record an assistant’s GUI twice, nor give its changes to the user’s next save', async () => {
    const gui = { id: 'gui', title: 'GUI', lastUpdate: at(0) } as ProjectDiagram;
    const project = projectWith({ GUINoCodeDiagram: [gui] });
    setGuiBaseline('gui', { pages: [page('p1', 'Home')] });
    const assistant = { pages: [page('p1', 'Home'), page('p2', 'Books')] };
    recordGuiDiagramUpdate(project, gui, { pages: [page('p1', 'Home')] }, assistant, 'assistant'); // written through the store
    recordGuiDiagramUpdate(project, gui, undefined, assistant, 'assistant'); // the editor loads the same model
    recordGuiDiagramUpdate(project, gui, undefined, { pages: [page('p1', 'Home'), page('p2', 'Books'), page('p3', 'About')] }, 'user');
    const trace = await traceOf(project);
    const sessions = trace.operations.filter((o): o is Extract<TraceOperation, { type: 'ModelingSession' }> => o.type === 'ModelingSession');
    const created = sessions.map((s) => s.changes.filter((c) => c.kind === 'CREATED').map((c) => trace.artifacts.find((a) => a.id === c.artifactId)!.name));
    expect(created).toEqual([['Books'], ['About']]);
    expect(sessions.map((s) => s.performedBy.length)).toEqual([2, 1]); // the assistant's, then the user's alone
  });
});

describe('an assistant turn', () => {
  it('stops answering edits once it has been over for a while', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(at(0)));
    const diagram = { id: 'cd', title: 'Library', lastUpdate: at(0) } as ProjectDiagram;
    const project = projectWith({ ClassDiagram: [diagram] });
    await recordAssistantRequest(project, 'add a Book class');
    recordAssistantReply(project, 'answer', 'Done.');
    const book = { elements: { b: { id: 'b', type: 'Class', name: 'Book' } }, relationships: {} };
    recordDiagramUpdate(project, 'ClassDiagram', diagram, {}, book, 'assistant'); // part of the turn
    vi.setSystemTime(new Date(Date.parse(at(0)) + TURN_GRACE_MS + 1000));
    const author = { elements: { ...book.elements, a: { id: 'a', type: 'Class', name: 'Author' } }, relationships: {} };
    recordDiagramUpdate(project, 'ClassDiagram', diagram, book, author, 'assistant');
    const trace = await traceOf(project);
    const promptLinks = trace.traceLinks.filter((l) => trace.artifacts.find((a) => a.id === l.sourceId)?.type === 'PromptArtifact');
    expect(promptLinks.map((l) => trace.artifacts.find((a) => a.id === l.targetId)!.name)).toEqual(['Book']);
    endAssistantConversation(project);
  });

  it('files the turn under the model the agent reports, with its tokens, and keeps the latest totals', () => {
    const trace = emptyTraceFile('p');
    const { callId, logId } = recordConversationRequest(trace, 'hello', { actorName: 'Ada', now: at(0) });
    expect(trace.tools.map((t) => t.name)).toEqual([UNKNOWN_ASSISTANT_LLM_NAME]);
    trace.traceLinks.push({ id: 'l', sourceId: 's', targetId: 't', operationId: 'o', timestamp: at(1),
      evidence: [{ id: 'e', type: 'AIEvidence', algorithm: UNKNOWN_ASSISTANT_LLM_NAME, logIds: [logId], timestamp: at(1) }] });
    recordConversationReply(trace, 'answer', 'Hi!', at(2), { model: 'claude-x', provider: 'anthropic', inputTokens: 10, outputTokens: 5 });
    recordConversationReply(trace, 'answer', '', at(3), { model: 'claude-x', provider: 'anthropic', inputTokens: 12, outputTokens: 7 });
    const call = trace.operations[0].toolCalls.find((c) => c.id === callId)!;
    expect(trace.tools).toEqual([expect.objectContaining({ type: 'LLM', name: 'claude-x', provider: 'anthropic' })]);
    expect(call).toMatchObject({ toolId: trace.tools[0].id, inputTokens: 12, outputTokens: 7 });
    expect(call.logs.map((l) => l.content)).toEqual(['hello', 'Hi!']); // a usage-only reply adds no message
    expect(trace.traceLinks[0].evidence[0]).toMatchObject({ algorithm: 'claude-x' });
  });

  it('reads `llmUsage` field by field', () => {
    expect(readLlmUsage({ model: ' m ', provider: 'openai', inputTokens: 3.4, outputTokens: -1, extra: 1 })).toEqual({ model: 'm', provider: 'openai', inputTokens: 3 });
    expect(readLlmUsage({ provider: 'openai' })).toBeUndefined();
    expect(readLlmUsage('gpt')).toBeUndefined();
  });
});

describe('merging trace fragments', () => {
  const fragment = (runId: string): TraceFile => ({
    schemaVersion: TRACE_SCHEMA_VERSION, projectId: null,
    actors: [{ id: 'fa', type: 'Agent', name: SPEC_DRIVEN_AGENT_NAME, timestamp: at(0) }],
    tools: [
      { id: 'fl1', type: 'LLM', name: 'gpt-x', provider: 'openai', timestamp: at(0) },
      { id: 'fl2', type: 'LLM', name: 'gpt-x', provider: 'azure', timestamp: at(0) },
    ],
    artifacts: [
      { id: `${runId}-cd`, type: 'ModelArtifact', name: 'Library', elementId: 'cd', elementType: 'DomainModel', timestamp: at(0) },
      { id: `${runId}-gui`, type: 'ModelArtifact', name: 'GUI', elementId: 'gui', elementType: 'GUIModel', timestamp: at(0) },
      { id: 'req-1', type: 'RequirementArtifact', name: 'Books have titles', quote: 'titles', kind: 'data', timestamp: at(0) },
      { id: `${runId}-f`, type: 'CodeArtifact', name: 'app.py', path: 'app.py', contentHash: 'h', timestamp: at(0) },
    ],
    operations: [{ id: runId, type: 'CodeGeneration', status: 'SUCCEEDED', startedAt: at(0), performedBy: ['fa'],
      toolCalls: [{ id: `${runId}-c1`, toolId: 'fl1', sequenceNumber: 0, status: 'SUCCEEDED', startedAt: at(0), logs: [] },
        { id: `${runId}-c2`, toolId: 'fl2', sequenceNumber: 1, status: 'SUCCEEDED', startedAt: at(0), logs: [] }],
      reads: [`${runId}-cd`, `${runId}-gui`, 'req-1'], writes: [`${runId}-f`] }],
    traceLinks: [{ id: `${runId}-k`, sourceId: 'req-1', targetId: `${runId}-f`, operationId: runId, timestamp: at(0),
      evidence: [{ id: 'e', type: 'AIEvidence', algorithm: 'judge', timestamp: at(0) }] }],
  });

  it('joins the models and requirements the trace has, keeps a provider’s tools apart, and merges a replay once', () => {
    const trace = emptyTraceFile('p');
    trace.artifacts.push(
      { id: 'cd-root', type: 'ModelArtifact', name: 'Library', elementId: 'cd', elementType: 'DomainModel', timestamp: at(0) },
      { id: 'req-1', type: 'RequirementArtifact', name: 'Books have titles', quote: 'titles', kind: 'data', timestamp: at(0) },
    );
    mergeTraceFragment(trace, fragment('run1'));
    mergeTraceFragment(trace, fragment('run1')); // reattached: the same run again
    expect(trace.operations).toHaveLength(1);
    expect(trace.operations[0].reads).toEqual(['cd-root', 'run1-gui', 'req-1']);
    expect(trace.artifacts.filter((a) => a.type === 'RequirementArtifact')).toHaveLength(1);
    expect(trace.tools.map((t) => t.provider)).toEqual(['openai', 'azure']);
    expect(trace.traceLinks).toEqual([expect.objectContaining({ sourceId: 'req-1', targetId: 'run1-f' })]);
  });
});

describe('retention of generation runs', () => {
  function runs(count: number): TraceFile {
    const trace: TraceFile = {
      ...emptyTraceFile('p'),
      actors: [{ id: 'ada', type: 'Person', name: 'Ada', timestamp: at(0) }],
      tools: [{ id: 'gen', type: 'CodeGenerator', name: 'sql', timestamp: at(0) }],
      artifacts: [{ id: 'book', type: 'ModelArtifact', name: 'Book', elementId: 'c1', elementType: 'Class', timestamp: at(0) }],
    };
    for (let run = 0; run < count; run += 1) {
      trace.artifacts.push(
        { id: `f${run}`, type: 'CodeArtifact', name: 'a.sql', path: 'a.sql', contentHash: `h${run}`, content: 'x', timestamp: at(run),
          ...(run > 0 ? { revisionOfId: `f${run - 1}` } : {}) },
        { id: `r${run}`, type: 'CodeArtifact', name: 'Book', path: 'a.sql', contentHash: 'x', startLine: 1, endLine: 1, parentId: `f${run}`, timestamp: at(run) },
      );
      trace.operations.push({ id: `g${run}`, type: 'CodeGeneration', status: 'SUCCEEDED', startedAt: at(run), performedBy: ['ada'],
        toolCalls: [{ id: `c${run}`, toolId: 'gen', sequenceNumber: 0, status: 'SUCCEEDED', startedAt: at(run), logs: [] }],
        reads: ['book'], writes: [`f${run}`, `r${run}`] });
      trace.traceLinks.push({ id: `k${run}`, sourceId: 'book', targetId: `r${run}`, operationId: `g${run}`, timestamp: at(run), evidence: [] });
    }
    return trace;
  }

  it(`keeps at most ${KEPT_GENERATION_RECORDS_PER_GENERATOR} runs per generator, removing older ones with their files`, () => {
    const total = KEPT_GENERATION_RECORDS_PER_GENERATOR + 3;
    const trace = runs(total);
    expect(pruneOldGenerations(trace)).toBe(total - KEPT_GENERATIONS_PER_GENERATOR);
    expect(trace.operations).toHaveLength(KEPT_GENERATION_RECORDS_PER_GENERATOR);
    expect(trace.operations[0].id).toBe('g3');
    expect(trace.artifacts.some((a) => a.id === 'f2' || a.id === 'r2')).toBe(false);
    const oldestKept = trace.artifacts.find((a) => a.id === 'f3') as CodeArtifact;
    expect(oldestKept).not.toHaveProperty('revisionOfId'); // it named a removed file
    expect(oldestKept).not.toHaveProperty('content');
    expect(trace.traceLinks).toHaveLength(KEPT_GENERATIONS_PER_GENERATOR);
    expect(pruneOldGenerations(trace)).toBe(0);
  });
});

describe('Spec-Driven runs', () => {
  const summary = {
    runId: 'r1', status: 'SUCCEEDED' as const, startedAt: at(0), endedAt: at(30), llm: { model: 'gpt-x', provider: 'openai' },
    tokensUsed: 1000, costUsd: 0.5, generator: 'web_app', changedFiles: ['src/App.tsx'], changedFileCount: 3,
    verification: [{ state: 'shippedUnenforced' as const, kind: 'requirement', id: 'R1', what: 'titles', detail: 'missing' }],
    diagrams: [{ id: 'cd', title: 'Library', modelType: 'DomainModel' }], requirementIds: ['req-1', 'unknown'],
  };

  it('records a run without a trace from its stream, once', () => {
    const trace = emptyTraceFile('p');
    trace.artifacts.push({ id: 'req-1', type: 'RequirementArtifact', name: 'Books have titles', quote: 'titles', kind: 'data', timestamp: at(0) });
    expect(recordSpecDrivenRun(trace, { ...summary, actorName: 'Ada' })).toBe(true);
    expect(recordSpecDrivenRun(trace, { ...summary, actorName: 'Ada' })).toBe(false);
    const [run] = trace.operations;
    expect(run).toMatchObject({ id: specDrivenOperationId('r1'), type: 'CodeGeneration', status: 'SUCCEEDED', writes: [] });
    expect(toolNamesOf(trace, run)).toEqual(['web_app', 'gpt-x']);
    expect(run.reads).toHaveLength(2); // the diagram and the requirement the trace has
    expect(trace.actors.map((a) => a.name)).toEqual(['Ada', SPEC_DRIVEN_AGENT_NAME]);
    const logs = run.toolCalls[1].logs.map((l) => l.content).join('\n');
    expect(logs).toContain('1000');
    expect(logs).toContain('src/App.tsx\n… and 2 more');
    expect(logs).toContain('shippedUnenforced requirement R1: titles (missing)');
  });

  it('merges the trace a run’s done event carries instead', async () => {
    const project = projectWith({});
    const fragment = { ...emptyTraceFile('x'), projectId: null, operations: [{ id: 'op', type: 'CodeGeneration', status: 'SUCCEEDED', startedAt: at(0),
      performedBy: [], toolCalls: [], reads: [], writes: [] }] };
    recordSpecDrivenOutcome(project, fragment, summary);
    expect((await traceOf(project)).operations.map((o) => o.id)).toEqual(['op']);
    recordSpecDrivenOutcome(project, undefined, summary);
    expect((await traceOf(project)).operations.map((o) => o.id)).toEqual(['op', specDrivenOperationId('r1')]);
  });
});

describe('trace versions', () => {
  it('reads a version 5 trace as version 6, and writes one back for an older backend', () => {
    const v5 = { ...emptyTraceFile('p'), schemaVersion: 5 };
    expect(migrateTraceFile(v5)).toMatchObject({ schemaVersion: 6 });
    const v6: TraceFile = { ...emptyTraceFile('p'), artifacts: [
      { id: 'f', type: 'CodeArtifact', name: 'a', path: 'a', contentHash: 'h', revisionOfId: 'f0', timestamp: at(0) },
    ] };
    const older = downgradeTraceFile(v6, 5)!;
    expect(older.schemaVersion).toBe(5);
    expect(older.artifacts[0]).not.toHaveProperty('revisionOfId');
    expect(downgradeTraceFile(v6, 3)).toBeUndefined();
  });

  it('refuses a trace newer than the editor reads, saying so', () => {
    expect(traceFileProblem({ ...emptyTraceFile('p'), schemaVersion: TRACE_SCHEMA_VERSION + 1 })).toMatch(/newer/i);
  });
});
