import { describe, it, expect } from 'vitest';
import { collectPickableElements } from '../useElementPickerProvider';
import { BesserProject } from '../../../shared/types/project';

// Minimal project factory — only `diagrams[*].{id,title,model}` matter here.
// `model` must satisfy `isUMLModel` (type + version + nodes + edges).
const node = (id: string, type: string, name: string) => ({
  id,
  type,
  position: { x: 0, y: 0 },
  width: 100,
  height: 60,
  data: { name },
});

const proj = (): BesserProject =>
  ({
    diagrams: {
      ClassDiagram: [
        {
          id: 'cd-1',
          title: 'Domain',
          model: {
            version: '4.0.0',
            type: 'ClassDiagram',
            nodes: [
              node('c1', 'class', 'Order'),
              { ...node('c2', 'class', 'Customer'), data: { name: 'Customer', stereotype: 'Abstract' } },
              { ...node('e1', 'class', 'Status'), data: { name: 'Status', stereotype: 'Enumeration' } },
            ],
            edges: [],
          },
        },
      ],
      ComponentDiagram: [
        {
          id: 'cmp-1',
          title: 'Components',
          model: {
            version: '4.0.0',
            type: 'ComponentDiagram',
            nodes: [node('k1', 'component', 'Billing')],
            edges: [],
          },
        },
      ],
    },
  }) as unknown as BesserProject;

const CLASS_TOKENS = ['Class', 'AbstractClass', 'Interface', 'Enumeration'];

describe('collectPickableElements (19 — realizes picker)', () => {
  it('T-R1 collects Class elements across diagrams', () => {
    const out = collectPickableElements(proj(), CLASS_TOKENS);
    expect(out.map((e) => e.id).sort()).toEqual(['c1', 'c2', 'e1']);
    expect(out.find((e) => e.id === 'c1')).toMatchObject({ name: 'Order', diagramTitle: 'Domain' });
  });

  it('T-R2 excludes the active diagram', () => {
    const out = collectPickableElements(proj(), CLASS_TOKENS, 'cd-1');
    expect(out).toEqual([]);
  });

  it('T-R3 filters by type token (Component not returned for Class)', () => {
    const out = collectPickableElements(proj(), CLASS_TOKENS);
    expect(out.some((e) => e.id === 'k1')).toBe(false);
  });

  it('T-R3b maps the Component token to component nodes (manifests picker)', () => {
    const out = collectPickableElements(proj(), ['Component']);
    expect(out).toEqual([{ id: 'k1', name: 'Billing', diagramTitle: 'Components' }]);
  });

  it('T-R4 returns [] for null project', () => {
    expect(collectPickableElements(null, ['Class'])).toEqual([]);
  });
});
