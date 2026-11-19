/**
 * Project traces as editors before the IndexedDB trace store kept them: one `localStorage` entry per
 * project. `shared/traceability/traceStore.ts` moves an entry over when it first reads the project's
 * trace, and removes it with the project. Unreadable storage reads as no entry.
 */
import { localStorageLegacyTracePrefix } from '../../constants/constant';

const keyOf = (projectId: string): string => `${localStorageLegacyTracePrefix}${projectId}`;

/** The project's trace as stored before IndexedDB (JSON), or null when there is none. */
export function readLegacyTrace(projectId: string): string | null {
  try {
    return localStorage.getItem(keyOf(projectId));
  } catch {
    return null; // storage disabled: nothing to move over
  }
}

export function removeLegacyTrace(projectId: string): void {
  try {
    localStorage.removeItem(keyOf(projectId));
  } catch {
    // storage disabled: nothing stored
  }
}
