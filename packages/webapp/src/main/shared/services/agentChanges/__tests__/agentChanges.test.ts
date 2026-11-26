import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearAgentChanges,
  diffDiagramModels,
  dropLatestAgentIteration,
  MAX_AGENT_ITERATIONS,
  recordAgentIteration,
} from '../agentChanges';
import { readAgentChanges } from '../../storage/agentChangeMarks';

const bounds = (x = 0, y = 0) => ({ x, y, width: 100, height: 60 });

type Item = Record<string, unknown> & { id: string };
const model = (elements: Item[], relationships: Item[] = []) => ({
  version: '3.0.0',
  type: 'ClassDiagram',
  size: { width: 0, height: 0 },
  interactive: { elements: {}, relationships: {} },
  elements: Object.fromEntries(elements.map((element) => [element.id, { owner: null, bounds: bounds(), ...element }])),
  relationships: Object.fromEntries(relationships.map((relationship) => [relationship.id, relationship])),
  assessments: {},
});

const book = { id: 'c1', type: 'Class', name: 'Book', attributes: ['a1'], methods: [] };
const title = { id: 'a1', type: 'ClassAttribute', name: '+ title: str', owner: 'c1' };
const loan = { id: 'c2', type: 'Class', name: 'Loan', attributes: [], methods: [], bounds: bounds(300, 0) };
const lends = {
  id: 'r1',
  type: 'ClassBidirectional',
  name: '',
  source: { element: 'c1', direction: 'Right' },
  target: { element: 'c2', direction: 'Left' },
  bounds: { x: 100, y: 30, width: 200, height: 1 },
  path: [{ x: 0, y: 0 }, { x: 200, y: 0 }],
};

describe('diffDiagramModels', () => {
  it('finds what was added, modified and deleted', () => {
    const before = model([book, title, loan], [lends]);
    const after = model([{ ...book, name: 'Novel' }, title, { id: 'c3', type: 'Class', name: 'Member' }]);

    const changes = diffDiagramModels(before, after);

    expect(changes.added).toEqual(['c3']);
    expect(changes.modified).toEqual(['c1']);
    expect(changes.deleted).toEqual([
      { id: 'c2', label: 'Loan', bounds: bounds(300, 0) },
      { id: 'r1', label: 'Book – Loan', relationship: true, points: [{ x: 100, y: 30 }, { x: 300, y: 30 }] },
    ]);
  });

  it('ignores moves, resizes and re-routed lines', () => {
    const before = model([book, title, loan], [lends]);
    const after = model(
      [{ ...book, bounds: bounds(50, 50) }, title, { ...loan, bounds: bounds(400, 90) }],
      [{ ...lends, source: { element: 'c1', direction: 'Down' }, path: [{ x: 0, y: 0 }, { x: 5, y: 80 }], isManuallyLayouted: true }],
    );

    expect(diffDiagramModels(before, after)).toEqual({ added: [], modified: [], deleted: [] });
  });

  it('marks a new member alone, and its class changed when a member is deleted', () => {
    const isbn = { id: 'a2', type: 'ClassAttribute', name: '+ isbn: str', owner: 'c1' };
    expect(diffDiagramModels(model([book, title]), model([{ ...book, attributes: ['a1', 'a2'] }, title, isbn]))).toEqual({
      added: ['a2'],
      modified: [],
      deleted: [],
    });

    const changes = diffDiagramModels(model([book, title]), model([{ ...book, attributes: [] }]));
    expect(changes.modified).toEqual(['c1']);
    // A deleted row is listed but not drawn: the rows below it moved up.
    expect(changes.deleted).toEqual([{ id: 'a1', label: 'Book.title' }]);
  });

  it('marks a relationship whose end or multiplicity changed', () => {
    const before = model([book, loan], [lends]);
    const after = model([book, loan], [{ ...lends, target: { element: 'c2', direction: 'Left', multiplicity: '0..*' } }]);
    expect(diffDiagramModels(before, after).modified).toEqual(['r1']);
  });

  it('marks everything added in an empty diagram', () => {
    expect(diffDiagramModels(null, model([book, title])).added).toEqual(['c1', 'a1']);
  });

  it('lists but does not draw what went when the whole model was rewritten with new ids', () => {
    const changes = diffDiagramModels(model([loan]), model([{ ...loan, id: 'x2' }]));
    expect(changes.added).toEqual(['x2']);
    expect(changes.deleted).toEqual([{ id: 'c2', label: 'Loan' }]);
  });
});

describe('the assistant iterations', () => {
  beforeEach(() => localStorage.clear());

  it('keeps the last few edits, newest first, and drops one on undo', () => {
    let current = model([]);
    for (let index = 0; index < MAX_AGENT_ITERATIONS + 1; index += 1) {
      const next = model([...Object.values(current.elements) as Item[], { id: `c${index}`, type: 'Class', name: `C${index}` }]);
      recordAgentIteration('p1', 'd1', current, next);
      current = next;
    }
    expect(readAgentChanges('p1', 'd1').map(({ added }) => added)).toEqual([['c3'], ['c2'], ['c1']]);

    dropLatestAgentIteration('p1', 'd1');
    expect(readAgentChanges('p1', 'd1').map(({ added }) => added)).toEqual([['c2'], ['c1']]);

    clearAgentChanges('p1', 'd1');
    expect(readAgentChanges('p1', 'd1')).toEqual([]);
    expect(localStorage.length).toBe(0);
  });

  it('notes nothing for an edit that changed nothing', () => {
    recordAgentIteration('p1', 'd1', model([book]), model([{ ...book, bounds: bounds(9, 9) }]));
    expect(readAgentChanges('p1', 'd1')).toEqual([]);
  });
});
