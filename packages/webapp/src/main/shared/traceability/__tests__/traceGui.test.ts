import { beforeEach, describe, expect, it } from 'vitest';
import { diffGuiModel, guiBindings, isTracedComponent, pageSources } from '../guiModelDiff';
import type { GuiComponentLike, GuiModelLike } from '../guiModelDiff';
import type { ClassModelLike } from '../classModelDiff';
import { GUI_BINDING_RULE, GUI_GENERATOR_NAME, recordElementChanges } from '../traceRecorder';
import { indexTrace, outOfDate } from '../traceQueries';
import { flushTraceSaves, loadProjectTrace, recordGuiDiagramUpdate, setTraceStorage } from '../traceStore';
import { memoryTraceStorage } from '../traceDatabase';
import { emptyTraceFile, isModelArtifact } from '../../types/traceability';
import type { TraceFile } from '../../types/traceability';
import type { BesserProject } from '../../types/project';

/** A library class diagram, as the editor stores it. */
const LIBRARY: ClassModelLike = {
  elements: {
    book: { id: 'book', type: 'Class', name: 'Book', owner: null },
    title: { id: 'title', type: 'ClassAttribute', name: 'title', owner: 'book' },
    pages: { id: 'pages', type: 'ClassAttribute', name: 'pages', owner: 'book' },
    borrow: { id: 'borrow', type: 'ClassMethod', name: 'borrow()', owner: 'book' },
    author: { id: 'author', type: 'Class', name: 'Author', owner: null },
    authorName: { id: 'authorName', type: 'ClassAttribute', name: 'name', owner: 'author' },
  },
  relationships: {
    writtenBy: { id: 'writtenBy', type: 'ClassBidirectional', source: { element: 'book', role: 'books' }, target: { element: 'author', role: 'author' } },
  },
};

const page = (id: string, name: string, components: GuiComponentLike[]) => ({
  id, name, frames: [{ component: { type: 'wrapper', components } }],
});
const table = (id: string, extra: Record<string, unknown> = {}): GuiComponentLike => ({
  type: 'table',
  attributes: {
    id, 'data-source': 'book',
    // Stored as JSON text, as the table registrar may write it.
    columns: JSON.stringify([{ field: 'title', columnType: 'field' }, { field: 'author', columnType: 'lookup', lookupEntity: 'author' }]),
    ...extra,
  },
});
const BUTTON: GuiComponentLike = {
  type: 'action-button', attributes: { id: 'b1', 'button-label': 'Borrow', 'method-class': 'book', method: 'borrow' },
};
const GUI: GuiModelLike = {
  pages: [page('p1', 'Book', [
    { tagName: 'h1', type: 'text', attributes: { id: 'h1' } }, // not traced: text
    { type: 'line-chart', attributes: { 'data-source': 'book' } }, // not traced: no persistent id
    { tagName: 'main', components: [table('t1'), BUTTON] }, // a layout container is skipped, its content is not
  ])],
};

