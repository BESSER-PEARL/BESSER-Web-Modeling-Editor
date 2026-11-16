import { describe, expect, it } from 'vitest';
import { indexTrace } from '../traceQueries';
import { TRACE_DIGEST_CAPS, buildTraceDigest, findFocusArtifacts, wholeWordIndex } from '../traceDigest';

import { emptyTraceFile } from '../../types/traceability';
import type { TraceArtifact, TraceFile, TraceLink, TraceOperation } from '../../types/traceability';

const at = (minute: number) => new Date(Date.UTC(2026, 9, 29, 10, minute)).toISOString();

const model = (id: string, name: string, elementType: string, parentId?: string): TraceArtifact => ({
  id, type: 'ModelArtifact', name, elementId: `e-${id}`, elementType, timestamp: at(0), ...(parentId ? { parentId } : {}),
});
const code = (id: string, path: string, parentId?: string, lines?: [number, number]): TraceArtifact => ({
  id, type: 'CodeArtifact', name: id, path, contentHash: 'h', content: 'SECRET FILE CONTENT', timestamp: at(0),
  ...(parentId ? { parentId } : {}), ...(lines ? { startLine: lines[0], endLine: lines[1] } : {}),
});
const requirement = (id: string, name: string): TraceArtifact => ({
  id, type: 'RequirementArtifact', name, quote: `the user said: ${name}`, kind: 'data', timestamp: at(0),
});
const prompt = (id: string): TraceArtifact => ({
  id, type: 'PromptArtifact', name: 'Prompt: a library', content: 'FULL PROMPT TEXT NOT TO BE SENT', contentHash: 'h', timestamp: at(0),
});
const operation = (id: string, type: TraceOperation['type'], minute: number, extra: Record<string, unknown> = {}): TraceOperation =>
  ({
    id, type, status: 'SUCCEEDED', startedAt: at(minute), endedAt: at(minute), performedBy: ['ada'], toolCalls: [], reads: [], writes: [],
    ...(type === 'ModelingSession' ? { changes: [] } : {}),
    ...extra,
  }) as TraceOperation;
const call = (toolId: string, minute: number) =>
  ({ id: `${toolId}-${minute}`, toolId, sequenceNumber: 0, status: 'SUCCEEDED' as const, startedAt: at(minute), logs: [] });
const link = (id: string, sourceId: string, targetId: string, operationId: string, minute: number, extra: Partial<TraceLink> = {}): TraceLink => ({
  id, sourceId, targetId, operationId, timestamp: at(minute),
  evidence: [{ id: `${id}-e`, type: 'RuleEvidence', rule: 'generator:sqlalchemy', timestamp: at(minute) }],
  ...extra,
});

/** A library: Book (title, isbn) generated twice by sqlalchemy and renamed after the newest run; two requirements. */
function library(): TraceFile {
  return {
    ...emptyTraceFile('p1'),
    actors: [
      { id: 'ada', type: 'Person', name: 'Ada', timestamp: at(0) },
      { id: 'bot', type: 'Agent', name: 'assistant', timestamp: at(0) },
    ],
    tools: [
      { id: 'gen', type: 'CodeGenerator', name: 'sqlalchemy', timestamp: at(0) },
      { id: 'ed', type: 'Editor', name: 'editor', timestamp: at(0) },
    ],
    artifacts: [
      model('cd', 'Library', 'DomainModel'), model('book', 'Book', 'Class', 'cd'), model('title', 'title', 'Property', 'book'),
      model('isbn', 'isbn', 'Property', 'book'), model('member', 'Member', 'Class', 'cd'),
      code('f1', 'models.py'), code('b1', 'models.py', 'f1', [3, 9]),
      code('f2', 'models.py'), code('b2', 'models.py', 'f2', [3, 11]),
      prompt('pr'),
      requirement('r1', 'Books have a title'), requirement('r2', 'Members can borrow books'),
    ],
    operations: [
      operation('x', 'RequirementExtraction', 0, { writes: ['r1', 'r2'], reads: ['pr'], performedBy: ['bot'] }),
      operation('m', 'ModelingSession', 1, {
        performedBy: ['bot'], toolCalls: [call('ed', 1)],
        changes: [
          { id: 'c0', kind: 'CREATED', artifactId: 'book', newValue: 'Book', timestamp: at(1) },
          { id: 'c0b', kind: 'CREATED', artifactId: 'isbn', newValue: 'isbn', timestamp: at(1) },
        ],
      }),
      operation('run1', 'CodeGeneration', 2, { toolCalls: [call('gen', 2)], writes: ['f1', 'b1'] }),
      operation('run2', 'CodeGeneration', 4, { toolCalls: [call('gen', 4)], writes: ['f2', 'b2'] }),
      operation('rename', 'ModelingSession', 6, {
        toolCalls: [call('ed', 6)],
        changes: [{ id: 'c1', kind: 'UPDATED', artifactId: 'book', feature: 'name', oldValue: 'Volume', newValue: 'Book', timestamp: at(6) }],
      }),
    ],
    traceLinks: [
      link('real1', 'r1', 'book', 'm', 1, { evidence: [{ id: 'e1', type: 'AIEvidence', algorithm: 'gpt-x', timestamp: at(1) }] }),
      link('real2', 'r1', 'title', 'm', 1), link('pb', 'pr', 'book', 'x', 1),
      link('g1', 'book', 'b1', 'run1', 2), link('d1', 'cd', 'f1', 'run1', 2),
      link('g2', 'book', 'b2', 'run2', 4), link('d2', 'cd', 'f2', 'run2', 4),
    ],
  };
}

