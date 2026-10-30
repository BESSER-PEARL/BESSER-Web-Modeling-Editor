import { describe, it, expect } from 'vitest';
import type { BesserNode, UMLModel } from '@besser/wme';
import { hashUmlModel } from '../../../shared/utils/lineageHash';

function emptyModel(type: string): UMLModel {
  return {
    version: '4.0.0',
    id: 'diagram',
    title: 'Diagram',
    type,
    nodes: [],
    edges: [],
    assessments: {},
  } as unknown as UMLModel;
}

const component = (id: string, x: number, y: number, extra: Record<string, unknown> = {}): BesserNode =>
  ({
    id,
    type: 'component',
    position: { x, y },
    width: 100,
    height: 60,
    measured: { width: 100, height: 60 },
    data: { name: id.toUpperCase() },
    ...extra,
  }) as BesserNode;

describe('06-v1 — hashUmlModel', () => {
  it('is deterministic across calls', () => {
    const m = emptyModel('ComponentDiagram');
    expect(hashUmlModel(m)).toBe(hashUmlModel(m));
  });

  it('ignores the order of nodes and of object keys', () => {
    const m1 = emptyModel('ComponentDiagram');
    m1.nodes = [component('a', 0, 0), component('b', 100, 0)];

    const m2 = emptyModel('ComponentDiagram');
    // Opposite order, and the node keys inserted in a different order.
    const b = component('b', 100, 0);
    m2.nodes = [
      { data: b.data, type: b.type, id: b.id, position: b.position, width: 100, height: 60 } as BesserNode,
      component('a', 0, 0),
    ];

    expect(hashUmlModel(m1)).toBe(hashUmlModel(m2));
  });

  it('ignores sub-pixel drift in position and size (rounds to int)', () => {
    const m1 = emptyModel('ComponentDiagram');
    m1.nodes = [component('a', 0.4, 0.49, { width: 100.3 })];

    const m2 = emptyModel('ComponentDiagram');
    m2.nodes = [component('a', 0, 0)];

    expect(hashUmlModel(m1)).toBe(hashUmlModel(m2));
  });

  it('flips on a real structural change (added node)', () => {
    const m1 = emptyModel('ComponentDiagram');
    const m2 = emptyModel('ComponentDiagram');
    m2.nodes = [component('a', 0, 0)];

    expect(hashUmlModel(m1)).not.toBe(hashUmlModel(m2));
  });

  it('flips on a data change', () => {
    const m1 = emptyModel('BPMN');
    m1.nodes = [component('a', 0, 0)];
    const m2 = emptyModel('BPMN');
    m2.nodes = [component('a', 0, 0, { data: { name: 'A', isAgentic: true } })];

    expect(hashUmlModel(m1)).not.toBe(hashUmlModel(m2));
  });

  it('ignores interactive / assessments runtime metadata', () => {
    const m1 = emptyModel('ComponentDiagram');
    const m2 = {
      ...emptyModel('ComponentDiagram'),
      interactive: { elements: { a: true }, relationships: {} },
    } as UMLModel;
    expect(hashUmlModel(m1)).toBe(hashUmlModel(m2));
  });

  it('ignores React Flow runtime node state and the diagram title', () => {
    const m1 = emptyModel('ComponentDiagram');
    m1.nodes = [component('a', 0, 0)];
    const m2 = { ...emptyModel('ComponentDiagram'), title: 'Renamed' };
    m2.nodes = [component('a', 0, 0, { selected: true, dragging: false, measured: { width: 0, height: 0 } })];

    expect(hashUmlModel(m1)).toBe(hashUmlModel(m2));
  });

  it('ignores sub-pixel drift in edge points but not a moved bend', () => {
    const withEdge = (points: Array<{ x: number; y: number }>): UMLModel => {
      const m = emptyModel('ComponentDiagram');
      m.nodes = [component('a', 0, 0), component('b', 300, 0)];
      m.edges = [
        {
          id: 'e',
          type: 'ComponentDependency',
          source: 'a',
          target: 'b',
          sourceHandle: 'right',
          targetHandle: 'left',
          data: { points },
        } as UMLModel['edges'][number],
      ];
      return m;
    };

    const start = { x: 100, y: 30 };
    const end = { x: 300, y: 30 };
    const straight = hashUmlModel(withEdge([start, end]));

    expect(
      hashUmlModel(
        withEdge([
          { x: 100.2, y: 30 },
          { ...end, y: 29.6 },
        ]),
      ),
    ).toBe(straight);
    expect(hashUmlModel(withEdge([start, { x: 200, y: 80 }, end]))).not.toBe(straight);
  });
});
