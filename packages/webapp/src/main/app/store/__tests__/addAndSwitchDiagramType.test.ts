import { configureStore } from '@reduxjs/toolkit';
import { beforeEach, describe, expect, it } from 'vitest';
import { ProjectStorageRepository } from '../../../shared/services/storage/ProjectStorageRepository';
import { createDefaultProject, getActiveDiagram } from '../../../shared/types/project';
import {
  addAndSwitchDiagramThunk,
  updateDiagramModelThunk,
  workspaceReducer,
  type WorkspaceState,
} from '../workspaceSlice';

const stateMachine = {
  version: '4.0.0',
  id: '',
  title: '',
  type: 'StateMachineDiagram',
  nodes: [{ id: 's1', type: 'State', position: { x: 0, y: 0 }, data: { name: 'Idle' } }],
  edges: [],
  assessments: {},
};

// The assistant's createNewTab for another diagram type: the editor remounted
// as the old type, and its next save landed in the old type's tab.
describe('addAndSwitchDiagramThunk for a different diagram type', () => {
  beforeEach(() => localStorage.clear());

  it('makes the new diagram type active', async () => {
    const project = createDefaultProject('P', '', '');
    ProjectStorageRepository.saveProject(project);
    const initial = workspaceReducer(undefined, { type: '@@init' });
    const workspace: WorkspaceState = {
      ...initial,
      project,
      activeDiagramType: 'ClassDiagram',
      activeDiagramIndex: 0,
      activeDiagram: getActiveDiagram(project, 'ClassDiagram')!,
    };
    const store = configureStore({ reducer: { workspace: workspaceReducer }, preloadedState: { workspace } });

    await store
      .dispatch(addAndSwitchDiagramThunk({ diagramType: 'StateMachineDiagram', initialModel: stateMachine as any }))
      .unwrap();

    const w = store.getState().workspace;
    expect(w.activeDiagramType).toBe('StateMachineDiagram');
    expect(w.editorOptions.type).toBe('StateMachineDiagram');
    expect(w.activeDiagramIndex).toBe(1);
    expect(w.project!.currentDiagramType).toBe('StateMachineDiagram');
    expect(ProjectStorageRepository.loadProject(project.id)!.currentDiagramType).toBe('StateMachineDiagram');

    // The editor's next autosave goes to the new state machine tab.
    await store.dispatch(updateDiagramModelThunk({ model: { ...stateMachine, title: 'autosave' } as any }));
    const stored = ProjectStorageRepository.loadProject(project.id)!;
    expect(stored.diagrams.ClassDiagram).toHaveLength(1);
    expect((stored.diagrams.ClassDiagram[0].model as any).type).toBe('ClassDiagram');
    expect((stored.diagrams.StateMachineDiagram[1].model as any).title).toBe('autosave');
  });
});