const digestOf = (trace: TraceFile, message = '', options = {}) => buildTraceDigest(trace, indexTrace(trace), message, options);

describe('buildTraceDigest', () => {
  it('has the contract shape: counts, operations newest first, requirements, out-of-date, generations', () => {
    const d = digestOf(library(), '', { summarize: (o: TraceOperation) => `summary of ${o.id}` });
    expect(d.schemaVersion).toBe(1);
    expect(d.recording).toBe(true);
    expect(d.counts.operations).toEqual({ ModelingSession: 2, CodeGeneration: 2, RequirementExtraction: 1, Conversation: 0 });
    expect(d.counts.artifacts).toBe(12);
    expect(d.counts.outOfDateLinks).toBeGreaterThanOrEqual(2);
    expect(d.recentOperations!.map((o) => o.id)).toEqual(['rename', 'run2', 'run1', 'm', 'x']);
    expect(d.recentOperations![0]).toMatchObject({ type: 'ModelingSession', status: 'SUCCEEDED', by: ['Person:Ada'], tools: ['editor'], summary: 'summary of rename' });
    expect(d.recentOperations![4].by).toEqual(['Agent:assistant']);
    expect(d.requirements).toEqual([
      expect.objectContaining({ id: 'r1', kind: 'data', text: 'Books have a title', realizedBy: ['Book', 'Book.title'], covered: true }),
      expect.objectContaining({ id: 'r2', covered: false }),
    ]);
    expect(d.requirements![1].realizedBy).toBeUndefined();
    expect(d.outOfDate!.some((e) => e.source === 'Book' && e.target === 'models.py:3-11'
      && e.reasons.includes('SOURCE_CHANGED') && e.generation === `sqlalchemy @ ${at(4)}`)).toBe(true);
    expect(d.generations).toEqual([
      { generator: 'sqlalchemy', at: at(4), files: 1, outOfDateFiles: 1 },
      { generator: 'sqlalchemy', at: at(2), files: 1, outOfDateFiles: 1 },
    ]);
    expect(d.focus).toBeUndefined();
  });

  it('describes the focus artifact: history, what it derives from, and the code derived from it', () => {
    const d = digestOf(library(), 'Why was Book generated twice?');
    expect(d.focus).toHaveLength(1);
    const [book] = d.focus!;
    expect(book).toMatchObject({ artifactId: 'book', name: 'Book', elementType: 'Class' });
    expect(book.history).toEqual([
      { kind: 'CREATED', new: 'Book', at: at(1), by: 'Agent:assistant', via: 'editor' },
      { kind: 'CREATED', feature: 'Book.isbn', new: 'isbn', at: at(1), by: 'Agent:assistant', via: 'editor' },
      { kind: 'UPDATED', feature: 'name', old: 'Volume', new: 'Book', at: at(6), by: 'Person:Ada', via: 'editor' },
    ]);
    expect(book.derivedFrom).toEqual(expect.arrayContaining([
      { type: 'Requirement', name: 'Books have a title', evidence: 'AIEvidence: gpt-x' },
      { type: 'Prompt', name: 'Prompt: a library', evidence: 'RuleEvidence: generator:sqlalchemy' },
    ]));
    expect(book.derived![0]).toEqual({ path: 'models.py', lines: '3-11', outOfDate: expect.arrayContaining(['SOURCE_CHANGED']) });
    expect(book.derived).toHaveLength(2);
  });

  it('never carries file contents or prompt texts', () => {
    const json = JSON.stringify(digestOf(library(), 'Book'));
    expect(json).not.toContain('SECRET FILE CONTENT');
    expect(json).not.toContain('FULL PROMPT TEXT');
  });

  it('caps every string and list as the agent does', () => {
    const trace = library();
    const long = 'x'.repeat(2000);
    trace.artifacts.push(requirement('rl', long), model('lm', 'L'.repeat(400), 'Class', 'cd'));
    trace.operations[0].writes.push('rl');
    for (let i = 0; i < 40; i += 1) {
      trace.artifacts.push(requirement(`rr${i}`, `req ${i}`));
      trace.operations[0].writes.push(`rr${i}`);
      trace.operations.push(operation(`op${i}`, 'Conversation', 10 + i));
      trace.operations.push(operation(`gen${i}`, 'CodeGeneration', 100 + i, { toolCalls: [call('gen', 100 + i)] }));
    }
    const d = digestOf(trace, '', { maxChars: 1e9 });
    expect(d.recentOperations).toHaveLength(TRACE_DIGEST_CAPS.recentOperations);
    expect(d.requirements!.length).toBeLessThanOrEqual(TRACE_DIGEST_CAPS.requirements);
    expect(d.requirements![0].text.length).toBeLessThanOrEqual(TRACE_DIGEST_CAPS.textChars);
    expect(d.requirements![0].quote!.length).toBeLessThanOrEqual(TRACE_DIGEST_CAPS.textChars);
  });

  it('keeps the serialized digest within the bound, trimming the least valuable lists first and deterministically', () => {
    const trace = library();
    for (let i = 0; i < 60; i += 1) {
      trace.artifacts.push(requirement(`rr${i}`, `A requirement number ${i} that says quite a lot about the library ${'y'.repeat(300)}`));
      trace.operations[0].writes.push(`rr${i}`);
      trace.operations.push(operation(`op${i}`, 'Conversation', 10 + i));
    }
    const full = digestOf(trace, 'Book', { maxChars: 1e9 });
    const bound = 6000;
    const a = digestOf(trace, 'Book', { maxChars: bound });
    const b = digestOf(trace, 'Book', { maxChars: bound });
    expect(JSON.stringify(a).length).toBeLessThanOrEqual(bound);
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
    // The focus survives whole; recent operations went first, then generations, then requirements.
    expect(a.focus).toEqual(full.focus);
    expect(a.recentOperations).toBeUndefined();
    expect(a.generations).toBeUndefined();
    expect(a.requirements!.length).toBeLessThan(full.requirements!.length);
    expect(a.requirements).toEqual(full.requirements!.slice(0, a.requirements!.length));
    expect(a.outOfDate).toEqual(full.outOfDate);
  });

  it('shortens the focus last, and stays in the bound at the default', () => {
    const trace = library();
    for (let i = 0; i < 30; i += 1) {
      trace.operations.push(operation(`e${i}`, 'ModelingSession', 20 + i, {
        changes: [{ id: `ce${i}`, kind: 'UPDATED', artifactId: 'book', feature: 'f', oldValue: 'o'.repeat(500), newValue: 'n'.repeat(500), timestamp: at(20 + i) }],
      }));
    }
    const d = digestOf(trace, 'Book Member');
    expect(JSON.stringify(d).length).toBeLessThanOrEqual(12000);
    expect(d.focus!.length).toBeGreaterThan(0);
    expect(d.focus![0].history!.length).toBeLessThanOrEqual(TRACE_DIGEST_CAPS.focusHistory);
    // The newest change is the one kept.
    const history = d.focus![0].history!;
    expect(history[history.length - 1].at).toBe(at(49));
  });
});

