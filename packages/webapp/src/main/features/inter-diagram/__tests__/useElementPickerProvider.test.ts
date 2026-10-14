import { describe, it, expect } from 'vitest';
import { collectPickableElements } from '../useElementPickerProvider';
import { BesserProject } from '../../../shared/types/project';

// Minimal project factory — only `diagrams[*].{id,title,model}` matter here.
// `model` must satisfy `isUMLModel` (type + version + elements + relationships).
const proj = (): BesserProject =>
  ({
    diagrams: {
      ClassDiagram: [
        {
          id: 'cd-1',
          title: 'Domain',
          model: {
            version: '3.0.0',
            type: 'ClassDiagram',
            elements: {
              c1: { id: 'c1', type: 'Class', name: 'Order' },
              c2: { id: 'c2', type: 'Class', name: 'Customer' },
              a1: { id: 'a1', type: 'ClassAttribute', name: 'total' },
            },
            relationships: {},
          },
        },
      ],
      ComponentDiagram: [
        {
          id: 'cmp-1',
          title: 'Components',
          model: {
            version: '3.0.0',
            type: 'ComponentDiagram',
            elements: { k1: { id: 'k1', type: 'Component', name: 'Billing' } },
            relationships: {},
          },
        },
      ],
    },
  }) as unknown as BesserProject;

describe('collectPickableElements (19 — realizes picker)', () => {
  it('T-R1 collects Class elements across diagrams', () => {
    const out = collectPickableElements(proj(), ['Class']);
    expect(out.map((e) => e.id).sort()).toEqual(['c1', 'c2']);
    expect(out.find((e) => e.id === 'c1')).toMatchObject({ name: 'Order', diagramTitle: 'Domain' });
  });

  it('T-R2 excludes the active diagram', () => {
    const out = collectPickableElements(proj(), ['Class'], 'cd-1');
    expect(out).toEqual([]);
  });

  it('T-R3 filters by type token (Component not returned for Class)', () => {
    const out = collectPickableElements(proj(), ['Class']);
    expect(out.some((e) => e.id === 'k1')).toBe(false);
  });

  it('T-R4 returns [] for null project', () => {
    expect(collectPickableElements(null, ['Class'])).toEqual([]);
  });
});
