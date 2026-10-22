import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useModelInjection } from '../useModelInjection';
import { consumeAutoLayoutRequest } from '../../../../shared/utils/autoLayoutSignal';

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn() },
}));

vi.mock('../../../../app/store/workspaceSlice', () => ({
  updateDiagramModelThunk: Object.assign((payload: unknown) => ({ type: 'updateDiagramModel', payload }), {
    rejected: { match: () => false },
  }),
  switchDiagramIndexThunk: (payload: unknown) => ({ type: 'switchDiagramIndex', payload }),
  addDiagramThunk: (payload: unknown) => ({ type: 'addDiagram', payload }),
  bumpEditorRevision: () => ({ type: 'bumpEditorRevision' }),
}));

const b = (x = 0, y = 0) => ({ x, y, width: 220, height: 100 });

/** Book/Author class diagram with legacy "+ name: type" member labels and an enum. */
const libraryModel = () => ({
  version: '3.0.0',
  type: 'ClassDiagram',
  size: { width: 1000, height: 1000 },
  interactive: { elements: {}, relationships: {} },
  assessments: {},
  elements: {
    'cls-book': { id: 'cls-book', type: 'Class', name: 'Book', owner: null, bounds: b(40, 40), attributes: ['att-title', 'att-pages', 'att-genre'], methods: ['met-read'] },
    'att-title': { id: 'att-title', type: 'ClassAttribute', name: '+ title: str', attributeType: 'str', owner: 'cls-book', bounds: b(40, 90) },
    'att-pages': { id: 'att-pages', type: 'ClassAttribute', name: 'pages', attributeType: 'int', owner: 'cls-book', bounds: b(40, 115) },
    'att-genre': { id: 'att-genre', type: 'ClassAttribute', name: 'genre', attributeType: 'Genre', owner: 'cls-book', bounds: b(40, 140) },
    'met-read': { id: 'met-read', type: 'ClassMethod', name: '+ read(): str', owner: 'cls-book', bounds: b(40, 170) },
    'cls-author': { id: 'cls-author', type: 'Class', name: 'Author', owner: null, bounds: b(400, 40), attributes: ['att-name'], methods: [] },
    'att-name': { id: 'att-name', type: 'ClassAttribute', name: 'name', attributeType: 'str', owner: 'cls-author', bounds: b(400, 90) },
    'enum-genre': { id: 'enum-genre', type: 'Enumeration', name: 'Genre', owner: null, bounds: b(40, 400), attributes: ['lit-fiction', 'lit-poetry'], methods: [] },
    'lit-fiction': { id: 'lit-fiction', type: 'ClassAttribute', name: 'FICTION', owner: 'enum-genre', bounds: b(40, 450) },
    'lit-poetry': { id: 'lit-poetry', type: 'ClassAttribute', name: 'POETRY', owner: 'enum-genre', bounds: b(40, 475) },
  },
  relationships: {
    'rel-writes': {
      id: 'rel-writes', type: 'ClassBidirectional', name: 'writes', bounds: b(), path: [],
      source: { element: 'cls-author', multiplicity: '1', role: 'author', direction: 'Left', bounds: b() },
      target: { element: 'cls-book', multiplicity: '*', role: 'books', direction: 'Right', bounds: b() },
    },
  },
});

/** The same model as the agent re-describes it in a rebuild: names only, no ids. */
const librarySpec = (extraClasses: any[] = []) => ({
  systemName: 'Library',
  classes: [
    {
      className: 'Book',
      attributes: [
        { name: 'title', type: 'str' },
        { name: 'pages', type: 'int' },
        { name: 'genre', type: 'Genre' },
      ],
      methods: [{ name: 'read', returnType: 'str' }],
    },
    { className: 'Author', attributes: [{ name: 'name', type: 'str' }], methods: [] },
    { className: 'Genre', isEnumeration: true, attributes: [{ name: 'FICTION' }, { name: 'POETRY' }], methods: [] },
    ...extraClasses,
  ],
  relationships: [
    { type: 'Association', source: 'Author', target: 'Book', sourceMultiplicity: '1', targetMultiplicity: '*', name: 'writes' },
  ],
});

