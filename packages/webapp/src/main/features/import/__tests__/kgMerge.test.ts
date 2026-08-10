import { describe, it, expect } from 'vitest';

import { mergeKnowledgeGraphs } from '../kgMerge';
import type { KGEdgeData, KGNodeData, KnowledgeGraphData } from '../../../shared/types/project';

const EX = 'http://example.org/';

function kg(nodes: KGNodeData[], edges: KGEdgeData[]): KnowledgeGraphData {
  return { type: 'KnowledgeGraphDiagram', version: '1.0.0', nodes, edges };
}

function classNode(local: string, extra: Partial<KGNodeData> = {}): KGNodeData {
  return { id: `${EX}${local}`, nodeType: 'class', label: local, iri: `${EX}${local}`, ...extra };
}

describe('mergeKnowledgeGraphs', () => {
  it('keeps both graphs when they share nothing', () => {
    const existing = kg([classNode('Person')], [{ id: 'edge:1', source: `${EX}Person`, target: `${EX}Person`, label: 'knows', iri: `${EX}knows` }]);
    const incoming = kg([classNode('Book')], [{ id: 'edge:1', source: `${EX}Book`, target: `${EX}Book`, label: 'cites', iri: `${EX}cites` }]);

    const result = mergeKnowledgeGraphs(existing, incoming);

    expect(result.model.nodes.map((n) => n.id)).toEqual([`${EX}Person`, `${EX}Book`]);
    expect(result.addedNodeCount).toBe(1);
    expect(result.addedEdgeCount).toBe(1);
    // The incoming edge reused id "edge:1" — it must be renumbered.
    expect(new Set(result.model.edges.map((e) => e.id)).size).toBe(2);
  });

  it('does not mutate its inputs', () => {
    const existing = kg([classNode('Person')], []);
    const incoming = kg([classNode('Book')], []);

    mergeKnowledgeGraphs(existing, incoming);

    expect(existing.nodes).toHaveLength(1);
    expect(incoming.nodes).toHaveLength(1);
  });

  it('collapses nodes that denote the same IRI', () => {
    const existing = kg([classNode('Person', { position: { x: 10, y: 20 } })], []);
    const incoming = kg([classNode('Person'), classNode('Author')], []);

    const result = mergeKnowledgeGraphs(existing, incoming);

    expect(result.model.nodes.map((n) => n.id)).toEqual([`${EX}Person`, `${EX}Author`]);
    expect(result.duplicateNodeCount).toBe(1);
    // The graph already on the canvas wins, so its layout is preserved.
    expect(result.model.nodes[0].position).toEqual({ x: 10, y: 20 });
  });

  it('reattaches incoming edges to the surviving shared node', () => {
    const existing = kg([classNode('Person')], []);
    const incoming = kg(
      [classNode('Person'), classNode('Author')],
      [{ id: 'edge:1', source: `${EX}Author`, target: `${EX}Person`, label: 'subClassOf', iri: `${EX}subClassOf` }],
    );

    const result = mergeKnowledgeGraphs(existing, incoming);

    expect(result.model.edges).toHaveLength(1);
    expect(result.model.edges[0]).toMatchObject({ source: `${EX}Author`, target: `${EX}Person` });
  });

  it('drops statements the current graph already carries', () => {
    const triple = { source: `${EX}Author`, target: `${EX}Person`, label: 'subClassOf', iri: `${EX}subClassOf` };
    const existing = kg([classNode('Person'), classNode('Author')], [{ id: 'edge:1', ...triple }]);
    const incoming = kg([classNode('Person'), classNode('Author')], [{ id: 'edge:9', ...triple }]);

    const result = mergeKnowledgeGraphs(existing, incoming);

    expect(result.model.edges).toHaveLength(1);
    expect(result.duplicateEdgeCount).toBe(1);
    expect(result.addedEdgeCount).toBe(0);
  });

  it('collapses literals that hash to the same id', () => {
    const literal: KGNodeData = { id: 'lit:abc123', nodeType: 'literal', label: '42', value: '42', datatype: 'xsd:integer' };
    const result = mergeKnowledgeGraphs(kg([literal], []), kg([{ ...literal }], []));

    expect(result.model.nodes).toHaveLength(1);
    expect(result.duplicateNodeCount).toBe(1);
  });

  it('renames colliding constraint nodes instead of merging them', () => {
    // Both files constrain ex:Person, so the OWL importer numbered their
    // constraint nodes identically — but they are different constraints.
    const existingConstraint: KGNodeData = {
      id: `nc:${EX}Person#1`,
      nodeType: 'nodeConstraint',
      label: 'min 1 name',
      metadata: { constraintSpecs: [{ kind: 'minCount', value: 1 }] },
    };
    const incomingConstraint: KGNodeData = {
      id: `nc:${EX}Person#1`,
      nodeType: 'nodeConstraint',
      label: 'max 3 emails',
      metadata: { constraintSpecs: [{ kind: 'maxCount', value: 3 }] },
    };
    const existing = kg([classNode('Person'), existingConstraint], []);
    const incoming = kg(
      [classNode('Person'), incomingConstraint],
      [{ id: 'edge:1', source: `nc:${EX}Person#1`, target: `${EX}Person`, label: 'targetClass', iri: `${EX}targetClass` }],
    );

    const result = mergeKnowledgeGraphs(existing, incoming);

    expect(result.model.nodes).toHaveLength(3);
    const renamed = result.model.nodes[2];
    expect(renamed.id).toBe(`nc:${EX}Person#1#imported`);
    expect(renamed.label).toBe('max 3 emails');
    // The edge that pointed at the incoming constraint follows the rename.
    expect(result.model.edges[0].source).toBe(`nc:${EX}Person#1#imported`);
  });

  it('rewrites nested SHACL shape refs through the rename', () => {
    const target: KGNodeData = { id: 'pc:shacl:#1', nodeType: 'propertyConstraint', label: 'inner' };
    const owner: KGNodeData = {
      id: 'nc:shacl:#1',
      nodeType: 'nodeConstraint',
      label: 'outer',
      metadata: { constraintSpecs: [{ kind: 'shaclNot', value: [{ ref: 'pc:shacl:#1' }] }] },
    };
    const existing = kg([{ ...target, label: 'other inner' }, { ...owner, label: 'other outer' }], []);
    const result = mergeKnowledgeGraphs(existing, kg([target, owner], []));

    const mergedOwner = result.model.nodes.find((n) => n.label === 'outer')!;
    const specs = mergedOwner.metadata!.constraintSpecs!;
    expect((specs[0].value as Array<{ ref: string }>)[0].ref).toBe('pc:shacl:#1#imported');
  });

  it('preserves the existing settings block', () => {
    const existing: KnowledgeGraphData = {
      ...kg([classNode('Person')], []),
      settings: { softLimit: 25, visibleIds: [`${EX}Person`] },
    };

    const result = mergeKnowledgeGraphs(existing, kg([classNode('Book')], []));

    expect(result.model.settings).toEqual({ softLimit: 25, visibleIds: [`${EX}Person`] });
    expect(result.addedNodeIds).toEqual([`${EX}Book`]);
  });
});