describe('the GUI diff', () => {
  it('traces pages and the components with a persistent id that show, edit or act on data', () => {
    const changes = diffGuiModel(undefined, GUI, LIBRARY);
    expect(changes.map((c) => [c.kind, c.elementType, c.name, c.parentElementId])).toEqual([
      ['CREATED', 'Screen', 'Book', null],
      ['CREATED', 'Table', 'Table of Book', 'p1'],
      ['CREATED', 'Button', 'Borrow', 'p1'],
      // A table's columns are its parts, known by what they show.
      ['CREATED', 'FieldColumn', 'title', 't1'],
      ['CREATED', 'LookupColumn', 'author', 't1'],
    ]);
    expect(changes.find((c) => c.elementType === 'LookupColumn')?.elementId).toBe('t1#lookup:author');
    expect(isTracedComponent({ type: 'gui-input-email' })).toBe(true);
    expect(isTracedComponent({ type: 'text' })).toBe(false);
  });

  it('reports a new binding as a change of what the element is bound to, by name', () => {
    const before: GuiModelLike = { pages: [page('p1', 'Book', [table('t1')])] };
    const rebound: GuiModelLike = { pages: [page('p1', 'Book', [table('t1', { 'data-source': 'author' })])] };
    const change = diffGuiModel(before, rebound, LIBRARY).find((c) => c.elementId === 't1');
    expect(change).toMatchObject({ kind: 'UPDATED', feature: 'bindings', oldValue: 'Book', newValue: 'Author' });
  });

  it('reports a column replaced by another as one deleted and one created', () => {
    const before: GuiModelLike = { pages: [page('p1', 'Book', [table('t1')])] };
    const after: GuiModelLike = { pages: [page('p1', 'Book', [table('t1', { columns: [{ field: 'pages', columnType: 'field', label: 'Pages' }] })])] };
    expect(diffGuiModel(before, after, LIBRARY).map((c) => [c.kind, c.elementType, c.name])).toEqual([
      ['CREATED', 'FieldColumn', 'Pages'], ['DELETED', 'LookupColumn', 'author'], ['DELETED', 'FieldColumn', 'title'],
    ]);
  });

  it('resolves bindings by id, and attributes and methods by name within their class', () => {
    const bindings = guiBindings(GUI, LIBRARY);
    expect(bindings.get('t1')?.map((b) => b.elementId)).toEqual(['book']);
    expect(bindings.get('t1#field:title')?.map((b) => b.elementId)).toEqual(['title']);
    // A lookup column follows the association end its field names.
    expect(bindings.get('t1#lookup:author')?.map((b) => [b.elementType, b.elementId])).toEqual([['BinaryAssociation', 'writtenBy']]);
    expect(bindings.get('b1')?.map((b) => b.elementId)).toEqual(['book', 'borrow']);
    const byName = guiBindings({ pages: [page('p1', 'Book', [{ type: 'bar-chart', attributes: { id: 'c1', 'data-source': 'Book', 'data-field': 'pages' } }])] }, LIBRARY);
    expect(byName.get('c1')?.map((b) => [b.elementId, b.parent?.name])).toEqual([['book', undefined], ['pages', 'Book']]);
    expect(bindings.has('p1')).toBe(false); // a page binds to nothing itself
  });

  it('resolves a lookup column without a role by the class it leads to, and the attribute it displays', () => {
    const lookup = (column: Record<string, unknown>) =>
      guiBindings({ pages: [page('p1', 'Book', [table('t1', { columns: [{ columnType: 'lookup', ...column }] })])] }, LIBRARY);
    const unnamed = lookup({ field: 'Author', lookupEntity: 'author', lookupField: 'name' });
    expect(unnamed.get('t1#lookup:Author')?.map((b) => b.name)).toEqual(['Book – Author', 'name']);
    // An end the class diagram does not have still shows its class.
    const missing = guiBindings({ pages: [page('p1', 'Book', [table('t1', { 'data-source': 'author', columns: [{ columnType: 'lookup', field: 'x', lookupEntity: 'author' }] })])] }, LIBRARY);
    expect(missing.get('t1#lookup:x')?.map((b) => b.name)).toEqual(['Author']);
  });

  it('derives each page from the classes its components show, not from what a column looks up', () => {
    expect(pageSources(GUI, LIBRARY).get('p1')?.map((b) => b.elementId)).toEqual(['book']);
  });
});

const ctx = {
  diagramId: 'gui', diagramTitle: 'Library GUI', modelType: 'GUIModel', actorName: 'Ada', source: 'user' as const,
  now: '2026-11-11T10:00:00.000Z',
  bindings: guiBindings(GUI, LIBRARY),
  boundModel: { id: 'cd', title: 'Library', modelType: 'DomainModel' },
};
/** A run of the GUI generator, which also derives each page from the classes it shows (as the store records it). */
const derivedCtx = { ...ctx, generatorName: GUI_GENERATOR_NAME, bindings: new Map([...ctx.bindings, ...pageSources(GUI, LIBRARY)]) };
const nameOf = (trace: TraceFile, artifactId: string) => trace.artifacts.find((a) => a.id === artifactId)?.name;
const linksOf = (trace: TraceFile) =>
  trace.traceLinks.map((l) => [nameOf(trace, l.sourceId), nameOf(trace, l.targetId), l.evidence[0].type === 'RuleEvidence' && l.evidence[0].rule]);

