import { beforeEach, describe, expect, it } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { createProjectThunk, updateDiagramModelThunk, workspaceReducer } from '../workspaceSlice';
import { readAgentChanges } from '../../../shared/services/storage/agentChangeMarks';
import { ProjectStorageRepository } from '../../../shared/services/storage/ProjectStorageRepository';

const bounds = { x: 0, y: 0, width: 100, height: 60 };
const book = { id: 'c1', type: 'Class', name: 'Book', owner: null, bounds };
const loan = { id: 'c2', type: 'Class', name: 'Loan', owner: null, bounds };
const model = (elements: Array<typeof book>) => ({
  version: '3.0.0',
  type: 'ClassDiagram',
  size: { width: 0, height: 0 },
  interactive: { elements: {}, relationships: {} },
  elements: Object.fromEntries(elements.map((element) => [element.id, element])),
  relationships: {},
  assessments: {},
});

describe('the workspace store marks what the assistant changed', () => {
  beforeEach(() => localStorage.clear());

  it('is recorded by the store for the assistant only, and never written into the model', async () => {
    const store = configureStore({ reducer: { workspace: workspaceReducer } });
    await store.dispatch(createProjectThunk({ name: 'Library', description: '', owner: 'Ada' })).unwrap();
    const { project } = store.getState().workspace;
    const diagramId = project!.diagrams.ClassDiagram[0].id;

    await store.dispatch(updateDiagramModelThunk({ model: model([book]) as never })).unwrap();
    expect(readAgentChanges(project!.id, diagramId)).toEqual([]);

    const edited = model([book, loan]);
    await store.dispatch(updateDiagramModelThunk({ model: edited as never, traceSource: 'assistant' })).unwrap();
    expect(readAgentChanges(project!.id, diagramId)[0].added).toEqual(['c2']);
    const saved = ProjectStorageRepository.loadProject(project!.id)!.diagrams.ClassDiagram[0].model;
    expect(JSON.stringify(saved)).toBe(JSON.stringify(edited));

    await store.dispatch(updateDiagramModelThunk({ model: model([book]) as never, undoesAssistantEdit: true })).unwrap();
    expect(readAgentChanges(project!.id, diagramId)).toEqual([]);
  });
});
