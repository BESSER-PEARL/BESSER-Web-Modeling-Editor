import { beforeEach, describe, expect, it } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import {
  addDiagramThunk,
  createProjectThunk,
  removeDiagramThunk,
  renameDiagramThunk,
  setTraceabilityEnabledThunk,
  updateDiagramModelThunk,
  workspaceReducer,
} from '../workspaceSlice';
import { getProjectTrace } from '../../../shared/traceability/traceStore';
import { indexTrace, isDeleted } from '../../../shared/traceability/traceQueries';
import type { ModelArtifact } from '../../../shared/types/traceability';
import { changesOf } from '../../../shared/types/traceability';

const book = {
  version: '3.0.0', type: 'ClassDiagram', size: { width: 0, height: 0 }, interactive: { elements: {}, relationships: {} },
  elements: { c1: { id: 'c1', type: 'Class', name: 'Book', owner: null, bounds: { x: 0, y: 0, width: 100, height: 60 } } },
  relationships: {}, assessments: {},
};

/** A project that records traces, with one class diagram the trace knows (Book was drawn on it). */
const tracedProject = async (recording = true) => {
  const store = configureStore({ reducer: { workspace: workspaceReducer } });
  await store.dispatch(createProjectThunk({ name: 'Library', description: '', owner: 'Ada' })).unwrap();
  await store.dispatch(setTraceabilityEnabledThunk(true)).unwrap();
  await store.dispatch(updateDiagramModelThunk({ model: book as never })).unwrap();
  if (!recording) await store.dispatch(setTraceabilityEnabledThunk(false)).unwrap();
  const project = store.getState().workspace.project!;
  return { store, projectId: project.id, diagramId: project.diagrams.ClassDiagram[0].id };
};

const diagramArtifact = (projectId: string, diagramId: string) =>
  getProjectTrace(projectId).artifacts.find((a): a is ModelArtifact => a.type === 'ModelArtifact' && a.elementId === diagramId)!;

const diagramChanges = (projectId: string, diagramId: string) => {
  const artifact = diagramArtifact(projectId, diagramId);
  return getProjectTrace(projectId).operations.flatMap(changesOf).filter((c) => c.artifactId === artifact.id);
};

describe('diagram renames and deletions in the trace', () => {
  beforeEach(() => localStorage.clear());

  it('records a rename from the diagram tabs', async () => {
    const { store, projectId, diagramId } = await tracedProject();
    await store.dispatch(renameDiagramThunk({ diagramType: 'ClassDiagram', index: 0, newTitle: 'Library model' })).unwrap();
    expect(diagramArtifact(projectId, diagramId).name).toBe('Library model');
    expect(diagramChanges(projectId, diagramId)).toEqual([
      expect.objectContaining({ kind: 'UPDATED', feature: 'name', newValue: 'Library model' }),
    ]);
  });

  it('records a rename from the title field', async () => {
    const { store, projectId, diagramId } = await tracedProject();
    await store.dispatch(updateDiagramModelThunk({ title: 'Catalogue' })).unwrap();
    expect(diagramArtifact(projectId, diagramId).name).toBe('Catalogue');
  });

  it('records a deletion, which also marks the diagram elements deleted', async () => {
    const { store, projectId, diagramId } = await tracedProject();
    await store.dispatch(addDiagramThunk({ diagramType: 'ClassDiagram', title: 'Spare' })).unwrap();
    await store.dispatch(removeDiagramThunk({ diagramType: 'ClassDiagram', index: 0 })).unwrap();
    expect(diagramChanges(projectId, diagramId).map((c) => c.kind)).toEqual(['DELETED']);
    const index = indexTrace(getProjectTrace(projectId));
    const bookArtifact = getProjectTrace(projectId).artifacts.find((a) => a.name === 'Book')!;
    expect(isDeleted(index, bookArtifact.id)).toBe(true);
  });

  it('records nothing while recording is off, or for a diagram the trace does not know', async () => {
    const { store, projectId, diagramId } = await tracedProject(false);
    await store.dispatch(renameDiagramThunk({ diagramType: 'ClassDiagram', index: 0, newTitle: 'Renamed' })).unwrap();
    expect(diagramChanges(projectId, diagramId)).toEqual([]);

    await store.dispatch(setTraceabilityEnabledThunk(true)).unwrap();
    await store.dispatch(addDiagramThunk({ diagramType: 'ClassDiagram', title: 'Never edited' })).unwrap();
    const before = getProjectTrace(projectId).operations.length;
    await store.dispatch(renameDiagramThunk({ diagramType: 'ClassDiagram', index: 1, newTitle: 'Still never edited' })).unwrap();
    expect(getProjectTrace(projectId).operations).toHaveLength(before);
  });
});
