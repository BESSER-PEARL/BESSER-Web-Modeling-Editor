import { describe, expect, it } from 'vitest';
import { diffClassModel } from '../classModelDiff';
import type { ClassModelLike } from '../classModelDiff';
import {
  COALESCE_MS,
  CREATION_FOLD_MS,
  mergeTraceFragment,
  pruneStoredContents,
  recordElementChanges,
  SESSION_IDLE_MS,
} from '../traceRecorder';
import type { RecordContext } from '../traceRecorder';
import {
  coverageMatrix,
  diagramsOf,
  diagramsOfOperation,
  fragmentLines,
  generatedFrom,
  historyOf,
  indexTrace,
  isSuspect,
  modelChildren,
} from '../traceQueries';
import { changesOf, emptyTraceFile } from '../../types/traceability';
import type { CodeArtifact, ModelArtifact, TraceFile } from '../../types/traceability';

const T0 = Date.parse('2026-10-29T10:00:00.000Z');
const at = (ms: number) => new Date(T0 + ms).toISOString();

const cls = (id: string, name: string, extra: Record<string, unknown> = {}) => ({ id, type: 'Class', name, owner: null, bounds: { x: 0, y: 0 }, ...extra });
const attr = (id: string, owner: string, name: string, extra: Record<string, unknown> = {}) => ({
  id, type: 'ClassAttribute', name, owner, attributeType: 'str', visibility: 'public', ...extra,
});
const model = (elements: any[], relationships: any[] = []): ClassModelLike => ({
  elements: Object.fromEntries(elements.map((e) => [e.id, e])),
  relationships: Object.fromEntries(relationships.map((r) => [r.id, r])),
});
const assoc = (id: string, source: string, target: string, extra: Record<string, unknown> = {}) => ({
  id, type: 'ClassBidirectional', name: '',
  source: { element: source, role: 'books', multiplicity: '*' },
  target: { element: target, role: 'library', multiplicity: '1' }, ...extra,
});

const ctx = (ms: number, overrides: Partial<RecordContext> = {}): RecordContext => ({
  diagramId: 'diagram-1', diagramTitle: 'Library', actorName: 'BESSER User', source: 'user', now: at(ms), ...overrides,
});

const record = (trace: TraceFile, previous: ClassModelLike, next: ClassModelLike, ms: number, overrides?: Partial<RecordContext>) =>
  recordElementChanges(trace, diffClassModel(previous, next), ctx(ms, overrides));

describe('diffClassModel', () => {
  it('ignores layout-only changes', () => {
    expect(diffClassModel(model([cls('c1', 'Book')]), model([cls('c1', 'Book', { bounds: { x: 50, y: 9 } })]))).toEqual([]);
  });

  it('reports creations with owners first and deletions with members first', () => {
    const changes = diffClassModel(model([]), model([attr('a1', 'c1', 'title'), cls('c1', 'Book')]));
    expect(changes.map((c) => [c.kind, c.elementType, c.name])).toEqual([
      ['CREATED', 'Class', 'Book'],
      ['CREATED', 'Property', 'title'],
    ]);
    const deleted = diffClassModel(model([cls('c1', 'Book'), attr('a1', 'c1', 'title')]), model([]));
    expect(deleted.map((c) => c.elementType)).toEqual(['Property', 'Class']);
  });

  it('reports a feature update with old and new values', () => {
    const [change] = diffClassModel(
      model([cls('c1', 'Book'), attr('a1', 'c1', 'pages')]),
      model([cls('c1', 'Book'), attr('a1', 'c1', 'pages', { attributeType: 'int' })]),
    );
    expect(change).toMatchObject({ kind: 'UPDATED', elementType: 'Property', feature: 'type', oldValue: 'str', newValue: 'int' });
  });

  it('does not report associations when a class they connect is renamed', () => {
    const before = model([cls('c1', 'Library'), cls('c2', 'Book')], [assoc('r1', 'c2', 'c1')]);
    const after = model([cls('c1', 'Library'), cls('c2', 'Novel')], [assoc('r1', 'c2', 'c1')]);
    expect(diffClassModel(before, after).map((c) => [c.elementId, c.feature])).toEqual([['c2', 'name']]);
  });

  it('treats a field the editor fills in with its default as unchanged', () => {
    const before = model([cls('c1', 'Book'), { id: 'a1', type: 'ClassAttribute', name: 'title', owner: 'c1' }]);
    const after = model([cls('c1', 'Book'), attr('a1', 'c1', 'title', { isOptional: false })]);
    expect(diffClassModel(before, after)).toEqual([]);
  });

  it('maps enumeration literals, abstract classes and generalizations to their B-UML types', () => {
    const next = model(
      [cls('c1', 'Animal', { type: 'AbstractClass' }), cls('c2', 'Dog'), { id: 'e1', type: 'Enumeration', name: 'Color', owner: null },
        { id: 'l1', type: 'ClassAttribute', name: 'RED', owner: 'e1' }],
      [{ id: 'g1', type: 'ClassInheritance', source: { element: 'c2' }, target: { element: 'c1' } }],
    );
    const types = Object.fromEntries(diffClassModel(model([]), next).map((c) => [c.elementId, c.elementType]));
    expect(types).toEqual({ c1: 'Class', c2: 'Class', e1: 'Enumeration', l1: 'EnumerationLiteral', g1: 'Generalization' });
  });
});

