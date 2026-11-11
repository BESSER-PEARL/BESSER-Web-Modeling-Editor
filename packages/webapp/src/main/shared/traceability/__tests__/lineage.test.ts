import { describe, expect, it } from 'vitest';
import { expandableIds, lineageLayout, lineageOf, lineageStartingPoints } from '../lineage';
import type { Lineage, LineageLayout } from '../lineage';
import { indexTrace } from '../traceQueries';
import { emptyTraceFile } from '../../types/traceability';
import type { TraceArtifact, TraceFile, TraceLink, TraceOperation } from '../../types/traceability';

const at = (minute: number) => new Date(Date.UTC(2026, 9, 29, 10, minute)).toISOString();

const model = (id: string, name: string, elementType: string, parentId?: string): TraceArtifact => ({
  id, type: 'ModelArtifact', name, elementId: `e-${id}`, elementType, timestamp: at(0), ...(parentId ? { parentId } : {}),
});
const code = (id: string, parentId?: string, lines?: [number, number]): TraceArtifact => ({
  id, type: 'CodeArtifact', name: id, path: 'sql_alchemy.py', contentHash: 'h', timestamp: at(0),
  ...(parentId ? { parentId } : {}), ...(lines ? { startLine: lines[0], endLine: lines[1] } : {}),
});
const operation = (id: string, type: TraceOperation['type'], minute: number, extra: Record<string, unknown> = {}): TraceOperation =>
  ({
    id, type, status: 'SUCCEEDED', startedAt: at(minute), endedAt: at(minute),
    performedBy: ['ada'], toolCalls: [], reads: [], writes: [],
    ...(type === 'ModelingSession' ? { changes: [] } : {}),
    ...extra,
  }) as TraceOperation;
/** A call to a generator, made at `minute`. */
const call = (toolId: string, minute: number) =>
  ({ id: `${toolId}-${minute}`, toolId, sequenceNumber: 0, status: 'SUCCEEDED' as const, startedAt: at(minute), logs: [] });
const link = (id: string, sourceId: string, targetId: string, operationId: string, minute: number, confidence = 1): TraceLink => ({
  id, sourceId, targetId, operationId, timestamp: at(minute),
  evidence: [{ id: `${id}-e`, type: confidence < 1 ? 'AIEvidence' : 'RuleEvidence', ...(confidence < 1 ? { algorithm: 'llm', logIds: [] } : { rule: 'r' }), timestamp: at(minute) } as TraceLink['evidence'][number]],
  confidence: { id: `${id}-c`, value: confidence, timestamp: at(minute) },
});

/**
 * A knowledge-graph concept converted (by an AI step) into class Book, which two SQLAlchemy runs
 * turned into code; the class diagram also links to each run's file.
 */
function chain(): TraceFile {
  return {
    ...emptyTraceFile('p1'),
    actors: [{ id: 'ada', type: 'Person', name: 'Ada', timestamp: at(0) }],
    tools: [{ id: 'gen', type: 'CodeGenerator', name: 'sqlalchemy', timestamp: at(0) }],
    artifacts: [
      model('kg', 'Library KG', 'KnowledgeGraph'), model('concept', 'Book concept', 'KGClass', 'kg'),
      model('cd', 'Class Diagram', 'DomainModel'), model('book', 'Book', 'Class', 'cd'), model('title', 'title', 'Property', 'book'),
      code('f1'), code('b1', 'f1', [3, 9]), code('f2'), code('b2', 'f2', [5, 11]),
    ],
    operations: [
      operation('convert', 'ModelingSession', 1),
      operation('run1', 'CodeGeneration', 2, { toolCalls: [call('gen', 2)], writes: ['f1', 'b1'] }),
      operation('run2', 'CodeGeneration', 4, { toolCalls: [call('gen', 4)], writes: ['f2', 'b2'] }),
    ],
    traceLinks: [
      link('k', 'concept', 'book', 'convert', 1, 0.8),
      link('g1', 'book', 'b1', 'run1', 2), link('d1', 'cd', 'f1', 'run1', 2),
      link('g2', 'book', 'b2', 'run2', 4), link('d2', 'cd', 'f2', 'run2', 4),
    ],
  };
}

