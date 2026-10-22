import { afterEach, describe, expect, it, vi } from 'vitest';
import cytoscape from 'cytoscape';
import {
  coalesceToNextTick,
  cyToModel,
  displayLabel,
  filterVisible,
  mergeWithFullModel,
  modelToElements,
  newNodeElement,
  nodesToReposition,
  sameCanvasStructure,
  syncElementData,
} from '../canvasModel';
import type { KGEdgeData, KGNodeData, KnowledgeGraphData } from '../types';

const OWL_CLASS = 'http://www.w3.org/2002/07/owl#Class';

const node = (n: Partial<KGNodeData> & Pick<KGNodeData, 'id' | 'nodeType'>, x = 0, y = 0): KGNodeData => ({
  label: '',
  position: { x, y },
  ...n,
});

const model = (nodes: KGNodeData[], edges: KGEdgeData[] = []): KnowledgeGraphData => ({
  type: 'KnowledgeGraphDiagram',
  version: '1.0.0',
  nodes,
  edges,
});

/** Load a model into a real (headless) Cytoscape instance, as the canvas does. */
// `preset` keeps the stored positions; Cytoscape's default layout would reset them to the origin.
const load = (m: KnowledgeGraphData) =>
  cytoscape({ headless: true, elements: modelToElements(m), layout: { name: 'preset' } });

describe('displayLabel', () => {
  it('renders vocabulary terms with their prefix and a chip glyph, whatever the stored label', () => {
    expect(displayLabel(node({ id: 'v', nodeType: 'class', iri: OWL_CLASS, label: 'Class' }))).toBe('owl:Class Ⓥ');
  });

  it('never returns an empty string, so a node cannot render 0x0', () => {
    expect(displayLabel(node({ id: 'b', nodeType: 'blank' }))).toBe('_:');
    expect(displayLabel(node({ id: 'l', nodeType: 'literal' }))).toBe('""');
    expect(displayLabel(node({ id: 'l2', nodeType: 'literal', value: 'hello' }))).toBe('hello');
    expect(displayLabel(node({ id: 'c', nodeType: 'class', iri: 'http://ex.org/onto#Person' }))).toBe('Person');
    expect(displayLabel(node({ id: 'd', nodeType: 'class', iri: 'http://ex.org/onto/Person/' }))).toBe('Person');
    expect(displayLabel(node({ id: 'x', nodeType: 'class' }))).toBe('x');
  });

  it('prefers the stored label when there is one', () => {
    expect(displayLabel(node({ id: 'c', nodeType: 'class', label: 'Person', iri: 'http://ex.org/onto#Thing' }))).toBe('Person');
  });
});

