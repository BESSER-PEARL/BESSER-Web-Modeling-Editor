import { describe, expect, it } from 'vitest';

import { ClassDiagramConverter } from '../ClassDiagramConverter';

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

    expect(Object.keys(model.elements).sort()).toEqual(['att-title', 'cls-author', 'cls-book', 'met-read']);
    expect(model.elements['cls-book'].attributes).toEqual(['att-title']);
    expect(model.elements['att-title'].owner).toBe('cls-book');
    expect(model.relationships['rel-writes'].source.element).toBe('cls-author');
  });

  it('never hands out an id twice and replaces blank ones', () => {
    const model = new ClassDiagramConverter().convertCompleteSystem({
      classes: [
        { id: 'dup', className: 'Book', attributes: [{ id: 'dup', name: 'title' }, { id: '  ', name: 'pages' }], methods: [] },
        { id: 'dup', className: 'Author', attributes: [], methods: [] },
      ],
      relationships: [{ id: 'dup', type: 'Association', source: 'Author', target: 'Book' }],
    });

    const ids = [...Object.keys(model.elements), ...Object.keys(model.relationships)];
    expect(ids).toHaveLength(5);
    expect(new Set(ids).size).toBe(5);
    expect(model.elements.dup.name).toBe('Book');
    expect(ids).not.toContain('  ');
  });
});
