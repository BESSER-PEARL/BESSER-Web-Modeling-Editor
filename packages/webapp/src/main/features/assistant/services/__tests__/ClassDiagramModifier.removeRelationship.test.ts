/**
 * Removing a relationship must never delete a class.
 *
 * The agent names a relationship with `target.sourceClass` / `target.targetClass`,
 * which the modifier knew neither of, so every branch in `removeElement` fell
 * through to "Remove entire class" and its fallback matched the SOURCE class by
 * name. "remove book copy" on the 11-class library model
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
  // v4 shape: classes are `class` nodes, relationships are edges.
  const model: any = {
    version: '4.0.0',
    id: 'library',
    title: 'Library',
    type: 'ClassDiagram',
    nodes: [],
    edges: [],
    assessments: {},
  };

  for (const name of CLASS_NAMES) {
    model.nodes.push({
      id: `class_${name}`,
      type: 'class',
      position: { x: 0, y: 0 },
      width: 220,
      height: 90,
      data: { name, attributes: [], methods: [] },
    });
  }

  for (const [name, [from, to]] of Object.entries(RELATIONSHIPS)) {
    model.edges.push({
      id: `rel_${name}`,
      type: 'ClassBidirectional',
      source: `class_${from}`,
      target: `class_${to}`,
      sourceHandle: 'right',
      targetHandle: 'left',
      data: { name, sourceNavigable: true, targetNavigable: true, points: [] },
    });
  }

  return model as BESSERModel;
}

const classNames = (model: BESSERModel) =>
  ((model as any).nodes as any[])
    .filter((n: any) => n.type === 'class')
    .map((n: any) => n.data.name)
    .sort();

const relNames = (model: BESSERModel) =>
  ((model as any).edges as any[])
    .map((e: any) => e.data?.name)
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

    // A batch as the agent actually sends it.
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
    after.nodes = after.nodes.filter((n: any) => n.id !== 'class_Book');

    const batch = [
      { action: 'remove_element', target: { sourceClass: 'Book', targetClass: 'BookCopy' } },
    ] as ModelModification[];

    const diff = summarizeModelDiff(before, after);
    const intended = classesNamedForRemoval(batch);
    expect(diff.removedClasses.filter((n) => !intended.has(n))).toEqual(['Book']);
  });
});
