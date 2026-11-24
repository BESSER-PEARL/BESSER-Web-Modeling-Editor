import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deleteProjectTrace,
  flushTraceSaves,
  getProjectTrace,
  loadProjectTrace,
  setTraceStorage,
  updateProjectTrace,
} from '../traceStore';
import { memoryTraceStorage } from '../traceDatabase';
import { localStorageLegacyTracePrefix } from '../../constants/constant';
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
    write: async (id, trace, expected) => { storage.writes += 1; return inner.write(id, trace, expected); },
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

  it('applies an update made once the trace has loaded after one made while it loaded', async () => {
    // Live in CI: a template load (made while the trace loaded) was recorded after the user's next edit, made
    // once the trace was in memory but before the template's update had been applied.
    const { storage, release } = spyStorage(true);
    setTraceStorage(storage);
    const opened = loadProjectTrace('p1'); // a view opened the trace
    const later = opened.then(() => updateProjectTrace('p1', (trace) => { trace.actors.push({ ...ada, id: 'later' }); }));
    const during = updateProjectTrace('p1', (trace) => { trace.actors.push({ ...ada, id: 'during' }); });
    release();
    await Promise.all([during, later]);
    expect(getProjectTrace('p1')!.actors.map((a) => a.id)).toEqual(['during', 'later']);
  });

  it('leaves out an update that throws, without rejecting, and keeps the updates around it', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(updateProjectTrace('p2', () => { throw new Error('boom'); })).resolves.toBeUndefined();
    await updateProjectTrace('p2', (trace) => { trace.actors.push(ada); });
    await expect(updateProjectTrace('p2', (trace) => { trace.actors.push({ ...ada, id: 'half' }); throw new Error('halfway'); })).resolves.toBeUndefined();
    await flushTraceSaves();
    await vi.waitFor(() => expect(getProjectTrace('p2')!.actors.map((a) => a.id)).toEqual(['ada']));
    vi.restoreAllMocks();
  });

  it('moves a trace kept in localStorage by an earlier version into the storage', async () => {
    const { storage } = spyStorage();
    setTraceStorage(storage);
    localStorage.setItem(`${localStorageLegacyTracePrefix}p1`, JSON.stringify({ ...emptyTraceFile('p1'), actors: [ada] }));
    expect((await loadProjectTrace('p1')).actors).toEqual([ada]);
    expect(localStorage.getItem(`${localStorageLegacyTracePrefix}p1`)).toBeNull();
    expect(await storage.read('p1')).toMatchObject({ actors: [ada] });
  });
});

describe('clearing a trace', () => {
  it('a load right after the delete starts from an empty trace, not the stored one', async () => {
    const storage = memoryTraceStorage();
    setTraceStorage(storage);
    await updateProjectTrace('p1', (trace) => { trace.actors.push(ada); });
    await flushTraceSaves();
    deleteProjectTrace('p1');
    // What the Traceability page's "Clear trace" does: load again at once.
    expect((await loadProjectTrace('p1')).actors).toEqual([]);
    await flushTraceSaves();
    expect(getProjectTrace('p1')?.actors).toEqual([]);
    expect(await storage.read('p1')).toBeUndefined();
  });
});

describe('a stored trace this editor cannot read', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  it.each([
    ['from a newer schema (a rollback)', { ...emptyTraceFile('p1'), schemaVersion: 99, actors: [ada] }],
    ['over the trace limits', { ...emptyTraceFile('p1'), actors: [ada, ...Array.from({ length: 10_001 }, (_, i) => ({ ...ada, id: `a${i}` }))] }],
  ])('is kept untouched, and recording stops for the session: %s', async (_label, unreadable) => {
    const { storage } = spyStorage();
    await storage.write('p1', unreadable as TraceFile);
    storage.writes = 0;
    setTraceStorage(storage);
    await updateProjectTrace('p1', (trace) => { trace.tools.push({ id: 't1', type: 'Editor', name: 'x', timestamp: at(1) }); });
    await flushTraceSaves();
    expect(storage.writes).toBe(0);
    expect(await storage.read('p1')).toMatchObject({ schemaVersion: unreadable.schemaVersion, actors: unreadable.actors });
    expect(getProjectTrace('p1')?.tools).toEqual([]);
  });

  it('is kept when another tab stores it while this tab has the trace loaded', async () => {
    const { storage } = spyStorage();
    setTraceStorage(storage);
    await loadProjectTrace('p1');
    // Another tab, on a newer editor, stores a trace this one cannot read.
    const newer = { ...emptyTraceFile('p1'), schemaVersion: 99, actors: [ada] } as TraceFile;
    await storage.write('p1', newer);
    await updateProjectTrace('p1', (trace) => { trace.tools.push({ id: 't1', type: 'Editor', name: 'x', timestamp: at(1) }); });
    await flushTraceSaves();
    await updateProjectTrace('p1', (trace) => { trace.tools.push({ id: 't2', type: 'Editor', name: 'y', timestamp: at(2) }); });
    await flushTraceSaves();
    expect(await storage.read('p1')).toMatchObject({ schemaVersion: 99, actors: [ada] });
  });

  it('can still be cleared', async () => {
    const storage = memoryTraceStorage();
    await storage.write('p1', { ...emptyTraceFile('p1'), schemaVersion: 99 } as TraceFile);
    setTraceStorage(storage);
    await loadProjectTrace('p1');
    deleteProjectTrace('p1');
    await loadProjectTrace('p1');
    await updateProjectTrace('p1', (trace) => { trace.actors.push(ada); });
    await flushTraceSaves();
    expect(await storage.read('p1')).toMatchObject({ schemaVersion: 6, actors: [ada] });
  });
});

