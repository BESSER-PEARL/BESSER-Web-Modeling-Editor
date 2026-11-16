import { useSyncExternalStore } from 'react';

/**
 * Why a project's stored trace could not be loaded, for the Traceability page's error state. The store
 * still starts a new trace for the session (recording goes on); this only lets the page say that what is
 * shown is not what was stored. `traceStore` reports a problem where it falls back to an empty trace.
 *
 * - `storageUnavailable`: the browser's trace storage (IndexedDB) could not be opened or read.
 * - `unusable`: the stored trace was found but could not be read (corrupt, or a newer schema).
 */
export type TraceLoadProblem = 'storageUnavailable' | 'unusable';

const problems = new Map<string, TraceLoadProblem>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

export function reportTraceLoadProblem(projectId: string, problem: TraceLoadProblem): void {
  problems.set(projectId, problem);
  notify();
}

/** Forget a project's problem (its trace was cleared or replaced). */
export function clearTraceLoadProblem(projectId: string): void {
  if (problems.delete(projectId)) notify();
}

export function traceLoadProblem(projectId: string | undefined): TraceLoadProblem | null {
  return (projectId && problems.get(projectId)) || null;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The project's load problem, re-rendering when it changes; null when its trace loaded (or is loading). */
export function useTraceLoadProblem(projectId: string | undefined): TraceLoadProblem | null {
  return useSyncExternalStore(subscribe, () => traceLoadProblem(projectId));
}
