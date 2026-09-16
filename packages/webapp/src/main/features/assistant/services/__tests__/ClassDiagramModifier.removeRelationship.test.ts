/**
 * Removing a relationship must never delete a class.
 *
 * The agent names a relationship with `target.sourceClass` / `target.targetClass`,
 * which the modifier knew neither of, so every branch in `removeElement` fell
 * through to "Remove entire class" and its fallback matched the SOURCE class by
 * name. Live case 2026-09-16: "remove book copy" on the 11-class library model
 * below left 8 classes and 1 relationship — BookCopy, Book and Loan all deleted,
 * 9 of 10 relationships gone — reported as "Applied 4 changes".
 */
import { describe, expect, it } from 'vitest';

import { ClassDiagramModifier } from '../modifiers/ClassDiagramModifier';
import type { ModelModification } from '../modifiers/base';
import type { BESSERModel } from '../UMLModelingService';

const CLASS_NAMES = ['Book', 'Author', 'BookCopy', 'Member', 'Loan', 'Reservation', 'Subject'];

/** name -> [source, target] for the 10 relationships of the live model. */
const RELATIONSHIPS: Record<string, [string, string]> = {
  authors: ['Book', 'Author'],
  copies: ['Book', 'BookCopy'],
  book_1: ['BookCopy', 'Book'],
  borrower: ['Loan', 'Member'],
  item: ['Loan', 'BookCopy'],
  loans: ['Member', 'Loan'],
  requester: ['Reservation', 'Member'],
  reservationBook: ['Reservation', 'Book'],
  subjects: ['Book', 'Subject'],
  works: ['Subject', 'Book'],
};

function makeLibraryModel(): BESSERModel {
  const model: BESSERModel = {
    version: '3.0.0',
    type: 'ClassDiagram',
    size: { width: 1400, height: 900 },
    elements: {},
    relationships: {},
    interactive: { elements: {}, relationships: {} },
    assessments: {},
  } as BESSERModel;

  for (const name of CLASS_NAMES) {
    model.elements[`class_${name}`] = {
      id: `class_${name}`,
      name,
      type: 'Class',
      owner: null,
      bounds: { x: 0, y: 0, width: 220, height: 90 },
      attributes: [],
      methods: [],
    } as any;
  }

  for (const [name, [from, to]] of Object.entries(RELATIONSHIPS)) {
    model.relationships[`rel_${name}`] = {
      id: `rel_${name}`,
      name,
      type: 'ClassBidirectional',
      owner: null,
      source: { element: `class_${from}`, direction: 'Right' },
      target: { element: `class_${to}`, direction: 'Left' },
    } as any;
  }

  return model;
}

const classNames = (model: BESSERModel) =>
  Object.values(model.elements)
    .filter((el: any) => el.type === 'Class')
    .map((el: any) => el.name)
    .sort();

const relNames = (model: BESSERModel) =>
  Object.values(model.relationships)
    .map((rel: any) => rel.name)
    .sort();

describe('removeElement with relationship endpoints', () => {
  const modifier = new ClassDiagramModifier();

  it('removes the relationship, not the source class', () => {
    const model = makeLibraryModel();
    const mod: ModelModification = {
      action: 'remove_element',
      target: { sourceClass: 'Book', targetClass: 'BookCopy' },
    } as ModelModification;

    const result = modifier.applyModification(model, mod);

    // The pre-fix behaviour deleted the class Book here.
    expect(classNames(result)).toEqual(CLASS_NAMES.slice().sort());
    expect(relNames(result)).not.toContain('copies');
    expect(relNames(result)).toHaveLength(9);
  });

  it('matches endpoints named in either order', () => {
    const model = makeLibraryModel();
    const mod: ModelModification = {
      action: 'remove_element',
      // 'authors' is stored Book -> Author; ask for it backwards.
      target: { sourceClass: 'Author', targetClass: 'Book' },
    } as ModelModification;

    const result = modifier.applyModification(model, mod);

    expect(classNames(result)).toEqual(CLASS_NAMES.slice().sort());
    expect(relNames(result)).not.toContain('authors');
  });

  it('accepts the rendered arrow label in relationshipName', () => {
    const model = makeLibraryModel();
    const mod: ModelModification = {
      action: 'remove_element',
      target: { relationshipName: 'Loan → BookCopy' },
    } as ModelModification;

    const result = modifier.applyModification(model, mod);

    expect(classNames(result)).toEqual(CLASS_NAMES.slice().sort());
    expect(relNames(result)).not.toContain('item');
  });

  it('changes nothing when the relationship does not exist', () => {
    const model = makeLibraryModel();
    const mod: ModelModification = {
      action: 'remove_element',
      target: { sourceClass: 'Author', targetClass: 'Subject' },
    } as ModelModification;

    const result = modifier.applyModification(model, mod);

    expect(classNames(result)).toEqual(CLASS_NAMES.slice().sort());
    expect(relNames(result)).toHaveLength(10);
  });

  it('never deletes a class from a lone, unresolvable endpoint', () => {
    const model = makeLibraryModel();
    const mod: ModelModification = {
      action: 'remove_element',
      target: { sourceClass: 'Book' },
    } as ModelModification;

    const result = modifier.applyModification(model, mod);

    expect(classNames(result)).toContain('Book');
    expect(relNames(result)).toHaveLength(10);
  });

  it('still removes a class when the target really names one', () => {
    const model = makeLibraryModel();
    const mod: ModelModification = {
      action: 'remove_element',
      target: { className: 'Subject' },
    } as ModelModification;

    const result = modifier.applyModification(model, mod);

    expect(classNames(result)).not.toContain('Subject');
    // Only Subject's own relationships go with it.
    expect(relNames(result).sort()).toEqual(
      ['authors', 'book_1', 'borrower', 'copies', 'item', 'loans', 'requester', 'reservationBook'].sort(),
    );
  });
});

