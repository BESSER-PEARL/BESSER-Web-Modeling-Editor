/**
 * Runs whose output the server no longer holds, learned in this tab from a
 * download, a file view or a push that came back "unknown or expired". The run
 * card reads it to stop offering actions that cannot work.
 */

import { useSyncExternalStore } from 'react';

import { ApiError } from '../api/api-client';

const expiredRunIds = new Set<string>();
const listeners = new Set<() => void>();

/** The backend answers 404 for a run id it no longer (or never) held. */
export function isExpiredRunError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 404 || error.status === 410);
}

export function markSpecDrivenRunExpired(runId: string): void {
  if (expiredRunIds.has(runId)) return;
  expiredRunIds.add(runId);
  listeners.forEach((listener) => listener());
}

export function isSpecDrivenRunExpired(runId: string): boolean {
  return expiredRunIds.has(runId);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSpecDrivenRunExpired(runId: string | undefined): boolean {
  return useSyncExternalStore(subscribe, () => (runId ? expiredRunIds.has(runId) : false));
}
