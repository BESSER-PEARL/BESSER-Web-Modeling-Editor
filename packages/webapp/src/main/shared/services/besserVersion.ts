/**
 * The BESSER version the backend runs, as reported by `GET /besser_api/`.
 *
 * Fetched once per page load and cached; used to stamp JSON exports. When the
 * backend is unreachable the version stays unknown and exports omit it, rather
 * than guess.
 */

import { apiClient } from '../api/api-client';

const TIMEOUT_MS = 3000;

let cached: string | undefined;
let pending: Promise<string | undefined> | null = null;

/** The version from an earlier successful load, if any. */
export function getCachedBesserVersion(): string | undefined {
  return cached;
}

/** Resolve the backend's BESSER version. Never rejects; a failure resolves `undefined` and allows a retry. */
export function loadBesserVersion(): Promise<string | undefined> {
  if (cached) return Promise.resolve(cached);
  if (!pending) {
    pending = (async () => {
      try {
        const body = await apiClient.get<{ besser_version?: unknown }>('/', { timeout: TIMEOUT_MS });
        const version = body?.besser_version;
        if (typeof version === 'string' && version && version !== 'unknown') cached = version;
        return cached;
      } catch {
        return undefined;
      } finally {
        pending = null;
      }
    })();
  }
  return pending;
}

/** Test-only: forget the cached version. */
export function _resetBesserVersionCacheForTests(): void {
  cached = undefined;
  pending = null;
}
