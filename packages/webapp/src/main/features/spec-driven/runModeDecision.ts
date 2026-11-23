/**
 * Decision helpers for incremental modify.
 *
 * Given the previously recorded successful run for the current project
 * (if any) and whether the backend can still edit it, decides whether a new
 * run should:
 *   - edit that run's app IN PLACE (`mode:'modify'` + `baseRunId`), or
 *   - rebuild from scratch (`mode:'generate'`).
 *
 * `decideRunMode` is side-effect-free; `resolveRunMode` adds the pre-run
 * model check and the user's answer. Both are unit-testable in isolation
 * from the React hook, Redux, and the SSE client (see
 * `__tests__/runModeDecision.test.ts`).
 */

import { globalConfirm } from '../../shared/services/confirm/globalConfirm';
import { checkModifyBase, modelChangeQuestion } from './services/modelChange';
import type { ModelChange } from './services/modelChange';
import type { SpecDrivenMode } from './types';
import { isValidRunId, type LastRunRecord } from '../../shared/services/storage/specDrivenRunRecords';

export { isValidRunId, type LastRunRecord };

export interface RunModeDecision {
  mode: SpecDrivenMode;
  /** Present ONLY when `mode === 'modify'`. */
  baseRunId?: string;
  /**
   * Set on an automatic modify whose model changed a lot or is another
   * app: ask "update the existing app / start fresh" before running.
   */
  askUser?: 'large' | 'unrelated';
  /**
   * Set on an automatic fresh build because the backend can no longer edit
   * the project's last run: the app is rebuilt, not edited in place.
   */
  baseExpired?: boolean;
}

export interface DecideRunModeParams {
  /** The stored last-run for the current project, or null when none. */
  lastRun: LastRunRecord | null | undefined;
  /** Current time in epoch ms (injected for deterministic tests). */
  nowMs: number;
  /** How long the backend keeps a run's workspace, in seconds: the modify window when it has not said whether the base can be edited. */
  ttlSeconds: number;
  /** How long the backend may still be able to edit a run (its download lifetime); the backend is asked within it. Defaults to `ttlSeconds`. */
  baseTtlSeconds?: number;
  /** Explicit `mode` from the trigger payload, if the agent forced one. */
  explicitMode?: string;
  /** Explicit `baseRunId` from the trigger payload, if provided. */
  explicitBaseRunId?: string;
  /** The base run's model vs the current one; absent when unknown. */
  modelChange?: ModelChange | null;
  /** The backend's answer to whether it can still edit the stored run; absent when it did not say. */
  baseAvailable?: boolean;
}

/** True while `lastRun` is younger than `ttlSeconds`. */
export function isWithinTtl(lastRun: LastRunRecord | null | undefined, nowMs: number, ttlSeconds: number): boolean {
  return !!lastRun && Number.isFinite(lastRun.at) && Number.isFinite(ttlSeconds) && nowMs - lastRun.at < ttlSeconds * 1000;
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
 *      valid run id AND the backend says it can still edit it; when the
 *      backend did not say, while it is within the workspace TTL.
 *      When the model changed a lot or is another app, `askUser` asks
 *      the caller to let the user choose; an unknown change modifies.
 *   3. Fall back to a fresh `generate`.
 */
export function decideRunMode(params: DecideRunModeParams): RunModeDecision {
  const { lastRun, nowMs, ttlSeconds, explicitMode, explicitBaseRunId, modelChange, baseAvailable } = params;

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

  // 2. Automatic: modify only a base the backend can still edit.
  if (storedRunId && (baseAvailable ?? isWithinTtl(lastRun, nowMs, ttlSeconds))) {
    // Never start fresh on our own: the base app may carry custom work.
    const verdict = modelChange?.verdict;
    if (verdict === 'large' || verdict === 'unrelated') {
      return { mode: 'modify', baseRunId: storedRunId, askUser: verdict };
    }
    return { mode: 'modify', baseRunId: storedRunId };
  }

  // 3. Fresh build, said so when it replaces an expired base.
  return storedRunId ? { mode: 'generate', baseExpired: true } : { mode: 'generate' };
}

/**
 * The run mode, with the backend's and the user's say. Without an explicit
 * mode, a stored run within `baseTtlSeconds` is first checked with the
 * backend: whether it can still edit that run, and how far the model moved
 * from the base app's. On a large change or another app the user picks
 * "Start fresh" (generate) or "Update the existing app" (modify, also on
 * dismiss). Null when `signal` aborts during the check or the question.
 */
export async function resolveRunMode(
  params: DecideRunModeParams,
  check: { project: unknown; instructions: string; signal: AbortSignal },
): Promise<RunModeDecision | null> {
  const decision = decideRunMode(params);
  const { lastRun, nowMs, ttlSeconds, baseTtlSeconds, explicitMode } = params;
  if (explicitMode || !lastRun || !isValidRunId(lastRun.runId)
    || !isWithinTtl(lastRun, nowMs, baseTtlSeconds ?? ttlSeconds)) {
    return decision;
  }
  const base = await checkModifyBase(check.project, check.instructions, lastRun.runId, check.signal);
  if (check.signal.aborted) return null;
  const modelChange = base?.modelChange;
  const checked = decideRunMode({ ...params, modelChange, baseAvailable: base?.baseAvailable });
  if (!checked.askUser || !modelChange) return checked;
  const startFresh = await globalConfirm({
    ...modelChangeQuestion(checked.askUser, modelChange),
    signal: check.signal,
  });
  if (check.signal.aborted) return null;
  return startFresh ? { mode: 'generate' } : checked;
}