describe('recording GUI edits', () => {
  it('records the edits as a session on the GUI model, each element linked from what it is bound to', () => {
    const trace = emptyTraceFile('p');
    recordElementChanges(trace, diffGuiModel(undefined, GUI, LIBRARY), ctx);
    const gui = trace.artifacts.find((a) => isModelArtifact(a) && a.elementId === 'gui');
    expect(gui).toMatchObject({ elementType: 'GUIModel', name: 'Library GUI' });
    expect(linksOf(trace)).toEqual([
      ['Book', 'Table of Book', GUI_BINDING_RULE], ['Book', 'Borrow', GUI_BINDING_RULE], ['borrow()', 'Borrow', GUI_BINDING_RULE],
      // Each column from what it shows: an attribute, the association a lookup follows.
      ['title', 'title', GUI_BINDING_RULE], ['Book – Author', 'author', GUI_BINDING_RULE],
    ]);
    const [session] = trace.operations;
    expect(session.type).toBe('ModelingSession');
    expect(session.reads.map((id) => nameOf(trace, id))).toEqual(['Book', 'borrow()', 'title', 'Book – Author']);
    // The bound elements are filed under the class diagram, an attribute under its class.
    const title = trace.artifacts.find((a) => isModelArtifact(a) && a.elementId === 'title')!;
    expect(nameOf(trace, (title as { parentId: string }).parentId)).toBe('Book');
  });

  it('records an auto-generated GUI as one session of the GUI generator, each page linked from its class', () => {
    const trace = emptyTraceFile('p');
    const old: GuiModelLike = { pages: [page('home', 'Home', [])] };
    recordElementChanges(trace, diffGuiModel(old, GUI, LIBRARY), derivedCtx);
    // What the generator replaced and what it made are one run.
    expect(trace.operations).toHaveLength(1);
    const [run] = trace.operations;
    expect(run.type).toBe('ModelingSession');
    expect(run.type === 'ModelingSession' && run.changes.map((c) => [c.kind, nameOf(trace, c.artifactId)])).toEqual([
      ['CREATED', 'Book'], ['CREATED', 'Table of Book'], ['CREATED', 'Borrow'], ['CREATED', 'title'], ['CREATED', 'author'],
      ['DELETED', 'Home'],
    ]);
    expect(run.toolCalls).toHaveLength(1);
    const generator = trace.tools.find((t) => t.id === run.toolCalls[0].toolId);
    expect(generator).toMatchObject({ type: 'ModelGenerator', name: GUI_GENERATOR_NAME });
    expect(linksOf(trace)).toContainEqual(['Book', 'Book', GUI_BINDING_RULE]); // class Book -> page Book
    expect(trace.traceLinks.every((l) => l.operationId === run.id)).toBe(true);
  });

  it('keeps the links of a generator run current until the GUI is edited after it, in a session of its own', () => {
    const trace = emptyTraceFile('p');
    recordElementChanges(trace, diffGuiModel(undefined, GUI, LIBRARY), derivedCtx);
    expect(trace.traceLinks.every((l) => outOfDate(indexTrace(trace), l).length === 0)).toBe(true);

    const edited: GuiModelLike = { pages: [page('p1', 'Book', [table('t1', { 'chart-title': 'Books' }), BUTTON])] };
    recordElementChanges(trace, diffGuiModel(GUI, edited, LIBRARY), { ...ctx, now: '2026-11-11T10:01:00.000Z' });
    expect(trace.operations).toHaveLength(2); // the edit is not part of the run
    const index = indexTrace(trace);
    const stale = trace.traceLinks.filter((l) => outOfDate(index, l).includes('TARGET_CHANGED'));
    // The table's link, and its page's: a page changes with what it holds. Its columns did not change.
    expect(stale.map((l) => nameOf(trace, l.targetId))).toEqual(['Book', 'Books']);
  });

  it('makes the links again when the generator runs again', () => {
    const trace = emptyTraceFile('p');
    const derive = (previous: GuiModelLike | undefined, next: GuiModelLike, now: string) =>
      recordElementChanges(trace, diffGuiModel(previous, next, LIBRARY), { ...derivedCtx, now });
    derive(undefined, GUI, '2026-11-11T10:00:00.000Z');
    const edited: GuiModelLike = { pages: [page('p1', 'Book', [table('t1', { 'data-source': '' })])] };
    recordElementChanges(trace, diffGuiModel(GUI, edited, LIBRARY), { ...ctx, now: '2026-11-11T10:01:00.000Z' });
    derive(edited, GUI, '2026-11-11T10:02:00.000Z');
    const index = indexTrace(trace);
    const run = trace.operations[2];
    const tableLinks = trace.traceLinks.filter((l) => nameOf(trace, l.targetId) === 'Table of Book');
    expect(tableLinks.length).toBeGreaterThan(0);
    expect(tableLinks.every((l) => l.operationId === run.id && outOfDate(index, l).length === 0)).toBe(true);
  });
});

describe('recording a GUI diagram in the project trace', () => {
  beforeEach(() => setTraceStorage(memoryTraceStorage()));

  it('links the GUI to the class diagram it references', async () => {
    const project = {
      id: 'p-gui', name: 'Library', owner: 'Ada', settings: { traceabilityEnabled: true },
      currentDiagramIndices: {},
      diagrams: {
        ClassDiagram: [{ id: 'cd', title: 'Library', model: LIBRARY }],
        GUINoCodeDiagram: [{ id: 'gui', title: 'Library GUI', model: {}, references: { ClassDiagram: 'cd' } }],
      },
    } as unknown as BesserProject;
    recordGuiDiagramUpdate(project, project.diagrams.GUINoCodeDiagram[0], undefined, GUI, 'derivation');
    await flushTraceSaves();
    const trace = await loadProjectTrace(project.id);
    expect(trace.operations.map((o) => o.type)).toEqual(['ModelingSession']);
    const classDiagram = trace.artifacts.find((a) => isModelArtifact(a) && a.elementId === 'cd');
    expect(classDiagram).toMatchObject({ elementType: 'DomainModel', name: 'Library' });
    expect(trace.traceLinks).toHaveLength(6);
  });
});