describe('modelToElements / cyToModel', () => {
  it('keeps the stored label apart from the label the canvas draws', () => {
    const cy = load(model([node({ id: 'v', nodeType: 'class', iri: OWL_CLASS, label: 'Class' })]));
    const data = cy.getElementById('v').data();

    expect(data.label).toBe('Class');
    expect(data.displayLabel).toBe('owl:Class Ⓥ');
  });

  it('round-trips every kind of node unchanged, including labels the canvas had to invent', () => {
    const original = model(
      [
        node({ id: 'vocab', nodeType: 'class', iri: OWL_CLASS, label: 'Class' }, 10, 20),
        node({ id: 'blank', nodeType: 'blank', label: '' }, 30, 40),
        node({ id: 'lit', nodeType: 'literal', label: '', value: '', datatype: 'xsd:string' }, 50, 60),
        node({ id: 'cleared', nodeType: 'class', label: '', iri: 'http://ex.org/onto#Person' }, 70, 80),
        node(
          {
            id: 'shape',
            nodeType: 'nodeConstraint',
            label: 'PersonShape',
            metadata: { constraintSpecs: [{ kind: 'minCount', value: 1 }], isAnonymous: false },
          },
          90,
          100,
        ),
      ],
      [
        { id: 'e1', source: 'cleared', target: 'vocab', label: 'type', iri: 'http://x/type' },
        { id: 'e2', source: 'blank', target: 'lit' },
      ],
    );

    const roundTripped = cyToModel(load(original), original);

    expect(roundTripped).toEqual(original);
  });

  it('leaves a label the user cleared empty', () => {
    const original = model([node({ id: 'n', nodeType: 'class', label: '', iri: 'http://ex.org/onto#Person' })]);

    expect(cyToModel(load(original), original).nodes[0].label).toBe('');
  });

  it('does not turn a missing edge label into an empty one', () => {
    const original = model(
      [node({ id: 'a', nodeType: 'class' }), node({ id: 'b', nodeType: 'class' })],
      [{ id: 'e', source: 'a', target: 'b' }],
    );

    expect(cyToModel(load(original), original).edges[0].label).toBeUndefined();
  });

  it('skips edges whose endpoints are missing instead of aborting the batch', () => {
    const original = model([node({ id: 'a', nodeType: 'class' })], [{ id: 'e', source: 'a', target: 'ghost' }]);

    expect(cyToModel(load(original), original).edges).toEqual([]);
  });

  it('does not let the edge-drawing helper elements reach the model', () => {
    const original = model([node({ id: 'a', nodeType: 'class' })]);
    const cy = load(original);
    cy.add({ group: 'nodes', data: { id: 'ghost' }, classes: 'eh-ghost-node' });

    expect(cyToModel(cy, original).nodes.map((n) => n.id)).toEqual(['a']);
  });

  it('draws a node dropped from the palette with a label, like any other', () => {
    const cy = cytoscape({ headless: true });
    cy.add(newNodeElement('class:1', 'class', { x: 5, y: 6 }));
    const data = cy.getElementById('class:1').data();

    expect(data.label).toBe('Class');
    expect(data.displayLabel).toBe('Class');
    expect(cy.getElementById('class:1').position()).toEqual({ x: 5, y: 6 });
  });
});

describe('filterVisible', () => {
  const full = model(
    [node({ id: 'a', nodeType: 'class' }), node({ id: 'b', nodeType: 'class' }), node({ id: 'c', nodeType: 'class' })],
    [
      { id: 'ab', source: 'a', target: 'b' },
      { id: 'bc', source: 'b', target: 'c' },
    ],
  );

  it('keeps only visible nodes and the edges between them', () => {
    const slice = filterVisible(full, ['a', 'b']);

    expect(slice.nodes.map((n) => n.id)).toEqual(['a', 'b']);
    expect(slice.edges.map((e) => e.id)).toEqual(['ab']);
  });

  it('shows nothing for an empty visible set', () => {
    expect(filterVisible(full, []).nodes).toEqual([]);
  });
});