describe('the live "remove book copy" batch', () => {
  const modifier = new ClassDiagramModifier();

  it('leaves 10 classes and 7 relationships', () => {
    let model = makeLibraryModel();

    // Exactly what the agent sent at 10:00:37 on 2026-09-16.
    const batch: ModelModification[] = [
      { action: 'remove_element', target: { className: 'BookCopy' } },
      { action: 'remove_element', target: { sourceClass: 'Book', targetClass: 'BookCopy' } },
      { action: 'remove_element', target: { sourceClass: 'BookCopy', targetClass: 'Book' } },
      { action: 'remove_element', target: { sourceClass: 'Loan', targetClass: 'BookCopy' } },
    ] as ModelModification[];

    for (const mod of batch) {
      model = modifier.applyModification(model, mod);
    }

    // Before the fix: ['Author','Member','Reservation','Subject'] and 1 relationship.
    expect(classNames(model)).toEqual(
      ['Author', 'Book', 'Loan', 'Member', 'Reservation', 'Subject'].sort(),
    );
    expect(relNames(model)).toEqual(
      ['authors', 'borrower', 'loans', 'requester', 'reservationBook', 'subjects', 'works'].sort(),
    );
  });
});

describe('summarizeModelDiff / classesNamedForRemoval', () => {
  const modifier = new ClassDiagramModifier();

  it('reports the real damage, not the claimed change', async () => {
    const { summarizeModelDiff, classesNamedForRemoval } = await import('../modifiers/base');
    const before = makeLibraryModel();
    let after = JSON.parse(JSON.stringify(before));

    const batch = [
      { action: 'remove_element', target: { className: 'BookCopy' } },
      { action: 'remove_element', target: { sourceClass: 'Book', targetClass: 'BookCopy' } },
    ] as ModelModification[];
    for (const mod of batch) after = modifier.applyModification(after, mod);

    const diff = summarizeModelDiff(before, after);
    expect(diff.removedClasses).toEqual(['BookCopy']);

    // Only the class modification counts as an intended removal; the
    // endpoint pair names a relationship and must never license a deletion.
    const intended = classesNamedForRemoval(batch);
    expect([...intended]).toEqual(['BookCopy']);
    expect(diff.removedClasses.filter((n) => !intended.has(n))).toEqual([]);
  });

  it('flags collateral when a class dies that nothing named', async () => {
    const { summarizeModelDiff, classesNamedForRemoval } = await import('../modifiers/base');
    const before = makeLibraryModel();
    const after = JSON.parse(JSON.stringify(before));
    // Simulate the pre-fix outcome: Book deleted by a relationship modification.
    delete after.elements.class_Book;

    const batch = [
      { action: 'remove_element', target: { sourceClass: 'Book', targetClass: 'BookCopy' } },
    ] as ModelModification[];

    const diff = summarizeModelDiff(before, after);
    const intended = classesNamedForRemoval(batch);
    expect(diff.removedClasses.filter((n) => !intended.has(n))).toEqual(['Book']);
  });
});
