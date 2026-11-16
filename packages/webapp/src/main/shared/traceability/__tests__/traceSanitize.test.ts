/**
 * Every trace from outside this tab's recording (an import, a backend fragment, the stored trace) goes through one
 * item-level check, so a malformed or hostile trace can neither crash the views nor hang the tab.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'react-toastify';
import { sanitizeTraceFile, TRACE_LIMITS } from '../traceSanitize';
import { flushTraceSaves, loadProjectTrace, readImportedTrace, readTraceFile, recordGenerationTrace, setTraceStorage } from '../traceStore';
import { memoryTraceStorage } from '../traceDatabase';
import { diagramOf, indexTrace, isDeleted, topLevelOf } from '../traceQueries';
import { emptyTraceFile } from '../../types/traceability';
import type { TraceArtifact, TraceFile } from '../../types/traceability';

vi.mock('react-toastify', () => ({ toast: { warn: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

const now = '2026-10-30T10:00:00.000Z';
const model = (id: string, parentId?: string): TraceArtifact =>
  ({ id, type: 'ModelArtifact', name: id, elementId: `e-${id}`, elementType: 'Class', timestamp: now, ...(parentId ? { parentId } : {}) });
const withItems = (items: Partial<Record<keyof TraceFile, unknown[]>>): TraceFile => ({ ...emptyTraceFile('p'), ...items } as TraceFile);

describe('sanitizeTraceFile', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  it('drops wrongly shaped items and keeps the others', () => {
    const result = sanitizeTraceFile(withItems({
      actors: [null, { id: 'a', type: 'Person', name: 'Ada', timestamp: now }, { id: 'x', type: 'Robot', name: 'R', timestamp: now }],
      artifacts: [null, 42, model('c1'), { id: 'bad', type: 'ModelArtifact', name: 'no element id', timestamp: now }, model('c1')],
      operations: [null, { id: 'o', type: 'CodeGeneration' }],
      traceLinks: [{ id: 'l', sourceId: 'c1', targetId: 'missing', operationId: 'o', evidence: [], timestamp: now }],
    }));
    if (!('trace' in result)) throw new Error('refused');
    expect(result.trace.actors.map((a) => a.id)).toEqual(['a']);
    expect(result.trace.artifacts.map((a) => a.id)).toEqual(['c1']); // the duplicate id is dropped too
    expect(result.trace.operations).toEqual([]);
    expect(result.trace.traceLinks).toEqual([]);
    expect(result.dropped).toBeGreaterThanOrEqual(8);
    expect(() => indexTrace(result.trace)).not.toThrow();
  });

  it('drops dangling references of an operation and its links', () => {
    const result = sanitizeTraceFile(withItems({
      actors: [{ id: 'a', type: 'Person', name: 'Ada', timestamp: now }],
      tools: [{ id: 't', type: 'Editor', name: 'Editor', timestamp: now }],
      artifacts: [model('c1'), { ...model('c2'), parentId: 'gone' }],
      operations: [{
        id: 'o', type: 'ModelingSession', status: 'SUCCEEDED', startedAt: now, performedBy: ['a', 'ghost'], reads: ['nope'], writes: ['c1'],
        toolCalls: [{ id: 'k', toolId: 't', sequenceNumber: 0, status: 'SUCCEEDED', startedAt: now, logs: [null] }, { id: 'k2', toolId: 'nope', sequenceNumber: 1, status: 'SUCCEEDED', startedAt: now, logs: [] }],
        changes: [{ id: 'ch', kind: 'CREATED', artifactId: 'c1', timestamp: now }, { id: 'ch2', kind: 'CREATED', artifactId: 'gone', timestamp: now }],
      }],
    }));
    if (!('trace' in result)) throw new Error('refused');
    const [operation] = result.trace.operations;
    expect(operation).toMatchObject({ performedBy: ['a'], reads: [], writes: ['c1'] });
    expect(operation.toolCalls.map((c) => [c.id, c.logs.length])).toEqual([['k', 0]]);
    expect(operation.type === 'ModelingSession' && operation.changes.map((c) => c.id)).toEqual(['ch']);
    expect(result.trace.artifacts.find((a) => a.id === 'c2')).not.toHaveProperty('parentId');
  });

  it('breaks a parent cycle, so every walk up the parents ends', () => {
    const result = sanitizeTraceFile(withItems({ artifacts: [model('a', 'b'), model('b', 'c'), model('c', 'a'), model('d', 'd')] }));
    if (!('trace' in result)) throw new Error('refused');
    const index = indexTrace(result.trace);
    for (const artifact of result.trace.artifacts) {
      expect(isDeleted(index, artifact.id)).toBe(false);
      expect(topLevelOf(index, artifact)).toBeDefined();
      expect(diagramOf(index, artifact)).toBeDefined();
    }
    expect(result.trace.artifacts.filter((a) => a.parentId === undefined).length).toBe(2);
  });

  it('keeps a fragment’s references to the project trace’s own items', () => {
    const fragment = withItems({
      operations: [{ id: 'o', type: 'CodeGeneration', status: 'SUCCEEDED', startedAt: now, performedBy: ['a'], toolCalls: [], reads: ['project-artifact'], writes: [] }],
    });
    const result = sanitizeTraceFile(fragment, { externalReferences: true });
    expect('trace' in result && result.trace.operations[0].reads).toEqual(['project-artifact']);
  });

  it('refuses a trace with too many items, with a message saying so', () => {
    const artifacts = new Array<unknown>(TRACE_LIMITS.artifacts + 1);
    expect(sanitizeTraceFile(withItems({ artifacts }))).toEqual({ tooLarge: { list: 'artifacts', count: TRACE_LIMITS.artifacts + 1, max: TRACE_LIMITS.artifacts } });
    const read = readTraceFile(withItems({ artifacts }));
    expect(read.problem).toMatch(/too large/);
  });
});

describe('where traces come in', () => {
  beforeEach(() => {
    setTraceStorage(memoryTraceStorage());
    vi.mocked(toast.warn).mockClear();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  it('an imported trace with null items and a parent cycle loads and indexes', () => {
    const imported = readImportedTrace(withItems({ artifacts: [null, model('a', 'b'), model('b', 'a')], operations: [null] }));
    expect(imported).toBeDefined();
    expect(() => indexTrace(imported!)).not.toThrow();
    expect(imported!.artifacts.some((a) => a.parentId === undefined)).toBe(true);
  });

  it('a stored trace is checked item by item when loaded', async () => {
    const storage = memoryTraceStorage();
    await storage.write('p', withItems({ artifacts: [null, model('a', 'a')] }));
    setTraceStorage(storage);
    const trace = await loadProjectTrace('p');
    expect(trace.artifacts.map((a) => [a.id, a.parentId])).toEqual([['a', undefined]]);
  });

  it('a backend fragment is checked before it is merged', async () => {
    await loadProjectTrace('p');
    expect(recordGenerationTrace('p', withItems({ projectId: null as never, operations: [{ id: 'o', type: 'CodeGeneration', status: 'SUCCEEDED' }] } as never))).toBe(true);
    await flushTraceSaves();
    expect((await loadProjectTrace('p')).operations).toEqual([]);
  });
});
