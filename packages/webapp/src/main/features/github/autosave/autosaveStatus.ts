/**
 * Each project's autosave status, for whatever shows it: the hook that runs
 * autosave (in the GitHub menu) writes it, the menu and the project settings
 * read it.
 */
import { useCallback, useSyncExternalStore } from 'react';
import type { AutosaveStatus } from './GitHubAutosaveController';

const OFF: AutosaveStatus = { phase: 'off' };
const statuses = new Map<string, AutosaveStatus>();
const listeners = new Set<() => void>();

export function setAutosaveStatus(projectId: string, status: AutosaveStatus): void {
  statuses.set(projectId, status);
  listeners.forEach((listener) => listener());
}

export const getAutosaveStatus = (projectId: string | null | undefined): AutosaveStatus =>
  (projectId ? statuses.get(projectId) : undefined) ?? OFF;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useAutosaveStatus(projectId: string | null | undefined): AutosaveStatus {
  const read = useCallback(() => getAutosaveStatus(projectId), [projectId]);
  return useSyncExternalStore(subscribe, read);
}
