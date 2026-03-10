import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { ApollonMode, Locale, Styles, UMLDiagramType, UMLModel } from '@besser/wme';
import {
  BesserProject,
  ProjectDiagram,
  SupportedDiagramType,
  QuantumCircuitData,
  isUMLModel,
  toSupportedDiagramType,
  toUMLDiagramType,
  getActiveDiagram,
} from '../../types/project';
import { ProjectStorageRepository } from '../storage/ProjectStorageRepository';
import { localStorageLatestProject } from '../../constant';
import { DeepPartial } from '../../utils/types';

// ── Types ──────────────────────────────────────────────────────────────

export type EditorOptions = {
  type: UMLDiagramType;
  mode?: ApollonMode;
  readonly?: boolean;
  enablePopups?: boolean;
  enableCopyPaste?: boolean;
  theme?: DeepPartial<Styles>;
  locale: Locale;
  colorEnabled?: boolean;
};

export const defaultEditorOptions: EditorOptions = {
  type: UMLDiagramType.ClassDiagram,
  mode: ApollonMode.Modelling,
  readonly: false,
  enablePopups: true,
  enableCopyPaste: true,
  locale: Locale.en,
  colorEnabled: true,
};

export interface WorkspaceState {
  // Project
  project: BesserProject | null;

  // Active diagram (denormalized from project for perf)
  activeDiagramType: SupportedDiagramType;
  activeDiagramIndex: number;
  activeDiagram: ProjectDiagram | null;

  // Editor configuration
  editorOptions: EditorOptions;

  // Lifecycle — monotonic counter; editors reinit when this bumps
  editorRevision: number;

