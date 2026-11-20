import { describe, expect, it } from 'vitest';
import { indexTrace, resolveArtifactId } from '../traceQueries';
import { lineageOf } from '../lineage';
import { traceSummary } from '../traceSummary';
import { requirementCoverage } from '../requirementCoverage';
import { emptyTraceFile } from '../../types/traceability';
import type { TraceArtifact, TraceFile, TraceLink, TraceOperation } from '../../types/traceability';

const at = (minute: number) => new Date(Date.UTC(2026, 9, 29, 10, minute)).toISOString();

const model = (id: string, name: string, elementType: string, parentId?: string): TraceArtifact => ({
  id, type: 'ModelArtifact', name, elementId: `e-${id}`, elementType, timestamp: at(0), ...(parentId ? { parentId } : {}),
});
const code = (id: string, path: string, parentId?: string, lines?: [number, number]): TraceArtifact => ({
  id, type: 'CodeArtifact', name: id, path, contentHash: 'h', timestamp: at(0),
  ...(parentId ? { parentId } : {}), ...(lines ? { startLine: lines[0], endLine: lines[1] } : {}),
});
const requirement = (id: string, name: string): TraceArtifact => ({
  id, type: 'RequirementArtifact', name, quote: name, kind: 'data', timestamp: at(0),
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
  evidence: [{ id: `${id}-e`, type: 'RuleEvidence', rule: 'r', timestamp: at(minute) }],
  ...extra,
});

/**
 * Two requirements extracted by the assistant: "Books have a title" realized by class Book (and its title),
 * "Members can borrow" realized by nothing. SQLAlchemy generated Book twice; Book was renamed after the
 * newest run, so its code is out of date. A spec-driven run linked the first requirement straight to a file.
 */
function library(): TraceFile {
  return {
    ...emptyTraceFile('p1'),
    actors: [{ id: 'ada', type: 'Person', name: 'Ada', timestamp: at(0) }],
    tools: [
      { id: 'gen', type: 'CodeGenerator', name: 'sqlalchemy', timestamp: at(0) },
      { id: 'sd', type: 'LLM', name: 'spec-driven', timestamp: at(0) },
    ],
    artifacts: [
      model('cd', 'Library', 'DomainModel'), model('book', 'Book', 'Class', 'cd'), model('title', 'title', 'Property', 'book'),
      code('f1', 'models.py'), code('b1', 'models.py', 'f1', [3, 9]),
      code('f2', 'models.py'), code('b2', 'models.py', 'f2', [3, 11]),
      code('api', 'api.py'),
      requirement('r1', 'Books have a title'), requirement('r2', 'Members can borrow books'),
    ],
    operations: [
      operation('x', 'RequirementExtraction', 0, { writes: ['r1', 'r2'] }),
      operation('m', 'ModelingSession', 1, {
        changes: [{ id: 'c0', kind: 'CREATED', artifactId: 'book', newValue: 'Book', timestamp: at(1) }],
      }),
      operation('run1', 'CodeGeneration', 2, { toolCalls: [call('gen', 2)], writes: ['f1', 'b1'] }),
      operation('run2', 'CodeGeneration', 4, { toolCalls: [call('gen', 4)], writes: ['f2', 'b2'] }),
      operation('sdrun', 'CodeGeneration', 5, { toolCalls: [call('sd', 5)], writes: ['api'] }),
      operation('rename', 'ModelingSession', 6, {
        changes: [{ id: 'c1', kind: 'UPDATED', artifactId: 'book', feature: 'name', oldValue: 'Volume', newValue: 'Book', timestamp: at(6) }],
      }),
    ],
    traceLinks: [
      link('real1', 'r1', 'book', 'm', 1), link('real2', 'r1', 'title', 'm', 1),
      link('g1', 'book', 'b1', 'run1', 2), link('d1', 'cd', 'f1', 'run1', 2),
      link('g2', 'book', 'b2', 'run2', 4), link('d2', 'cd', 'f2', 'run2', 4),
      link('v', 'r1', 'api', 'sdrun', 5, {
        evidence: [{ id: 'v-e', type: 'AIEvidence', algorithm: 'spec-driven', timestamp: at(5) }],
        confidence: { id: 'v-c', value: 0.72, explanation: 'The API exposes the title', timestamp: at(5) },
      }),
    ],
  };
}

