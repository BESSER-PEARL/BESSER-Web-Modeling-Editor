/* @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { KnowledgeGraphInspector, KgSelection } from '../KnowledgeGraphInspector';
import { deleteSelectionFromModel } from '../delete-selection';
import type { KnowledgeGraphData } from '../types';

const MODEL: KnowledgeGraphData = {
  type: 'KnowledgeGraphDiagram',
  version: '1.0.0',
  nodes: [
    { id: 'a', nodeType: 'class', label: 'Person' },
    { id: 'b', nodeType: 'class', label: 'Book' },
  ],
  edges: [{ id: 'e1', source: 'a', target: 'b', label: 'reads' }],
};

function renderInspector(model: KnowledgeGraphData, selection: KgSelection) {
  const onChange = vi.fn();
  const view = render(
    <KnowledgeGraphInspector
      model={model}
      selection={selection}
      onChange={onChange}
      onHideNode={vi.fn()}
      onBulkHideNodes={vi.fn()}
      onRequestSelection={vi.fn()}
      onClearSelection={vi.fn()}
    />,
  );
  const rerender = (nextModel: KnowledgeGraphData, nextSelection: KgSelection) =>
    view.rerender(
      <KnowledgeGraphInspector
        model={nextModel}
        selection={nextSelection}
        onChange={onChange}
        onHideNode={vi.fn()}
        onBulkHideNodes={vi.fn()}
        onRequestSelection={vi.fn()}
        onClearSelection={vi.fn()}
      />,
    );
  return { onChange, rerender };
}

describe('KnowledgeGraphInspector — deleting the inspected element', () => {
  it('does not ask to discard unsaved changes when the element is deleted elsewhere', () => {
    // Reproduces the canvas Delete/Backspace flow: the editor removes the
    // selected node from the model and clears the selection in one go, while
    // the inspector still holds a (pristine) draft for that node.
    const { rerender } = renderInspector(MODEL, { kind: 'node', id: 'a' });
    expect(screen.getByDisplayValue('Person')).toBeInTheDocument();

    rerender(deleteSelectionFromModel(MODEL, ['a'], []), null);

    expect(screen.queryByText('Discard unsaved changes?')).not.toBeInTheDocument();
    expect(screen.getByText(/Click a node or relation on the canvas/)).toBeInTheDocument();
  });

  it('still guards a genuinely edited draft when the selection changes', () => {
    const { rerender } = renderInspector(MODEL, { kind: 'node', id: 'a' });
    fireEvent.change(screen.getByDisplayValue('Person'), { target: { value: 'Human' } });

    rerender(MODEL, { kind: 'node', id: 'b' });

    expect(screen.getByText('Discard unsaved changes?')).toBeInTheDocument();
  });

  it('confirms before deleting the single element the inspector is editing', () => {
    const { onChange } = renderInspector(MODEL, { kind: 'node', id: 'a' });

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    // The prompt is the shared one, and nothing is removed until it's answered.
    expect(screen.getByText('Delete selection?')).toBeInTheDocument();
    expect(screen.getByText(/permanently remove 1 node and 0 relations/)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('removes the node and its relations once the prompt is confirmed', () => {
    const { onChange } = renderInspector(MODEL, { kind: 'node', id: 'a' });

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    // Two "Delete" buttons exist while the dialog is up (footer + dialog);
    // the confirm one is the last in document order.
    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
    fireEvent.click(deleteButtons[deleteButtons.length - 1]);

    expect(onChange).toHaveBeenCalledTimes(1);
    const next: KnowledgeGraphData = onChange.mock.calls[0][0];
    expect(next.nodes.map((n) => n.id)).toEqual(['b']);
    expect(next.edges).toEqual([]);
  });
});
