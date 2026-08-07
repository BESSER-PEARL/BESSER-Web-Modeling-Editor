import { describe, expect, it } from 'vitest';
import {
  collectHiddenMetaIds,
  isMetaVocabNode,
  rejectHidden,
  withoutHiddenNodes,
} from '../meta-vocab';
import type { KGEdgeData, KGNodeData } from '../types';

const node = (id: string, extra: Partial<KGNodeData> = {}): KGNodeData => ({
  id,
  label: id,
  nodeType: 'class',
  ...extra,
});

const edge = (id: string, source: string, target: string): KGEdgeData => ({
  id,
  source,
  target,
});

describe('isMetaVocabNode', () => {
  it.each([
    'http://www.w3.org/2002/07/owl#Class',
    'http://www.w3.org/1999/02/22-rdf-syntax-ns#Property',
    'http://www.w3.org/2000/01/rdf-schema#Literal',
  ])('flags %s', (iri) => {
    expect(isMetaVocabNode(node('n1', { iri }))).toBe(true);
  });

  it.each([
    'http://www.w3.org/2001/XMLSchema#string',
    'http://www.w3.org/2001/XMLSchema#integer',
  ])('keeps %s visible — a datatype range is modelled content, not a declaration', (iri) => {
    expect(isMetaVocabNode(node('n1', { iri }))).toBe(false);
  });

  it('leaves user-modelled IRIs alone', () => {
    expect(isMetaVocabNode(node('n1', { iri: 'http://example.org/onto#Person' }))).toBe(false);
  });

  it('falls back to the id, which OWL imports set to the IRI', () => {
    expect(isMetaVocabNode({ id: 'http://www.w3.org/2002/07/owl#Restriction' })).toBe(true);
  });

  it('does not flag blank or literal nodes', () => {
    expect(isMetaVocabNode(node('_:b0', { nodeType: 'blank' }))).toBe(false);
    expect(isMetaVocabNode(node('lit:1', { nodeType: 'literal', value: 'Ada' }))).toBe(false);
  });
});

describe('collectHiddenMetaIds', () => {
  const nodes = [
    node('http://example.org#Person'),
    node('http://www.w3.org/2002/07/owl#Class'),
    node('http://www.w3.org/2000/01/rdf-schema#Class'),
    node('http://www.w3.org/2001/XMLSchema#string'),
  ];

  it('collects the declaration-vocabulary node ids by default, leaving xsd out', () => {
    expect([...collectHiddenMetaIds(nodes, false)]).toEqual([
      'http://www.w3.org/2002/07/owl#Class',
      'http://www.w3.org/2000/01/rdf-schema#Class',
    ]);
  });

  it('hides nothing when the user opted into showing vocabulary nodes', () => {
    expect(collectHiddenMetaIds(nodes, true).size).toBe(0);
  });
});

describe('withoutHiddenNodes', () => {
  it('drops hidden nodes and every edge incident to one', () => {
    const model = {
      nodes: [node('Person'), node('Address'), node('owl:Class')],
      edges: [
        edge('e1', 'Person', 'owl:Class'), // declaration — implicit, goes away
        edge('e2', 'Person', 'Address'), // user relation — stays
        edge('e3', 'owl:Class', 'Address'),
      ],
    };
    const result = withoutHiddenNodes(model, new Set(['owl:Class']));
    expect(result.nodes.map((n) => n.id)).toEqual(['Person', 'Address']);
    expect(result.edges.map((e) => e.id)).toEqual(['e2']);
  });

  it('returns the same reference when nothing is hidden', () => {
    const model = { nodes: [node('Person')], edges: [] as KGEdgeData[] };
    expect(withoutHiddenNodes(model, new Set())).toBe(model);
  });
});

describe('rejectHidden', () => {
  it('removes hidden ids and preserves order', () => {
    expect(rejectHidden(['a', 'owl', 'b'], new Set(['owl']))).toEqual(['a', 'b']);
  });

  it('copies the input when nothing is hidden', () => {
    const ids = ['a', 'b'];
    const out = rejectHidden(ids, new Set());
    expect(out).toEqual(ids);
    expect(out).not.toBe(ids);
  });
});
