import { beforeEach, describe, expect, it, vi } from 'vitest';
import { newRunTraceState, noteRunEvent, recordRunInTrace, runSummary } from '../runTrace';
import type { DoneEvent } from '../types';
import { ProjectStorageRepository } from '../../../shared/services/storage/ProjectStorageRepository';
import { createDefaultProject } from '../../../shared/types/project';
import { flushTraceSaves, loadProjectTrace, setTraceStorage } from '../../../shared/traceability/traceStore';
import { memoryTraceStorage } from '../../../shared/traceability/traceDatabase';
import { specDrivenOperationId } from '../../../shared/traceability/traceRecorder';
import { emptyTraceFile } from '../../../shared/types/traceability';

const done = (extra: Partial<DoneEvent> = {}): DoneEvent => ({
  event: 'done', runId: 'r1', downloadUrl: '/download/r1', fileName: 'app.zip', isZip: true,
  recipe: { generator_used: 'web_app' }, tokensUsed: 4200, changedFiles: ['src/App.tsx'], changedFileCount: 1,
  verification: {
    verified: [{ kind: 'requirement', id: 'R1', what: 'Books have titles', how: 'pytest' }],
    notVerified: [], shippedUnenforced: [],
    counts: { verified: 1, notVerified: 0, shippedUnenforced: 0 },
  },
  ...extra,
});

describe('what the trace records of a Spec-Driven run', () => {
  beforeEach(() => setTraceStorage(memoryTraceStorage()));

  it('follows the model the run was served by, and builds the run from its events', () => {
    const state = newRunTraceState(['call:R1']);
    noteRunEvent(state, { event: 'start', runId: 'r1', provider: 'openai', llmModel: 'gpt-a', maxCost: 1, maxRuntime: 60 });
    noteRunEvent(state, { event: 'model_update', model: 'gpt-b' });
    noteRunEvent(state, { event: 'cost', usd: 0.25, turns: 3, elapsedSeconds: 9, servedModel: 'gpt-b-2026' } as never);
    const summary = runSummary(state, 'r1', done(), []);
    expect(summary).toMatchObject({
      status: 'SUCCEEDED', llm: { model: 'gpt-b-2026', provider: 'openai' }, tokensUsed: 4200, costUsd: 0.25,
      generator: 'web_app', changedFiles: ['src/App.tsx'], requirementIds: ['call:R1'],
      verification: [{ state: 'verified', kind: 'requirement', id: 'R1', what: 'Books have titles', detail: 'pytest' }],
    });
    expect(runSummary(state, 'r1', { event: 'error', code: 'CANCELLED', message: 'stopped' }, []).status).toBe('CANCELLED');
    expect(runSummary(state, 'r1', { event: 'error', code: 'UPSTREAM_LLM', message: 'x' }, []).status).toBe('FAILED');
  });

  it('records a run without a trace from its stream, reading the project’s diagrams', async () => {
    const project = createDefaultProject('Shop', '', 'Ada');
    vi.spyOn(ProjectStorageRepository, 'loadProject').mockReturnValue(project);
    recordRunInTrace(project.id, 'r1', newRunTraceState(), done());
    await flushTraceSaves();
    const trace = await loadProjectTrace(project.id);
    expect(trace.operations.map((o) => o.id)).toEqual([specDrivenOperationId('r1')]);
  });

  it('carries a requirement item’s traceRef into the summary', () => {
    const item = { kind: 'requirement' as const, id: 'R1', traceRef: 'r1:R1', what: 'Books have titles', how: 'pytest' };
    const summary = runSummary(newRunTraceState(), 'r1', done({ verification: { ...done().verification!, verified: [item] } }), []);
    expect(summary.verification[0]).toMatchObject({ id: 'R1', traceRef: 'r1:R1' });
  });

  it('records the run once when done.trace arrives after the fallback has recorded it', async () => {
    const project = createDefaultProject('Shop', '', 'Ada');
    vi.spyOn(ProjectStorageRepository, 'loadProject').mockReturnValue(project);
    const fragment = { ...emptyTraceFile('x'), projectId: null, operations: [{ id: specDrivenOperationId('r1'), type: 'CodeGeneration',
      status: 'SUCCEEDED', startedAt: '2026-01-01T00:00:00.000Z', performedBy: [], toolCalls: [], reads: [], writes: [] }] };
    recordRunInTrace(project.id, 'r1', newRunTraceState(), done()); // the stream fallback
    recordRunInTrace(project.id, 'r1', newRunTraceState(), done({ trace: fragment })); // the backend's trace, later
    await flushTraceSaves();
    expect((await loadProjectTrace(project.id)).operations.map((o) => o.id)).toEqual([specDrivenOperationId('r1')]);
    // ... and the other way round.
    const other = createDefaultProject('Shop2', '', 'Ada');
    vi.spyOn(ProjectStorageRepository, 'loadProject').mockReturnValue(other);
    recordRunInTrace(other.id, 'r1', newRunTraceState(), done({ trace: fragment }));
    recordRunInTrace(other.id, 'r1', newRunTraceState(), done());
    await flushTraceSaves();
    expect((await loadProjectTrace(other.id)).operations.map((o) => o.id)).toEqual([specDrivenOperationId('r1')]);
  });

  it('merges the trace the done event carries', async () => {
    const project = createDefaultProject('Shop', '', 'Ada');
    vi.spyOn(ProjectStorageRepository, 'loadProject').mockReturnValue(project);
    const fragment = { ...emptyTraceFile('x'), projectId: null, operations: [{ id: 'backend-run', type: 'CodeGeneration', status: 'SUCCEEDED',
      startedAt: '2026-01-01T00:00:00.000Z', performedBy: [], toolCalls: [], reads: [], writes: [] }] };
    recordRunInTrace(project.id, 'r2', newRunTraceState(), done({ runId: 'r2', trace: fragment }));
    await flushTraceSaves();
    expect((await loadProjectTrace(project.id)).operations.map((o) => o.id)).toEqual(['backend-run']);
  });
});
