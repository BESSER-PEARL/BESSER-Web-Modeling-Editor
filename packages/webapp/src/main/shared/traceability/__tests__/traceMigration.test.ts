import { describe, expect, it } from 'vitest';
import { migrateTraceFile } from '../traceMigration';
import { loadProjectTrace, recordGenerationTrace, setTraceStorage, traceFileProblem } from '../traceStore';
import { ASSISTANT_LLM_NAME } from '../traceRecorder';
import { memoryTraceStorage } from '../traceDatabase';
import { TRACE_SCHEMA_VERSION } from '../../types/traceability';
import type { TraceFile } from '../../types/traceability';

const time = '2026-10-29T10:00:00.000Z';
const v1Operation = (id: string, operationType: string, changes: unknown[] = []) => ({
  id, operationType, status: 'SUCCEEDED', startedAt: time, performedBy: ['ada'], uses: [], consumes: [], produces: [],
  changes, logs: [],
});

/** A trace as version 1 wrote it: one Operation shape with an `operationType`. */
const v1Trace = () => ({
  schemaVersion: 1, projectId: 'p1', actors: [], tools: [], artifacts: [], traceLinks: [],
  operations: [
    v1Operation('m', 'MANUAL_MODELLING', [{ id: 'c', kind: 'CREATED', artifactId: 'a', timestamp: time }]),
    v1Operation('a', 'ASSISTANT_MODELLING'),
    v1Operation('g', 'CODE_GENERATION'),
  ],
});

describe('migrateTraceFile', () => {
  it('turns version 1 operations into the operation classes', () => {
    const migrated = migrateTraceFile(v1Trace()) as TraceFile;
    expect(migrated.schemaVersion).toBe(TRACE_SCHEMA_VERSION);
    expect(migrated.operations.map((o) => o.type)).toEqual(['Modeling', 'Modeling', 'CodeGeneration']);
    expect(migrated.operations[0]).toMatchObject({ changes: [{ id: 'c', kind: 'CREATED' }] });
    expect(migrated.operations[2]).not.toHaveProperty('changes');
    expect(migrated.operations[0]).not.toHaveProperty('operationType');
    expect(traceFileProblem(migrated, 'p1')).toBeNull();
  });

  it('leaves a current trace, and anything that is not a trace, untouched', () => {
    const current = { ...v1Trace(), schemaVersion: TRACE_SCHEMA_VERSION };
    expect(migrateTraceFile(current)).toBe(current);
    expect(migrateTraceFile('nope')).toBe('nope');
  });
});

describe('recordGenerationTrace', () => {
  it('records the trace of an older backend in the current shape', async () => {
    setTraceStorage(memoryTraceStorage());
    expect(recordGenerationTrace('p9', { ...v1Trace(), projectId: 'p9', operations: [v1Operation('g', 'CODE_GENERATION')] })).toBe(true);
    const [operation] = (await loadProjectTrace('p9')).operations;
    expect(operation).toMatchObject({ type: 'CodeGeneration' });
    expect(operation).not.toHaveProperty('operationType');
  });

  it('leaves out a trace it cannot read', async () => {
    setTraceStorage(memoryTraceStorage());
    expect(recordGenerationTrace('p8', { schemaVersion: 99 })).toBe(false);
    expect((await loadProjectTrace('p8')).operations).toEqual([]);
  });
});


describe('version 2 traces', () => {
  /** A version 2 operation: tools in `uses`, messages in `logs` naming their tool (or none). */
  const v2Trace = () => ({
    schemaVersion: 2, projectId: 'p1', artifacts: [], traceLinks: [],
    actors: [{ id: 'ada', type: 'Person', name: 'Ada', timestamp: time }, { id: 'bot', type: 'Agent', name: 'assistant', timestamp: time }],
    tools: [{ id: 'ed', type: 'Editor', name: 'Editor', timestamp: time }, { id: 'gpt', type: 'LLM', name: 'gpt', provider: 'openai', timestamp: time }],
    operations: [
      { id: 'm', type: 'Modeling', status: 'SUCCEEDED', startedAt: time, endedAt: time, performedBy: ['ada', 'bot'], uses: ['ed', 'gpt'],
        consumes: [], produces: [], changes: [{ id: 'c', kind: 'CREATED', artifactId: 'a', timestamp: time }],
        logs: [
          { id: 'l1', content: 'add Book', sequenceNumber: 1, logType: 'INPUT_REQUEST', toolId: 'gpt', timestamp: time },
          { id: 'l2', content: 'note', sequenceNumber: 2, logType: 'INFO', timestamp: time },
        ] },
      { id: 'chat', type: 'Conversation', status: 'SUCCEEDED', startedAt: time, performedBy: ['ada', 'bot'], uses: [],
        consumes: [], produces: [], logs: [{ id: 'l3', content: 'hi', sequenceNumber: 1, logType: 'INPUT_REQUEST', timestamp: time }] },
    ],
  });

  it('turns each tool an operation used into a call, holding the messages that named it', () => {
    const migrated = migrateTraceFile(v2Trace()) as TraceFile;
    expect(migrated.schemaVersion).toBe(TRACE_SCHEMA_VERSION);
    const [modeling, chat] = migrated.operations;
    expect(modeling.toolCalls.map((c) => [c.toolId, c.sequenceNumber, c.logs.map((l) => l.id)])).toEqual([
      ['ed', 0, ['l2']], // a message naming no tool goes to the first call
      ['gpt', 1, ['l1']],
    ]);
    expect(modeling.toolCalls[0]).toMatchObject({ status: 'SUCCEEDED', startedAt: time, endedAt: time });
    expect(modeling).not.toHaveProperty('uses');
    expect(modeling).not.toHaveProperty('logs');
    expect(modeling.toolCalls[1].logs[0]).not.toHaveProperty('toolId');
    // An operation with messages but no tool talked to the assistant, whose model is unknown.
    const llm = migrated.tools.find((t) => t.id === chat.toolCalls[0].toolId)!;
    expect(llm).toMatchObject({ type: 'LLM', name: ASSISTANT_LLM_NAME, provider: 'unknown' });
    expect(chat.toolCalls[0].logs.map((l) => l.content)).toEqual(['hi']);
    expect(traceFileProblem(migrated, 'p1')).toBeNull();
  });

  it('brings a version 1 trace all the way to the current version', () => {
    const migrated = migrateTraceFile(v1Trace()) as TraceFile;
    expect(migrated.operations.every((o) => Array.isArray(o.toolCalls) && !('uses' in o))).toBe(true);
  });
});
