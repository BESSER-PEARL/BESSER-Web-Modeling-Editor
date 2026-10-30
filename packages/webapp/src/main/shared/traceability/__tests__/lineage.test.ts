import { describe, expect, it } from 'vitest';
import { lineageOf } from '../lineage';
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
    performedBy: ['ada'], uses: [], consumes: [], produces: [], logs: [],
    ...(type === 'Modeling' ? { changes: [] } : {}),
    ...extra,
  }) as TraceOperation;
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
      operation('convert', 'Modeling', 1),
      operation('run1', 'CodeGeneration', 2, { uses: ['gen'], produces: ['f1', 'b1'] }),
      operation('run2', 'CodeGeneration', 4, { uses: ['gen'], produces: ['f2', 'b2'] }),
    ],
    traceLinks: [
      link('k', 'concept', 'book', 'convert', 1, 0.8),
      link('g1', 'book', 'b1', 'run1', 2), link('d1', 'cd', 'f1', 'run1', 2),
      link('g2', 'book', 'b2', 'run2', 4), link('d2', 'cd', 'f2', 'run2', 4),
    ],
  };
}

const latest = { latestGenerationOnly: true };

describe('lineageOf', () => {
  it('follows links upstream and downstream, one column per step', () => {
    const lineage = lineageOf(indexTrace(chain()), 'book', latest);
    expect([...lineage.nodes.values()].map((n) => [n.artifact.id, n.column])).toEqual(
      expect.arrayContaining([['concept', 0], ['book', 1], ['b2', 2]]),
    );
    expect(lineage.nodes.size).toBe(3);
    expect(lineage.edges.map((e) => e.link.id).sort()).toEqual(['g2', 'k']);
  });

  it('shows older generations only when asked', () => {
    const lineage = lineageOf(indexTrace(chain()), 'book', { latestGenerationOnly: false });
    expect(lineage.edges.map((e) => e.link.id).sort()).toEqual(['g1', 'g2', 'k']);
  });

  it("starts a diagram's lineage from the diagram and its linked elements, grouped by container", () => {
    const lineage = lineageOf(indexTrace(chain()), 'cd', latest);
    expect([...lineage.nodes.keys()].sort()).toEqual(['b2', 'book', 'cd', 'concept', 'f2']);
    const classColumn = lineage.columns[lineage.nodes.get('book')!.column];
    const diagramGroup = classColumn.find((g) => g.container.id === 'cd')!;
    expect(diagramGroup.nodes.map((n) => n.artifact.id)).toEqual(['book']);
    const codeGroup = lineage.columns[lineage.nodes.get('b2')!.column].find((g) => g.container.id === 'f2')!;
    expect(codeGroup.nodes.map((n) => n.artifact.id)).toEqual(['b2']);
  });

  it('marks a changed source suspect and everything derived from it stale', () => {
    const trace = chain();
    // The concept changes after the conversion: the class may be out of date, and so its code.
    trace.operations.push(operation('edit', 'Modeling', 6, {
      changes: [{ id: 'c1', kind: 'UPDATED', artifactId: 'concept', feature: 'name', oldValue: 'Book', newValue: 'Volume', timestamp: at(6) }],
    }));
    const lineage = lineageOf(indexTrace(trace), 'book', latest);
    const state = Object.fromEntries(lineage.edges.map((e) => [e.link.id, e.state]));
    expect(state).toEqual({ k: 'suspect', g2: 'staleUpstream' });
    expect(lineage.nodes.get('book')!.stale).toBe(true);
    expect(lineage.nodes.get('b2')!.stale).toBe(true);
    expect(lineage.nodes.get('concept')!.stale).toBe(false);
  });

  it('follows a chain that starts from a prompt in a conversation', () => {
    const trace = chain();
    trace.artifacts.push({ id: 'prompt', type: 'PromptArtifact', name: 'Library prompt', content: 'Books have a title.',
      contentHash: 'h', timestamp: at(0) });
    trace.operations.push(operation('chat', 'Conversation', 0, { performedBy: ['ada', 'assistant'] }));
    trace.traceLinks.push(link('p', 'prompt', 'concept', 'chat', 0, 0.9));
    const lineage = lineageOf(indexTrace(trace), 'book', latest);
    expect([...lineage.nodes.values()].map((n) => [n.artifact.id, n.column])).toEqual(
      expect.arrayContaining([['prompt', 0], ['concept', 1], ['book', 2], ['b2', 3]]),
    );
  });

  it('marks code suspect when a member of its element changes', () => {
    const trace = chain();
    trace.operations.push(operation('edit', 'Modeling', 6, {
      changes: [{ id: 'c1', kind: 'UPDATED', artifactId: 'title', feature: 'type', oldValue: 'str', newValue: 'int', timestamp: at(6) }],
    }));
    const lineage = lineageOf(indexTrace(trace), 'book', latest);
    expect(lineage.edges.find((e) => e.link.id === 'g2')!.state).toBe('suspect');
    expect(lineage.edges.find((e) => e.link.id === 'k')!.state).toBe('current');
  });

  it('orders code by the position of the element it comes from, so links do not cross', () => {
    const trace = chain();
    trace.traceLinks = trace.traceLinks.filter((l) => l.id !== 'k'); // both classes in the first column
    // Author comes before Book, but its code comes after Book's in the file.
    trace.artifacts.push(model('author', 'Author', 'Class', 'cd'), code('a2', 'f2', [20, 25]));
    trace.traceLinks.push(link('g3', 'author', 'a2', 'run2', 4));
    const lineage = lineageOf(indexTrace(trace), 'cd', latest);
    const codeGroup = lineage.columns[lineage.nodes.get('b2')!.column].find((g) => g.container.id === 'f2')!;
    expect(codeGroup.nodes.map((n) => n.artifact.id)).toEqual(['a2', 'b2']);
  });

  it('terminates on a cyclic trace', () => {
    const trace = chain();
    trace.traceLinks.push(link('loop', 'b2', 'concept', 'run2', 5));
    expect(() => lineageOf(indexTrace(trace), 'book', latest)).not.toThrow();
  });
});