describe('indexTrace', () => {
  it('indexes links by operation, actors and tools by id, model artifacts by editor id and writers', () => {
    const index = indexTrace(library());
    expect(index.linksByOperation.get('run2')!.map((l) => l.id)).toEqual(['g2', 'd2']);
    expect(index.linksByOperation.has('rename')).toBe(false);
    expect(index.actorsById.get('ada')!.name).toBe('Ada');
    expect(index.toolsById.get('gen')!.name).toBe('sqlalchemy');
    expect(index.artifactsByElementId.get('e-book')!.id).toBe('book');
    expect(index.writerOf.get('f2')!.id).toBe('run2');
  });
});

describe('resolveArtifactId', () => {
  const index = indexTrace(library());
  it('takes a trace artifact id as it is, and maps an editor element id to its artifact', () => {
    expect(resolveArtifactId(index, 'book')).toBe('book');
    expect(resolveArtifactId(index, 'e-book')).toBe('book');
    expect(resolveArtifactId(index, 'e-cd')).toBe('cd');
  });
  it('gives null for what the trace does not hold', () => {
    expect(resolveArtifactId(index, 'nope')).toBeNull();
    expect(resolveArtifactId(index, null)).toBeNull();
    expect(resolveArtifactId(index, '')).toBeNull();
  });
});

describe('traceSummary', () => {
  it('counts the current links, the out-of-date ones, and the files each generator should regenerate', () => {
    const index = indexTrace(library());
    const summary = traceSummary(index, lineageOf(index, null, { history: false }));
    expect(summary.operations).toBe(6);
    expect(summary.artifacts).toBe(10);
    // run1's links are superseded by run2's; the requirement links and the spec-driven verdict stay.
    expect(summary.links).toBe(5);
    // Book was renamed after run2 (its link and the diagram's) and after the requirement links were made.
    expect(summary.outOfDateLinks).toBeGreaterThanOrEqual(2);
    expect(summary.staleGenerators).toHaveLength(1);
    const [stale] = summary.staleGenerators;
    expect(stale.tool!.name).toBe('sqlalchemy');
    expect(stale.operation.id).toBe('run2');
    expect(stale.files.map((f) => f.id)).toEqual(['f2']);
  });

  it('reports nothing to regenerate when the code is up to date', () => {
    const file = library();
    file.operations = file.operations.filter((o) => o.id !== 'rename');
    const index = indexTrace(file);
    const summary = traceSummary(index, lineageOf(index, null, { history: false }));
    expect(summary.outOfDateLinks).toBe(0);
    expect(summary.staleGenerators).toEqual([]);
  });
});

describe('requirementCoverage', () => {
  it('follows each requirement to the elements realizing it and the newest code generated from them', () => {
    const { groups, counts } = requirementCoverage(indexTrace(library()));
    expect(groups).toHaveLength(1);
    const [r1, r2] = groups[0].rows;
    expect(r1.requirement.id).toBe('r1');
    expect(r1.realizations.map((r) => r.element.id)).toEqual(['book', 'title']);
    // Book's newest SQLAlchemy fragment (not run1's), and the file the verdict points to.
    expect(r1.code.map((c) => c.code.id)).toEqual(['api', 'b2']);
    expect(r1.code.find((c) => c.code.id === 'b2')!.via!.id).toBe('book');
    expect(r1.code.find((c) => c.code.id === 'api')!.via).toBeNull();
    expect(r1.status).toBe('generated');
    expect(r1.outOfDate).toBe(true);
    expect(r1.verdicts).toHaveLength(1);
    expect(r1.verdicts[0].confidence!.value).toBe(0.72);
    expect(r1.verdicts[0].evidence[0].type).toBe('AIEvidence');

    expect(r2.status).toBe('uncovered');
    expect(r2.realizations).toEqual([]);
    expect(counts).toEqual({ generated: 1, modeled: 0, uncovered: 1 });
  });

  it('tells a modeled requirement without code from one realized only by deleted elements', () => {
    const file = library();
    file.traceLinks = file.traceLinks.filter((l) => !['g1', 'g2', 'v'].includes(l.id));
    expect(requirementCoverage(indexTrace(file)).groups[0].rows[0].status).toBe('modeled');

    file.operations.push(operation('del', 'ModelingSession', 7, {
      changes: [{ id: 'c2', kind: 'DELETED', artifactId: 'book', oldValue: 'Book', timestamp: at(7) }],
    }));
    const [row] = requirementCoverage(indexTrace(file)).groups[0].rows;
    expect(row.status).toBe('uncovered');
    expect(row.realizations.every((r) => r.deleted)).toBe(true);
  });

  it('has nothing to show without an extraction', () => {
    const file = library();
    file.operations = file.operations.filter((o) => o.type !== 'RequirementExtraction');
    expect(requirementCoverage(indexTrace(file)).groups).toEqual([]);
  });
});
