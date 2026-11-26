/**
 * Removing OCL constraints through the assistant.
 *
 * BESSER-PEARL/modeling-agent#98: "remove book_has_title constraint" deleted the Book class.
 * BESSER-PEARL/BESSER#837: "remove the OCL constraints" left them on the diagram.
 *
 * The agent now names a constraint with target.constraintName (the block's own name, else
 * "Class::op pre" / "Class inv"). One ClassOCLConstraint box can hold several `context`
 * blocks, so a name removes its block; the box goes only once it is empty.
 */
import { ClassDiagramModifier } from '../modifiers/ClassDiagramModifier';
import { classesNamedForRemoval, type ModelModification } from '../modifiers/base';
import type { BESSERModel } from '../UMLModelingService';

function libraryModel(): BESSERModel {
  return {
    version: '3.0.0',
    type: 'ClassDiagram',
    size: { width: 1000, height: 800 },
    elements: {
      'c-book': { id: 'c-book', name: 'Book', type: 'Class', owner: null, attributes: ['a-title'], methods: [],
        bounds: { x: 0, y: 0, width: 200, height: 100 } },
      'a-title': { id: 'a-title', name: '+ title: str', type: 'ClassAttribute', owner: 'c-book',
        bounds: { x: 0, y: 40, width: 200, height: 30 } },
      'c-account': { id: 'c-account', name: 'Account', type: 'Class', owner: null, attributes: [], methods: [],
        bounds: { x: 400, y: 0, width: 200, height: 100 } },
      'ocl-book': { id: 'ocl-book', name: '', type: 'ClassOCLConstraint', owner: null,
        bounds: { x: -700, y: 0, width: 640, height: 130 }, description: '',
        constraint: "context Book inv book_has_title: self.title <> ''\n\n" +
          'context Book inv title_is_short: self.title.size() < 200' },
      'ocl-acc': { id: 'ocl-acc', name: 'OCL', type: 'ClassOCLConstraint', owner: null,
        bounds: { x: 700, y: 0, width: 240, height: 80 }, description: '',
        constraint: 'context Account::deposit(amount: Integer) pre: amount > 0' },
    },
    relationships: {
      'l-book': { id: 'l-book', type: 'ClassOCLLink', name: '',
        source: { element: 'ocl-book', direction: 'Right' }, target: { element: 'c-book', direction: 'Left' } },
      'l-acc': { id: 'l-acc', type: 'ClassOCLLink', name: '',
        source: { element: 'ocl-acc', direction: 'Right' }, target: { element: 'c-account', direction: 'Left' } },
    },
    interactive: { elements: {}, relationships: {} },
    assessments: {},
  } as unknown as BESSERModel;
}

const remove = (target: Record<string, string>): ModelModification =>
  ({ action: 'remove_element', target, changes: {} }) as unknown as ModelModification;

describe('ClassDiagramModifier — remove an OCL constraint', () => {
  const modifier = new ClassDiagramModifier();

  it('removes the named constraint and keeps its class (modeling-agent#98)', () => {
    const result = modifier.applyModification(
      libraryModel(), remove({ className: 'Book', constraintName: 'book_has_title' }));

    expect(result.elements['c-book']).toBeDefined();
    expect(result.elements['a-title']).toBeDefined();
    // The other invariant in the same box stays.
    expect(result.elements['ocl-book'].constraint).toBe('context Book inv title_is_short: self.title.size() < 200');
    expect(result.relationships['l-book']).toBeDefined();
    expect(result.elements['ocl-acc']).toBeDefined();
  });

  it('never removes the class, even when className alone would match it', () => {
    const result = modifier.applyModification(libraryModel(), remove({ className: 'Book', constraintName: 'nope' }));
    expect(result.elements['c-book']).toBeDefined();
    expect(result.elements['ocl-book'].constraint).toContain('book_has_title');
  });

  it('deletes the box and its link once its last constraint is removed', () => {
    let model = modifier.applyModification(libraryModel(), remove({ constraintName: 'book_has_title' }));
    model = modifier.applyModification(model, remove({ constraintName: 'TITLE_IS_SHORT' }));

    expect(model.elements['ocl-book']).toBeUndefined();
    expect(model.relationships['l-book']).toBeUndefined();
    expect(model.elements['c-book']).toBeDefined();
  });

  it('removes an unnamed precondition by its label', () => {
    const result = modifier.applyModification(libraryModel(), remove({ constraintName: 'Account::deposit pre' }));
    expect(result.elements['ocl-acc']).toBeUndefined();
    expect(result.relationships['l-acc']).toBeUndefined();
    expect(result.elements['c-account']).toBeDefined();
  });

  it('removes every constraint when each is named, leaving all classes (BESSER#837)', () => {
    let model = libraryModel();
    for (const target of [
      { className: 'Book', constraintName: 'book_has_title' },
      { className: 'Book', constraintName: 'title_is_short' },
      { className: 'Account', constraintName: 'Account::deposit pre' },
    ]) {
      model = modifier.applyModification(model, remove(target));
    }

    expect(Object.values(model.elements).filter((el: any) => el.type === 'ClassOCLConstraint')).toHaveLength(0);
    expect(Object.values(model.relationships).filter((rel: any) => rel.type === 'ClassOCLLink')).toHaveLength(0);
    expect(model.elements['c-book']).toBeDefined();
    expect(model.elements['c-account']).toBeDefined();
  });

  it('removes one of two unnamed blocks per op, so "remove all" removes both', () => {
    const model = libraryModel();
    model.elements['ocl-book'].constraint = "context Book inv: self.title <> ''\n\ncontext Book inv: self.title.size() < 200";

    const once = modifier.applyModification(model, remove({ constraintName: 'Book inv' }));
    expect(once.elements['ocl-book'].constraint).toBe('context Book inv: self.title.size() < 200');
    const twice = modifier.applyModification(once, remove({ constraintName: 'Book inv' }));
    expect(twice.elements['ocl-book']).toBeUndefined();
  });

  it('finds non-ASCII names, as the agent lists them', () => {
    const model = libraryModel();
    model.elements['ocl-book'].constraint = "context Bücher inv größe_ok: self.title <> ''";
    const result = modifier.applyModification(model, remove({ constraintName: 'größe_ok' }));
    expect(result.elements['ocl-book']).toBeUndefined();
  });

  it('is not an intended class removal for the collateral-deletion check', () => {
    expect([...classesNamedForRemoval([remove({ className: 'Book', constraintName: 'book_has_title' })])]).toEqual([]);
  });

  it('removes a whole box by its id', () => {
    const result = modifier.applyModification(libraryModel(), remove({ constraintId: 'ocl-book' }));
    expect(result.elements['ocl-book']).toBeUndefined();
    expect(result.relationships['l-book']).toBeUndefined();
    expect(result.elements['c-book']).toBeDefined();
  });
});