describe('mergeWithFullModel', () => {
  const full = model(
    [
      node({ id: 'a', nodeType: 'class', label: 'A' }),
      node({ id: 'b', nodeType: 'class', label: 'B' }),
      node({ id: 'hidden', nodeType: 'class', label: 'Hidden' }),
    ],
    [
      { id: 'ab', source: 'a', target: 'b' },
      { id: 'a-hidden', source: 'a', target: 'hidden' },
    ],
  );
  const visible = new Set(['a', 'b']);

  it('passes hidden nodes and their edges through untouched', () => {
    const canvas = filterVisible(full, ['a', 'b']);
    const merged = mergeWithFullModel(full, canvas, visible);

    expect(merged).toEqual(full);
  });

  it('applies edits made on the canvas', () => {
    const canvas = filterVisible(full, ['a', 'b']);
    canvas.nodes[0] = { ...canvas.nodes[0], label: 'Renamed', position: { x: 9, y: 9 } };

    const merged = mergeWithFullModel(full, canvas, visible);

    expect(merged.nodes.find((n) => n.id === 'a')).toMatchObject({ label: 'Renamed', position: { x: 9, y: 9 } });
    expect(merged.nodes.find((n) => n.id === 'hidden')!.label).toBe('Hidden');
  });

  it('treats a visible node missing from the canvas as deleted, and drops its edges', () => {
    const canvas = { ...filterVisible(full, ['a', 'b']) };
    canvas.nodes = canvas.nodes.filter((n) => n.id !== 'b');
    canvas.edges = [];

    const merged = mergeWithFullModel(full, canvas, visible);

    expect(merged.nodes.map((n) => n.id)).toEqual(['a', 'hidden']);
    expect(merged.edges.map((e) => e.id)).toEqual(['a-hidden']);
  });

  it('does not delete a hidden node just because the canvas never showed it', () => {
    const canvas = filterVisible(full, ['a']);

    const merged = mergeWithFullModel(full, canvas, new Set(['a']));

    // `b` is not in the visible set either, so the editor considers it hidden too.
    expect(merged.nodes.map((n) => n.id).sort()).toEqual(['a', 'b', 'hidden']);
  });

  it('adds nodes created on the canvas', () => {
    const canvas = filterVisible(full, ['a', 'b']);
    canvas.nodes = [...canvas.nodes, node({ id: 'new', nodeType: 'individual', label: 'New' })];

    expect(mergeWithFullModel(full, canvas, visible).nodes.map((n) => n.id)).toContain('new');
  });

  it('keeps constraint metadata the canvas lost', () => {
    const withSpecs = model([
      node({ id: 's', nodeType: 'nodeConstraint', metadata: { constraintSpecs: [{ kind: 'minCount', value: 1 }] } }),
    ]);
    const canvas = model([node({ id: 's', nodeType: 'nodeConstraint' })]);

    const merged = mergeWithFullModel(withSpecs, canvas, new Set(['s']));

    expect(merged.nodes[0].metadata).toEqual({ constraintSpecs: [{ kind: 'minCount', value: 1 }] });
  });

  it('drops edges left dangling by a deletion', () => {
    const canvas = filterVisible(full, ['a', 'b']);
    canvas.nodes = canvas.nodes.filter((n) => n.id !== 'a');

    const merged = mergeWithFullModel(full, canvas, visible);

    expect(merged.edges).toEqual([]);
  });
});

describe('syncElementData (inspector edits reaching the canvas)', () => {
  const original = model(
    [
      node({ id: 'lit', nodeType: 'literal', label: '', value: 'old' }, 10, 10),
      node({ id: 'c', nodeType: 'class', label: '', iri: 'http://ex.org/onto#Old' }, 50, 10),
      node(
        { id: 's', nodeType: 'nodeConstraint', label: 'Shape', metadata: { constraintSpecs: [{ kind: 'minCount', value: 1 }] } },
        90,
        10,
      ),
    ],
    [{ id: 'e', source: 'c', target: 'lit', label: 'p', iri: 'http://ex.org/onto#old' }],
  );
  const edited = (): KnowledgeGraphData => ({
    ...original,
    nodes: original.nodes.map((n) => {
      if (n.id === 'lit') return { ...n, value: 'new' };
      if (n.id === 'c') return { ...n, iri: 'http://ex.org/onto#New' };
      if (n.id === 's') return { ...n, metadata: { constraintSpecs: [{ kind: 'minCount', value: 3 }] } };
      return n;
    }),
    edges: [{ ...original.edges[0], iri: 'http://ex.org/onto#new' }],
  });

  /** What dragging a node does: move it on the canvas, then emit the canvas
   *  through `cyToModel` and merge it into the full model. */
  const dragAndEmit = (cy: cytoscape.Core, full: KnowledgeGraphData) => {
    cy.getElementById('lit').position({ x: 200, y: 200 });
    const all = new Set(full.nodes.map((n) => n.id));
    return mergeWithFullModel(full, cyToModel(cy, full), all);
  };

  it('treats content-only edits as the same structure', () => {
    const cy = load(original);
    expect(sameCanvasStructure(cyToModel(cy, original), edited())).toBe(true);
    expect(sameCanvasStructure(cyToModel(cy, original), model(original.nodes.slice(1), []))).toBe(false);
  });

  it('a later drag keeps an edited value, IRI, constraint spec and edge IRI', () => {
    const cy = load(original);
    const after = edited();

    expect(syncElementData(cy, after)).toBe(4);
    const merged = dragAndEmit(cy, after);

    const byId = (id: string) => merged.nodes.find((n) => n.id === id)!;
    expect(byId('lit').value).toBe('new');
    expect(byId('lit').position).toEqual({ x: 200, y: 200 });
    expect(byId('c').iri).toBe('http://ex.org/onto#New');
    expect(byId('s').metadata).toEqual({ constraintSpecs: [{ kind: 'minCount', value: 3 }] });
    expect(merged.edges[0].iri).toBe('http://ex.org/onto#new');
  });

  it('without the sync the drag would revert the edit (the bug this guards against)', () => {
    const cy = load(original);
    const merged = dragAndEmit(cy, edited());
    expect(merged.nodes.find((n) => n.id === 'lit')!.value).toBe('old');
  });

  it('recomputes the drawn label from the new content', () => {
    const cy = load(original);
    expect(cy.getElementById('lit').data('displayLabel')).toBe('old');
    expect(cy.getElementById('c').data('displayLabel')).toBe('Old');

    syncElementData(cy, edited());

    expect(cy.getElementById('lit').data('displayLabel')).toBe('new');
    expect(cy.getElementById('c').data('displayLabel')).toBe('New');
  });

  it('leaves unchanged elements alone, whatever the key order of their metadata', () => {
    const cy = load(original);
    const reordered: KnowledgeGraphData = {
      ...original,
      nodes: original.nodes.map((n) =>
        n.id === 's' ? { ...n, metadata: { constraintSpecs: [{ value: 1, kind: 'minCount' }] } } : n,
      ),
    };
    expect(syncElementData(cy, reordered)).toBe(0);
  });
});

