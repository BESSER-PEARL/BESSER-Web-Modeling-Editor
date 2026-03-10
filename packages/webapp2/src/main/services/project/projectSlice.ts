/**
 * BACKWARD-COMPATIBILITY SHIM
 * All state now lives in workspaceSlice. This file re-exports what consumers need.
 * Consumers should migrate to import directly from workspaceSlice.
 */
import type { WorkspaceState } from '../workspace/workspaceSlice';
import {
  // Thunks
  loadProjectThunk,
  createProjectThunk,
  switchDiagramTypeThunk,
  switchDiagramIndexThunk,
  updateDiagramModelThunk,
  updateQuantumDiagramThunk,
  addDiagramThunk,
  removeDiagramThunk,
  renameDiagramThunk,
  // Actions
  bumpEditorRevision,
  clearError,
  updateProjectInfo,
  // Selectors
  selectProject,
  selectActiveDiagram,
  selectActiveDiagramType,
  selectActiveDiagramIndex,
  selectUMLDiagramType,
  selectDiagramsForActiveType,
  selectEditorRevision,
  selectWorkspaceLoading,
  selectWorkspaceError,
  // Reducer
  workspaceReducer,
} from '../workspace/workspaceSlice';

// ── Re-export thunks with original names ───────────────────────────────

export {
  loadProjectThunk,
  createProjectThunk,
  switchDiagramTypeThunk,
  switchDiagramIndexThunk,
  addDiagramThunk,
  removeDiagramThunk,
  renameDiagramThunk,
  updateQuantumDiagramThunk,
};

// updateCurrentDiagramThunk → now updateDiagramModelThunk
export const updateCurrentDiagramThunk = updateDiagramModelThunk;

// ── Re-export actions ──────────────────────────────────────────────────

export { clearError, updateProjectInfo };

// setCreateNewEditor(true) → bumpEditorRevision
export const setCreateNewEditor = (value: boolean) => {
  if (value) return bumpEditorRevision();
  return { type: 'workspace/noop' } as const;
};

// ── Re-export selectors with original names ────────────────────────────

export const selectCurrentProject = selectProject;
export const selectCurrentDiagram = selectActiveDiagram;
export const selectCurrentDiagramType = selectActiveDiagramType;
export const selectCurrentDiagramIndex = selectActiveDiagramIndex;
export const selectCurrentUMLDiagramType = selectUMLDiagramType;
export const selectDiagramsForCurrentType = selectDiagramsForActiveType;
export const selectCreateNewEditor = selectEditorRevision;
export const selectLoading = selectWorkspaceLoading;
export const selectError = selectWorkspaceError;

// ── Reducer shim ───────────────────────────────────────────────────────

export const projectReducer = workspaceReducer;

// ── Legacy state type (for direct state access) ────────────────────────
export type { WorkspaceState as ProjectState };