describe('two tabs on one project', () => {
  /** A second copy of the store module: what another tab runs, on the same storage. */
  async function otherTab() {
    vi.resetModules();
    return import('../traceStore');
  }
  const actor = (id: string) => ({ ...ada, id, name: id });

  it('keeps the records of both tabs when each saves', async () => {
    const shared = memoryTraceStorage();
    const tabA = await otherTab();
    const tabB = await otherTab();
    tabA.setTraceStorage(shared);
    tabB.setTraceStorage(shared);
    await tabA.loadProjectTrace('p');
    await tabB.loadProjectTrace('p');
    await tabA.updateProjectTrace('p', (trace) => { trace.actors.push(actor('A')); });
    await tabA.flushTraceSaves();
    await tabB.updateProjectTrace('p', (trace) => { trace.actors.push(actor('B')); });
    await tabB.flushTraceSaves();
    const stored = (await shared.read('p')) as TraceFile;
    expect(stored.actors.map((a) => a.id)).toEqual(['A', 'B']);
    expect(tabB.getProjectTrace('p')!.actors.map((a) => a.id)).toEqual(['A', 'B']);
  });

  it('shows another tab’s saved records without a reload', async () => {
    const shared = memoryTraceStorage();
    const tabA = await otherTab();
    const tabB = await otherTab();
    tabA.setTraceStorage(shared);
    tabB.setTraceStorage(shared);
    await tabA.loadProjectTrace('p');
    await tabB.loadProjectTrace('p');
    const seen = vi.fn();
    const { result } = await import('@testing-library/react').then(({ renderHook }) =>
      renderHook(() => { const trace = tabB.useProjectTrace('p'); seen(trace?.actors.length); return trace; }));
    await tabA.updateProjectTrace('p', (trace) => { trace.actors.push(actor('A')); });
    await tabA.flushTraceSaves();
    await vi.waitFor(() => expect(result.current?.actors.map((a) => a.id)).toEqual(['A']));
  });

  it('applies its unsaved updates on top of what another tab saved meanwhile', async () => {
    const shared = memoryTraceStorage();
    setTraceStorage(shared);
    await loadProjectTrace('p');
    await updateProjectTrace('p', (trace) => { trace.actors.push(actor('mine')); });
    // Another tab saves first (straight into the storage, as this tab has not heard of it yet).
    const elsewhere = (await shared.read('p')) ?? { ...emptyTraceFile('p') };
    await shared.write('p', { ...(elsewhere as TraceFile), actors: [actor('theirs')] }, 0);
    await flushTraceSaves();
    expect(((await shared.read('p')) as TraceFile).actors.map((a) => a.id)).toEqual(['theirs', 'mine']);
  });
});

describe('a failing save', () => {
  const generated = (id: string, minute: number) =>
    ({ id, type: 'CodeArtifact' as const, name: 'app.py', path: 'app.py', contentHash: id, content: 'code', timestamp: at(minute) });

  async function traceWithTwoContents(storage: TraceStorage) {
    setTraceStorage(storage);
    await updateProjectTrace('p1', (trace) => { trace.artifacts.push(generated('old', 1), generated('new', 2)); });
  }

  it('drops older file contents only when the storage is full, and publishes the pruned trace', async () => {
    const inner = memoryTraceStorage();
    let fail = true;
    const storage: TraceStorage = {
      ...inner,
      write: async (id, trace, expected) => {
        if (fail) { fail = false; throw new DOMException('full', 'QuotaExceededError'); }
        return inner.write(id, trace, expected);
      },
    };
    await traceWithTwoContents(storage);
    const before = getProjectTrace('p1');
    await flushTraceSaves();
    const after = getProjectTrace('p1')!;
    expect(after).not.toBe(before);
    expect(after.artifacts.find((a) => a.id === 'old')).not.toHaveProperty('content');
    expect(((await inner.read('p1')) as TraceFile).artifacts.find((a) => a.id === 'new')).toHaveProperty('content', 'code');
  });

  it('keeps every file content on another write error', async () => {
    const inner = memoryTraceStorage();
    const storage: TraceStorage = { ...inner, write: async () => { throw new DOMException('gone', 'InvalidStateError'); } };
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await traceWithTwoContents(storage);
    await flushTraceSaves();
    expect(getProjectTrace('p1')!.artifacts.find((a) => a.id === 'old')).toHaveProperty('content', 'code');
    vi.restoreAllMocks();
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
        toolCalls: [{ id: `c${run}`, toolId: 'gen', sequenceNumber: 0, status: 'SUCCEEDED', startedAt: at(run), logs: [] }],
        reads: ['book'], writes: [`f${run}`, `l${run}`] } as TraceOperation);
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
    expect(trace.operations[0].writes).toEqual(['f0']); // no reference to the dropped fragment
    expect(pruneOldGenerations(trace)).toBe(0); // compacting again changes nothing
  });

  it('shows the generator once in the coverage matrix, by its newest run', () => {
    const trace = generations(7);
    pruneOldGenerations(trace);
    expect(coverageMatrix(indexTrace(trace), 8).generations.map((g) => g.id)).toEqual(['g6']);
  });
});
