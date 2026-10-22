import { beforeEach, describe, expect, it } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { UMLDiagramType } from '@besser/wme';
import { createProjectThunk, switchDiagramTypeThunk, workspaceReducer } from '../workspaceSlice';
import { ALL_DIAGRAM_TYPES } from '../../../shared/types/project';

const makeStore = async () => {
  const store = configureStore({ reducer: { workspace: workspaceReducer } });
  await store.dispatch(createProjectThunk({ name: 'Switch', description: '', owner: 'test' })).unwrap();
  return store;
};

describe('switchDiagramTypeThunk', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // Issue #653: the assistant switches with 'BPMN', which used to fall back to
  // ClassDiagram, so a generated BPMN model overwrote the class diagram.
  it('opens the BPMN diagram when given the project name BPMN', async () => {
    const store = await makeStore();
    await store.dispatch(switchDiagramTypeThunk({ diagramType: 'BPMN' })).unwrap();
    expect(store.getState().workspace.activeDiagramType).toBe('BPMN');
    expect(store.getState().workspace.project?.currentDiagramType).toBe('BPMN');
  });

  it('still accepts the editor name of BPMN', async () => {
    const store = await makeStore();
    await store.dispatch(switchDiagramTypeThunk({ diagramType: UMLDiagramType.BPMN })).unwrap();
    expect(store.getState().workspace.activeDiagramType).toBe('BPMN');
  });

  it('opens every project diagram type by its project name', async () => {
    const store = await makeStore();
    for (const type of ALL_DIAGRAM_TYPES) {
      await store.dispatch(switchDiagramTypeThunk({ diagramType: type })).unwrap();
      expect(store.getState().workspace.activeDiagramType).toBe(type);
    }
  });
});
