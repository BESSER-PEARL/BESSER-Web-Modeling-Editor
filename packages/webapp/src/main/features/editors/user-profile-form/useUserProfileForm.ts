/**
 * Wires the User Profile form to the live Apollon editor and Redux so the form
 * and the graphical canvas stay in sync in both directions.
 *
 *   form edit  -> (debounced) rebuild UMLModel -> Redux thunk + editor.model
 *   canvas edit -> subscribeToModelChange -> reparse -> setFormState
 *
 * Two refs prevent feedback loops:
 *   - `suppressSyncRef`     : true while WE are writing to the editor, so our
 *                             own model-change listener ignores the echo.
 *   - `applyingExternalRef` : true when the last setFormState came from the
 *                             canvas, so the write effect does not echo it back.
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
  setFormState: React.Dispatch<React.SetStateAction<Instance | null>>;
  /** True once a metamodel + root instance are available. */
  ready: boolean;
}

export const useUserProfileForm = (open: boolean, editor: ApollonEditor | undefined): UseUserProfileForm => {
  const dispatch = useAppDispatch();
  const [tree, setTree] = useState<MetaTree | null>(null);
  const [formState, setFormState] = useState<Instance | null>(null);

  const treeRef = useRef<MetaTree | null>(null);
  const suppressSyncRef = useRef(false);
  const applyingExternalRef = useRef(false);
  const lastSigRef = useRef<string>('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const releaseRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buildTree = useCallback((): MetaTree => {
    const t = buildMetamodelTree();
    treeRef.current = t;
    setTree(t);
    return t;
  }, []);

  // On open: build the metamodel tree and parse the current model into the form.
  // The tree is built even before the editor is ready so the form renders its
  // structure immediately; it re-parses once `editor` becomes available.
  useEffect(() => {
    if (!open) return;
    const t = buildTree();
    if (!t.root) {
      setFormState(null);
      return;
    }
    const parsed = (editor ? parseUserDiagramModel(editor.model as any, t) : null) ?? createEmptyInstance(t.root);
    lastSigRef.current = instanceSignature(parsed);
    // Don't echo this initial parse straight back to the editor.
    applyingExternalRef.current = true;
    setFormState(parsed);
  }, [open, editor, buildTree]);

  // Canvas -> form: reflect external model changes while the drawer is open.
  useEffect(() => {
    if (!open || !editor) return;
    const subId = editor.subscribeToModelChange((model: any) => {
      if (suppressSyncRef.current) return;
      const t = treeRef.current;
      if (!t?.root) return;
      const parsed = parseUserDiagramModel(model, t);
      const sig = instanceSignature(parsed);
      if (sig === lastSigRef.current) return; // no meaningful change
      lastSigRef.current = sig;
      applyingExternalRef.current = true;
      setFormState(parsed);
    });
    return () => editor.unsubscribeFromModelChange(subId);
  }, [open, editor]);

  // Form -> canvas: debounced rebuild + write, skipping canvas-originated edits.
  useEffect(() => {
    if (!open || !editor || !formState) return;

    if (applyingExternalRef.current) {
      // This state came from the canvas; consume the flag and don't write back.
      applyingExternalRef.current = false;
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const t = treeRef.current;
      if (!t) return;
      const model = buildUserDiagramModel(formState, t, editor.model as any);
      lastSigRef.current = instanceSignature(formState);
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

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [formState, open, editor, dispatch]);

  // Reset transient state when the drawer closes.
  useEffect(() => {
    if (open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (releaseRef.current) clearTimeout(releaseRef.current);
    suppressSyncRef.current = false;
    applyingExternalRef.current = false;
  }, [open]);

  return { tree, formState, setFormState, ready: !!tree?.root && !!formState };
};
