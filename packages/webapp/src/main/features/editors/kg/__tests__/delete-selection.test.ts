import { describe, expect, it } from 'vitest';

import { deleteSelectionFromModel } from '../delete-selection';
import type { KnowledgeGraphData } from '../types';

/** a -- e1 --> b -- e2 --> c, plus a stray c -- e3 --> a. */
const MODEL: KnowledgeGraphData = {
  type: 'KnowledgeGraphDiagram',
  version: '1.0.0',
  nodes: [
    { id: 'a', nodeType: 'class', label: 'A' },
    { id: 'b', nodeType: 'class', label: 'B' },
    { id: 'c', nodeType: 'individual', label: 'C' },
  ],
  edges: [
    { id: 'e1', source: 'a', target: 'b' },
    { id: 'e2', source: 'b', target: 'c' },
    { id: 'e3', source: 'c', target: 'a' },
  ],
};

describe('deleteSelectionFromModel', () => {
  it('removes a node together with every relation attached to it', () => {
    const next = deleteSelectionFromModel(MODEL, ['a'], []);
    expect(next.nodes.map((n) => n.id)).toEqual(['b', 'c']);
    expect(next.edges.map((e) => e.id)).toEqual(['e2']);
  });

  it('removes a relation without touching its endpoints', () => {
    const next = deleteSelectionFromModel(MODEL, [], ['e2']);
    expect(next.nodes.map((n) => n.id)).toEqual(['a', 'b', 'c']);
    expect(next.edges.map((e) => e.id)).toEqual(['e1', 'e3']);
  });

  it('handles a mixed selection, counting an edge only once', () => {
    const next = deleteSelectionFromModel(MODEL, ['b'], ['e1']);
    expect(next.nodes.map((n) => n.id)).toEqual(['a', 'c']);
    expect(next.edges.map((e) => e.id)).toEqual(['e3']);
  });

  it('leaves the model untouched (same reference) for an empty selection', () => {
    expect(deleteSelectionFromModel(MODEL, [], [])).toBe(MODEL);
  });

  it('does not mutate the input model', () => {
    deleteSelectionFromModel(MODEL, ['a'], ['e2']);
    expect(MODEL.nodes).toHaveLength(3);
    expect(MODEL.edges).toHaveLength(3);
  });

  it('preserves settings and other top-level fields', () => {
    const withSettings: KnowledgeGraphData = { ...MODEL, settings: { softLimit: 7 } };
    expect(deleteSelectionFromModel(withSettings, ['c'], []).settings).toEqual({ softLimit: 7 });
  });
});
