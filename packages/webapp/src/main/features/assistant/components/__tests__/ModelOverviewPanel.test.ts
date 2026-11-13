import { describe, expect, it } from 'vitest';
import { parseClassDiagram } from '../ModelOverviewPanel';

describe('ModelOverviewPanel parseClassDiagram', () => {
  it('summarizes a v4 (React Flow) class diagram', () => {
    const model = {
      version: '4.0.0',
      type: 'ClassDiagram',
      nodes: [
        {
          id: 'c1',
          type: 'class',
          position: { x: 0, y: 0 },
          data: {
            name: 'Book',
            attributes: [
              { id: 'a1', name: 'title', attributeType: 'str' },
              { id: 'a2', name: 'pages', attributeType: 'int' },
            ],
            methods: [{ id: 'm1', name: 'read()' }],
            oclConstraints: [{ id: 'o1', name: '', expression: 'context Book inv p: self.pages > 0' }],
          },
        },
        {
          id: 'c2',
          type: 'class',
          position: { x: 0, y: 0 },
          data: { name: 'Genre', stereotype: 'Enumeration', attributes: [{ id: 'l1', name: 'Fiction' }], methods: [] },
        },
        {
          id: 'c3',
          type: 'class',
          position: { x: 0, y: 0 },
          data: { name: 'Item', stereotype: 'abstract', attributes: [], methods: [] },
        },
        {
          id: 'ocl',
          type: 'ClassOCLConstraint',
          position: { x: 0, y: 0 },
          data: { name: '', expression: 'context Book inv q: self.title <> ""' },
        },
      ],
      edges: [
        { id: 'e1', source: 'c1', target: 'c2', type: 'ClassBidirectional', data: { sourceMultiplicity: '*', targetMultiplicity: '1' } },
        { id: 'e2', source: 'c1', target: 'c3', type: 'ClassInheritance', data: {} },
        // Not relationships: OCL tether and a dangling edge.
        { id: 'e3', source: 'ocl', target: 'c1', type: 'ClassOCLLink', data: {} },
        { id: 'e4', source: 'c1', target: 'gone', type: 'ClassBidirectional', data: {} },
      ],
    };

    const { classes, relations, constraints } = parseClassDiagram(model);
    expect(classes.map((c) => [c.name, c.kind])).toEqual([
      ['Book', 'class'],
      ['Genre', 'enum'],
      ['Item', 'abstract'],
    ]);
    expect(classes[0].attributes).toEqual([
      { name: 'title', type: 'str' },
      { name: 'pages', type: 'int' },
    ]);
    expect(classes[0].methods).toEqual(['read()']);
    expect(classes[1].attributes.map((a) => a.name)).toEqual(['Fiction']);
    expect(relations).toEqual([
      { source: 'Book', target: 'Genre', kind: 'association', sourceMultiplicity: '*', targetMultiplicity: '1' },
      { source: 'Book', target: 'Item', kind: 'inheritance', sourceMultiplicity: undefined, targetMultiplicity: undefined },
    ]);
    expect(constraints).toEqual([
      'context Book inv p: self.pages > 0',
      'context Book inv q: self.title <> ""',
    ]);
  });

  it('still reads a legacy v3 class diagram', () => {
    const model = {
      version: '3.0.0',
      type: 'ClassDiagram',
      elements: {
        c1: { id: 'c1', type: 'Class', name: 'A', attributes: ['a1'], methods: [] },
        a1: { id: 'a1', type: 'ClassAttribute', name: 'x', attributeType: 'int', owner: 'c1' },
        c2: { id: 'c2', type: 'Interface', name: 'I', attributes: [], methods: [] },
        o1: { id: 'o1', type: 'ClassOCLConstraint', constraint: 'context A inv: self.x > 0' },
      },
      relationships: {
        r1: { id: 'r1', type: 'ClassRealization', source: { element: 'c1' }, target: { element: 'c2' } },
        r2: { id: 'r2', type: 'ClassOCLLink', source: { element: 'o1' }, target: { element: 'c1' } },
      },
    };
    const { classes, relations, constraints } = parseClassDiagram(model);
    expect(classes.map((c) => [c.name, c.kind])).toEqual([
      ['A', 'class'],
      ['I', 'interface'],
    ]);
    expect(classes[0].attributes).toEqual([{ name: 'x', type: 'int' }]);
    expect(relations.map((r) => r.kind)).toEqual(['realization']);
    expect(constraints).toEqual(['context A inv: self.x > 0']);
  });

  it('returns an empty summary for a missing model', () => {
    expect(parseClassDiagram(undefined)).toEqual({ classes: [], relations: [], constraints: [] });
  });
});
