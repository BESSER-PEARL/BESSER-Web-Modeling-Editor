/**
 * Wires the User Profile form to the live Apollon editor and Redux so the form
 * and the graphical canvas stay in sync in both directions.
 *
 * A single UserDiagram canvas can hold **several** profiles (each a `User`
 * element plus its reachable subgraph), so the form state is a *list* of
 * profile `Instance` trees, not a single one.
 *
 * Design invariant: the editor model is written ONLY in response to an explicit
 * user edit in the form (via `applyEdit` / add / remove). Opening the drawer,
 * switching tabs, and reflecting external canvas changes are strictly read-only
 * — they never call `editor.model = …`, so simply opening the form can never
 * reload or mutate the canvas.
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
  parseUserDiagramProfiles,
} from './model-serialization';
import { Instance } from './types';

const WRITE_DEBOUNCE_MS = 350;

/** Order-insensitive signature of the whole profile list, for change-detection. */
const profilesSignature = (profiles: Instance[]): string =>
  profiles.map(instanceSignature).sort().join('||');

interface UseUserProfileForm {
  tree: MetaTree | null;
  profiles: Instance[];
  /** Apply a user edit across the profile list; updates state AND schedules a canvas write. */
  applyEdit: (updater: (prev: Instance[]) => Instance[]) => void;
  /** Append a new empty profile (a fresh root `User`). */
  addProfile: () => void;
  /** Remove the profile whose root instance has the given key. */
  removeProfile: (rootKey: string) => void;
  /** True once a metamodel + at least one profile are available. */
  ready: boolean;
}

export const useUserProfileForm = (open: boolean, editor: ApollonEditor | undefined): UseUserProfileForm => {
  const dispatch = useAppDispatch();
  const [tree, setTree] = useState<MetaTree | null>(null);
  const [profiles, setProfiles] = useState<Instance[]>([]);

  const treeRef = useRef<MetaTree | null>(null);
  const profilesRef = useRef<Instance[]>([]);
  const suppressSyncRef = useRef(false);
  const lastSigRef = useRef<string>('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const releaseRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Read-only state update (open / external sync). Never writes to the editor.
  const commitState = useCallback((next: Instance[]) => {
    profilesRef.current = next;
    lastSigRef.current = profilesSignature(next);
    setProfiles(next);
  }, []);

  // Debounced write of the given profile list back to the canvas + storage.
  const scheduleWrite = useCallback(
    (state: Instance[]) => {
      if (!editor) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        const t = treeRef.current;
        if (!t) return;
        const model = buildUserDiagramModel(state, t, editor.model as any);
        lastSigRef.current = profilesSignature(state);
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

  // The ONLY paths that write to the canvas: explicit user edits.
  const applyEdit = useCallback(
    (updater: (prev: Instance[]) => Instance[]) => {
      const prev = profilesRef.current;
      const next = updater(prev);
      if (next === prev) return; // updater declined the change
      profilesRef.current = next;
      setProfiles(next);
      scheduleWrite(next);
    },
    [scheduleWrite],
  );

  const addProfile = useCallback(() => {
    const t = treeRef.current;
    if (!t?.root) return;
    applyEdit((prev) => [...prev, createEmptyInstance(t.root!)]);
  }, [applyEdit]);

  const removeProfile = useCallback(
    (rootKey: string) => {
      applyEdit((prev) => {
        if (prev.length <= 1) return prev; // keep at least one profile
        const next = prev.filter((p) => p.key !== rootKey);
        return next.length === prev.length ? prev : next;
      });
    },
    [applyEdit],
  );

  // On open: build the metamodel tree and parse the current model into the form.
  // Strictly read-only — does not touch the editor model.
  useEffect(() => {
    if (!open) return;
    const t = buildMetamodelTree();
    treeRef.current = t;
    setTree(t);
    if (!t.root) {
      commitState([]);
      return;
    }
    const parsed = editor ? parseUserDiagramProfiles(editor.model as any, t) : [];
    commitState(parsed.length > 0 ? parsed : [createEmptyInstance(t.root)]);
  }, [open, editor, commitState]);

  // Canvas -> form: reflect external model changes while the drawer is open.
  // Read-only — never writes back.
  useEffect(() => {
    if (!open || !editor) return;
    const subId = editor.subscribeToModelChange((model: any) => {
      if (suppressSyncRef.current) return; // ignore the echo of our own write
      const t = treeRef.current;
      if (!t?.root) return;
      const parsed = parseUserDiagramProfiles(model, t);
      const next = parsed.length > 0 ? parsed : [createEmptyInstance(t.root)];
      if (profilesSignature(next) === lastSigRef.current) return; // no meaningful change
      commitState(next);
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

  return { tree, profiles, applyEdit, addProfile, removeProfile, ready: !!tree?.root && profiles.length > 0 };
};
