import { configureStore } from '@reduxjs/toolkit';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultProject, getActiveDiagram, type BesserProject } from '../project';
import { ProjectStorageRepository } from '../../services/storage/ProjectStorageRepository';
import { importProjectFromJson } from '../../services/project-import/projectImport';
import { updateDiagramModelThunk, workspaceReducer, type WorkspaceState } from '../../../app/store/workspaceSlice';
import { useModelInjection } from '../../../features/assistant/hooks/useModelInjection';

// A v3 model marked `failMe` makes the migrator throw, standing in for any
// v3 data the converter still cannot lift.
vi.mock('../../services/storage/migrate-uml-v3-to-v4', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/storage/migrate-uml-v3-to-v4')>();
  return {
    ...actual,
    migrateUMLModelV3ToV4: (model: any, ...rest: any[]) => {
      if (model?.failMe) throw new Error('cannot migrate');
      return (actual.migrateUMLModelV3ToV4 as any)(model, ...rest);
    },
  };
});

const toastError = vi.fn();
const toastWarning = vi.fn();
vi.mock('react-toastify', () => ({
  toast: {
    error: (...a: unknown[]) => toastError(...a),
    warning: (...a: unknown[]) => toastWarning(...a),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

const v3ClassModel = () => ({
  version: '3.0.0',
  type: 'ClassDiagram',
  failMe: true,
  size: { width: 100, height: 100 },
  interactive: { elements: {}, relationships: {} },
  elements: {
    c1: { id: 'c1', name: 'Ship', type: 'Class', owner: null, bounds: { x: 0, y: 0, width: 100, height: 60 }, attributes: [], methods: [] },
  },
  relationships: {},
  assessments: {},
});

const v4ClassModel = () => ({
  version: '4.0.0',
  id: '',
  title: '',
  type: 'ClassDiagram',
  nodes: [{ id: 'n1', type: 'class', position: { x: 0, y: 0 }, data: { name: 'New', attributes: [], methods: [] } }],
  edges: [],
  assessments: {},
});

const projectWithV3Class = (): BesserProject => {
  const project = createDefaultProject('P', '', '');
  const diagram = getActiveDiagram(project, 'ClassDiagram')!;
  diagram.title = 'Library';
  diagram.model = v3ClassModel() as any;
  return project;
};

describe('a v3 diagram that fails to migrate is never overwritten', () => {
  beforeEach(() => {
    localStorage.clear();
    toastError.mockClear();
    toastWarning.mockClear();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('updateDiagramModelThunk refuses to replace the v3 model', async () => {
    const project = projectWithV3Class();
    const updateDiagram = vi.spyOn(ProjectStorageRepository, 'updateDiagram');
    const initial = workspaceReducer(undefined, { type: '@@init' });
    const workspace: WorkspaceState = {
      ...initial,
      project,
      activeDiagramType: 'ClassDiagram',
      activeDiagramIndex: 0,
      activeDiagram: getActiveDiagram(project, 'ClassDiagram')!,
    };
    const store = configureStore({ reducer: { workspace: workspaceReducer }, preloadedState: { workspace } });

    const result = await store.dispatch(updateDiagramModelThunk({ model: v4ClassModel() as any }));

    expect(updateDiagramModelThunk.rejected.match(result)).toBe(true);
    expect((result as any).error.message).toContain('Library');
    expect(updateDiagram).not.toHaveBeenCalled();
    expect((store.getState().workspace.activeDiagram!.model as any).elements).toBeDefined();
  });

  // Like a local load: the project is imported, the diagram stays v3
  // (read-only) and a warning names it, instead of rejecting the project.
  it('importing a project whose diagram cannot migrate keeps that diagram read-only and names it', async () => {
    const envelope = { project: projectWithV3Class(), exportedAt: new Date().toISOString(), version: '2.0.0' };
    const file = new File([JSON.stringify(envelope)], 'project.json', { type: 'application/json' });

    const imported = await importProjectFromJson(file);

    const stored = ProjectStorageRepository.loadProject(imported.id)!;
    expect((getActiveDiagram(stored, 'ClassDiagram')!.model as any).elements).toBeDefined();
    expect(toastWarning).toHaveBeenCalledTimes(1);
    expect(String(toastWarning.mock.calls[0]?.[0])).toContain('Library');
  });

  it('importing a genuinely invalid file is still rejected and nothing is stored', async () => {
    const file = new File([JSON.stringify({ hello: 'world' })], 'project.json', { type: 'application/json' });

    await expect(importProjectFromJson(file)).rejects.toThrow();
    expect(ProjectStorageRepository.getAllProjects()).toHaveLength(0);
  });

  it('the assistant refuses to modify the v3 diagram', async () => {
    const project = projectWithV3Class();
    const dispatched: Array<{ type: string }> = [];
    const dispatch = vi.fn((action: { type: string }) => {
      dispatched.push(action);
      return { unwrap: () => Promise.resolve(action) };
    });
    const setMessages = vi.fn();
    const { result } = renderHook(() =>
      useModelInjection({
        dispatch: dispatch as any,
        editor: null,
        modelingServiceRef: { current: null },
        currentModelRef: { current: getActiveDiagram(project, 'ClassDiagram')!.model },
        currentProjectRef: { current: project },
        currentDiagramTypeRef: { current: 'ClassDiagram' },
        switchDiagramRef: { current: () => Promise.resolve(true) },
        setMessages,
        setMessageMeta: vi.fn(),
        setProgressMessage: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.handleInjection({
        action: 'inject_complete_system',
        message: 'Done.',
        diagramType: 'ClassDiagram',
        systemSpec: { classes: [{ className: 'Port', attributes: [], methods: [] }], relationships: [] },
      } as any);
    });

    expect(dispatched).toEqual([]);
    expect(String(toastError.mock.calls[0]?.[0])).toContain('Library');
    // Live: "cannot be changed.. Try rephrasing your request." Rephrasing
    // cannot help with a read-only diagram.
    const chat = setMessages.mock.calls
      .map(([update]) => (typeof update === 'function' ? update([]) : update))
      .flat()
      .map((m: { content: string }) => m.content)
      .join(' ');
    expect(chat).toContain('Library');
    expect(chat).not.toMatch(/\.\./);
    expect(chat).not.toMatch(/rephras/i);
  });
});
