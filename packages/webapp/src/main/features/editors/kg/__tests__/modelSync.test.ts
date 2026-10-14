import { describe, expect, it } from 'vitest';
import { pruneSelection, sameKgContent } from '../modelSync';
import type { KnowledgeGraphData } from '../types';

const model = (over: Partial<KnowledgeGraphData> = {}): KnowledgeGraphData => ({
  type: 'KnowledgeGraphDiagram',
  version: '1.0.0',
  nodes: [
    { id: 'a', nodeType: 'class', label: 'A' },
    { id: 'b', nodeType: 'class', label: 'B' },
  ],
  edges: [{ id: 'e', source: 'a', target: 'b', label: 'rel' }],
  ...over,
});

describe('sameKgContent', () => {
  it('ignores which nodes are visible: that is editor view state, not the graph', () => {
    const base = model({ settings: { layout: 'fcose' } });
    const saved = model({ settings: { layout: 'fcose', visibleIds: ['a'] } });

    expect(sameKgContent(base, saved)).toBe(true);
    expect(sameKgContent(saved, { ...saved, settings: { layout: 'fcose', visibleIds: [] } })).toBe(true);
  });

  it('treats a model with only visibleIds in its settings like one without settings', () => {
    expect(sameKgContent(model(), model({ settings: { visibleIds: ['a'] } }))).toBe(true);
  });

  it('does not depend on key order', () => {
    const a = model();
    const b: KnowledgeGraphData = JSON.parse(JSON.stringify({ edges: a.edges, nodes: a.nodes, version: a.version, type: a.type }));

    expect(sameKgContent(a, b)).toBe(true);
  });

  it.each([
    ['a node label', model({ nodes: [{ id: 'a', nodeType: 'class', label: 'Renamed' }, model().nodes[1]] })],
    ['a node position', model({ nodes: [{ ...model().nodes[0], position: { x: 1, y: 2 } }, model().nodes[1]] })],
    ['an edge', model({ edges: [] })],
    ['another setting', model({ settings: { layout: 'grid' } })],
  ])('notices a real change to %s', (_what, changed) => {
    expect(sameKgContent(model(), changed)).toBe(false);
  });
});

describe('pruneSelection', () => {
  const m = model();

  it('keeps a selection whose element still exists', () => {
    expect(pruneSelection({ kind: 'node', id: 'a' }, m)).toEqual({ kind: 'node', id: 'a' });
    expect(pruneSelection({ kind: 'edge', id: 'e' }, m)).toEqual({ kind: 'edge', id: 'e' });
  });

  it('drops a selection whose element is gone', () => {
    expect(pruneSelection({ kind: 'node', id: 'gone' }, m)).toBeNull();
    expect(pruneSelection({ kind: 'edge', id: 'gone' }, m)).toBeNull();
  });

  it('keeps the surviving part of a multi-selection', () => {
    expect(pruneSelection({ kind: 'multi', nodeIds: ['a', 'gone'], edgeIds: ['e'] }, m)).toEqual({
      kind: 'multi',
      nodeIds: ['a'],
      edgeIds: ['e'],
    });
    expect(pruneSelection({ kind: 'multi', nodeIds: ['gone'], edgeIds: ['gone2'] }, m)).toBeNull();
  });

  it('passes an empty selection through', () => {
    expect(pruneSelection(null, m)).toBeNull();
  });

  it('returns the same object when nothing changed, so React does not re-render', () => {
    const selection = { kind: 'node', id: 'a' } as const;

    expect(pruneSelection(selection, m)).toBe(selection);
  });
});