describe('recordElementChanges', () => {
  it('records a session with the actor, the editor and the element artifacts', () => {
    const trace = emptyTraceFile('p1');
    record(trace, model([]), model([cls('c1', 'Book'), attr('a1', 'c1', 'title')]), 0);
    expect(trace.actors.map((a) => a.name)).toEqual(['BESSER User']);
    expect(trace.tools.map((t) => t.type)).toEqual(['Editor']);
    expect(trace.operations).toHaveLength(1);
    const title = trace.artifacts.find((a) => a.type === 'ModelArtifact' && a.elementId === 'a1')!;
    const book = trace.artifacts.find((a) => a.type === 'ModelArtifact' && a.elementId === 'c1')!;
    expect(title.parentId).toBe(book.id);
  });

  it('folds a rename shortly after creation into the creation', () => {
    const trace = emptyTraceFile('p1');
    record(trace, model([]), model([cls('c1', 'Class')]), 0);
    record(trace, model([cls('c1', 'Class')]), model([cls('c1', 'Book')]), CREATION_FOLD_MS - 1);
    const changes = changesOf(trace.operations[0]);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ kind: 'CREATED', newValue: 'Book' });
  });

  it('coalesces quick updates of one feature and drops one that ends where it started', () => {
    const trace = emptyTraceFile('p1');
    const v = (name: string) => model([cls('c1', name)]);
    const base = CREATION_FOLD_MS + 1000; // the class existed before recording
    record(trace, v('Book'), v('Boo'), base);
    record(trace, v('Boo'), v('Bo'), base + COALESCE_MS - 1);
    expect(changesOf(trace.operations[0])).toEqual([expect.objectContaining({ feature: 'name', oldValue: 'Book', newValue: 'Bo' })]);
    record(trace, v('Bo'), v('Book'), base + 2 * COALESCE_MS - 2);
    expect(trace.operations).toHaveLength(0);
  });

  it('keeps a creation followed by a deletion', () => {
    const trace = emptyTraceFile('p1');
    record(trace, model([]), model([cls('c1', 'Book')]), 0);
    record(trace, model([cls('c1', 'Book')]), model([]), 1000);
    expect(changesOf(trace.operations[0]).map((c) => c.kind)).toEqual(['CREATED', 'DELETED']);
  });

  it('starts a new session after the idle time, or for the assistant', () => {
    const trace = emptyTraceFile('p1');
    record(trace, model([]), model([cls('c1', 'A')]), 0);
    record(trace, model([cls('c1', 'A')]), model([cls('c1', 'A'), cls('c2', 'B')]), SESSION_IDLE_MS + 1);
    record(trace, model([cls('c1', 'A'), cls('c2', 'B')]), model([cls('c1', 'A'), cls('c2', 'B'), cls('c3', 'C')]),
      SESSION_IDLE_MS + 2, { source: 'assistant' });
    // All three are Modeling sessions; the third is told apart by its actors, not by its type.
    expect(trace.operations.map((o) => o.type)).toEqual(['Modeling', 'Modeling', 'Modeling']);
    expect(trace.operations[2].performedBy).toHaveLength(2); // the user and the assistant
  });
});

