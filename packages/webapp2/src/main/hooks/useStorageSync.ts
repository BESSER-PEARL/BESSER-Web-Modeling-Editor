import { useEffect, useRef } from 'react';
import { ProjectStorageRepository } from '../services/storage/ProjectStorageRepository';
import { syncProjectFromStorage } from '../services/workspace/workspaceSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';

/**
 * Keeps Redux workspace state in sync with localStorage.
 *
 * Editors like GrapesJS and the Quantum circuit editor write directly to
 * localStorage via ProjectStorageRepository for performance. This hook
 * subscribes to ProjectStorageRepository's change notifications and
 * dispatches a lightweight Redux action to pull the fresh project data
 * into the store — so every consumer of `useAppSelector(selectProject)`
 * always sees the latest state.
 *
 * Infinite-loop prevention:
 * - `syncProjectFromStorage` is a plain reducer that does NOT write back
 *   to localStorage, so it cannot re-trigger the listener.
 * - A revision counter comparison skips dispatches when the store is
 *   already up to date (e.g. when the write came from a Redux thunk
 *   that already updated the store).
 */
export function useStorageSync(): void {
  const dispatch = useAppDispatch();
  const currentProjectId = useAppSelector((s) => s.workspace.project?.id);

  // Track the last revision we synced so we skip no-op dispatches.
  const lastSyncedRevisionRef = useRef(ProjectStorageRepository.revision);

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
}
