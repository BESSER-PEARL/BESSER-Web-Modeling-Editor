import { describe, expect, it } from 'vitest';
import { migrateTraceFile } from '../traceMigration';
import { loadProjectTrace, recordGenerationTrace, setTraceStorage, traceFileProblem } from '../traceStore';
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
  it('turns version 1 operations into the operation classes of version 2', () => {
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