describe('nodesToReposition', () => {
  const at = (id: string, x: number, y: number) => node({ id, nodeType: 'class' }, x, y);

  it('lists the nodes whose position differs between the canvas and the model', () => {
    const onCanvas = [at('a', 0, 0), at('b', 10, 10), at('c', 20, 20)];
    const wanted = [at('a', 0, 0), at('b', 50, 60), at('c', 20, 20)];

    expect(nodesToReposition(onCanvas, wanted)).toEqual([{ id: 'b', x: 50, y: 60 }]);
  });

  it('is empty when the canvas already matches, so nothing is touched', () => {
    const nodes = [at('a', 1, 2), at('b', 3, 4)];

    expect(nodesToReposition(nodes, nodes)).toEqual([]);
  });

  it('ignores sub-pixel differences from rounding', () => {
    expect(nodesToReposition([at('a', 10, 10)], [at('a', 10.2, 9.9)])).toEqual([]);
  });

  it('matches nodes by id, not by order', () => {
    const onCanvas = [at('a', 0, 0), at('b', 1, 1)];
    const wanted = [at('b', 1, 1), at('a', 9, 9)];

    expect(nodesToReposition(onCanvas, wanted)).toEqual([{ id: 'a', x: 9, y: 9 }]);
  });

  it('skips nodes the model has no usable position for, and nodes the canvas does not show', () => {
    const onCanvas = [at('a', 0, 0)];
    const wanted = [node({ id: 'a', nodeType: 'class' }), at('elsewhere', 5, 5), { ...at('a', 0, 0), position: { x: NaN, y: 0 } }];

    expect(nodesToReposition(onCanvas, wanted)).toEqual([]);
  });
});

describe('coalesceToNextTick', () => {
  afterEach(() => vi.useRealTimers());

  it('turns a burst of calls into one call after the burst', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const run = coalesceToNextTick(fn);

    run();
    run();
    run();
    expect(fn).not.toHaveBeenCalled();
    vi.runAllTimers();

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('calls again for the next burst', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const run = coalesceToNextTick(fn);

    run();
    vi.runAllTimers();
    run();
    vi.runAllTimers();

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('can be cancelled, e.g. when the canvas is torn down', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const run = coalesceToNextTick(fn);

    run();
    run.cancel();
    vi.runAllTimers();

    expect(fn).not.toHaveBeenCalled();
  });
});
