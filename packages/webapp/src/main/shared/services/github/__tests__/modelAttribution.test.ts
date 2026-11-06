import { describe, expect, it } from 'vitest';
import type { BesserProject } from '../../../types/project';
import { classModelElements, classModelIds, elementLabel, elementRecords, newElementIds } from '../modelAttribution';

const ANA = { addedBy: 'ana', addedAt: '2026-11-04T12:00:00Z' };

const apollon = (elements: Record<string, unknown>, attribution?: BesserProject['attribution']) =>
  ({
    id: 'p1',
    attribution,
    diagrams: { ClassDiagram: [{ id: 'cd1', model: { elements, relationships: {} } }] },
  }) as unknown as BesserProject;

const BOOK = { id: 'c1', type: 'Class', name: 'Book', owner: null };
const TITLE = { id: 'a1', type: 'ClassAttribute', name: '+ title: str', owner: 'c1' };
const LOAN = { id: 'c2', type: 'Class', name: 'Loan', owner: null };

describe('classModelElements', () => {
  it('reads the classes and members of an Apollon model, and nothing else', () => {
    const project = apollon({ c1: BOOK, a1: TITLE, pk: { id: 'pk', type: 'Package', name: 'shop' } });

    expect([...classModelElements(project).keys()]).toEqual(['c1', 'a1']);
    expect(classModelElements(project).get('a1')?.ownerId).toBe('c1');
  });

  it('reads the class nodes and their rows of a React Flow model', () => {
    const project = {
      diagrams: {
        ClassDiagram: [{
          model: {
            nodes: [
              { id: 'c1', type: 'class', data: { name: 'Book', attributes: [{ id: 'a1', name: 'title' }], methods: [{ id: 'm1', name: 'lend' }] } },
              { id: 'n1', type: 'colorDescription', data: {} },
            ],
          },
        }],
      },
    } as unknown as BesserProject;

    expect([...classModelElements(project).keys()]).toEqual(['c1', 'a1', 'm1']);
  });
});

describe('newElementIds', () => {
  it('finds what the pull added and someone is credited for', () => {
    const local = apollon({ c1: BOOK });
    const pulled = apollon({ c1: BOOK, c2: LOAN, a1: TITLE }, { c1: ANA, c2: ANA, a1: ANA });

    expect(newElementIds(pulled, local)).toEqual(['c2', 'a1']);
  });

  it('finds a relationship the pull added and someone is credited for', () => {
    const relationships = { r1: { source: { element: 'c1' }, target: { element: 'c2' } } };
    const local = apollon({ c1: BOOK, c2: LOAN });
    const pulled = {
      ...apollon({ c1: BOOK, c2: LOAN }, { r1: ANA }),
      diagrams: { ClassDiagram: [{ id: 'cd1', model: { elements: { c1: BOOK, c2: LOAN }, relationships } }] },
    } as unknown as BesserProject;

    expect(newElementIds(pulled, local)).toEqual(['r1']);
    expect(newElementIds(pulled, local, ['r1'])).toEqual([]);
    expect(classModelIds(pulled)).toContain('r1');
  });

  it('marks nothing in a project saved before attribution existed', () => {
    const local = apollon({ c1: BOOK });
    const pulled = apollon({ c1: BOOK, c2: LOAN });

    expect(newElementIds(pulled, local)).toEqual([]);
  });

  it('does not mark an element both sides already hold, even with a new record', () => {
    const local = apollon({ c1: BOOK });
    const pulled = apollon({ c1: BOOK }, { c1: ANA });

    expect(newElementIds(pulled, local)).toEqual([]);
  });
});

describe('elementLabel', () => {
  it('names a class, and a member with its class and without its type', () => {
    const elements = classModelElements(apollon({ c1: BOOK, a1: TITLE, m1: { id: 'm1', type: 'ClassMethod', name: '+ lend(days: int): bool', owner: 'c1' } }));

    expect(elementLabel(elements.get('c1')!, elements)).toBe('Book');
    expect(elementLabel(elements.get('a1')!, elements)).toBe('Book.title');
    expect(elementLabel(elements.get('m1')!, elements)).toBe('Book.lend');
  });
});

describe('elementRecords', () => {
  it('keeps only records whose author and date are text', () => {
    const records = elementRecords(apollon({}, {
      c1: ANA,
      c2: { addedBy: 5, addedAt: ANA.addedAt },
      c3: { addedBy: 'ana', addedAt: 7 },
      c4: 'ana',
      c5: null,
      c6: { addedBy: '', addedAt: ANA.addedAt },
    } as unknown as BesserProject['attribution']));

    expect([...records.keys()]).toEqual(['c1']);
  });

  it('reads a file whose whole block is not an object', () => {
    expect(elementRecords(apollon({}, 'x' as unknown as BesserProject['attribution'])).size).toBe(0);
    expect(elementRecords(null).size).toBe(0);
  });

  it('does not treat a name every object has as a record', () => {
    expect(elementRecords(apollon({}, { c1: ANA })).has('constructor')).toBe(false);
  });
});

describe('newElementIds: what the pull brought in', () => {
  const incoming = apollon({ c1: BOOK, c2: LOAN }, { c2: ANA });
  const local = apollon({ c1: BOOK });

  it('marks an element the repo did not hold at the last sync', () => {
    expect(newElementIds(incoming, local, ['c1'])).toEqual(['c2']);
  });

  it('does not mark an element the repo held and this project deleted', () => {
    expect(newElementIds(incoming, local, ['c1', 'c2'])).toEqual([]);
  });

  it('marks what is new when the link does not know what the repo held', () => {
    expect(newElementIds(incoming, local)).toEqual(['c2']);
  });

  it('marks nothing for a record that is not text', () => {
    const forged = apollon({ c1: BOOK, c2: LOAN }, { c2: { addedBy: 5 } } as unknown as BesserProject['attribution']);
    expect(newElementIds(forged, local)).toEqual([]);
  });
});

describe('classModelElements: a file edited by hand', () => {
  it('skips rows and nodes that are not objects', () => {
    const project = {
      diagrams: {
        ClassDiagram: [{
          model: {
            nodes: [null, 7, { id: 'n1', type: 'class', data: { name: 'Book', attributes: [null, 'x', { id: 'r1', name: 'title' }], methods: [null] } }],
            edges: [],
          },
        }],
      },
    } as unknown as BesserProject;

    expect([...classModelElements(project).keys()]).toEqual(['n1', 'r1']);
  });

  it('skips elements that are not objects', () => {
    expect([...classModelElements(apollon({ c1: BOOK, bad: null, odd: 'x' })).keys()]).toEqual(['c1']);
  });
});
