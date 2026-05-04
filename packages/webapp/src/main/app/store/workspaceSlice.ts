import { createSlice, PayloadAction, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import { ApollonMode, Locale, Styles, UMLDiagramType, UMLModel } from '@besser/wme';
import {
  ALL_DIAGRAM_TYPES,
  BesserProject,
  MAX_DIAGRAMS_PER_TYPE,
  PerspectiveSettings,
  ProjectDiagram,
  SupportedDiagramType,
  QuantumCircuitData,
  defaultPerspectivesAllEnabled,
  isPerspectiveVisible,
  isUMLModel,
  toSupportedDiagramType,
  toUMLDiagramType,
  getActiveDiagram,
  getReferencedDiagram,
} from '../../shared/types/project';
import { ProjectStorageRepository } from '../../shared/services/storage/ProjectStorageRepository';
import { localStorageLatestProject } from '../../shared/constants/constant';
import { DeepPartial } from '../../shared/utils/types';
import userMetaModel from '../../../../../editor/src/main/packages/user-modeling/usermetamodel_buml_short.json';

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
  const activeDiagram = project ? (getActiveDiagram(project, activeDiagramType) ?? null) : null;

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
    let project!: BesserProject;
    ProjectStorageRepository.withoutNotify(() => {
      project = ProjectStorageRepository.createNewProject(name, description, owner);
    });
    return project;
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

    // Non-UML diagram types are already SupportedDiagramType strings; don't
    // route them through toSupportedDiagramType (which would drop unknowns to
    // the 'ClassDiagram' fallback and send the user to the wrong view).
    const supportedType =
      diagramType === 'QuantumCircuitDiagram' ||
      diagramType === 'GUINoCodeDiagram' ||
      diagramType === 'PlatformCustomizationDiagram'
        ? (diagramType as SupportedDiagramType)
        : toSupportedDiagramType(diagramType as UMLDiagramType);

    let diagram: ProjectDiagram | null = null;
    ProjectStorageRepository.withoutNotify(() => {
      diagram = ProjectStorageRepository.switchDiagramType(project.id, supportedType);
    });
    if (!diagram) throw new Error('Failed to switch diagram type');

    // Set class diagram reference in bridge for Object Diagrams
    // Uses the ObjectDiagram's per-diagram references to find the correct ClassDiagram
    if (diagramType === UMLDiagramType.ObjectDiagram) {
      const classDiagram = getReferencedDiagram(project, diagram, 'ClassDiagram');
      if (isUMLModel(classDiagram?.model)) {
        try {
          const { diagramBridge } = await import('@besser/wme');
          diagramBridge.setClassDiagramData(classDiagram.model);
        } catch {
          /* bridge not available */
        }
      }
    } else if (diagramType === UMLDiagramType.UserDiagram) {
      try {
        const { diagramBridge } = await import('@besser/wme');
        // User modeling depends on this metamodel being present in the bridge.
        diagramBridge.setClassDiagramData(userMetaModel as unknown as UMLModel);
      } catch {
        /* bridge not available */
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

    let diagram: ProjectDiagram | null = null;
    ProjectStorageRepository.withoutNotify(() => {
      diagram = ProjectStorageRepository.switchDiagramIndex(project.id, diagramType, index);
    });
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
    if (!current) return null;
    const updated: ProjectDiagram = {
      ...current,
      ...updates,
      lastUpdate: new Date().toISOString(),
    };

    let success = false;
    ProjectStorageRepository.withoutNotify(() => {
      success = ProjectStorageRepository.updateDiagram(
        project.id,
        activeDiagramType,
        updated,
        activeDiagramIndex,
      );
    });
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
    const quantumDiagrams = project.diagrams.QuantumCircuitDiagram;
    const safeIndex = qIndex < quantumDiagrams.length ? qIndex : 0;
    const current = quantumDiagrams[safeIndex];
    if (!current) throw new Error('No quantum diagram found');
    const updated: ProjectDiagram = {
      ...current,
      model,
      lastUpdate: new Date().toISOString(),
    };

    let success = false;
    ProjectStorageRepository.withoutNotify(() => {
      success = ProjectStorageRepository.updateDiagram(
        project.id,
        'QuantumCircuitDiagram',
        updated,
        safeIndex,
      );
    });
    if (!success) throw new Error('Failed to update quantum diagram');
    return updated;
  },
);

/**
 * Lightweight sync: re-reads the project from storage into Redux
 * WITHOUT bumping editorRevision (no editor reinit).
 * Use after direct ProjectStorageRepository writes from editors
 * (GrapesJS, Quantum, Agent) that bypass Redux thunks.
 */
export const refreshProjectStateThunk = createAsyncThunk(
  'workspace/refreshProjectState',
  async (_: void, { getState }) => {
    const state = getState() as { workspace: WorkspaceState };
    const { project } = state.workspace;
    if (!project) return null;
    return ProjectStorageRepository.loadProject(project.id);
  },
);

/**
 * Toggle a single modeling perspective (e.g. ClassDiagram, GUINoCodeDiagram)
 * on or off for the active project.
 *
 * Behavior:
 *  - Last-enabled guard: refuses to disable the only remaining enabled
 *    perspective (the workspace would have nothing to show).
 *  - Active-hidden auto-switch: if the toggled-off perspective is the
 *    `currentDiagramType`, dispatches `switchDiagramTypeThunk` to the first
 *    perspective still enabled (in `ALL_DIAGRAM_TYPES` order) so the editor
 *    lands on a working canvas.
 *  - Persists the updated project via `ProjectStorageRepository` inside
 *    `withoutNotify` to avoid the storage-listener loop.
 */
export const setPerspectiveEnabledThunk = createAsyncThunk(
  'workspace/setPerspectiveEnabled',
  async (
    { type, enabled }: { type: SupportedDiagramType; enabled: boolean },
    { getState, dispatch },
  ) => {
    const state = getState() as { workspace: WorkspaceState };
    const { project } = state.workspace;
    if (!project) throw new Error('No active project');

    const current = defaultPerspectivesAllEnabled(project.settings?.perspectives);
    if (current[type] === enabled) {
      return { type, enabled, perspectives: current, autoSwitchTo: null as SupportedDiagramType | null };
    }

    if (!enabled) {
      const enabledCount = ALL_DIAGRAM_TYPES.filter((t) => current[t] !== false).length;
      if (enabledCount <= 1) {
        throw new Error('At least one perspective must be enabled');
      }
    }

    const next: PerspectiveSettings = { ...current, [type]: enabled };

    const updatedProject: BesserProject = {
      ...project,
      settings: {
        ...project.settings,
        perspectives: next,
      },
    };

    ProjectStorageRepository.withoutNotify(() => {
      ProjectStorageRepository.saveProject(updatedProject);
    });

    let autoSwitchTo: SupportedDiagramType | null = null;
    if (!enabled && project.currentDiagramType === type) {
      autoSwitchTo = ALL_DIAGRAM_TYPES.find((t) => next[t] !== false) ?? null;
    }

    if (autoSwitchTo) {
      void dispatch(switchDiagramTypeThunk({ diagramType: autoSwitchTo }));
    }

    return { type, enabled, perspectives: next, autoSwitchTo };
  },
);

/**
 * Apply a perspective preset: replaces the per-diagram visibility map with
 * exactly the diagrams in `diagrams`. Same guards as `setPerspectiveEnabledThunk`
 * (must keep ≥1 enabled, auto-switch the active editor if it would be hidden).
 */
export const applyPerspectivePresetThunk = createAsyncThunk(
  'workspace/applyPerspectivePreset',
  async (
    { diagrams }: { diagrams: SupportedDiagramType[] },
    { getState, dispatch },
  ) => {
    const state = getState() as { workspace: WorkspaceState };
    const { project } = state.workspace;
    if (!project) throw new Error('No active project');

    if (diagrams.length === 0) {
      throw new Error('At least one perspective must be enabled');
    }

    const allowed = new Set(diagrams);
    const next = {} as PerspectiveSettings;
    for (const t of ALL_DIAGRAM_TYPES) {
      next[t] = allowed.has(t);
    }

    const updatedProject: BesserProject = {
      ...project,
      settings: {
        ...project.settings,
        perspectives: next,
      },
    };

    ProjectStorageRepository.withoutNotify(() => {
      ProjectStorageRepository.saveProject(updatedProject);
    });

    let autoSwitchTo: SupportedDiagramType | null = null;
    if (next[project.currentDiagramType] === false) {
      autoSwitchTo = ALL_DIAGRAM_TYPES.find((t) => next[t] === true) ?? null;
    }

    if (autoSwitchTo) {
      void dispatch(switchDiagramTypeThunk({ diagramType: autoSwitchTo }));
    }

    return { perspectives: next, autoSwitchTo };
  },
);

export const updateDiagramReferencesThunk = createAsyncThunk(
  'workspace/updateDiagramReferences',
  async (
    { diagramType, diagramIndex, references }: {
      diagramType: SupportedDiagramType;
      diagramIndex: number;
      references: Partial<Record<SupportedDiagramType, string>>;
    },
    { getState },
  ) => {
    const state = getState() as { workspace: WorkspaceState };
    const { project } = state.workspace;
    if (!project) throw new Error('No active project');

    // Suppress notifyChange — the thunk's fulfilled reducer already updates
    // Redux state, so a redundant syncProjectFromStorage would be a no-op at
    // best and a race-condition source at worst.
    let success = false;
    ProjectStorageRepository.withoutNotify(() => {
      success = ProjectStorageRepository.updateDiagramReferences(
        project.id, diagramType, diagramIndex, references,
      );
    });
    if (!success) throw new Error('Failed to update diagram references');

    return { diagramType, diagramIndex, references };
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

    // The only blocking failure from addDiagram is the hard project limit —
    // title collisions are resolved in-place by auto-suffixing ("Agent",
    // "Agent 2", ...). Check the limit up-front so we can give a specific
    // error instead of the generic null-handling below.
    const existing = project.diagrams[diagramType] ?? [];
    if (existing.length >= MAX_DIAGRAMS_PER_TYPE) {
      throw new Error(
        `Cannot add more ${diagramType}s: project limit of ${MAX_DIAGRAMS_PER_TYPE} reached.`,
      );
    }

    let result: { index: number; diagram: ProjectDiagram } | null = null;
    ProjectStorageRepository.withoutNotify(() => {
      result = ProjectStorageRepository.addDiagram(project.id, diagramType, title);
    });
    if (!result) throw new Error('Failed to add diagram');

    const { index: newIndex, diagram } = result as { index: number; diagram: ProjectDiagram };
    return { diagramType, index: newIndex, diagram };
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

    let success = false;
    let updatedProject: BesserProject | null = null;
    ProjectStorageRepository.withoutNotify(() => {
      success = ProjectStorageRepository.removeDiagram(project.id, diagramType, index);
      if (success) {
        updatedProject = ProjectStorageRepository.loadProject(project.id);
      }
    });
    if (!success) throw new Error('Cannot remove diagram');
    if (!updatedProject) throw new Error('Failed to reload project after removal');
    return { project: updatedProject as BesserProject, diagramType };
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

    // Short-circuit no-op renames — avoid writing to storage for an identity change.
    if (newTitle.trim() === diagrams[index].title.trim()) {
      return { diagramType, index, diagram: diagrams[index] };
    }

    // AgentDiagram titles must be unique: downstream code (GUI ``agent-name``
    // bindings, generator output layout, render.yaml service names) identifies
    // agents by name, so duplicates silently overwrite each other.
    if (diagramType === 'AgentDiagram') {
      const trimmed = newTitle.trim();
      const collision = diagrams.some(
        (d, i) => i !== index && d.title.trim().toLowerCase() === trimmed.toLowerCase(),
      );
      if (collision) {
        throw new Error(`An agent named "${trimmed}" already exists in this project.`);
      }
    }

    const updated = { ...diagrams[index], title: newTitle };
    ProjectStorageRepository.withoutNotify(() => {
      ProjectStorageRepository.updateDiagram(project.id, diagramType, updated, index);
    });
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
        // Suppress change notification — Redux is already up-to-date
        ProjectStorageRepository.withoutNotify(() => {
          ProjectStorageRepository.saveProject(state.project!);
        });
      }
    },
    changeEditorMode(state, action: PayloadAction<ApollonMode>) {
      state.editorOptions.mode = action.payload;
    },
    changeReadonlyMode(state, action: PayloadAction<boolean>) {
      state.editorOptions.readonly = action.payload;
    },
    /**
     * Sync Redux state from an externally-provided project snapshot
     * (e.g. after a direct localStorage write by the GUI/Quantum editor).
     *
     * This does NOT bump editorRevision (no editor reinit), and does NOT
     * write back to localStorage — avoiding infinite sync loops.
     */
    syncProjectFromStorage(state, action: PayloadAction<BesserProject>) {
      const p = action.payload;
      state.project = p;

      // Sync activeDiagramType if storage has a different value
      if (p.currentDiagramType && p.currentDiagramType !== state.activeDiagramType) {
        state.activeDiagramType = p.currentDiagramType;
        state.editorOptions = deriveEditorOptions(state.editorOptions, p.currentDiagramType);
      }

      // Sync activeDiagramIndex if storage has a different value for the active type
      const storedIndex = p.currentDiagramIndices?.[state.activeDiagramType];
      if (storedIndex !== undefined && storedIndex !== state.activeDiagramIndex) {
        state.activeDiagramIndex = storedIndex;
      }

      // Keep active diagram pointer in sync without reinitializing the editor
      state.activeDiagram = getActiveDiagram(p, state.activeDiagramType) ?? state.activeDiagram;
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
        state.activeDiagram = getActiveDiagram(p, p.currentDiagramType) ?? null;
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
        state.activeDiagram = getActiveDiagram(p, p.currentDiagramType) ?? null;
        state.editorOptions = deriveEditorOptions(state.editorOptions, p.currentDiagramType);
        state.editorRevision += 1;
      })
      .addCase(createProjectThunk.rejected, (state, action) => {
        console.error('createProjectThunk failed:', action.error.message);
        state.error = action.error.message || 'Failed to create project';
      })

      // ── Switch diagram type ───────────────────────────────────
      .addCase(switchDiagramTypeThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(switchDiagramTypeThunk.fulfilled, (state, action) => {
        state.loading = false;
        const { diagram, diagramType } = action.payload;
        state.activeDiagram = diagram;
        state.activeDiagramType = diagramType;
        state.activeDiagramIndex = state.project?.currentDiagramIndices[diagramType] ?? 0;
        state.editorOptions = deriveEditorOptions(state.editorOptions, diagramType);
        state.editorRevision += 1;
        if (state.project) state.project.currentDiagramType = diagramType;
      })
      .addCase(switchDiagramTypeThunk.rejected, (state, action) => {
        state.loading = false;
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
      .addCase(switchDiagramIndexThunk.rejected, (state, action) => {
        console.error('switchDiagramIndexThunk failed:', action.error.message);
        state.error = action.error.message || 'Failed to switch diagram index';
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
      .addCase(updateQuantumDiagramThunk.rejected, (state, action) => {
        console.error('updateQuantumDiagramThunk failed:', action.error.message);
        state.error = action.error.message || 'Failed to update quantum diagram';
      })

      // ── Add diagram ───────────────────────────────────────────
      .addCase(addDiagramThunk.fulfilled, (state, action) => {
        const { diagramType, index, diagram } = action.payload;
        if (state.project) {
          // Reload project from storage to stay in sync (storage already added the diagram)
          const freshProject = ProjectStorageRepository.loadProject(state.project.id);
          if (freshProject) {
            state.project = freshProject;
          } else {
            console.warn('[workspaceSlice] addDiagramThunk: storage reload failed, falling back to manual push');
            state.project.diagrams[diagramType].push(diagram);
          }
          state.project.currentDiagramIndices[diagramType] = index;
        }
        state.activeDiagram = diagram;
        state.activeDiagramIndex = index;
        state.editorRevision += 1;
      })
      .addCase(addDiagramThunk.rejected, (state, action) => {
        console.error('addDiagramThunk failed:', action.error.message);
        state.error = action.error.message || 'Failed to add diagram';
      })

      // ── Remove diagram ────────────────────────────────────────
      .addCase(removeDiagramThunk.fulfilled, (state, action) => {
        const { project, diagramType } = action.payload;
        state.project = project;
        state.activeDiagramIndex = project.currentDiagramIndices[diagramType] ?? 0;
        state.activeDiagram = getActiveDiagram(project, diagramType) ?? null;
        state.editorRevision += 1;
      })
      .addCase(removeDiagramThunk.rejected, (state, action) => {
        console.error('removeDiagramThunk failed:', action.error.message);
        state.error = action.error.message || 'Failed to remove diagram';
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
      })
      .addCase(renameDiagramThunk.rejected, (state, action) => {
        console.error('renameDiagramThunk failed:', action.error.message);
        state.error = action.error.message || 'Failed to rename diagram';
      })

      // ── Update diagram references ─────────────────────────────
      .addCase(updateDiagramReferencesThunk.fulfilled, (state, action) => {
        const { diagramType, diagramIndex, references } = action.payload;
        if (state.project) {
          const diagram = state.project.diagrams[diagramType][diagramIndex];
          if (diagram) {
            diagram.references = { ...diagram.references, ...references };
          }
          // Keep activeDiagram in sync
          if (state.activeDiagramType === diagramType && state.activeDiagramIndex === diagramIndex) {
            state.activeDiagram = diagram;
          }
        }
      })
      .addCase(updateDiagramReferencesThunk.rejected, (state, action) => {
        console.error('updateDiagramReferencesThunk failed:', action.error.message);
        state.error = action.error.message || 'Failed to update diagram references';
      })

      // ── Toggle perspective visibility (view-only, no revision bump) ──
      .addCase(setPerspectiveEnabledThunk.fulfilled, (state, action) => {
        const { perspectives } = action.payload;
        if (state.project) {
          state.project.settings = {
            ...state.project.settings,
            perspectives,
          };
        }
      })
      .addCase(setPerspectiveEnabledThunk.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to update perspective';
      })
      .addCase(applyPerspectivePresetThunk.fulfilled, (state, action) => {
        const { perspectives } = action.payload;
        if (state.project) {
          state.project.settings = {
            ...state.project.settings,
            perspectives,
          };
        }
      })
      .addCase(applyPerspectivePresetThunk.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to apply perspective preset';
      })

      // ── Refresh project from storage (no revision bump) ─────
      .addCase(refreshProjectStateThunk.fulfilled, (state, action) => {
        if (!action.payload) return;
        const p = action.payload;
        state.project = p;

        // Sync activeDiagramType if storage has a different value
        if (p.currentDiagramType && p.currentDiagramType !== state.activeDiagramType) {
          state.activeDiagramType = p.currentDiagramType;
          state.editorOptions = deriveEditorOptions(state.editorOptions, p.currentDiagramType);
        }

        // Sync activeDiagramIndex if storage has a different value for the active type
        const storedIndex = p.currentDiagramIndices?.[state.activeDiagramType];
        if (storedIndex !== undefined && storedIndex !== state.activeDiagramIndex) {
          state.activeDiagramIndex = storedIndex;
        }

        // Keep active diagram in sync without triggering editor reinit
        state.activeDiagram = getActiveDiagram(p, state.activeDiagramType) ?? state.activeDiagram;
      })
      .addCase(refreshProjectStateThunk.rejected, (_state, action) => {
        console.error('refreshProjectStateThunk failed:', action.error.message);
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
  syncProjectFromStorage,
} = workspaceSlice.actions;

export const workspaceReducer = workspaceSlice.reducer;

// ── Selectors ──────────────────────────────────────────────────────────

// Base selectors (direct state access — no memoization needed for primitives/references)
export const selectProject = (state: { workspace: WorkspaceState }) => state.workspace.project;
export const selectActiveDiagram = (state: { workspace: WorkspaceState }) => state.workspace.activeDiagram;
export const selectActiveDiagramType = (state: { workspace: WorkspaceState }) => state.workspace.activeDiagramType;
export const selectActiveDiagramIndex = (state: { workspace: WorkspaceState }) => state.workspace.activeDiagramIndex;
export const selectEditorOptions = (state: { workspace: WorkspaceState }) => state.workspace.editorOptions;
export const selectEditorRevision = (state: { workspace: WorkspaceState }) => state.workspace.editorRevision;
export const selectWorkspaceLoading = (state: { workspace: WorkspaceState }) => state.workspace.loading;
export const selectWorkspaceError = (state: { workspace: WorkspaceState }) => state.workspace.error;

// Derived selectors (memoized to avoid unnecessary re-renders)

const EMPTY_DIAGRAMS: ProjectDiagram[] = [];

export const selectProjectId = createSelector(selectProject, (project) => project?.id);

export const selectDiagrams = createSelector(
  selectProject,
  (project) => project?.diagrams,
);

export const selectClassDiagrams = createSelector(
  selectDiagrams,
  (diagrams) => diagrams?.ClassDiagram ?? EMPTY_DIAGRAMS,
);

export const selectObjectDiagrams = createSelector(
  selectDiagrams,
  (diagrams) => diagrams?.ObjectDiagram ?? EMPTY_DIAGRAMS,
);

export const selectStateMachineDiagrams = createSelector(
  selectDiagrams,
  (diagrams) => diagrams?.StateMachineDiagram ?? EMPTY_DIAGRAMS,
);

export const selectAgentDiagrams = createSelector(
  selectDiagrams,
  (diagrams) => diagrams?.AgentDiagram ?? EMPTY_DIAGRAMS,
);

export const selectGUIDiagrams = createSelector(
  selectDiagrams,
  (diagrams) => diagrams?.GUINoCodeDiagram ?? EMPTY_DIAGRAMS,
);

export const selectQuantumCircuitDiagrams = createSelector(
  selectDiagrams,
  (diagrams) => diagrams?.QuantumCircuitDiagram ?? EMPTY_DIAGRAMS,
);

export const selectUMLDiagramType = createSelector(
  selectActiveDiagramType,
  (activeDiagramType) => toUMLDiagramType(activeDiagramType) ?? UMLDiagramType.ClassDiagram,
);

export const selectDiagramsForActiveType = createSelector(
  [selectDiagrams, selectActiveDiagramType],
  (diagrams, activeDiagramType) => diagrams?.[activeDiagramType] ?? EMPTY_DIAGRAMS,
);

export const selectIsUMLEditor = createSelector(
  selectActiveDiagramType,
  (activeDiagramType) => toUMLDiagramType(activeDiagramType) !== null,
);

export const selectIsGUIEditor = createSelector(
  selectActiveDiagramType,
  (activeDiagramType) => activeDiagramType === 'GUINoCodeDiagram',
);

export const selectIsQuantumEditor = createSelector(
  selectActiveDiagramType,
  (activeDiagramType) => activeDiagramType === 'QuantumCircuitDiagram',
);

export const selectPerspectives = createSelector(
  selectProject,
  (project) => project?.settings?.perspectives,
);

export const selectVisiblePerspectives = createSelector(
  selectPerspectives,
  (perspectives) => ALL_DIAGRAM_TYPES.filter((t) => isPerspectiveVisible(perspectives, t)),
);
