/* @vitest-environment jsdom */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { KnowledgeGraphData } from '../types';
import type { ProjectDiagram } from '../../../../shared/types/project';

// ── The project store, as the editor sees it ────────────────────────────────
// The editor saves its model (debounced) and then gets the saved diagram back
// through `useProject().currentDiagram`. The mocks below close that loop.
const store = vi.hoisted(() => ({
  diagram: undefined as ProjectDiagram | undefined,
  notify: () => {},
}));

vi.mock('../../../../app/hooks/useProject', () => ({
  useProject: () => ({
    currentProject: { id: 'p1', name: 'P', diagrams: {}, currentDiagramIndices: {} },
    currentDiagram: store.diagram,
  }),
}));

vi.mock('../../../../shared/services/storage/ProjectStorageRepository', () => ({
  ProjectStorageRepository: {
    getCurrentProject: () => undefined,
    loadProject: () => ({
      id: 'p1',
      diagrams: { KnowledgeGraphDiagram: [store.diagram] },
      currentDiagramIndices: { KnowledgeGraphDiagram: 0 },
    }),
    updateDiagram: (_id: string, _type: string, diagram: ProjectDiagram) => {
      store.diagram = diagram;
      store.notify();
    },
  },
}));

// ── Children that need a browser canvas or a lot of context ────────────────
const moveA = (model: any, x: number) => ({
  ...model,
  nodes: model.nodes.map((n: any) => (n.id === 'a' ? { ...n, position: { x, y: x } } : n)),
});
vi.mock('../CytoscapeCanvas', () => ({
  CytoscapeCanvas: React.forwardRef<unknown, any>(({ model, visibleIds, onSelect, onChange, onUndo, onRedo }, _ref) => (
    <div>
      <button data-testid="select-a" onClick={() => onSelect({ kind: 'node', id: 'a' })} />
      <button data-testid="select-n3" onClick={() => onSelect({ kind: 'node', id: 'n3' })} />
      <button data-testid="drag-a" onClick={() => onChange(moveA(model, 5))} />
      <button data-testid="drag-a-again" onClick={() => onChange(moveA(model, 9))} />
      <button
        data-testid="auto-layout"
        onClick={() => onChange(moveA(model, 70), { undoable: false })}
      />
      <button
        data-testid="add-n3"
        onClick={() => onChange({ ...model, nodes: [...model.nodes, { id: 'n3', nodeType: 'class', label: 'N3' }] })}
      />
      <button data-testid="key-undo" onClick={() => onUndo?.()} />
      <button data-testid="key-redo" onClick={() => onRedo?.()} />
      <div data-testid="canvas-nodes">{model.nodes.map((n: any) => n.id).join(',')}</div>
      <div data-testid="canvas-visible">{visibleIds.join(',')}</div>
      <div data-testid="canvas-a-x">{String(model.nodes.find((n: any) => n.id === 'a')?.position?.x ?? '')}</div>
    </div>
  )),
}));
vi.mock('../KnowledgeGraphNodeList', () => ({
  KnowledgeGraphNodeList: ({ onToggle }: any) => (
    <>
      <button data-testid="hide-b" onClick={() => onToggle('b', false)} />
      <button data-testid="show-b" onClick={() => onToggle('b', true)} />
    </>
  ),
}));
vi.mock('../KnowledgeGraphInspector', () => ({
  KnowledgeGraphInspector: ({ selection, model, onChange }: any) => (
    <div>
      <div data-testid="selection">{JSON.stringify(selection)}</div>
      <button
        data-testid="inspector-delete-a"
        onClick={() =>
          onChange({
            ...model,
            nodes: model.nodes.filter((n: any) => n.id !== 'a'),
            edges: model.edges.filter((e: any) => e.source !== 'a' && e.target !== 'a'),
          })
        }
      />
    </div>
  ),
}));
vi.mock('../KnowledgeGraphPalette', () => ({ KnowledgeGraphPalette: () => null }));
vi.mock('../KnowledgeGraphToolbar', () => ({
  KnowledgeGraphToolbar: ({ canUndo, canRedo, onUndo, onRedo }: any) => (
    <div>
      <button data-testid="undo" disabled={!canUndo} onClick={onUndo} />
      <button data-testid="redo" disabled={!canRedo} onClick={onRedo} />
    </div>
  ),
}));
vi.mock('../KgCanvasControls', () => ({ KgCanvasControls: () => null }));
vi.mock('../KgDeleteConfirmDialog', () => ({ KgDeleteConfirmDialog: () => null }));

import { KnowledgeGraphEditor } from '../KnowledgeGraphEditor';

