import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useModelInjection } from '../useModelInjection';

const { layoutModel } = vi.hoisted(() => ({ layoutModel: vi.fn(async (model: any) => model) }));
vi.mock('@besser/wme', async (importOriginal) => ({ ...(await importOriginal<object>()), layoutModel }));

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

const row = (id: string, name: string, attributeType = 'str') => ({ id, name, attributeType, visibility: 'public' });
const classNode = (id: string, name: string, x: number, y: number, attributes: any[], methods: any[] = [], stereotype?: string) => ({
  id,
  type: 'class',
  position: { x, y },
  width: 220,
  height: 100,
  measured: { width: 220, height: 100 },
  data: { name, attributes, methods, ...(stereotype && { stereotype }) },
});

/** Book/Author class diagram with a legacy "+ title: str" member label and an enum. */
const libraryModel = (): any => ({
  version: '4.0.0',
  type: 'ClassDiagram',
  nodes: [
    classNode('cls-book', 'Book', 40, 40, [row('att-title', '+ title: str'), row('att-pages', 'pages', 'int'), row('att-genre', 'genre', 'Genre')], [
      row('met-read', '+ read(): str'),
    ]),
    classNode('cls-author', 'Author', 400, 40, [row('att-name', 'name')]),
    classNode('enum-genre', 'Genre', 40, 400, [row('lit-fiction', 'FICTION'), row('lit-poetry', 'POETRY')], [], 'Enumeration'),
  ],
  edges: [
    {
      id: 'rel-writes',
      type: 'ClassBidirectional',
      source: 'cls-author',
      target: 'cls-book',
      data: { name: 'writes', sourceMultiplicity: '1', targetMultiplicity: '*', points: [] },
    },
  ],
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
const nodeNamed = (model: any, name: string) => model.nodes.find((n: any) => n.data.name === name);
const idOf = (model: any, name: string) => nodeNamed(model, name)?.id;
const rows = (model: any, classId: string, list = 'attributes') =>
  model.nodes.find((n: any) => n.id === classId)?.data[list] ?? [];
const memberId = (model: any, name: string, classId: string, list = 'attributes') =>
  rows(model, classId, list).find((r: any) => memberName(r.name) === name)?.id;
const allIds = (model: any) => [
  ...model.nodes.map((n: any) => n.id),
  ...model.nodes.flatMap((n: any) => [...(n.data.attributes ?? []), ...(n.data.methods ?? [])].map((r: any) => r.id)),
  ...model.edges.map((e: any) => e.id),
];

describe('whole-diagram rebuild keeps element ids', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reuses class, attribute, method, literal and relationship ids on a replace rebuild', async () => {
    const model = await rebuild(librarySpec(), true);

    expect(idOf(model, 'Book')).toBe('cls-book');
    expect(idOf(model, 'Author')).toBe('cls-author');
    expect(idOf(model, 'Genre')).toBe('enum-genre');
    expect(rows(model, 'cls-book').map((r: any) => r.id)).toEqual(['att-title', 'att-pages', 'att-genre']);
    expect(memberId(model, 'read', 'cls-book', 'methods')).toBe('met-read');
    expect(memberId(model, 'name', 'cls-author')).toBe('att-name');
    expect(rows(model, 'enum-genre').map((r: any) => r.id)).toEqual(['lit-fiction', 'lit-poetry']);
    expect(model.edges.map((e: any) => e.id)).toEqual(['rel-writes']);
    expect(model.edges[0].source).toBe('cls-author');
  });

  it('keeps object-diagram references resolvable after the rebuild', async () => {
    const model = await rebuild(librarySpec(), true);

    for (const ref of objectDiagramRefs) {
      const node = model.nodes.find((n: any) => n.id === ref.classId);
      expect(node?.data.name).toBe(ref.className);
      const attribute = node.data.attributes.find((r: any) => r.id === ref.attributeId);
      expect(memberName(attribute.name)).toBe(ref.attributeName);
    }
  });

  it('gives an added class a fresh id and never reuses an id twice', async () => {
    const model = await rebuild(
      librarySpec([{ className: 'Loan', attributes: [{ name: 'title', type: 'str' }], methods: [] }]),
      true,
    );

    const loanId = idOf(model, 'Loan');
    expect(loanId).toBeTruthy();
    expect(allIds(libraryModel())).not.toContain(loanId);
    // Same attribute name on another class does not steal Book.title's id.
    expect(memberId(model, 'title', loanId)).not.toBe('att-title');
    expect(memberId(model, 'title', 'cls-book')).toBe('att-title');
    const ids = allIds(model);
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
    expect(model.edges.map((e: any) => e.id)).toEqual(['rel-writes']);
  });

  it('ignores ids the spec carries and matches by name', async () => {
    const spec = librarySpec();
    (spec.classes[1] as any).id = 'cls-book'; // Author listed with Book's id
    spec.classes.push({ className: 'Shelf', id: 'att-title', attributes: [], methods: [] } as any);
    spec.classes.reverse();
    const model = await rebuild(spec, true);

    expect(idOf(model, 'Book')).toBe('cls-book');
    expect(idOf(model, 'Author')).toBe('cls-author');
    expect(memberId(model, 'title', 'cls-book')).toBe('att-title');
    expect(allIds(libraryModel())).not.toContain(idOf(model, 'Shelf'));
  });

  it('keeps the ids of classes whose names differ only in case', async () => {
    const current = libraryModel();
    current.nodes.push(classNode('cls-book2', 'book', 800, 40, []));
    const model = await rebuild(librarySpec([{ className: 'book', attributes: [], methods: [] }]), true, current);

    expect(idOf(model, 'Book')).toBe('cls-book');
    expect(idOf(model, 'book')).toBe('cls-book2');
  });

  it('keeps the ids of overloaded methods', async () => {
    const current = libraryModel();
    current.nodes[0].data.methods.push(row('met-read2', '+ read(page: int): str'));
    const spec = librarySpec();
    spec.classes[0].methods = [
      { name: 'read', returnType: 'str' },
      { name: 'read', returnType: 'str', parameters: [{ name: 'page', type: 'int' }] },
    ] as any;
    const model = await rebuild(spec, true, current);

    expect(rows(model, 'cls-book', 'methods').map((r: any) => r.id).sort()).toEqual(['met-read', 'met-read2']);
  });
});