  // Loading / error
  loading: boolean;
  error: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────

function deriveEditorOptions(
  base: EditorOptions,
  diagramType: SupportedDiagramType,
): EditorOptions {
  const umlType = toUMLDiagramType(diagramType);
  return { ...base, type: umlType ?? base.type };
}

function buildInitialState(): WorkspaceState {
  let project: BesserProject | null = null;
  let editorOptions = { ...defaultEditorOptions };

  try {
    project = ProjectStorageRepository.getCurrentProject();
    if (project) {
      const umlType = toUMLDiagramType(project.currentDiagramType);
      if (umlType !== null) {
        editorOptions.type = umlType;
      }
    }
  } catch {
    /* first run — no project yet */
  }

  const activeDiagramType = project?.currentDiagramType ?? 'ClassDiagram';
  const activeDiagramIndex = project?.currentDiagramIndices[activeDiagramType] ?? 0;
  const activeDiagram = project ? getActiveDiagram(project, activeDiagramType) : null;

  return {
    project,
    activeDiagramType,
    activeDiagramIndex,
    activeDiagram,
    editorOptions,
    editorRevision: 0,
    loading: false,
    error: null,
  };
}

// ── Thunks ─────────────────────────────────────────────────────────────

export const loadProjectThunk = createAsyncThunk(
  'workspace/loadProject',
  async (projectId: string | undefined) => {
    const project = projectId
      ? ProjectStorageRepository.loadProject(projectId)
      : ProjectStorageRepository.getCurrentProject();

    if (!project) throw new Error('Project not found');

    localStorage.setItem(localStorageLatestProject, project.id);
    return project;
  },
);

export const createProjectThunk = createAsyncThunk(
  'workspace/createProject',
  async ({ name, description, owner }: { name: string; description: string; owner: string }) => {
    return ProjectStorageRepository.createNewProject(name, description, owner);
  },
);

export const switchDiagramTypeThunk = createAsyncThunk(
  'workspace/switchDiagramType',
  async (
    { diagramType }: { diagramType: UMLDiagramType | SupportedDiagramType },
    { getState },
  ) => {
    const state = getState() as { workspace: WorkspaceState };
    const { project } = state.workspace;
    if (!project) throw new Error('No active project');

    const supportedType =
      diagramType === 'QuantumCircuitDiagram' || diagramType === 'GUINoCodeDiagram'
        ? (diagramType as SupportedDiagramType)
        : toSupportedDiagramType(diagramType as UMLDiagramType);

    const diagram = ProjectStorageRepository.switchDiagramType(project.id, supportedType);
    if (!diagram) throw new Error('Failed to switch diagram type');

    // Set class diagram reference in bridge for Object Diagrams
    if (diagramType === UMLDiagramType.ObjectDiagram) {
      const classDiagram = getActiveDiagram(project, 'ClassDiagram');
      if (isUMLModel(classDiagram?.model)) {
        try {
          const { diagramBridge } = await import('@besser/wme');
          diagramBridge.setClassDiagramData(classDiagram.model);
        } catch {
          /* bridge not available */
        }
      }
    }

    return { diagram, diagramType: supportedType };
  },
);

export const switchDiagramIndexThunk = createAsyncThunk(
  'workspace/switchDiagramIndex',
  async (
    { diagramType, index }: { diagramType: SupportedDiagramType; index: number },
    { getState },
  ) => {
    const state = getState() as { workspace: WorkspaceState };
    const { project } = state.workspace;
    if (!project) throw new Error('No active project');

    const diagram = ProjectStorageRepository.switchDiagramIndex(project.id, diagramType, index);
    if (!diagram) throw new Error('Failed to switch diagram index');

    return { diagram, diagramType, index };
  },
);

export const updateDiagramModelThunk = createAsyncThunk(
  'workspace/updateDiagramModel',
  async (
    updates: Partial<Pick<ProjectDiagram, 'model' | 'title' | 'description'>>,
    { getState },
  ) => {
    const state = getState() as { workspace: WorkspaceState };
    const { project, activeDiagramType, activeDiagramIndex } = state.workspace;
    if (!project) return null;

    const current = getActiveDiagram(project, activeDiagramType);
    const updated: ProjectDiagram = {
      ...current,
      ...updates,
      lastUpdate: new Date().toISOString(),
    };

    const success = ProjectStorageRepository.updateDiagram(
      project.id,
      activeDiagramType,
      updated,
      activeDiagramIndex,
    );
    if (!success) throw new Error('Failed to update diagram');
    return updated;
  },
);

export const updateQuantumDiagramThunk = createAsyncThunk(
  'workspace/updateQuantumDiagram',
  async ({ model }: { model: QuantumCircuitData }, { getState }) => {
    const state = getState() as { workspace: WorkspaceState };
    const { project } = state.workspace;
    if (!project) throw new Error('No active project');

    const qIndex = project.currentDiagramIndices.QuantumCircuitDiagram ?? 0;
    const current = project.diagrams.QuantumCircuitDiagram[qIndex];
    const updated: ProjectDiagram = {
      ...current,
      model,
      lastUpdate: new Date().toISOString(),
    };

    const success = ProjectStorageRepository.updateDiagram(
      project.id,
      'QuantumCircuitDiagram',
      updated,
      qIndex,
    );
    if (!success) throw new Error('Failed to update quantum diagram');
    return updated;
  },
);

export const addDiagramThunk = createAsyncThunk(
  'workspace/addDiagram',
  async (
    { diagramType, title }: { diagramType: SupportedDiagramType; title?: string },
    { getState },
  ) => {
    const state = getState() as { workspace: WorkspaceState };
    const { project } = state.workspace;
    if (!project) throw new Error('No active project');

    const result = ProjectStorageRepository.addDiagram(project.id, diagramType, title);
    if (!result) throw new Error('Cannot add more diagrams (limit reached)');

    return { diagramType, index: result.index, diagram: result.diagram };
  },
);

export const removeDiagramThunk = createAsyncThunk(
  'workspace/removeDiagram',
  async (
    { diagramType, index }: { diagramType: SupportedDiagramType; index: number },
    { getState },
  ) => {
    const state = getState() as { workspace: WorkspaceState };
    const { project } = state.workspace;
    if (!project) throw new Error('No active project');

    const success = ProjectStorageRepository.removeDiagram(project.id, diagramType, index);
    if (!success) throw new Error('Cannot remove diagram');

    const updatedProject = ProjectStorageRepository.loadProject(project.id);
    if (!updatedProject) throw new Error('Failed to reload project after removal');
    return { project: updatedProject, diagramType };
  },
);

export const renameDiagramThunk = createAsyncThunk(
  'workspace/renameDiagram',
  async (
    { diagramType, index, newTitle }: { diagramType: SupportedDiagramType; index: number; newTitle: string },
    { getState },
  ) => {
    const state = getState() as { workspace: WorkspaceState };
    const { project } = state.workspace;
    if (!project) throw new Error('No active project');

    const diagrams = project.diagrams[diagramType];
    if (index < 0 || index >= diagrams.length) throw new Error('Invalid diagram index');

    const updated = { ...diagrams[index], title: newTitle };
    ProjectStorageRepository.updateDiagram(project.id, diagramType, updated, index);
    return { diagramType, index, diagram: updated };
  },
);

// ── Slice ──────────────────────────────────────────────────────────────

const workspaceSlice = createSlice({
  name: 'workspace',
  initialState: buildInitialState(),
  reducers: {
    bumpEditorRevision(state) {
      state.editorRevision += 1;
    },
    clearError(state) {
      state.error = null;
    },
    updateProjectInfo(
      state,
      action: PayloadAction<Partial<Pick<BesserProject, 'name' | 'description' | 'owner'>>>,
    ) {
      if (state.project) {
        Object.assign(state.project, action.payload);
        ProjectStorageRepository.saveProject(state.project);
      }
    },
    changeEditorMode(state, action: PayloadAction<ApollonMode>) {
      state.editorOptions.mode = action.payload;
    },
    changeReadonlyMode(state, action: PayloadAction<boolean>) {
      state.editorOptions.readonly = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // ── Load project ──────────────────────────────────────────
      .addCase(loadProjectThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadProjectThunk.fulfilled, (state, action) => {
        const p = action.payload;
        state.loading = false;
        state.project = p;
        state.activeDiagramType = p.currentDiagramType;
        state.activeDiagramIndex = p.currentDiagramIndices[p.currentDiagramType] ?? 0;
        state.activeDiagram = getActiveDiagram(p, p.currentDiagramType);
        state.editorOptions = deriveEditorOptions(state.editorOptions, p.currentDiagramType);
        state.editorRevision += 1;
      })
      .addCase(loadProjectThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to load project';
      })

      // ── Create project ────────────────────────────────────────
      .addCase(createProjectThunk.fulfilled, (state, action) => {
        const p = action.payload;
        state.project = p;
        state.activeDiagramType = p.currentDiagramType;
        state.activeDiagramIndex = 0;
        state.activeDiagram = getActiveDiagram(p, p.currentDiagramType);
        state.editorOptions = deriveEditorOptions(state.editorOptions, p.currentDiagramType);
        state.editorRevision += 1;
      })

      // ── Switch diagram type ───────────────────────────────────
      .addCase(switchDiagramTypeThunk.fulfilled, (state, action) => {
        const { diagram, diagramType } = action.payload;
        state.activeDiagram = diagram;
        state.activeDiagramType = diagramType;
        state.activeDiagramIndex = state.project?.currentDiagramIndices[diagramType] ?? 0;
        state.editorOptions = deriveEditorOptions(state.editorOptions, diagramType);
        state.editorRevision += 1;
        if (state.project) state.project.currentDiagramType = diagramType;
      })
      .addCase(switchDiagramTypeThunk.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to switch diagram type';
      })

      // ── Switch diagram index ──────────────────────────────────
      .addCase(switchDiagramIndexThunk.fulfilled, (state, action) => {
        const { diagram, diagramType, index } = action.payload;
        state.activeDiagram = diagram;
        state.activeDiagramIndex = index;
        state.editorRevision += 1;
        if (state.project) {
          state.project.currentDiagramIndices[diagramType] = index;
        }
      })

      // ── Update diagram model (no revision bump) ───────────────
      .addCase(updateDiagramModelThunk.fulfilled, (state, action) => {
        if (action.payload) {
          state.activeDiagram = action.payload;
          if (state.project) {
            state.project.diagrams[state.activeDiagramType][state.activeDiagramIndex] =
              action.payload;
          }
        }
      })
      .addCase(updateDiagramModelThunk.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to update diagram';
      })

      // ── Update quantum diagram ────────────────────────────────
      .addCase(updateQuantumDiagramThunk.fulfilled, (state, action) => {
        if (state.project) {
          const qIndex = state.project.currentDiagramIndices.QuantumCircuitDiagram ?? 0;
          state.project.diagrams.QuantumCircuitDiagram[qIndex] = action.payload;
        }
        if (state.activeDiagramType === 'QuantumCircuitDiagram') {
          state.activeDiagram = action.payload;
        }
      })

      // ── Add diagram ───────────────────────────────────────────
      .addCase(addDiagramThunk.fulfilled, (state, action) => {
        const { diagramType, index, diagram } = action.payload;
        if (state.project) {
          state.project.diagrams[diagramType].push(diagram);
          state.project.currentDiagramIndices[diagramType] = index;
        }
        state.activeDiagram = diagram;
        state.activeDiagramIndex = index;
        state.editorRevision += 1;
      })

      // ── Remove diagram ────────────────────────────────────────
      .addCase(removeDiagramThunk.fulfilled, (state, action) => {
        const { project, diagramType } = action.payload;
        state.project = project;
        state.activeDiagramIndex = project.currentDiagramIndices[diagramType] ?? 0;
        state.activeDiagram = getActiveDiagram(project, diagramType);
        state.editorRevision += 1;
      })

      // ── Rename diagram ────────────────────────────────────────
      .addCase(renameDiagramThunk.fulfilled, (state, action) => {
        const { diagramType, index, diagram } = action.payload;
        if (state.project) {
          state.project.diagrams[diagramType][index] = diagram;
        }
        if (state.activeDiagramIndex === index && state.activeDiagramType === diagramType) {
          state.activeDiagram = diagram;
        }
      });
  },
});

