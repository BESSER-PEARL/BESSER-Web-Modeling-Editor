/**
 * Spec-Driven Agent browser storage: the per-project last run and the durable
 * run pointer (localStorage), and run ownership across tabs. The BYOK key, run
 * budget and free-tier opt-in live in `shared/services/llmKeyStorage`.
 */

import {
  localStorageSpecDrivenActiveRunV1,
  localStorageSpecDrivenActiveRunV2Prefix,
} from '../../shared/constants/constant';
import { isValidRunId } from './runModeDecision';

/* ------------------------------------------------------------------ */
/*  Per-project last successful run (incremental modify)                */
/*                                                                      */
/*  Unlike the BYOK key/budget (sessionStorage, tab-lifetime),          */
/*  the last-run pointer lives in LOCALSTORAGE so a follow-up "add      */
/*  feature X" can still edit the previous app in place after a reload. */
/*  It is not a secret — just a run id + timestamp keyed by project.    */
/* ------------------------------------------------------------------ */

/** True when localStorage is reachable (it's not in some privacy modes). */
function _hasLocalStorage(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  } catch {
    return false;
  }
}

// The last successful run lives in shared/ so the GitHub feature can record one too.
export { readProjectLastRun, writeProjectLastRun } from '../../shared/services/storage/specDrivenRunRecords';

/* ------------------------------------------------------------------ */
/*  Active durable run pointer (reload/reattach)                       */
/* ------------------------------------------------------------------ */

export interface ActiveSpecDrivenRunV1 {
  version: 1;
  runId: string;
  projectId: string;
  lastSequence: number;
  startedAt: number;
}

export interface ActiveSpecDrivenRunV2 {
  version: 2;
  runId: string;
  projectId: string;
  lastSequence: number;
  startedAt: number;
}

export type ActiveSpecDrivenRun = ActiveSpecDrivenRunV1 | ActiveSpecDrivenRunV2;

function _parseActiveSpecDrivenRun(
  raw: string | null,
  expectedVersion: 1 | 2,
): ActiveSpecDrivenRun | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ActiveSpecDrivenRun> | null;
    if (
      !parsed ||
      parsed.version !== expectedVersion ||
      !isValidRunId(parsed.runId) ||
      typeof parsed.projectId !== 'string' ||
      !parsed.projectId ||
      parsed.projectId.length > 256 ||
      typeof parsed.lastSequence !== 'number' ||
      !Number.isFinite(parsed.lastSequence) ||
      parsed.lastSequence < 0 ||
      typeof parsed.startedAt !== 'number' ||
      !Number.isFinite(parsed.startedAt) ||
      parsed.startedAt <= 0
    ) {
      return null;
    }
    return {
      version: expectedVersion,
      runId: parsed.runId,
      projectId: parsed.projectId,
      lastSequence: Math.trunc(parsed.lastSequence),
      startedAt: parsed.startedAt,
    } as ActiveSpecDrivenRun;
  } catch {
    return null;
  }
}

export function readActiveSpecDrivenRun(
  projectId?: string,
): ActiveSpecDrivenRun | null {
  if (!_hasLocalStorage()) return null;
  try {
    const candidates: ActiveSpecDrivenRun[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key?.startsWith(localStorageSpecDrivenActiveRunV2Prefix)) continue;
      const record = _parseActiveSpecDrivenRun(
        window.localStorage.getItem(key),
        2,
      );
      if (record && (!projectId || record.projectId === projectId)) {
        candidates.push(record);
      }
    }
    if (candidates.length > 0) {
      return candidates.sort((left, right) => right.startedAt - left.startedAt)[0];
    }

    // Backward-compatible one-release migration path for v1 pointers.
    const legacy = _parseActiveSpecDrivenRun(
      window.localStorage.getItem(localStorageSpecDrivenActiveRunV1),
      1,
    );
    return legacy && (!projectId || legacy.projectId === projectId) ? legacy : null;
  } catch {
    return null;
  }
}

/** Persist only the cursor required to reattach; never persist the request/key. */
export function writeActiveSpecDrivenRun(
  record: Omit<ActiveSpecDrivenRunV2, 'version'>,
): void {
  if (
    !_hasLocalStorage() ||
    !isValidRunId(record.runId) ||
    !record.projectId ||
    !Number.isFinite(record.lastSequence) ||
    record.lastSequence < 0
  ) {
    return;
  }
  try {
    window.localStorage.setItem(
      `${localStorageSpecDrivenActiveRunV2Prefix}${record.runId}`,
      JSON.stringify({
        version: 2,
        runId: record.runId,
        projectId: record.projectId.slice(0, 256),
        lastSequence: Math.trunc(record.lastSequence),
        startedAt: record.startedAt,
      } satisfies ActiveSpecDrivenRunV2),
    );
    const legacy = _parseActiveSpecDrivenRun(
      window.localStorage.getItem(localStorageSpecDrivenActiveRunV1),
      1,
    );
    if (legacy?.runId === record.runId) {
      window.localStorage.removeItem(localStorageSpecDrivenActiveRunV1);
    }
  } catch {
    /* storage may be unavailable/full in privacy modes */
  }
}

/** Clear only the expected run so an old terminal callback cannot erase a newer one. */
export function clearActiveSpecDrivenRun(expectedRunId?: string): void {
  // No id (a run stopped before the server named it) has nothing to clear;
  // wiping every pointer would drop other tabs' live runs.
  if (!expectedRunId || !_hasLocalStorage()) return;
  try {
    window.localStorage.removeItem(
      `${localStorageSpecDrivenActiveRunV2Prefix}${expectedRunId}`,
    );
    const legacy = _parseActiveSpecDrivenRun(
      window.localStorage.getItem(localStorageSpecDrivenActiveRunV1),
      1,
    );
    if (legacy?.runId === expectedRunId) {
      window.localStorage.removeItem(localStorageSpecDrivenActiveRunV1);
    }
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/*  Run ownership across tabs                                          */
/* ------------------------------------------------------------------ */

// The active-run pointer lives in localStorage, which every tab of the
// origin shares, so without an owner marker a second tab would adopt (and
// could cancel) a run the first tab is still driving. The owning tab holds
// a Web Lock for the run's lifetime; the browser drops it when that tab
// closes or reloads, which is exactly when adopting the run is right.
const _runLockName = (runId: string) => `besser_spec_driven_run_${runId}`;

type _LockManager = {
  request: (
    name: string,
    options: { ifAvailable?: boolean },
    callback: (lock: unknown) => Promise<void> | void,
  ) => Promise<unknown>;
};

function _lockManager(): _LockManager | null {
  const locks = (globalThis.navigator as { locks?: _LockManager } | undefined)?.locks;
  return locks && typeof locks.request === 'function' ? locks : null;
}

/**
 * Claim ownership of `runId` for this tab. Resolves to a release function,
 * or `null` when another live tab already owns the run. Without Web Locks
 * support every tab may adopt (the pre-lock behaviour).
 */
export function claimSpecDrivenRunOwnership(
  runId: string,
  opts: { ifAvailable?: boolean } = {},
): Promise<(() => void) | null> {
  const locks = _lockManager();
  const noop = () => {};
  if (!locks) return Promise.resolve(noop);
  return new Promise((resolve) => {
    let release: () => void = noop;
    const held = new Promise<void>((done) => {
      release = done;
    });
    locks
      .request(_runLockName(runId), { ifAvailable: opts.ifAvailable ?? false }, (lock) => {
        if (!lock) {
          resolve(null);
          return;
        }
        resolve(release);
        return held;
      })
      .catch(() => resolve(noop));
  });
}