/** A generation fragment as the backend returns it, linking class `c1` to lines 3-9 of sql_alchemy.py. */
function generationFragment(ms: number, content = 'line\n'.repeat(12)): TraceFile {
  const time = at(ms);
  return {
    schemaVersion: 1, projectId: null,
    actors: [{ id: 'fa', type: 'Person', name: 'BESSER User', timestamp: time }],
    tools: [{ id: 'ft', type: 'CodeGenerator', name: 'sqlalchemy', version: '8.5.0', timestamp: time }],
    artifacts: [
      { id: 'fm', type: 'ModelArtifact', name: 'Library', elementId: 'diagram-1', elementType: 'DomainModel', timestamp: time },
      { id: 'ff', type: 'CodeArtifact', name: 'sql_alchemy.py', path: 'sql_alchemy.py', contentHash: 'h', content, timestamp: time },
      { id: 'fc', type: 'ModelArtifact', name: 'Book', elementId: 'c1', elementType: 'Class', parentId: 'fm', timestamp: time },
      { id: 'fr', type: 'CodeArtifact', name: 'Book (3-9)', path: 'sql_alchemy.py', contentHash: 'h2', startLine: 3, endLine: 9, parentId: 'ff', timestamp: time },
    ],
    operations: [{ id: 'fo', type: 'CodeGeneration', status: 'SUCCEEDED', startedAt: time, endedAt: time,
      performedBy: ['fa'], uses: ['ft'], consumes: ['fm', 'fc'], produces: ['ff', 'fr'], logs: [] }],
    traceLinks: [{ id: 'fl', sourceId: 'fc', targetId: 'fr', operationId: 'fo', timestamp: time,
      evidence: [{ id: 'fe', type: 'RuleEvidence', rule: 'sql_alchemy_template.py.j2#class', timestamp: time }],
      confidence: { id: 'fk', value: 1, basedOn: ['fe'], timestamp: time } }],
  };
}

describe('mergeTraceFragment and queries', () => {
  const recordedThenGenerated = () => {
    const trace = emptyTraceFile('p1');
    record(trace, model([]), model([cls('c1', 'Book'), attr('a1', 'c1', 'title')]), 0);
    mergeTraceFragment(trace, generationFragment(60_000));
    return trace;
  };

  it('links the generated code to the element the editor recorded', () => {
    const trace = recordedThenGenerated();
    const book = trace.artifacts.find((a): a is ModelArtifact => a.type === 'ModelArtifact' && a.elementId === 'c1')!;
    expect(trace.artifacts.filter((a) => a.type === 'ModelArtifact' && a.elementId === 'c1')).toHaveLength(1);
    expect(trace.actors).toHaveLength(1);
    const index = indexTrace(trace);
    const [fragment] = generatedFrom(index, book.id);
    expect(fragment.fragment.startLine).toBe(3);
    expect(fragment.suspect).toBe(false);
  });

  it('marks the link suspect when the element or one of its members changes later', () => {
    const trace = recordedThenGenerated();
    const before = model([cls('c1', 'Book'), attr('a1', 'c1', 'title')]);
    record(trace, before, model([cls('c1', 'Book'), attr('a1', 'c1', 'title', { attributeType: 'int' })]), 120_000);
    const index = indexTrace(trace);
    expect(isSuspect(index, trace.traceLinks[0])).toBe(true);
    const book = trace.artifacts.find((a) => a.type === 'ModelArtifact' && a.elementId === 'c1')!;
    expect(historyOf(index, book.id).map((c) => c.change.kind)).toEqual(['CREATED', 'CREATED', 'UPDATED']);
    const [group] = coverageMatrix(index, 5).groups;
    expect(group.elements.find((r) => r.element.id === book.id)!.cells).toEqual(['suspect']);
  });

  it('keeps file contents only for the newest generations of a path', () => {
    const trace = emptyTraceFile('p1');
    for (let i = 0; i < 5; i += 1) mergeTraceFragment(trace, { ...generationFragment(i * 1000), artifacts: generationFragment(i * 1000).artifacts.map((a) => ({ ...a, id: `${a.id}${i}`, ...(a.parentId ? { parentId: `${a.parentId}${i}` } : {}) })) });
    const files = trace.artifacts.filter((a): a is CodeArtifact => a.type === 'CodeArtifact' && a.startLine === undefined);
    expect(files.filter((f) => f.content !== undefined)).toHaveLength(3);
    expect(pruneStoredContents(trace, 1)).toBe(2);
  });
});

