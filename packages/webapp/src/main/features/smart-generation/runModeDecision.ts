/**
 * Pure decision helper for incremental vibe-modify.
 *
 * Given the previously recorded successful run for the current project
 * (if any) and the backend's download-TTL window, decides whether a new
 * run should:
 *   - edit that run's app IN PLACE (`mode:'modify'` + `baseRunId`), or
 *   - rebuild from scratch (`mode:'generate'`).
 *
 * Extracted as a side-effect-free function so the branching logic is
 * unit-testable in isolation from the React hook, Redux, and the SSE
 * client (see `__tests__/runModeDecision.test.ts`).
 */

import type { SmartGenMode } from './types';

/** Canonical backend run id: `uuid.uuid4().hex` → 32 lowercase hex chars. */
const RUN_ID_RE = /^[a-f0-9]{32}$/i;

/** Narrow an arbitrary value to a valid 32-hex run id. */
export function isValidRunId(value: unknown): value is string {
  return typeof value === 'string' && RUN_ID_RE.test(value);
}

/** A previously recorded successful run for a project. */
export interface LastRunRecord {
  runId: string;
  /** Epoch ms at which the run completed. */
  at: number;
}

export interface RunModeDecision {
  mode: SmartGenMode;
  /** Present ONLY when `mode === 'modify'`. */
  baseRunId?: string;
}

export interface DecideRunModeParams {
  /** The stored last-run for the current project, or null when none. */
  lastRun: LastRunRecord | null | undefined;
  /** Current time in epoch ms (injected for deterministic tests). */
  nowMs: number;
  /** Backend download-TTL window in seconds (the modify window). */
  ttlSeconds: number;
  /** Explicit `mode` from the trigger payload, if the agent forced one. */
  explicitMode?: string;
  /** Explicit `baseRunId` from the trigger payload, if provided. */
  explicitBaseRunId?: string;
}

/**
 * Decide modify-vs-fresh.
 *
 * Priority:
 *   1. An explicit `mode` on the trigger payload wins over the heuristic
 *      (the agent knows something the frontend doesn't). A forced
 *      `modify` still needs a valid base run id — the explicit one, else
 *      the stored one; with neither it degrades to a fresh `generate`
 *      rather than sending an invalid request.
 *   2. Otherwise, automatically `modify` the stored last run when it is a
 *      valid run id AND still within the backend's download-TTL window
 *      (after the TTL the backend has garbage-collected the temp dir /
 *      zip it would edit in place, so a rebuild is the only option).
 *   3. Fall back to a fresh `generate`.
 */
export function decideRunMode(params: DecideRunModeParams): RunModeDecision {
  const { lastRun, nowMs, ttlSeconds, explicitMode, explicitBaseRunId } = params;

  const storedRunId =
    lastRun && isValidRunId(lastRun.runId) ? lastRun.runId : undefined;
  const explicitBase = isValidRunId(explicitBaseRunId)
    ? explicitBaseRunId
    : undefined;

  // 1. Explicit override from the trigger payload.
  if (explicitMode === 'generate') {
    return { mode: 'generate' };
  }
  if (explicitMode === 'modify') {
    const baseRunId = explicitBase ?? storedRunId;
    return baseRunId ? { mode: 'modify', baseRunId } : { mode: 'generate' };
  }

  // 2. Automatic heuristic — modify only within a fresh, valid window.
  const withinTtl =
    !!lastRun &&
    Number.isFinite(lastRun.at) &&
    Number.isFinite(ttlSeconds) &&
    nowMs - lastRun.at < ttlSeconds * 1000;

  if (storedRunId && withinTtl) {
    return { mode: 'modify', baseRunId: storedRunId };
  }

  // 3. Fresh build.
  return { mode: 'generate' };
}
