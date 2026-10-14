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
vi.mock('../CytoscapeCanvas', () => ({
  CytoscapeCanvas: React.forwardRef<unknown, any>(({ model, onSelect, onChange }, _ref) => (
    <div>
      <button data-testid="select-a" onClick={() => onSelect({ kind: 'node', id: 'a' })} />
      <button
        data-testid="drag-a"
        onClick={() =>
          onChange({ ...model, nodes: model.nodes.map((n: any) => (n.id === 'a' ? { ...n, position: { x: 5, y: 5 } } : n)) })
        }
      />
    </div>
  )),
}));
vi.mock('../KnowledgeGraphNodeList', () => ({
  KnowledgeGraphNodeList: ({ onToggle }: any) => <button data-testid="hide-b" onClick={() => onToggle('b', false)} />,
}));
vi.mock('../KnowledgeGraphInspector', () => ({
  KnowledgeGraphInspector: ({ selection }: any) => <div data-testid="selection">{JSON.stringify(selection)}</div>,
}));
vi.mock('../KnowledgeGraphPalette', () => ({ KnowledgeGraphPalette: () => null }));
vi.mock('../KnowledgeGraphToolbar', () => ({ KnowledgeGraphToolbar: () => null }));
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

  it('clears the selection when something else replaces the model and the node is gone', () => {
    act(() => {
      store.diagram = diagramOf({ ...MODEL, nodes: [MODEL.nodes[1]], edges: [] });
      store.notify();
    });

    expect(selectionShown()).toBeNull();
  });
});