describe('diagram trees', () => {
  const twoDiagrams = () => {
    const trace = emptyTraceFile('p1');
    record(trace, model([]), model([cls('c1', 'Book'), attr('a1', 'c1', 'title')]), 0);
    record(trace, model([]), model([cls('c9', 'Order')]), 1_000, { diagramId: 'diagram-2', diagramTitle: 'Shop' });
    mergeTraceFragment(trace, generationFragment(60_000));
    return trace;
  };

  it('lists each diagram with its elements, and members under their element', () => {
    const index = indexTrace(twoDiagrams());
    const diagrams = diagramsOf(index);
    expect(diagrams.map((d) => [d.name, d.elementType])).toEqual([['Library', 'DomainModel'], ['Shop', 'DomainModel']]);
    const [book] = modelChildren(index, diagrams[0].id);
    expect(book.name).toBe('Book');
    expect(modelChildren(index, book.id).map((m) => m.name)).toEqual(['title']);
    expect(modelChildren(index, diagrams[1].id).map((m) => m.name)).toEqual(['Order']);
  });

  it('names the diagrams an operation changed or read', () => {
    const index = indexTrace(twoDiagrams());
    // Both diagrams were edited in one modeling session; the generation read one of them.
    const [session, generation] = index.trace.operations;
    expect(diagramsOfOperation(index, session).map((d) => d.name)).toEqual(['Library', 'Shop']);
    expect(diagramsOfOperation(index, generation).map((d) => d.name)).toEqual(['Library']);
  });

  it("covers a diagram's whole file in its own row, apart from its elements", () => {
    const trace = twoDiagrams();
    const diagramId = trace.artifacts.find((a) => a.type === 'ModelArtifact' && a.elementId === 'diagram-1')!.id;
    trace.traceLinks.push({ ...trace.traceLinks[0], id: 'whole', sourceId: diagramId, targetId: 'ff' });
    const index = indexTrace(trace);
    const groups = coverageMatrix(index, 5).groups;
    expect(groups.map((g) => [g.diagram.element.name, g.diagram.cells])).toEqual([['Library', ['generated']], ['Shop', ['none']]]);
    const [whole] = generatedFrom(index, diagramId);
    expect(fragmentLines(whole)).toHaveLength(13);
  });

  it('files a member under its element even when the element was never recorded', () => {
    const trace = emptyTraceFile('p1');
    const before = model([cls('c1', 'Book'), attr('a1', 'c1', 'title')]);
    record(trace, before, model([cls('c1', 'Book'), attr('a1', 'c1', 'name')]), 0);
    const index = indexTrace(trace);
    const [diagram] = diagramsOf(index);
    expect(modelChildren(index, diagram.id).map((e) => [e.name, e.elementType])).toEqual([['Book', 'Class']]);
    expect(modelChildren(index, modelChildren(index, diagram.id)[0].id).map((m) => m.name)).toEqual(['name']);
  });
});