const latest = { latestGenerationOnly: true };
const ids = (lineage: Lineage) => [...lineage.nodes.keys()].sort();
const edgeIds = (lineage: Lineage) => lineage.edges.map((e) => e.link.id).sort();
/** Each column's cards, each card as its visible rows (`id`, or `id+` when it hides parts), indented by depth.
 *  A generation run's card is `run:<operation id>`. */
const drawn = (layout: LineageLayout) =>
  layout.columns.map((cards) =>
    cards.map((card) => card.rows.map((r) => `${'  '.repeat(r.depth)}${r.subject.id}${r.parts > 0 && !r.expanded ? '+' : ''}`)),
  );
const bundles = (layout: LineageLayout) =>
  Object.fromEntries(layout.bundles.map((b) => [`${b.sourceId}->${b.targetId}`, b.edges.map((e) => e.link.id).sort()]));

describe('lineageOf', () => {
  it('follows links upstream and downstream', () => {
    const lineage = lineageOf(indexTrace(chain()), 'book', latest);
    expect(ids(lineage)).toEqual(['b2', 'book', 'concept']);
    expect(edgeIds(lineage)).toEqual(['g2', 'k']);
  });

  it('shows older generations only when asked', () => {
    const lineage = lineageOf(indexTrace(chain()), 'book', { latestGenerationOnly: false });
    expect(edgeIds(lineage)).toEqual(['g1', 'g2', 'k']);
  });

  it("starts a diagram's lineage from the diagram and its linked elements", () => {
    const lineage = lineageOf(indexTrace(chain()), 'cd', latest);
    expect(ids(lineage)).toEqual(['b2', 'book', 'cd', 'concept', 'f2']);
  });

  it('covers the whole project without a starting point', () => {
    const lineage = lineageOf(indexTrace(chain()), null, latest);
    expect(edgeIds(lineage)).toEqual(['d2', 'g2', 'k']);
    expect(lineage.nodes.has('f1')).toBe(false); // reached only through an older generation
  });

  it('marks a link whose source changed out of date, and what follows it upstream changed', () => {
    const trace = chain();
    // The concept changes after the conversion: the class may be out of date, and so its code.
    trace.operations.push(operation('edit', 'ModelingSession', 6, {
      changes: [{ id: 'c1', kind: 'UPDATED', artifactId: 'concept', feature: 'name', oldValue: 'Book', newValue: 'Volume', timestamp: at(6) }],
    }));
    const lineage = lineageOf(indexTrace(trace), 'book', latest);
    const reasons = Object.fromEntries(lineage.edges.map((e) => [e.link.id, e.outOfDate]));
    expect(reasons).toEqual({ k: ['SOURCE_CHANGED'], g2: ['UPSTREAM_CHANGED'] });
    expect(lineage.nodes.get('book')!.outOfDate).toBe(true);
    expect(lineage.nodes.get('b2')!.outOfDate).toBe(true);
    expect(lineage.nodes.get('concept')!.outOfDate).toBe(false);
  });

  it('follows a chain that starts from a prompt in a conversation', () => {
    const trace = chain();
    trace.artifacts.push({ id: 'prompt', type: 'PromptArtifact', name: 'Library prompt', content: 'Books have a title.',
      contentHash: 'h', timestamp: at(0) });
    trace.operations.push(operation('chat', 'Conversation', 0, { performedBy: ['ada', 'assistant'] }));
    trace.traceLinks.push(link('p', 'prompt', 'concept', 'chat', 0, 0.9));
    const index = indexTrace(trace);
    const lineage = lineageOf(index, 'book', latest);
    expect(ids(lineage)).toEqual(['b2', 'book', 'concept', 'prompt']);
    expect(drawn(lineageLayout(index, lineage, new Set())).map((column) => column.map((card) => card[0]))).toEqual([
      ['prompt'], ['kg+'], ['cd+'], ['run:run2+'],
    ]);
  });

  it('marks code out of date when a member of its element changes, and the link that made the element too', () => {
    const trace = chain();
    trace.operations.push(operation('edit', 'ModelingSession', 6, {
      changes: [{ id: 'c1', kind: 'UPDATED', artifactId: 'title', feature: 'type', oldValue: 'str', newValue: 'int', timestamp: at(6) }],
    }));
    const lineage = lineageOf(indexTrace(trace), 'book', latest);
    expect(lineage.edges.find((e) => e.link.id === 'g2')!.outOfDate).toEqual(['SOURCE_CHANGED']);
    // The class was edited after the conversion made it; an edited target is not passed on downstream.
    expect(lineage.edges.find((e) => e.link.id === 'k')!.outOfDate).toEqual(['TARGET_CHANGED']);
  });

  it('does not count the changes of the operation that made the link', () => {
    const trace = chain();
    // The conversion goes on editing the class it made (an assistant's later reply in the same turn).
    const convert = trace.operations.find((o) => o.id === 'convert') as Extract<TraceOperation, { type: 'ModelingSession' }>;
    convert.changes.push({ id: 'c1', kind: 'CREATED', artifactId: 'title', timestamp: at(3) });
    const outOfDateOf = (t: TraceFile) => lineageOf(indexTrace(t), 'book', latest).edges.find((e) => e.link.id === 'k')!.outOfDate;
    expect(outOfDateOf(trace)).toEqual([]);
    trace.operations.push(operation('edit', 'ModelingSession', 6, {
      changes: [{ id: 'c2', kind: 'UPDATED', artifactId: 'book', feature: 'name', oldValue: 'Book', newValue: 'Volume', timestamp: at(6) }],
    }));
    expect(outOfDateOf(trace)).toEqual(['TARGET_CHANGED']);
  });

  it('terminates on a cyclic trace', () => {
    const trace = chain();
    trace.traceLinks.push(link('loop', 'b2', 'concept', 'run2', 5));
    const index = indexTrace(trace);
    expect(() => lineageLayout(index, lineageOf(index, 'book', latest), new Set(['kg', 'cd', 'f2']))).not.toThrow();
  });
});

