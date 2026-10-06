import { describe, expect, it } from 'vitest';
import { getModelMetrics } from '../useGeneratorExecution';

// The editor writes ClassType casing ('Abstract', 'Enumeration'); an exact
// lowercase compare reported 0 abstract classes and 0 enumerations.
describe('getModelMetrics', () => {
  it('counts abstract classes and enumerations whatever the stereotype casing', () => {
    const node = (id: string, stereotype?: string) => ({
      id,
      type: 'class',
      position: { x: 0, y: 0 },
      data: { name: id, attributes: [{ id: `${id}-a` }], methods: [], ...(stereotype && { stereotype }) },
    });
    const project: any = {
      currentDiagramType: 'ClassDiagram',
      currentDiagramIndices: { ClassDiagram: 0 },
      diagrams: {
        ClassDiagram: [{
          id: 'cd',
          title: 'cd',
          model: {
            version: '4.0.0',
            type: 'ClassDiagram',
            nodes: [node('Plain'), node('Shape', 'Abstract'), node('Old', 'abstract'), node('Color', 'Enumeration')],
            edges: [{ id: 'e1' }],
          },
        }],
      },
    };

    expect(getModelMetrics(project)).toMatchObject({
      classes_count: 1,
      abstract_classes_count: 2,
      enumerations_count: 1,
      attributes_count: 4,
      relationships_count: 1,
    });
  });
});
