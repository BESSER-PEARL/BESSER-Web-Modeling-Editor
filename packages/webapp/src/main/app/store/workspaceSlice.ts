import { createSlice, PayloadAction, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import { BesserMode, Locale, Styles, UMLDiagramType, UMLModel } from '@besser/wme';
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
import { getUserMetaModelV4 } from '@besser/wme';

// ── Types ──────────────────────────────────────────────────────────────

export type EditorOptions = {
  type: UMLDiagramType;
  mode?: BesserMode;
  readonly?: boolean;
  enablePopups?: boolean;
  enableCopyPaste?: boolean;
  theme?: DeepPartial<Styles>;
  locale: Locale;
  colorEnabled?: boolean;
};

export const defaultEditorOptions: EditorOptions = {
  type: UMLDiagramType.ClassDiagram,
  mode: BesserMode.Modelling,
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

/**
 * Push the model that some diagram editors expect to find in the shared
 * `diagramBridge` before they render. Without this:
 *   - ObjectDiagram → its palette can't resolve the typed objects against
 *     the referenced ClassDiagram, so the canvas can't be edited correctly.
 *   - UserDiagram   → its palette is empty (it's an Object Diagram under
 *     the hood, but it needs the dedicated user metamodel loaded).
 *
 * This used to live inline inside `switchDiagramTypeThunk`, which meant
 * loading a project (via `loadProjectThunk`) whose active diagram was a
 * UserDiagram or ObjectDiagram would skip the setup entirely. Extracted
 * so both code paths share it.
 */
async function setupBridgeForActiveDiagram(
  project: BesserProject,
  activeDiagram: ProjectDiagram | null,
  diagramType: SupportedDiagramType,
): Promise<void> {
  if (diagramType === 'ObjectDiagram') {
    if (!activeDiagram) return;
    const classDiagram = getReferencedDiagram(project, activeDiagram, 'ClassDiagram');
    if (isUMLModel(classDiagram?.model)) {
      try {
        const { diagramBridge } = await import('@besser/wme');
        diagramBridge.setClassDiagramData(classDiagram.model);
      } catch {
        /* bridge not available */
      }
    }
  } else if (diagramType === 'UserDiagram') {
    try {
      const { diagramBridge } = await import('@besser/wme');
      // Fix #4: feed the v4-shape `{nodes, edges}` view of
      // the user meta-model. The raw `userMetaModel` JSON is the v3
      // `{elements, relationships}` shape — passing it directly caused
      // every bridge reader (`getAvailableClasses`, enum-literal lookups
      // in `UserModelNameEditPanel`) to silently return `[]`.
      diagramBridge.setClassDiagramData(getUserMetaModelV4() as unknown as UMLModel);
    } catch {
      /* bridge not available */
    }
  }
}

export const loadProjectThunk = createAsyncThunk(
  'workspace/loadProject',
  async (projectId: string | undefined) => {
    const project = projectId
      ? ProjectStorageRepository.loadProject(projectId)
      : ProjectStorageRepository.getCurrentProject();

    if (!project) throw new Error('Project not found');

    localStorage.setItem(localStorageLatestProject, project.id);

    // Mirror the bridge setup that `switchDiagramTypeThunk` would do, so
    // imported / template-loaded projects whose active diagram is a User
    // or Object diagram show the correct palette on first render.
    const activeDiagram = getActiveDiagram(project, project.currentDiagramType);
    await setupBridgeForActiveDiagram(project, activeDiagram, project.currentDiagramType);

    return project;
  },
);

export const createProjectThunk = createAsyncThunk(
  'workspace/createProject',
  async ({
    name,
    description,
    owner,
    perspectives,
  }: {
    name: string;
    description: string;
    owner: string;
    perspectives?: PerspectiveSettings;
  }) => {
    let project!: BesserProject;
    ProjectStorageRepository.withoutNotify(() => {
      project = ProjectStorageRepository.createNewProject(name, description, owner, perspectives);
    });

    // Content-bleed-on-new-project: explicitly clear the singleton
    // `diagramBridge` cache (including its localStorage backup) before
    // priming it for the new project. Without this, the bridge keeps the
    // *previous* project's ClassDiagram data — which surfaces as stale
    // class options in ObjectDiagram/UserDiagram palettes and reference
    // lookups inside the brand-new project. We then mirror
    // `loadProjectThunk`'s setup call so a brand-new project's first
    // active diagram has the correct (here: empty) bridge state.
    try {
      const { diagramBridge } = await import('@besser/wme');
      diagramBridge.clearDiagramData();
    } catch {
      /* bridge not available */
    }
    const activeDiagram = getActiveDiagram(project, project.currentDiagramType);
    await setupBridgeForActiveDiagram(project, activeDiagram ?? null, project.currentDiagramType);

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

    const supportedType =
      diagramType === 'QuantumCircuitDiagram' || diagramType === 'GUINoCodeDiagram'
        ? (diagramType as SupportedDiagramType)
        : toSupportedDiagramType(diagramType as UMLDiagramType);

    let diagram: ProjectDiagram | null = null;
    ProjectStorageRepository.withoutNotify(() => {
      diagram = ProjectStorageRepository.switchDiagramType(project.id, supportedType);
    });
    if (!diagram) throw new Error('Failed to switch diagram type');

    await setupBridgeForActiveDiagram(project, diagram, supportedType);

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
 *
 * ## bumpEditorRevision contract
 *
 * This thunk DOES NOT bump `editorRevision`, by design. It exists for
 * "metadata-only" project refreshes where the active editor's bound
 * model has not changed (e.g. another diagram was renamed, an agent
 * config was updated, perspective settings changed). Bumping the
 * revision would tear down and recreate the BesserEditor, dropping
 * unsaved edits and clearing undo history — neither of which is the
 * intended side-effect of a "refresh metadata" call.
 *
 * If the caller's mutation DOES alter the body of the currently-
 * active diagram's model (e.g. retrofitting nodes onto the live tab),
 * the caller MUST dispatch `bumpEditorRevision()` AFTER this thunk's
 * fulfilled action resolves. A runtime warning is emitted below when
 * we detect an active-diagram model identity change without a
 * follow-up bump in the same microtask, so the contract violation is
 * surfaced loudly in development instead of producing a silently
 * stale canvas.
 *
 * Callers known to correctly pair a bump:
 *   - AgentConfigurationPanel: bumps after applying agent profiles
 *   - GraphicalUIEditor template injection: bumps after notifyChange
 *
 * Callers that intentionally do NOT bump (active model unchanged):
 *   - PerspectiveSettingsDialog
 *   - GitHubSidebar after pulling project metadata
 */
export const refreshProjectStateThunk = createAsyncThunk(
  'workspace/refreshProjectState',
  async (_: void, { getState }) => {
    const state = getState() as { workspace: WorkspaceState };
    const { project } = state.workspace;
    if (!project) return null;
    const activeType = state.workspace.activeDiagramType;
    const activeIndex = state.workspace.activeDiagramIndex;
    const previousActiveModelRef = state.workspace.activeDiagram?.model;
    return {
      project: ProjectStorageRepository.loadProject(project.id),
      previousActiveModelRef,
      activeType,
      activeIndex,
    };
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

/**
 * Combined add + switch in a single thunk.
 *
 * Background: the Assistant's "new tab" flow used to dispatch three
 * separate actions — `addDiagramThunk` (bumps editorRevision once),
 * `switchDiagramIndexThunk` (bumps a second time), and a manual
 * `bumpEditorRevision` after writing the model. Each bump destroys and
 * recreates the BesserEditor, so the editor was reinitialized three
 * times for a single user-visible operation. This thunk performs both
 * the create and the switch in storage, then emits a SINGLE
 * `editorRevision` bump via its fulfilled reducer.
 *
 * Use this whenever a caller wants to create a diagram and immediately
 * focus it — which is virtually every add-diagram path except the
 * tabs strip's `+` button (which is fine as-is because it doesn't
 * follow-up with a model write).
 */
export const addAndSwitchDiagramThunk = createAsyncThunk(
  'workspace/addAndSwitchDiagram',
  async (
    { diagramType, title, initialModel }: {
      diagramType: SupportedDiagramType;
      title?: string;
      /** Optional initial model to seed the new diagram with. When
       * provided, the model is written to storage BEFORE the single
       * editorRevision bump in the fulfilled reducer, so the editor
       * sets up exactly once with the seeded model. */
      initialModel?: ProjectDiagram['model'];
    },
    { getState },
  ) => {
    const state = getState() as { workspace: WorkspaceState };
    const { project } = state.workspace;
    if (!project) throw new Error('No active project');

    const existing = project.diagrams[diagramType] ?? [];
    if (existing.length >= MAX_DIAGRAMS_PER_TYPE) {
      throw new Error(
        `Cannot add more ${diagramType}s: project limit of ${MAX_DIAGRAMS_PER_TYPE} reached.`,
      );
    }

    let result: { index: number; diagram: ProjectDiagram } | null = null;
    ProjectStorageRepository.withoutNotify(() => {
      result = ProjectStorageRepository.addDiagram(project.id, diagramType, title);
      if (result) {
        ProjectStorageRepository.switchDiagramIndex(project.id, diagramType, result.index);
        if (initialModel) {
          // Overwrite the just-created empty model with the caller-
          // provided one, BEFORE we return so the reducer reads the
          // seeded diagram out of storage and the editor sees it on
          // its first (and only) setup pass.
          const seeded: ProjectDiagram = {
            ...result.diagram,
            model: initialModel,
            lastUpdate: new Date().toISOString(),
          };
          ProjectStorageRepository.updateDiagram(
            project.id,
            diagramType,
            seeded,
            result.index,
          );
          result = { index: result.index, diagram: seeded };
        }
      }
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
    changeEditorMode(state, action: PayloadAction<BesserMode>) {
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

      // ── Add + switch diagram (single editor reinit) ──────────
      .addCase(addAndSwitchDiagramThunk.fulfilled, (state, action) => {
        const { diagramType, index, diagram } = action.payload;
        if (state.project) {
          const freshProject = ProjectStorageRepository.loadProject(state.project.id);
          if (freshProject) {
            state.project = freshProject;
          } else {
            console.warn('[workspaceSlice] addAndSwitchDiagramThunk: storage reload failed, falling back to manual push');
            state.project.diagrams[diagramType].push(diagram);
          }
          state.project.currentDiagramIndices[diagramType] = index;
        }
        state.activeDiagram = diagram;
        state.activeDiagramIndex = index;
        // SINGLE editorRevision bump for the combined
        // add + switch (vs. the previous 3 bumps when add, switch, and
        // a manual bumpEditorRevision were dispatched separately).
        state.editorRevision += 1;
      })
      .addCase(addAndSwitchDiagramThunk.rejected, (state, action) => {
        console.error('addAndSwitchDiagramThunk failed:', action.error.message);
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
        if (!action.payload || !action.payload.project) return;
        const { project: p, previousActiveModelRef } = action.payload;
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
        const nextActive = getActiveDiagram(p, state.activeDiagramType);
        state.activeDiagram = nextActive ?? state.activeDiagram;

        // Development-only contract warning.
        // If the active diagram's model identity changed (i.e. the body
        // of the currently-displayed diagram was rewritten by whatever
        // triggered the refresh), the caller MUST dispatch
        // `bumpEditorRevision()` after this thunk resolves — otherwise
        // the canvas keeps showing the stale model. We can't enforce
        // this from inside the reducer, but we can warn loudly.
        if (
          import.meta.env?.DEV &&
          previousActiveModelRef !== undefined &&
          nextActive?.model !== undefined &&
          previousActiveModelRef !== nextActive.model
        ) {
          // Defer the warning so callers that bump in the same tick (or
          // via `.then` on the dispatch promise) have a chance to do so
          // before we complain.
          queueMicrotask(() => {
            // eslint-disable-next-line no-console
            console.warn(
              '[refreshProjectStateThunk] Active diagram model body changed but editorRevision was not bumped. ' +
              'Callers that mutate the active diagram\'s model must dispatch bumpEditorRevision() ' +
              'after the refresh resolves; otherwise the canvas will keep rendering the stale model. ' +
              'See refreshProjectStateThunk JSDoc.',
            );
          });
        }
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