describe('lineageLayout', () => {
  const project = () => {
    const index = indexTrace(chain());
    return { index, lineage: lineageOf(index, null, latest) };
  };

  it('starts with diagrams and generation runs, their links bundled', () => {
    const { index, lineage } = project();
    const layout = lineageLayout(index, lineage, new Set());
    expect(drawn(layout)).toEqual([[['kg+']], [['cd+']], [['run:run2+']]]);
    // The class's fragment link and the diagram's whole-file link both join the diagram to the run's code.
    expect(bundles(layout)).toEqual({ 'kg->cd': ['k'], 'cd->run:run2': ['d2', 'g2'] });
  });

  it('shows the parts of an expanded subject, and the links reach them', () => {
    const { index, lineage } = project();
    const layout = lineageLayout(index, lineage, new Set(['cd', 'run:run2', 'f2']));
    // The class holds a member the trace links nothing to: it is shown, untraced, as the model has it.
    expect(drawn(layout)).toEqual([[['kg+']], [['cd', '  book+']], [['run:run2', '  f2', '    b2']]]);
    expect(bundles(layout)).toEqual({ 'kg->book': ['k'], 'book->b2': ['g2'], 'cd->f2': ['d2'] });
  });

  it('lists members by kind and fragments by line', () => {
    const trace = chain();
    trace.artifacts.push(
      model('read', 'read', 'Method', 'book'), model('pages', 'pages', 'Property', 'book'),
      code('t2', 'f2', [6, 6]), code('r2', 'f2', [9, 10]), code('p2', 'f2', [7, 7]),
    );
    trace.traceLinks.push(link('gt', 'title', 't2', 'run2', 4), link('gr', 'read', 'r2', 'run2', 4), link('gp', 'pages', 'p2', 'run2', 4));
    const index = indexTrace(trace);
    const layout = lineageLayout(index, lineageOf(index, null, latest), new Set(['cd', 'book', 'run:run2', 'f2']));
    expect(drawn(layout)[1][0]).toEqual(['cd', '  book', '    pages', '    title', '    read']);
    expect(drawn(layout)[2][0]).toEqual(['run:run2', '  f2', '    b2', '    t2', '    p2', '    r2']);
  });

  it('flags a collapsed artifact when a part it hides may be out of date', () => {
    const trace = chain();
    trace.operations.push(operation('edit', 'ModelingSession', 6, {
      changes: [{ id: 'c1', kind: 'UPDATED', artifactId: 'book', feature: 'name', oldValue: 'Libro', newValue: 'Book', timestamp: at(6) }],
    }));
    const index = indexTrace(trace);
    const lineage = lineageOf(index, null, latest);
    const code = (expanded: Set<string>) => lineageLayout(index, lineage, expanded).columns[2][0].rows;
    expect(code(new Set()).map((r) => r.outOfDate)).toEqual([true]);
    // Opened, the run has no flag of its own: its file and fragment carry theirs.
    expect(code(new Set(['run:run2', 'f2'])).map((r) => [r.subject.id, r.outOfDate])).toEqual([
      ['run:run2', false], ['f2', true], ['b2', true],
    ]);
  });

  it('places each card right of what it was derived from, ordered so links cross less', () => {
    const trace = chain();
    // A second diagram, first by name, generated into a second file.
    trace.artifacts.push(model('ad', 'A diagram', 'DomainModel'), code('f3'));
    trace.operations.push(operation('run3', 'CodeGeneration', 5, { toolCalls: [call('other', 5)], writes: ['f3'] }));
    trace.traceLinks.push(link('d3', 'ad', 'f3', 'run3', 5));
    const index = indexTrace(trace);
    const layout = lineageLayout(index, lineageOf(index, null, latest), new Set());
    const cards = drawn(layout).map((column) => column.map((card) => card[0]));
    expect(cards).toEqual([['ad', 'kg+'], ['run:run3+', 'cd+'], ['run:run2+']]);
  });

  it('expands everything that has parts', () => {
    const { index, lineage } = project();
    expect([...expandableIds(index, lineage)].sort()).toEqual(['book', 'cd', 'f2', 'kg', 'run:run2']);
  });

  it('shows the model elements the trace links nothing to, untraced, but not deleted ones', () => {
    const trace = chain();
    // Added by hand after the diagram was generated: no link reaches them.
    trace.artifacts.push(model('isbn', 'isbn', 'Property', 'book'), model('author', 'Author', 'Class', 'cd'),
      model('gone', 'gone', 'Property', 'book'));
    trace.operations.push(operation('edit', 'ModelingSession', 6, {
      changes: [{ id: 'c1', kind: 'DELETED', artifactId: 'gone', oldValue: 'gone', timestamp: at(6) }],
    }));
    const index = indexTrace(trace);
    const rows = lineageLayout(index, lineageOf(index, null, latest), new Set(['cd', 'book'])).columns[1][0].rows;
    expect(rows.map((r) => [r.subject.id, r.traced])).toEqual([
      ['cd', true], ['author', false], ['book', true], ['isbn', false], ['title', false],
    ]);
  });

  it("shows every member of an element in an artifact's lineage, but not the model's other elements", () => {
    const trace = chain();
    trace.artifacts.push(model('isbn', 'isbn', 'Property', 'book'), model('author', 'Author', 'Class', 'cd'));
    const index = indexTrace(trace);
    const layout = lineageLayout(index, lineageOf(index, 'b2', latest), new Set(['cd', 'book']));
    expect(drawn(layout).flat().find((card) => card[0] === 'cd')).toEqual(['cd', '  book', '    isbn', '    title']);
  });
});

