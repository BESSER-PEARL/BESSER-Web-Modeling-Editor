/**
 * Wires the User Profile form to the live Apollon editor and Redux so the form
 * and the graphical canvas stay in sync in both directions.
 *
 * Design invariant: the editor model is written ONLY in response to an explicit
 * user edit in the form (via `applyEdit`). Opening the drawer, switching tabs,
 * and reflecting external canvas changes are strictly read-only — they never
 * call `editor.model = …`, so simply opening the form can never reload or
 * mutate the canvas.
 *
 *   user form edit -> applyEdit -> (debounced) rebuild UMLModel -> Redux + editor.model
 *   canvas edit    -> subscribeToModelChange -> reparse -> setState (no write-back)
 *
 * `suppressSyncRef` prevents our own model-change listener from reacting to the
 * write we just performed.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApollonEditor } from '@besser/wme';
import { useAppDispatch } from '../../../app/store/hooks';
import { updateDiagramModelThunk } from '../../../app/store/workspaceSlice';
import { buildMetamodelTree, MetaTree } from './metamodel-tree';
import {
  buildUserDiagramModel,
  createEmptyInstance,
  instanceSignature,
  parseUserDiagramModel,
} from './model-serialization';
import { Instance } from './types';

const WRITE_DEBOUNCE_MS = 350;

interface UseUserProfileForm {
  tree: MetaTree | null;
  formState: Instance | null;
  /** Apply a user edit: updates form state AND schedules a write to the canvas. */
  applyEdit: (updater: (prev: Instance) => Instance) => void;
  /** True once a metamodel + root instance are available. */
  ready: boolean;
}

export const useUserProfileForm = (open: boolean, editor: ApollonEditor | undefined): UseUserProfileForm => {
  const dispatch = useAppDispatch();
  const [tree, setTree] = useState<MetaTree | null>(null);
  const [formState, setFormState] = useState<Instance | null>(null);

  const treeRef = useRef<MetaTree | null>(null);
  const formStateRef = useRef<Instance | null>(null);
  const suppressSyncRef = useRef(false);
  const lastSigRef = useRef<string>('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const releaseRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Read-only state update (open / external sync). Never writes to the editor.
  const commitState = useCallback((next: Instance | null) => {
    formStateRef.current = next;
    lastSigRef.current = instanceSignature(next);
    setFormState(next);
  }, []);

  // Debounced write of a given form state back to the canvas + storage.
  const scheduleWrite = useCallback(
    (state: Instance) => {
      if (!editor) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        const t = treeRef.current;
        if (!t) return;
        const model = buildUserDiagramModel(state, t, editor.model as any);
        lastSigRef.current = instanceSignature(state);
        suppressSyncRef.current = true;
        try {
          await dispatch(updateDiagramModelThunk({ model: model as any })).unwrap();
          await editor.nextRender;
          editor.model = { ...(model as any) };
          await editor.nextRender;
        } catch {
          // Swallow: a transient write failure shouldn't break the form.
        } finally {
          if (releaseRef.current) clearTimeout(releaseRef.current);
          releaseRef.current = setTimeout(() => {
            suppressSyncRef.current = false;
          }, 60);
        }
      }, WRITE_DEBOUNCE_MS);
    },
    [editor, dispatch],
  );

  // The ONLY path that writes to the canvas: an explicit user edit.
  const applyEdit = useCallback(
    (updater: (prev: Instance) => Instance) => {
      const prev = formStateRef.current;
      if (!prev) return;
      const next = updater(prev);
      if (next === prev) return; // updater declined the change
      formStateRef.current = next;
      setFormState(next);
      scheduleWrite(next);
    },
    [scheduleWrite],
  );

  // On open: build the metamodel tree and parse the current model into the form.
  // Strictly read-only — does not touch the editor model.
  useEffect(() => {
    if (!open) return;
    const t = buildMetamodelTree();
    treeRef.current = t;
    setTree(t);
    if (!t.root) {
      commitState(null);
      return;
    }
    const parsed = (editor ? parseUserDiagramModel(editor.model as any, t) : null) ?? createEmptyInstance(t.root);
    commitState(parsed);
  }, [open, editor, commitState]);

  // Canvas -> form: reflect external model changes while the drawer is open.
  // Read-only — never writes back.
  useEffect(() => {
    if (!open || !editor) return;
    const subId = editor.subscribeToModelChange((model: any) => {
      if (suppressSyncRef.current) return; // ignore the echo of our own write
      const t = treeRef.current;
      if (!t?.root) return;
      const parsed = parseUserDiagramModel(model, t);
      if (instanceSignature(parsed) === lastSigRef.current) return; // no meaningful change
      commitState(parsed);
    });
    return () => editor.unsubscribeFromModelChange(subId);
  }, [open, editor, commitState]);

  // Reset transient state when the drawer closes.
  useEffect(() => {
    if (open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (releaseRef.current) clearTimeout(releaseRef.current);
    suppressSyncRef.current = false;
  }, [open]);

  return { tree, formState, applyEdit, ready: !!tree?.root && !!formState };
};
