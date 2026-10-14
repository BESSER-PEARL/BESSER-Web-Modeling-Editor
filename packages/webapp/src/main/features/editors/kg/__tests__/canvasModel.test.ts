import { describe, expect, it } from 'vitest';
import cytoscape from 'cytoscape';
import {
  cyToModel,
  displayLabel,
  filterVisible,
  mergeWithFullModel,
  modelToElements,
  newNodeElement,
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
