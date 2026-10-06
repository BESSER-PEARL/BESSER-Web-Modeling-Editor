import { describe, expect, it } from 'vitest';
import { scaffoldObjectsFromClasses } from '../scaffoldObjectsFromClasses';

const v4 = (type: string, nodes: any[]): any => ({ version: '4.0.0', id: type, title: '', type, nodes, edges: [] });

// Enumerations written by older data (or the assistant before its casing fix)
// carry a lowercase stereotype; the exact 'Enumeration' compare missed them and
// enum-typed slots fell back to a generic sample value.
describe('scaffoldObjectsFromClasses enum literals', () => {
  it.each(['Enumeration', 'enumeration'])('seeds an enum-typed slot with the first literal (%s)', (stereotype) => {
    const classModel = v4('ClassDiagram', [
      {
        id: 'enum1',
        type: 'class',
        position: { x: 0, y: 0 },
        data: { name: 'Color', stereotype, attributes: [{ id: 'l1', name: 'RED' }, { id: 'l2', name: 'GREEN' }], methods: [] },
      },
      {
        id: 'car',
        type: 'class',
        position: { x: 300, y: 0 },
        data: { name: 'Car', attributes: [{ id: 'a1', name: 'paint', attributeType: 'Color' }], methods: [] },
      },
    ]);

    const { model } = scaffoldObjectsFromClasses({ classModel, objectModel: v4('ObjectDiagram', []) });

    const car = (model.nodes as any[]).find((n) => n.data.classId === 'car');
    expect(car.data.attributes[0].value).toBe('RED');
  });
});