const SAVE_DEBOUNCE_MS = 400;

const MODEL: KnowledgeGraphData = {
  type: 'KnowledgeGraphDiagram',
  version: '1.0.0',
  nodes: [
    { id: 'a', nodeType: 'class', label: 'A' },
    { id: 'b', nodeType: 'class', label: 'B' },
  ],
  edges: [{ id: 'e', source: 'a', target: 'b', label: 'rel' }],
};

const diagramOf = (model: KnowledgeGraphData): ProjectDiagram => ({
  id: 'd1',
  title: 'KG',
  model,
  lastUpdate: '2026-01-01T00:00:00.000Z',
});

function Harness() {
  const [, force] = React.useReducer((n: number) => n + 1, 0);
  store.notify = force;
  return <KnowledgeGraphEditor />;
}

const selectionShown = () => JSON.parse(screen.getByTestId('selection').textContent || 'null');
const advanceSave = () => act(() => void vi.advanceTimersByTime(SAVE_DEBOUNCE_MS + 10));

describe('KnowledgeGraphEditor: the store echoing back a saved model', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    store.diagram = diagramOf(MODEL);
    render(
      <MemoryRouter>
        <Harness />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTestId('select-a'));
  });
  afterEach(() => vi.useRealTimers());

  it('selects through the canvas', () => {
    expect(selectionShown()).toEqual({ kind: 'node', id: 'a' });
  });

  it('keeps the selection after a visibility toggle is saved', () => {
    fireEvent.click(screen.getByTestId('hide-b'));
    advanceSave();

    // The save really happened and came back, otherwise this test proves nothing.
    expect((store.diagram!.model as KnowledgeGraphData).settings?.visibleIds).toEqual(['a']);
    expect(selectionShown()).toEqual({ kind: 'node', id: 'a' });
  });

  it('keeps the selection after the first save that follows an edit', () => {
    fireEvent.click(screen.getByTestId('drag-a'));
    advanceSave();

    expect((store.diagram!.model as KnowledgeGraphData).nodes[0].position).toEqual({ x: 5, y: 5 });
    expect(selectionShown()).toEqual({ kind: 'node', id: 'a' });
  });

  it('keeps the selection when something else replaces the model but the node survives', () => {
    act(() => {
      store.diagram = diagramOf({ ...MODEL, edges: [] });
      store.notify();
    });

    expect(selectionShown()).toEqual({ kind: 'node', id: 'a' });
  });

  it('never carries a selection over to a different diagram, even when the node ids coincide', () => {
    act(() => {
      store.diagram = { ...diagramOf({ ...MODEL, edges: [] }), id: 'another-diagram' };
      store.notify();
    });

    expect(selectionShown()).toBeNull();
  });

  it('shows a graph something else stored (a Refine KG apply) without being remounted', () => {
    // The refine hooks only dispatch updateDiagramModelThunk; they do not bump
    // editorRevision, so the new model must reach the canvas through the store.
    act(() => {
      store.diagram = diagramOf({
        ...MODEL,
        nodes: [...MODEL.nodes, { id: 'n3', nodeType: 'class', label: 'N3' }],
      });
      store.notify();
    });

    expect(text('canvas-nodes')).toBe('a,b,n3');
    expect(text('canvas-visible')?.split(',')).toContain('n3');
  });

  it('clears the selection when something else replaces the model and the node is gone', () => {
    act(() => {
      store.diagram = diagramOf({ ...MODEL, nodes: [MODEL.nodes[1]], edges: [] });
      store.notify();
    });

    expect(selectionShown()).toBeNull();
  });
});

// ── Undo / redo ─────────────────────────────────────────────────────────────

const click = (id: string) => fireEvent.click(screen.getByTestId(id));
const text = (id: string) => screen.getByTestId(id).textContent;
const savedModel = () => store.diagram!.model as KnowledgeGraphData;

