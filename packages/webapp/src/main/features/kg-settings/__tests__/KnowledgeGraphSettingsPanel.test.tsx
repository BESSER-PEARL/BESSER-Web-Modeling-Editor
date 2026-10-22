/* @vitest-environment jsdom */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { KnowledgeGraphData, ProjectDiagram } from '../../../shared/types/project';

const workspace = vi.hoisted(() => ({
  diagram: undefined as ProjectDiagram | undefined,
  type: 'KnowledgeGraphDiagram' as string,
}));
const dispatch = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock('../../../app/hooks/useProject', () => ({
  useProject: () => ({
    currentProject: { id: 'p1' },
    currentDiagram: workspace.diagram,
    currentDiagramType: workspace.type,
  }),
}));
vi.mock('../../../app/store/hooks', () => ({ useAppDispatch: () => dispatch }));
vi.mock('../../../app/store/workspaceSlice', () => ({
  updateDiagramModelThunk: (arg: unknown) => ({ type: 'update', arg }),
}));
vi.mock('react-toastify', () => ({ toast }));
vi.mock('../../../shared/services/storage/ProjectStorageRepository', () => ({
  ProjectStorageRepository: new Proxy({}, { get: () => { throw new Error('the panel must go through the store'); } }),
}));

import { KnowledgeGraphSettingsPanel } from '../KnowledgeGraphSettingsPanel';

const MODEL: KnowledgeGraphData = {
  type: 'KnowledgeGraphDiagram',
  version: '1.0.0',
  nodes: [{ id: 'a', nodeType: 'class', label: 'A', position: { x: 1, y: 2 } }],
  edges: [],
  settings: { visibleIds: ['a'], softLimit: 30, layout: 'grid' },
};

const renderPanel = () =>
  render(
    <MemoryRouter>
      <KnowledgeGraphSettingsPanel />
    </MemoryRouter>,
  );

beforeEach(() => {
  workspace.diagram = { id: 'd1', title: 'KG', model: MODEL, lastUpdate: '2026-01-01T00:00:00.000Z' };
  workspace.type = 'KnowledgeGraphDiagram';
  dispatch.mockReset().mockReturnValue({ unwrap: async () => workspace.diagram });
  toast.success.mockReset();
  toast.error.mockReset();
});

describe('KnowledgeGraphSettingsPanel', () => {
  it('saves through updateDiagramModelThunk, keeping the settings it does not own', async () => {
    renderPanel();
    fireEvent.change(screen.getByLabelText(/soft/i), { target: { value: '50' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    });

    expect(dispatch).toHaveBeenCalledTimes(1);
    const { model } = dispatch.mock.calls[0][0].arg as { model: KnowledgeGraphData };
    // visibleIds is the editor's: kept as it is.
    expect(model.settings).toEqual({ visibleIds: ['a'], softLimit: 50, layout: 'grid' });
    // The layout did not change, so the stored positions stay.
    expect(model.nodes[0].position).toEqual({ x: 1, y: 2 });
    expect(toast.success).toHaveBeenCalled();
  });

  it('reports a failed save', async () => {
    dispatch.mockReturnValue({ unwrap: async () => { throw new Error('quota'); } });
    renderPanel();
    fireEvent.change(screen.getByLabelText(/soft/i), { target: { value: '50' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    });

    expect(toast.error).toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('edits nothing when the open diagram is not a knowledge graph', () => {
    workspace.type = 'ClassDiagram';
    renderPanel();

    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
  });
});