/** Object-diagram references into the class diagram (classId / attributeId). */
const objectDiagramRefs = [
  { classId: 'cls-book', className: 'Book', attributeId: 'att-title', attributeName: 'title' },
  { classId: 'cls-author', className: 'Author', attributeId: 'att-name', attributeName: 'name' },
];

const run = async (command: any, currentModel: any = libraryModel()) => {
  const dispatched: any[] = [];
  const dispatch = vi.fn((action: any) => {
    dispatched.push(action);
    return { unwrap: () => Promise.resolve(action) };
  });
  const { result } = renderHook(() =>
    useModelInjection({
      dispatch: dispatch as any,
      editor: null,
      modelingServiceRef: { current: null },
      currentModelRef: { current: currentModel },
      currentProjectRef: { current: null },
      currentDiagramTypeRef: { current: 'ClassDiagram' },
      switchDiagramRef: { current: async () => true },
      setMessages: vi.fn(),
      setMessageMeta: vi.fn(),
      setProgressMessage: vi.fn(),
    }),
  );
  await act(async () => {
    await result.current.handleInjection({ diagramType: 'ClassDiagram', message: 'm', ...command });
  });
  const written = dispatched.filter((a) => a.type === 'updateDiagramModel');
  return written.length ? written[written.length - 1].payload.model : null;
};

const rebuild = (systemSpec: any, replaceExisting?: boolean, currentModel?: any) =>
  run({ action: 'inject_complete_system', systemSpec, replaceExisting }, currentModel);