describe('KnowledgeGraphEditor: undo and redo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    store.diagram = diagramOf({ ...MODEL, nodes: [{ ...MODEL.nodes[0], position: { x: 1, y: 1 } }, MODEL.nodes[1]] });
    render(
      <MemoryRouter>
        <Harness />
      </MemoryRouter>,
    );
  });
  afterEach(() => vi.useRealTimers());

  it('starts with nothing to undo or redo', () => {
    expect(screen.getByTestId('undo')).toBeDisabled();
    expect(screen.getByTestId('redo')).toBeDisabled();
  });

  it('undoes and redoes a change made on the canvas, moving the node back', () => {
    click('drag-a');
    expect(text('canvas-a-x')).toBe('5');
    expect(screen.getByTestId('undo')).toBeEnabled();

    click('undo');
    expect(text('canvas-a-x')).toBe('1');
    expect(screen.getByTestId('undo')).toBeDisabled();
    expect(screen.getByTestId('redo')).toBeEnabled();

    click('redo');
    expect(text('canvas-a-x')).toBe('5');
    expect(screen.getByTestId('redo')).toBeDisabled();
  });

  it('is reachable from the canvas keyboard shortcuts', () => {
    click('drag-a');

    click('key-undo');
    expect(text('canvas-a-x')).toBe('1');
    click('key-redo');
    expect(text('canvas-a-x')).toBe('5');
  });

  it('steps back through several changes one at a time', () => {
    click('drag-a');
    click('drag-a-again');
    expect(text('canvas-a-x')).toBe('9');

    click('undo');
    expect(text('canvas-a-x')).toBe('5');
    click('undo');
    expect(text('canvas-a-x')).toBe('1');
  });

  it('does not count an automatic layout as a step, yet keeps its result', () => {
    click('auto-layout');

    expect(text('canvas-a-x')).toBe('70');
    expect(screen.getByTestId('undo')).toBeDisabled();
  });

  it('keeps earlier steps when an automatic layout happens in between', () => {
    click('drag-a');
    click('auto-layout');

    click('undo');

    expect(text('canvas-a-x')).toBe('1');
  });

  it('drops the redo branch once something new is done after an undo', () => {
    click('drag-a');
    click('undo');
    expect(screen.getByTestId('redo')).toBeEnabled();

    click('drag-a-again');

    expect(screen.getByTestId('redo')).toBeDisabled();
  });

  it('does not make showing or hiding a node an undo step', () => {
    click('hide-b');
    click('show-b');

    expect(screen.getByTestId('undo')).toBeDisabled();
  });

  describe('which nodes are on the canvas afterwards', () => {
    it('undoing an addition removes the node from the canvas', () => {
      click('add-n3');
      expect(text('canvas-visible')).toBe('a,b,n3');

      click('undo');

      expect(text('canvas-nodes')).toBe('a,b');
      expect(text('canvas-visible')).toBe('a,b');
    });

    it('undoing a deletion brings the node and its place on the canvas back', () => {
      click('inspector-delete-a');
      expect(text('canvas-nodes')).toBe('b');
      expect(text('canvas-visible')).toBe('b');

      click('undo');

      expect(text('canvas-nodes')).toBe('a,b');
      expect(text('canvas-visible')).toBe('b,a');
    });

    it('leaves a node the user hid hidden', () => {
      click('hide-b');
      click('drag-a');

      click('undo');

      expect(text('canvas-visible')).toBe('a');
    });
  });

  it('clears a selection whose node the undo removed', () => {
    click('add-n3');
    click('select-n3');
    expect(selectionShown()).toEqual({ kind: 'node', id: 'n3' });

    click('undo');

    expect(selectionShown()).toBeNull();
  });

  it('keeps a selection that still exists', () => {
    click('select-a');
    click('drag-a');

    click('undo');

    expect(selectionShown()).toEqual({ kind: 'node', id: 'a' });
  });

  it('saves the undone graph', () => {
    click('drag-a');
    advanceSave();
    expect(savedModel().nodes[0].position).toEqual({ x: 5, y: 5 });

    click('undo');
    advanceSave();

    expect(savedModel().nodes[0].position).toEqual({ x: 1, y: 1 });
  });

  it('keeps its history when the store hands back the editor\'s own save', () => {
    click('drag-a');
    advanceSave();

    expect(screen.getByTestId('undo')).toBeEnabled();
    click('undo');
    expect(text('canvas-a-x')).toBe('1');
  });

  it('starts over when another diagram is loaded', () => {
    click('drag-a');
    expect(screen.getByTestId('undo')).toBeEnabled();

    act(() => {
      store.diagram = { ...diagramOf({ ...MODEL, nodes: [MODEL.nodes[1]], edges: [] }), id: 'another-diagram' };
      store.notify();
    });

    expect(screen.getByTestId('undo')).toBeDisabled();
    expect(screen.getByTestId('redo')).toBeDisabled();
    expect(text('canvas-nodes')).toBe('b');
  });

  it('starts over when something else replaces the graph, so an undo cannot undo it', () => {
    click('drag-a');

    act(() => {
      store.diagram = diagramOf({ ...MODEL, edges: [] });
      store.notify();
    });

    expect(screen.getByTestId('undo')).toBeDisabled();
  });

  it('does nothing when asked to undo with nothing to undo', () => {
    click('key-undo');
    click('key-redo');

    expect(text('canvas-a-x')).toBe('1');
  });
});