describe('replaceExisting=false keeps the existing diagram', () => {
  beforeEach(() => vi.clearAllMocks());

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
    for (const node of before.nodes) {
      expect(model.nodes.find((n: any) => n.id === node.id)).toEqual(node);
    }
    expect(model.edges.find((e: any) => e.id === 'rel-writes')).toEqual(before.edges[0]);
    const orderId = idOf(model, 'Order');
    expect(orderId).toBeTruthy();
    expect(memberId(model, 'total', orderId)).toBeTruthy();
    // Placed below the existing content, and the user's layout is not rearranged.
    expect(nodeNamed(model, 'Order').position.y).toBeGreaterThan(500);
    expect(layoutModel).not.toHaveBeenCalled();
  });

  it('adds a new association between two existing classes', async () => {
    const model = await rebuild(
      {
        systemName: 'Library',
        classes: [
          { className: 'Book', attributes: [{ name: 'title', type: 'str' }], methods: [] },
          { className: 'Author', attributes: [{ name: 'name', type: 'str' }], methods: [] },
        ],
        relationships: [{ type: 'Association', source: 'Author', target: 'Book', name: 'reviews' }],
      },
      false,
    );

    expect(model.edges.map((e: any) => e.data.name).sort()).toEqual(['reviews', 'writes']);
    expect(model.edges.find((e: any) => e.id === 'rel-writes').data.name).toBe('writes');
  });

  it('does not fold a class into an existing one because the spec carries its id', async () => {
    const model = await rebuild(
      { systemName: 'S', classes: [{ id: 'cls-author', className: 'Shelf', attributes: [], methods: [] }], relationships: [] },
      false,
    );

    expect(model.nodes.find((n: any) => n.id === 'cls-author').data.name).toBe('Author');
    expect(idOf(model, 'Shelf')).toBeTruthy();
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

    expect(model.nodes.filter((n: any) => n.data.name === 'Book')).toHaveLength(1);
    const isbnId = memberId(model, 'isbn', 'cls-book');
    expect(isbnId).toBeTruthy();
    expect(rows(model, 'cls-book').map((r: any) => r.id)).toEqual(['att-title', 'att-pages', 'att-genre', isbnId]);
    expect(nodeNamed(model, 'Book').position).toEqual(libraryModel().nodes[0].position);
    const borrows = model.edges.find((e: any) => e.data.name === 'borrows');
    expect(borrows.target).toBe('cls-book');
    expect(model.edges).toHaveLength(2);
  });

  it('still replaces when replaceExisting is true or not sent', async () => {
    for (const replaceExisting of [true, undefined]) {
      const model = await rebuild(
        { systemName: 'Shop', classes: [{ className: 'Order', attributes: [], methods: [] }], relationships: [] },
        replaceExisting,
      );
      expect(model.nodes.map((n: any) => n.data.name)).toEqual(['Order']);
    }
  });
});
