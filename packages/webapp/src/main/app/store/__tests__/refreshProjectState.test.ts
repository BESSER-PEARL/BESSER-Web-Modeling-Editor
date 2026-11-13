import { configureStore } from '@reduxjs/toolkit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UMLModel } from '@besser/wme';
import { ProjectStorageRepository } from '../../../shared/services/storage/ProjectStorageRepository';
import { createDefaultProject, getActiveDiagram, type BesserProject } from '../../../shared/types/project';
import { bumpEditorRevision, refreshProjectStateThunk, workspaceReducer, type WorkspaceState } from '../workspaceSlice';

const WARNING = 'editorRevision was not bumped';

const setup = (
  stored: BesserProject,
  active: BesserProject = stored,
  activeDiagram = getActiveDiagram(active, active.currentDiagramType) ?? null,
) => {
  vi.spyOn(ProjectStorageRepository, 'loadProject').mockImplementation(() => structuredClone(stored));
  const initial = workspaceReducer(undefined, { type: '@@init' });
  const workspace: WorkspaceState = {
    ...initial,
    project: active,
    activeDiagramType: active.currentDiagramType,
    activeDiagramIndex: 0,
    activeDiagram,
  };
  return configureStore({ reducer: { workspace: workspaceReducer }, preloadedState: { workspace } });
};

const warnings = () => vi.mocked(console.warn).mock.calls.filter(([msg]) => String(msg).includes(WARNING));
const nextTask = () => new Promise((resolve) => setTimeout(resolve, 10));

const withEditedActiveModel = (project: BesserProject): BesserProject => {
  const edited = structuredClone(project);
  const diagram = getActiveDiagram(edited, edited.currentDiagramType)!;
  (diagram.model as UMLModel).title = 'edited elsewhere';
  return edited;
};

describe('refreshProjectStateThunk editorRevision contract warning', () => {
  afterEach(() => vi.restoreAllMocks());

  it('stays quiet for a metadata-only refresh (fresh objects, same model content)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const project = createDefaultProject('P', '', '');
    const store = setup({ ...structuredClone(project), name: 'Renamed' }, project);
    await store.dispatch(refreshProjectStateThunk());
    await nextTask();
    expect(warnings()).toEqual([]);
  });

  it('warns when the active model changed and nothing bumped the revision', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const project = createDefaultProject('P', '', '');
    const store = setup(withEditedActiveModel(project), project);
    await store.dispatch(refreshProjectStateThunk());
    await nextTask();
    expect(warnings()).toHaveLength(1);
  });

  it('stays quiet when the refresh also changes the active diagram ("Define agent behavior")', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const project = createDefaultProject('P', '', '');
    project.currentDiagramType = 'BPMN';
    // addDiagramThunk made the new Agent diagram active while the type stayed BPMN.
    const store = setup(withEditedActiveModel(project), project, project.diagrams.AgentDiagram[0]);
    await store.dispatch(refreshProjectStateThunk());
    await nextTask();
    expect(warnings()).toEqual([]);
  });

  it('stays quiet when the caller bumps the revision after the refresh', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const project = createDefaultProject('P', '', '');
    const store = setup(withEditedActiveModel(project), project);
    await store.dispatch(refreshProjectStateThunk()).unwrap();
    store.dispatch(bumpEditorRevision());
    await nextTask();
    expect(warnings()).toEqual([]);
  });
});
