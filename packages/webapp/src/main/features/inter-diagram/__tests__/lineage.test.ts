import { describe, it, expect } from 'vitest';
import type { UMLModel } from '@besser/wme';
import { hashUmlModel } from '../lineage-hash';

function emptyModel(type: string): UMLModel {
  return {
    version: '3.0.0',
    type,
    size: { width: 800, height: 600 },
    elements: {},
    interactive: { elements: {}, relationships: {} },
    relationships: {},
    assessments: {},
  } as unknown as UMLModel;
}

describe('06-v1 — hashUmlModel', () => {
  it('is deterministic across calls', () => {
    const m = emptyModel('ComponentDiagram');
    expect(hashUmlModel(m)).toBe(hashUmlModel(m));
  });

  it('ignores cosmetic differences in object key insertion order', () => {
    const m1 = emptyModel('ComponentDiagram');
    (m1.elements as Record<string, unknown>).a = {
      id: 'a',
      type: 'Component',
      name: 'A',
      bounds: { x: 0, y: 0, width: 100, height: 60 },
    };
    (m1.elements as Record<string, unknown>).b = {
      id: 'b',
      type: 'Component',
      name: 'B',
      bounds: { x: 100, y: 0, width: 100, height: 60 },
    };

    const m2 = emptyModel('ComponentDiagram');
    // Insert in the opposite order.
    (m2.elements as Record<string, unknown>).b = {
      id: 'b',
      type: 'Component',
      name: 'B',
      bounds: { x: 100, y: 0, width: 100, height: 60 },
    };
    (m2.elements as Record<string, unknown>).a = {
      id: 'a',
      type: 'Component',
      name: 'A',
      bounds: { x: 0, y: 0, width: 100, height: 60 },
    };

    expect(hashUmlModel(m1)).toBe(hashUmlModel(m2));
  });

  it('ignores sub-pixel drift in bounds (rounds to int)', () => {
    const m1 = emptyModel('ComponentDiagram');
    (m1.elements as Record<string, unknown>).a = {
      id: 'a',
      type: 'Component',
      name: 'A',
      bounds: { x: 0.4, y: 0.49, width: 100, height: 60 },
    };

    const m2 = emptyModel('ComponentDiagram');
    (m2.elements as Record<string, unknown>).a = {
      id: 'a',
      type: 'Component',
      name: 'A',
      bounds: { x: 0, y: 0, width: 100, height: 60 },
    };

    expect(hashUmlModel(m1)).toBe(hashUmlModel(m2));
  });

  it('flips on a real structural change (added element)', () => {
    const m1 = emptyModel('ComponentDiagram');
    const m2 = emptyModel('ComponentDiagram');
    (m2.elements as Record<string, unknown>).a = {
      id: 'a',
      type: 'Component',
      name: 'A',
      bounds: { x: 0, y: 0, width: 100, height: 60 },
    };

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
});