const memberName = (name: string) => name.replace(/^[+\-#~] /, '').split(/[:(]/)[0].trim();
const idOf = (model: any, name: string, owner: string | null = null) =>
  (Object.values(model.elements) as any[]).find(
    (e) => memberName(e.name) === name && (owner === null ? !e.owner : e.owner === owner),
  )?.id;

describe('whole-diagram rebuild keeps element ids', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    consumeAutoLayoutRequest();
  });

  it('reuses class, attribute, method, literal and relationship ids on a replace rebuild', async () => {
    const model = await rebuild(librarySpec(), true);

    expect(idOf(model, 'Book')).toBe('cls-book');
    expect(idOf(model, 'Author')).toBe('cls-author');
    expect(idOf(model, 'Genre')).toBe('enum-genre');
    expect(idOf(model, 'title', 'cls-book')).toBe('att-title');
    expect(idOf(model, 'pages', 'cls-book')).toBe('att-pages');
    expect(idOf(model, 'genre', 'cls-book')).toBe('att-genre');
    expect(idOf(model, 'read', 'cls-book')).toBe('met-read');
    expect(idOf(model, 'name', 'cls-author')).toBe('att-name');
    expect(idOf(model, 'FICTION', 'enum-genre')).toBe('lit-fiction');
    expect(idOf(model, 'POETRY', 'enum-genre')).toBe('lit-poetry');
    expect(Object.keys(model.relationships)).toEqual(['rel-writes']);
    expect(model.relationships['rel-writes'].source.element).toBe('cls-author');
    expect(model.elements['cls-book'].attributes).toEqual(['att-title', 'att-pages', 'att-genre']);
  });

  it('keeps object-diagram references resolvable after the rebuild', async () => {
    const model = await rebuild(librarySpec(), true);

    for (const ref of objectDiagramRefs) {
      expect(model.elements[ref.classId]?.name).toBe(ref.className);
      expect(model.elements[ref.attributeId]?.owner).toBe(ref.classId);
      expect(memberName(model.elements[ref.attributeId].name)).toBe(ref.attributeName);
    }
  });

  it('gives an added class a fresh id and never reuses an id twice', async () => {
    const model = await rebuild(
      librarySpec([{ className: 'Loan', attributes: [{ name: 'title', type: 'str' }], methods: [] }]),
      true,
    );

    const loanId = idOf(model, 'Loan');
    expect(loanId).toBeTruthy();
    expect(Object.keys(libraryModel().elements)).not.toContain(loanId);
    // Same attribute name on another class does not steal Book.title's id.
    expect(idOf(model, 'title', loanId)).not.toBe('att-title');
    expect(idOf(model, 'title', 'cls-book')).toBe('att-title');
    const ids = [...Object.keys(model.elements), ...Object.keys(model.relationships)];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('matches classes case-insensitively and keeps a single association whose name changed', async () => {
    const spec = librarySpec();
    spec.classes[0].className = 'book';
    spec.relationships[0].name = 'authors';
    spec.relationships[0].source = 'book';
    spec.relationships[0].target = 'Author';
    const model = await rebuild(spec, true);

    expect(idOf(model, 'book')).toBe('cls-book');
    expect(Object.keys(model.relationships)).toEqual(['rel-writes']);
  });

  it('honours a valid spec id (a rename) and drops ids that are taken or of another kind', async () => {
    const spec = librarySpec();
    spec.classes[0].className = 'Novel';
    (spec.classes[0] as any).id = 'cls-book';
    spec.relationships[0].target = 'Novel';
    (spec.classes[1] as any).id = 'cls-book'; // Author: matched by name instead
    spec.classes.push({ className: 'Shelf', id: 'att-title', attributes: [], methods: [] } as any);
    spec.classes.push({ className: 'Branch', id: 'cls-new', attributes: [], methods: [] } as any);
    const model = await rebuild(spec, true);

    expect(idOf(model, 'Novel')).toBe('cls-book');
    expect(idOf(model, 'title', 'cls-book')).toBe('att-title');
    expect(idOf(model, 'Author')).toBe('cls-author');
    expect(idOf(model, 'Shelf')).not.toBe('att-title');
    expect(idOf(model, 'Branch')).toBe('cls-new');
  });

  it('prefers a name match over a wrong id the spec carries', async () => {
    const spec = librarySpec();
    (spec.classes[1] as any).id = 'cls-book'; // Author listed with Book's id
    spec.classes.reverse();
    const model = await rebuild(spec, true);

    expect(idOf(model, 'Book')).toBe('cls-book');
    expect(idOf(model, 'Author')).toBe('cls-author');
  });
});

describe('replaceExisting=false keeps the existing diagram', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    consumeAutoLayoutRequest();
  });

  it('adds the new classes alongside the old ones', async () => {
    const model = await rebuild(
      {
        systemName: 'Shop',
        classes: [{ className: 'Order', attributes: [{ name: 'total', type: 'float' }], methods: [] }],
        relationships: [],
      },
      false,
    );

    const before = libraryModel();
    for (const [id, element] of Object.entries(before.elements)) {
      expect(model.elements[id]).toEqual(element);
    }
    expect(model.relationships['rel-writes']).toEqual(before.relationships['rel-writes']);
    const orderId = idOf(model, 'Order');
    expect(orderId).toBeTruthy();
    expect(idOf(model, 'total', orderId)).toBeTruthy();
    // Placed below the existing content, and the user's layout is not rearranged.
    expect(model.elements[orderId].bounds.y).toBeGreaterThan(500);
    expect(consumeAutoLayoutRequest()).toBe(false);
  });

  it('merges a class that already exists instead of duplicating it', async () => {
    const model = await rebuild(
      {
        systemName: 'Library',
        classes: [
          { className: 'Book', attributes: [{ name: 'title', type: 'str' }, { name: 'isbn', type: 'str' }], methods: [] },
          { className: 'Member', attributes: [{ name: 'email', type: 'str' }], methods: [] },
        ],
        relationships: [{ type: 'Association', source: 'Member', target: 'Book', name: 'borrows' }],
      },
      false,
    );

    const books = (Object.values(model.elements) as any[]).filter((e) => e.name === 'Book');
    expect(books).toHaveLength(1);
    const isbnId = idOf(model, 'isbn', 'cls-book');
    expect(isbnId).toBeTruthy();
    expect(model.elements['cls-book'].attributes).toEqual(['att-title', 'att-pages', 'att-genre', isbnId]);
    expect(model.elements['cls-book'].bounds).toEqual(libraryModel().elements['cls-book'].bounds);
    const borrows = (Object.values(model.relationships) as any[]).find((r) => r.name === 'borrows');
    expect(borrows.target.element).toBe('cls-book');
    expect(Object.keys(model.relationships)).toHaveLength(2);
  });

  it('still replaces when replaceExisting is true or not sent', async () => {
    for (const replaceExisting of [true, undefined]) {
      const model = await rebuild(
        { systemName: 'Shop', classes: [{ className: 'Order', attributes: [], methods: [] }], relationships: [] },
        replaceExisting,
      );
      expect((Object.values(model.elements) as any[]).map((e) => e.name)).toEqual(['Order']);
    }
  });
});