// ── Exports ────────────────────────────────────────────────────────────

export const {
  bumpEditorRevision,
  clearError,
  updateProjectInfo,
  changeEditorMode,
  changeReadonlyMode,
} = workspaceSlice.actions;

export const workspaceReducer = workspaceSlice.reducer;

// ── Selectors ──────────────────────────────────────────────────────────

export const selectProject = (state: { workspace: WorkspaceState }) => state.workspace.project;
export const selectActiveDiagram = (state: { workspace: WorkspaceState }) => state.workspace.activeDiagram;
export const selectActiveDiagramType = (state: { workspace: WorkspaceState }) => state.workspace.activeDiagramType;
export const selectActiveDiagramIndex = (state: { workspace: WorkspaceState }) => state.workspace.activeDiagramIndex;
export const selectEditorOptions = (state: { workspace: WorkspaceState }) => state.workspace.editorOptions;
export const selectEditorRevision = (state: { workspace: WorkspaceState }) => state.workspace.editorRevision;
export const selectWorkspaceLoading = (state: { workspace: WorkspaceState }) => state.workspace.loading;
export const selectWorkspaceError = (state: { workspace: WorkspaceState }) => state.workspace.error;

export const selectUMLDiagramType = (state: { workspace: WorkspaceState }) =>
  toUMLDiagramType(state.workspace.activeDiagramType) ?? UMLDiagramType.ClassDiagram;

export const selectDiagramsForActiveType = (state: { workspace: WorkspaceState }) =>
  state.workspace.project?.diagrams[state.workspace.activeDiagramType] ?? [];

export const selectIsUMLEditor = (state: { workspace: WorkspaceState }) =>
  toUMLDiagramType(state.workspace.activeDiagramType) !== null;

export const selectIsGUIEditor = (state: { workspace: WorkspaceState }) =>
  state.workspace.activeDiagramType === 'GUINoCodeDiagram';

export const selectIsQuantumEditor = (state: { workspace: WorkspaceState }) =>
  state.workspace.activeDiagramType === 'QuantumCircuitDiagram';