describe('lineageStartingPoints', () => {
  it('offers the models with their elements, the prompts and the files of each run, all taking part in links', () => {
    const trace = chain();
    trace.artifacts.push(
      model('status', 'Status', 'Enumeration', 'cd'), model('lends', 'lends', 'BinaryAssociation', 'cd'),
      model('idle', 'Idle', 'Class', 'cd'), // no link: no lineage to start from
      code('s2', 'f2', [20, 22]), code('a2', 'f2', [30, 31]),
      { id: 'prompt', type: 'PromptArtifact', name: 'A library', content: 'A library', contentHash: 'h', timestamp: at(0) },
    );
    trace.traceLinks.push(link('gs', 'status', 's2', 'run2', 4), link('ga', 'lends', 'a2', 'run2', 4), link('p', 'prompt', 'book', 'convert', 1));
    const index = indexTrace(trace);
    const points = lineageStartingPoints(index, lineageOf(index, null, latest));
    expect(points.models.map(({ model: m, elements }) => [m.id, elements.map((e) => e.id)])).toEqual([
      ['cd', ['book', 'status', 'lends']], // classes, then enumerations, then associations
      ['kg', ['concept']],
    ]);
    expect(points.prompts.map((p) => p.id)).toEqual(['prompt']);
    // The latest run only (the older one is not in the lineage), with its files.
    expect(points.runs.map((r) => [r.operation.id, r.files.map((f) => f.id)])).toEqual([['run2', ['f2']]]);
  });
});