describe('focus', () => {
  const index = indexTrace(library());
  const ids = (message: string) => findFocusArtifacts(index, message).map((a) => a.id);

  it('matches whole words, case-insensitively', () => {
    expect(ids('tell me about book')).toEqual(['book']);
    expect(ids('Bookshop and Notebook')).toEqual([]);
    expect(wholeWordIndex('a Book.', 'book')).toBe(2);
    expect(wholeWordIndex('rebook', 'book')).toBe(-1);
  });

  it('lets a qualified member beat its owner', () => {
    expect(ids('why does Book.isbn exist?')).toEqual(['isbn']);
    expect(ids('the isbn of Book')).toEqual(['isbn']);
    expect(ids('what is an isbn')).toEqual([]); // a member alone, without its owner, is too generic
  });

  it('orders by where the message names them and keeps ambiguous names', () => {
    expect(ids('Member borrows Book')).toEqual(['member', 'book']);
    const trace = library();
    trace.artifacts.push(model('cd2', 'Shop', 'DomainModel'), model('book2', 'Book', 'Class', 'cd2'));
    expect(findFocusArtifacts(indexTrace(trace), 'Book').map((a) => a.id).sort()).toEqual(['book', 'book2']);
  });

  it('prefers a live element to a deleted one of the same name, and caps at five', () => {
    const trace = library();
    trace.artifacts.push(model('old', 'Book', 'Class', 'cd'));
    trace.operations.push(operation('del', 'ModelingSession', 7, {
      changes: [{ id: 'cd1', kind: 'DELETED', artifactId: 'old', oldValue: 'Book', timestamp: at(7) }],
    }));
    expect(findFocusArtifacts(indexTrace(trace), 'Book').map((a) => a.id)).toEqual(['book']);
    for (let i = 0; i < 8; i += 1) trace.artifacts.push(model(`k${i}`, `Kind${i}`, 'Class', 'cd'));
    const names = Array.from({ length: 8 }, (_, i) => `Kind${i}`).join(' ');
    expect(findFocusArtifacts(indexTrace(trace), names)).toHaveLength(5);
  });

  it('is empty when the message names nothing or is empty', () => {
    expect(ids('what is out of date?')).toEqual([]);
    expect(ids('')).toEqual([]);
  });
});

