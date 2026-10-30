import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LEGACY_TRACE_STORAGE_PREFIX,
  flushTraceSaves,
  loadProjectTrace,
  setTraceStorage,
  updateProjectTrace,
} from '../traceStore';
import { memoryTraceStorage } from '../traceDatabase';
import type { TraceStorage } from '../traceDatabase';
import { KEPT_GENERATIONS_PER_GENERATOR, pruneOldGenerations } from '../traceRecorder';
import { coverageMatrix, indexTrace } from '../traceQueries';
import { emptyTraceFile } from '../../types/traceability';
import type { TraceFile, TraceOperation } from '../../types/traceability';

const at = (minute: number) => new Date(Date.UTC(2026, 9, 30, 10, minute)).toISOString();
const ada = { id: 'ada', type: 'Person' as const, name: 'Ada', timestamp: at(0) };

/** A storage that counts writes and can delay reads, to see what the store does in between. */
function spyStorage(delayReads = false) {
  const inner = memoryTraceStorage();
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const storage: TraceStorage & { writes: number } = {
    writes: 0,
    read: async (id) => { if (delayReads) await gate; return inner.read(id); },
    write: async (id, trace) => { storage.writes += 1; return inner.write(id, trace); },
    remove: (id) => inner.remove(id),
  };
  return { storage, release };
}

describe('trace storage', () => {
  beforeEach(() => {
    localStorage.clear();
    setTraceStorage(memoryTraceStorage());
  });

  it('saves a trace and reads it back in a new session', async () => {
    const { storage } = spyStorage();
    setTraceStorage(storage);
    await updateProjectTrace('p1', (trace) => { trace.actors.push(ada); });
    await flushTraceSaves();
    setTraceStorage(storage); // a new session: nothing loaded, same storage
    expect((await loadProjectTrace('p1')).actors).toEqual([ada]);
  });

  it('saves quick successive updates in one write', async () => {
    vi.useFakeTimers();
    try {
      const { storage } = spyStorage();
      setTraceStorage(storage);
      await loadProjectTrace('p1');
      for (let i = 0; i < 5; i += 1) void updateProjectTrace('p1', (trace) => { trace.actors.push({ ...ada, id: `a${i}` }); });
      await vi.runAllTimersAsync();
      expect(storage.writes).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('applies updates made while the trace loads, in order, on top of what was stored', async () => {
    const { storage, release } = spyStorage(true);
    await storage.write('p1', { ...emptyTraceFile('p1'), actors: [ada] });
    setTraceStorage(storage);
    const first = updateProjectTrace('p1', (trace) => { trace.actors.push({ ...ada, id: 'second' }); });
    const second = updateProjectTrace('p1', (trace) => { trace.actors.push({ ...ada, id: 'third' }); });
    release();
    await Promise.all([first, second]);
    expect((await loadProjectTrace('p1')).actors.map((a) => a.id)).toEqual(['ada', 'second', 'third']);
  });

  it('moves a trace kept in localStorage by an earlier version into the storage', async () => {
    const { storage } = spyStorage();
    setTraceStorage(storage);
    localStorage.setItem(`${LEGACY_TRACE_STORAGE_PREFIX}p1`, JSON.stringify({ ...emptyTraceFile('p1'), actors: [ada] }));
    expect((await loadProjectTrace('p1')).actors).toEqual([ada]);
    expect(localStorage.getItem(`${LEGACY_TRACE_STORAGE_PREFIX}p1`)).toBeNull();
    expect(await storage.read('p1')).toMatchObject({ actors: [ada] });
  });
});

describe('retention of generation runs', () => {
  /** `runs` runs of one generator, each producing a file and a fragment linked from class Book. */
  function generations(runs: number): TraceFile {
    const trace: TraceFile = {
      ...emptyTraceFile('p1'),
      actors: [ada],
      tools: [{ id: 'gen', type: 'CodeGenerator', name: 'sqlalchemy', timestamp: at(0) }],
      artifacts: [{ id: 'book', type: 'ModelArtifact', name: 'Book', elementId: 'c1', elementType: 'Class', timestamp: at(0) }],
    };
    for (let run = 0; run < runs; run += 1) {
      trace.artifacts.push(
        { id: `f${run}`, type: 'CodeArtifact', name: 'sql_alchemy.py', path: 'sql_alchemy.py', contentHash: `h${run}`, content: 'code', timestamp: at(run) },
        { id: `l${run}`, type: 'CodeArtifact', name: 'Book', path: 'sql_alchemy.py', contentHash: 'x', startLine: 1, endLine: 2, parentId: `f${run}`, timestamp: at(run) },
      );
      trace.operations.push({ id: `g${run}`, type: 'CodeGeneration', status: 'SUCCEEDED', startedAt: at(run), performedBy: ['ada'],
        uses: ['gen'], consumes: ['book'], produces: [`f${run}`, `l${run}`], logs: [] } as TraceOperation);
      trace.traceLinks.push({ id: `k${run}`, sourceId: 'book', targetId: `l${run}`, operationId: `g${run}`, timestamp: at(run),
        evidence: [{ id: `e${run}`, type: 'RuleEvidence', rule: 'r', timestamp: at(run) }] });
    }
    return trace;
  }

  it(`keeps the links of the newest ${KEPT_GENERATIONS_PER_GENERATOR} runs and only the files of older ones`, () => {
    const trace = generations(7);
    expect(pruneOldGenerations(trace)).toBe(2);
    expect(trace.traceLinks.map((l) => l.operationId)).toEqual(['g2', 'g3', 'g4', 'g5', 'g6']);
    expect(trace.operations).toHaveLength(7); // every run is still in the history
    const old = trace.artifacts.find((a) => a.id === 'f0')!;
    expect(old).toMatchObject({ contentHash: 'h0' });
    expect(old).not.toHaveProperty('content');
    expect(trace.artifacts.some((a) => a.id === 'l0')).toBe(false);
    expect(trace.operations[0].produces).toEqual(['f0']); // no reference to the dropped fragment
    expect(pruneOldGenerations(trace)).toBe(0); // compacting again changes nothing
  });

  it('counts only runs with links in the coverage matrix', () => {
    const trace = generations(7);
    pruneOldGenerations(trace);
    expect(coverageMatrix(indexTrace(trace), 8).generations.map((g) => g.id)).toEqual(['g6', 'g5', 'g4', 'g3', 'g2']);
  });
});
