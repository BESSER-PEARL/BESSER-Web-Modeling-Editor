import { useCallback, useEffect, useRef } from 'react';
import { ProjectStorageRepository } from '../services/storage/ProjectStorageRepository';
import { syncProjectFromStorage, selectProjectId } from '../services/workspace/workspaceSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  localStorageProjectPrefix,
  localStorageUserThemePreference,
} from '../constant';
import { useCrossTabSync } from './useCrossTabSync';
import { setTheme } from '../utils/theme-switcher';

/**
 * Keeps Redux workspace state in sync with localStorage.
 *
 * Two complementary sync mechanisms:
 *
 * 1. **Same-tab sync** — Editors like GrapesJS and the Quantum circuit editor
 *    write directly to localStorage via ProjectStorageRepository for performance.
 *    This hook subscribes to ProjectStorageRepository's change notifications and
 *    dispatches a lightweight Redux action to pull the fresh project data into
 *    the store — so every consumer of `useAppSelector(selectProject)` always
 *    sees the latest state.
 *
 * 2. **Cross-tab sync** — Listens for the browser `storage` event (which fires
 *    when localStorage is modified in a *different* tab) so that project data
 *    and theme preferences stay consistent across multiple open tabs.
 *
 * Infinite-loop prevention:
 * - `syncProjectFromStorage` is a plain reducer that does NOT write back
 *   to localStorage, so it cannot re-trigger the listener.
 * - A revision counter comparison skips dispatches when the store is
 *   already up to date (e.g. when the write came from a Redux thunk
 *   that already updated the store).
 * - The `storage` event only fires in *other* tabs, never the originating tab,
 *   so cross-tab handlers cannot cause same-tab loops.
 */
export function useStorageSync(): void {
  const dispatch = useAppDispatch();
  const currentProjectId = useAppSelector(selectProjectId);

  // Track the last revision we synced so we skip no-op dispatches.
  const lastSyncedRevisionRef = useRef(ProjectStorageRepository.revision);

  // ── 1. Same-tab sync (ProjectStorageRepository change listeners) ──────
  useEffect(() => {
    const unsubscribe = ProjectStorageRepository.onProjectChange(() => {
      const currentRevision = ProjectStorageRepository.revision;

      // Skip if we already processed this revision
      if (currentRevision === lastSyncedRevisionRef.current) {
        return;
      }
      lastSyncedRevisionRef.current = currentRevision;

      // Re-read the active project from localStorage
      const projectId = currentProjectId;
      if (!projectId) return;

      const fresh = ProjectStorageRepository.loadProject(projectId);
      if (fresh) {
        dispatch(syncProjectFromStorage(fresh));
      }
    });

    return unsubscribe;
  }, [dispatch, currentProjectId]);

  // ── 2. Cross-tab sync (browser `storage` event) ──────────────────────

  // Sync project data when another tab saves the active project
  const projectStorageKey = currentProjectId
    ? `${localStorageProjectPrefix}${currentProjectId}`
    : null;

  const handleProjectChangeFromOtherTab = useCallback(
    (newValue: string | null) => {
      if (!newValue || !currentProjectId) return;

      // Re-read through ProjectStorageRepository so migrations are applied
      const fresh = ProjectStorageRepository.loadProject(currentProjectId);
      if (fresh) {
        dispatch(syncProjectFromStorage(fresh));
      }
    },
    [dispatch, currentProjectId],
  );

  useCrossTabSync(projectStorageKey ?? '', handleProjectChangeFromOtherTab);

  // Sync theme preference when another tab toggles theme
  const handleThemeChangeFromOtherTab = useCallback(
    (newValue: string | null) => {
      if (newValue) {
        setTheme(newValue);
      }
    },
    [],
  );

  useCrossTabSync(localStorageUserThemePreference, handleThemeChangeFromOtherTab);
}
