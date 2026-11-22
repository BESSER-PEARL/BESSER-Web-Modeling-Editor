import { describe, expect, it } from 'vitest';
import { pruneSelection, reconcileVisibleIds, sameKgContent } from '../modelSync';
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

describe('reconcileVisibleIds (after undo / redo swaps the model)', () => {
  const nodes = (...ids: string[]) => ids.map((id) => ({ id, nodeType: 'class' as const, label: id }));
  const kg = (...ids: string[]): KnowledgeGraphData => ({ ...model(), nodes: nodes(...ids), edges: [] });
  const opts = { hardLimit: 100, hidden: new Set<string>() };

  it('keeps what was visible and still exists, in order', () => {
    expect(reconcileVisibleIds(kg('a', 'b', 'c'), kg('a', 'b', 'c'), ['c', 'a'], opts)).toEqual(['c', 'a']);
  });

  it('drops nodes the restored model no longer has (undoing an addition)', () => {
    expect(reconcileVisibleIds(kg('a', 'b', 'new'), kg('a', 'b'), ['a', 'new'], opts)).toEqual(['a']);
  });

  it('shows nodes that came back (undoing a deletion)', () => {
    expect(reconcileVisibleIds(kg('a'), kg('a', 'b', 'c'), ['a'], opts)).toEqual(['a', 'b', 'c']);
  });

  it('does not reveal nodes the user hid that were never removed', () => {
    // b exists both before and after, and is not visible: it stays hidden.
    expect(reconcileVisibleIds(kg('a', 'b'), kg('a', 'b', 'c'), ['a'], opts)).toEqual(['a', 'c']);
  });

  it('stops at the hard limit', () => {
    expect(reconcileVisibleIds(kg('a'), kg('a', 'b', 'c', 'd'), ['a'], { ...opts, hardLimit: 3 })).toEqual(['a', 'b', 'c']);
  });

  it('never shows vocabulary nodes that are meant to stay off the canvas', () => {
    const hidden = new Set(['owl:Class']);

    expect(reconcileVisibleIds(kg('a'), kg('a', 'owl:Class', 'b'), ['a'], { ...opts, hidden })).toEqual(['a', 'b']);
  });

  it('is a no-op when nothing came or went', () => {
    const visible = ['a', 'b'];

    expect(reconcileVisibleIds(kg('a', 'b'), kg('a', 'b'), visible, opts)).toBe(visible);
  });
});
