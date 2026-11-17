/**
 * Every trace from outside this tab's recording (an import, a backend fragment, the stored trace) goes through one
 * item-level check, so a malformed or hostile trace can neither crash the views nor hang the tab.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'react-toastify';
import { sanitizeTraceFile, TRACE_LIMITS } from '../traceSanitize';
import {
  flushTraceSaves, getProjectTrace, loadProjectTrace, readImportedTrace, readTraceFile, recordGenerationTrace, replaceProjectTrace, setTraceStorage,
} from '../traceStore';
import { memoryTraceStorage } from '../traceDatabase';
import { diagramOf, indexTrace, isDeleted, topLevelOf } from '../traceQueries';
import { emptyTraceFile } from '../../types/traceability';
import type { TraceArtifact, TraceFile } from '../../types/traceability';

vi.mock('react-toastify', () => ({ toast: { warn: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

const now = '2026-10-30T10:00:00.000Z';
const model = (id: string, parentId?: string): TraceArtifact =>
  ({ id, type: 'ModelArtifact', name: id, elementId: `e-${id}`, elementType: 'Class', timestamp: now, ...(parentId ? { parentId } : {}) });
const withItems = (items: Partial<Record<keyof TraceFile, unknown[]>>): TraceFile => ({ ...emptyTraceFile('p'), ...items } as TraceFile);

describe('TRACE_LIMITS', () => {
  it('are not above the 250,000 items per list the backend accepts on a B-UML export', () => {
    for (const list of ['actors', 'tools', 'artifacts', 'operations', 'traceLinks'] as const) {
      expect(TRACE_LIMITS[list]).toBeLessThanOrEqual(250_000);
    }
  });
});

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

describe('confidence and unknown keys of a crafted trace', () => {
  const op = (confidence?: unknown) => ({
    id: 'o', type: 'CodeGeneration', status: 'SUCCEEDED', startedAt: now, performedBy: [], toolCalls: [], reads: [], writes: [],
    ...(confidence !== undefined ? { confidence } : {}),
  });
  const link = (confidence: unknown) => ({ id: 'l', sourceId: 'a', targetId: 'b', operationId: 'o', evidence: [], timestamp: now, confidence });
  const sane = (confidence: unknown) => {
    const result = sanitizeTraceFile(withItems({ artifacts: [model('a'), model('b')], operations: [op(confidence)], traceLinks: [link(confidence)] }));
    if (!('trace' in result)) throw new Error('refused');
    return [result.trace.operations[0].confidence, result.trace.traceLinks[0].confidence];
  };

  it('keeps a confidence whose value is a number in [0, 1] and whose explanation is a string or absent', () => {
    const good = { id: 'c', value: 0.5, explanation: 'why', timestamp: now };
    expect(sane(good)).toEqual([good, good]);
    const bare = { id: 'c', value: 1, timestamp: now };
    expect(sane(bare)).toEqual([bare, bare]);
  });

  it.each([
    ['a string value', { id: 'c', value: '0.5', timestamp: now }],
    ['a value above 1', { id: 'c', value: 2, timestamp: now }],
    ['a negative value', { id: 'c', value: -0.1, timestamp: now }],
    ['no value', { id: 'c', timestamp: now }],
    ['an object explanation', { id: 'c', value: 0.5, explanation: { x: 1 }, timestamp: now }],
  ])('drops a confidence with %s', (_label, confidence) => {
    expect(sane(confidence)).toEqual([undefined, undefined]);
  });

  it('does not copy an own __proto__ key of an imported trace', () => {
    const raw = JSON.parse(`{"schemaVersion":6,"projectId":"p","actors":[],"tools":[],"artifacts":[],"operations":[],"traceLinks":[],
      "__proto__":{"polluted":"yes"},"extra":1}`);
    const result = sanitizeTraceFile(raw);
    if (!('trace' in result)) throw new Error('refused');
    expect(Object.prototype.hasOwnProperty.call(result.trace, '__proto__')).toBe(false);
    expect(Object.keys(result.trace).sort()).toEqual(['actors', 'artifacts', 'operations', 'projectId', 'schemaVersion', 'tools', 'traceLinks']);
  });

  it('replacing a trace leaves the cached trace a plain trace object', async () => {
    setTraceStorage(memoryTraceStorage());
    const before = (await loadProjectTrace('p')) as unknown as Record<string, unknown>;
    const raw = JSON.parse(`{"schemaVersion":6,"projectId":"p","actors":[],"tools":[],"artifacts":[],"operations":[],"traceLinks":[],
      "__proto__":{"polluted":"yes"}}`);
    await replaceProjectTrace('p', raw);
    // The trace views held before the replace is updated in place: its prototype must not change.
    for (const cached of [before, getProjectTrace('p') as unknown as Record<string, unknown>]) {
      expect(Object.getPrototypeOf(cached)).toBe(Object.prototype);
      expect(cached.polluted).toBeUndefined();
    }
  });
});
