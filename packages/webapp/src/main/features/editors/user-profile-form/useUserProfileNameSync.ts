/**
 * Two-way sync between a User profile's identity and its diagram tab title.
 *
 * A "user profile model" is a `UserDiagram`; the thing that names it is the tab
 * title. This hook links that title to the root User element's `name` attribute
 * (added to the metamodel) so the two always agree:
 *
 *   rename the tab  -> the root User `name` attribute (+ its canvas label) updates
 *   edit the name   -> the tab title relabels (no editor remount)
 *
 * Loop-safety: `lastTitleRef`/`lastNameRef` record the last value we synced in
 * each direction. When we perform a write we advance the *matching* ref to the
 * new value first, so the write's own re-run sees "no change" and stops. A
 * `suppressRef` additionally guards the model write-back window.
 */

import { useEffect, useRef } from 'react';
import type { ApollonEditor, UMLModel } from '@besser/wme';
import { useAppDispatch } from '../../../app/store/hooks';
import { updateDiagramModelThunk } from '../../../app/store/workspaceSlice';
import { readUserProfileName, writeUserProfileName } from './model-serialization';

interface DiagramLike {
  title?: string;
  // The diagram model is a broad union across diagram types; this hook only
  // reads the live `editor.model` and uses this field for change-detection.
  model?: unknown;
}

export const useUserProfileNameSync = (
  editor: ApollonEditor | undefined,
  activeDiagram: DiagramLike | null | undefined,
  activeDiagramType: string | undefined,
): void => {
  const dispatch = useAppDispatch();

  const lastTitleRef = useRef<string | null>(null);
  const lastNameRef = useRef<string | null>(null);
  const suppressRef = useRef(false);
  const releaseRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (activeDiagramType !== 'UserDiagram' || !editor || !activeDiagram) return;
    if (suppressRef.current) return;

    const title = (activeDiagram.title ?? '').trim();
    const model = editor.model as UMLModel | undefined;
    if (!model) return;
    const nameInModel = readUserProfileName(model).trim();

    const writeModelName = async (value: string) => {
      const nextModel = writeUserProfileName(model, value);
      suppressRef.current = true;
      try {
        await dispatch(updateDiagramModelThunk({ model: nextModel as any })).unwrap();
        await editor.nextRender;
        editor.model = { ...(nextModel as any) };
        await editor.nextRender;
      } catch {
        // Swallow: a transient write failure shouldn't break the editor.
      } finally {
        if (releaseRef.current) clearTimeout(releaseRef.current);
        releaseRef.current = setTimeout(() => {
          suppressRef.current = false;
        }, 60);
      }
    };

    // First run for this diagram: seed refs and backfill the model name from the
    // tab title (title is authoritative on load; this also gives old diagrams
    // saved before the metamodel had a `name` attribute a value to show).
    if (lastTitleRef.current === null) {
      lastTitleRef.current = title;
      lastNameRef.current = nameInModel;
      if (title && title !== nameInModel) {
        lastNameRef.current = title;
        void writeModelName(title);
      }
      return;
    }

    const titleChanged = title !== lastTitleRef.current;
    const nameChanged = nameInModel !== lastNameRef.current;

    if (titleChanged && title !== nameInModel) {
      // Tab renamed -> push into the model's User `name` attribute.
      lastTitleRef.current = title;
      lastNameRef.current = title;
      void writeModelName(title);
    } else if (nameChanged && nameInModel && nameInModel !== title) {
      // User `name` edited on canvas/form -> relabel the tab (no remount).
      lastNameRef.current = nameInModel;
      lastTitleRef.current = nameInModel;
      void dispatch(updateDiagramModelThunk({ title: nameInModel }));
    } else {
      lastTitleRef.current = title;
      lastNameRef.current = nameInModel;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDiagram?.title, activeDiagram?.model, activeDiagramType, editor, dispatch]);

  // Reset the per-diagram sync state when switching diagrams/types.
  useEffect(() => {
    lastTitleRef.current = null;
    lastNameRef.current = null;
    suppressRef.current = false;
    return () => {
      if (releaseRef.current) clearTimeout(releaseRef.current);
    };
  }, [activeDiagramType]);
};
