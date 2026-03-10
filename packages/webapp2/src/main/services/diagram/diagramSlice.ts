/**
 * BACKWARD-COMPATIBILITY SHIM
 * All state now lives in workspaceSlice. This file re-exports what consumers need.
 * Consumers should migrate to import directly from workspaceSlice.
 */
import { createAsyncThunk } from '@reduxjs/toolkit';
import { UMLDiagramType, UMLModel } from '@besser/wme';
import { GrapesJSProjectData, isUMLModel } from '../../types/project';
import {
  updateDiagramModelThunk,
  bumpEditorRevision,
  changeEditorMode,
  changeReadonlyMode,
  type EditorOptions,
  type WorkspaceState,
} from '../workspace/workspaceSlice';

// ── Type re-exports ────────────────────────────────────────────────────

export type Diagram = {
  id: string;
  title: string;
  model?: UMLModel | GrapesJSProjectData;
  lastUpdate: string;
  versions?: Diagram[];
  description?: string;
  token?: string;
};

export type { EditorOptions };
export { changeEditorMode, changeReadonlyMode };

// ── Thunk shim ─────────────────────────────────────────────────────────
// updateDiagramThunk used to live here and cross-dispatch to projectSlice.
// Now it delegates to the unified updateDiagramModelThunk.

export const updateDiagramThunk = createAsyncThunk(
  'diagram/updateWithProject',
  async (diagram: Partial<Diagram>, { dispatch }) => {
    const updates: any = {};
    if (diagram.model) updates.model = diagram.model;
    if (diagram.title !== undefined) updates.title = diagram.title;
    if (diagram.description !== undefined) updates.description = diagram.description;

    if (Object.keys(updates).length > 0) {
      await dispatch(updateDiagramModelThunk(updates));
    }

    return diagram;
  },
);

// ── Action shims ───────────────────────────────────────────────────────
// These map old diagramSlice actions to workspace equivalents.

/** setCreateNewEditor(true) → bumpEditorRevision; setCreateNewEditor(false) → no-op */
export const setCreateNewEditor = (value: boolean) => {
  if (value) return bumpEditorRevision();
  // false is a no-op — the revision counter doesn't need resetting
  return { type: 'workspace/noop' } as const;
};

/** changeDiagramType — no longer needed; switchDiagramTypeThunk handles it */
export const changeDiagramType = (_type: UMLDiagramType) =>
  ({ type: 'workspace/noop' } as const);

/** loadDiagram — bumps revision so editor reinits */
export const loadDiagram = (_diagram: Diagram) => bumpEditorRevision();

/** loadImportedDiagram — same as loadDiagram */
export const loadImportedDiagram = (_diagram: Diagram) => bumpEditorRevision();

// ── Selector shims ─────────────────────────────────────────────────────
// Map old `state.diagram.*` accessors to workspace state.

export const selectDiagram = (state: { workspace: WorkspaceState }): Diagram => {
  const w = state.workspace;
  return {
    id: w.activeDiagram?.id ?? '',
    title: w.activeDiagram?.title ?? '',
    model: isUMLModel(w.activeDiagram?.model) ? w.activeDiagram.model : undefined,
    lastUpdate: w.activeDiagram?.lastUpdate ?? '',
  };
};

export const selectCreatenewEditor = (state: { workspace: WorkspaceState }) =>
  // Components that read this to decide "should I reinit?" now use editorRevision.
  // Return true always so old code initializes on first render.
  true;

export const selectDisplayUnpublishedVersion = () => true;
export const setDisplayUnpublishedVersion = (_v: boolean) =>
  ({ type: 'workspace/noop' } as const);

// ── Reducer shim ───────────────────────────────────────────────────────
// The store no longer uses this reducer, but some code may import it.
import { workspaceReducer } from '../workspace/workspaceSlice';
export const diagramReducer = workspaceReducer;

// ── Legacy sync actions (no-ops) ───────────────────────────────────────
export const updateDiagram = (_d: Partial<Diagram>) =>
  ({ type: 'workspace/noop' } as const);
export const createDiagram = (_d: { title: string; diagramType: UMLDiagramType; template?: UMLModel }) =>
  ({ type: 'workspace/noop' } as const);
