import { describe, expect, it } from 'vitest';

import { ClassDiagramConverter } from '../ClassDiagramConverter';

const classNode = (model: any, id: string) => model.nodes.find((n: any) => n.id === id);
const allIds = (model: any) => [
  ...model.nodes.map((n: any) => n.id),
  ...model.nodes.flatMap((n: any) => [...(n.data.attributes ?? []), ...(n.data.methods ?? [])].map((r: any) => r.id)),
  ...model.edges.map((e: any) => e.id),
];

describe('ClassDiagramConverter spec ids', () => {
  it('uses the ids a complete-system spec carries', () => {
    const model = new ClassDiagramConverter().convertCompleteSystem({
      classes: [
        {
          id: 'cls-book',
          className: 'Book',
          attributes: [{ id: 'att-title', name: 'title', type: 'str' }],
          methods: [{ id: 'met-read', name: 'read', returnType: 'str' }],
        },
        { id: 'cls-author', className: 'Author', attributes: [], methods: [] },
      ],
      relationships: [{ id: 'rel-writes', type: 'Association', source: 'Author', target: 'Book', name: 'writes' }],
    });

    expect(model.nodes.map((n: any) => n.id).sort()).toEqual(['cls-author', 'cls-book']);
    expect(classNode(model, 'cls-book').data.attributes.map((r: any) => r.id)).toEqual(['att-title']);
    expect(classNode(model, 'cls-book').data.methods.map((r: any) => r.id)).toEqual(['met-read']);
    expect(model.edges.find((e: any) => e.id === 'rel-writes')?.source).toBe('cls-author');
  });

  it('never hands out an id twice and replaces blank ones', () => {
    const model = new ClassDiagramConverter().convertCompleteSystem({
      classes: [
        { id: 'dup', className: 'Book', attributes: [{ id: 'dup', name: 'title' }, { id: '  ', name: 'pages' }], methods: [] },
        { id: 'dup', className: 'Author', attributes: [], methods: [] },
      ],
      relationships: [{ id: 'dup', type: 'Association', source: 'Author', target: 'Book' }],
    });

    const ids = allIds(model);
    expect(ids).toHaveLength(5);
    expect(new Set(ids).size).toBe(5);
    expect(classNode(model, 'dup').data.name).toBe('Book');
    expect(ids).not.toContain('  ');
  });
});
