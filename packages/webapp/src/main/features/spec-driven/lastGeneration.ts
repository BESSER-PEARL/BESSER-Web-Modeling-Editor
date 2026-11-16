/** The project's last Spec-Driven run as this browser knows it, for the modeling agent's context. */

import { FALLBACK_SMART_GEN_CONFIG, peekSpecDrivenConfig } from '../../shared/services/specDrivenConfig';
import { readProjectLastRun } from '../../shared/services/storage/specDrivenRunRecords';
import { isWithinTtl } from './runModeDecision';

/** The `lastGeneration` field the editor sends to the modeling agent. */
export interface LastGeneration {
  runId: string;
  /** Epoch ms at which the run finished. */
  at: number;
  /** The server no longer holds the run's output (past the download lifetime). */
  expired: boolean;
  /** The user's request the run was started with, when recorded. */
  request?: string;
}

export function readLastGeneration(projectId: string | undefined, nowMs: number = Date.now()): LastGeneration | undefined {
  const last = projectId ? readProjectLastRun(projectId) : null;
  if (!last) return undefined;
  const ttlSeconds =
    peekSpecDrivenConfig()?.download_ttl_seconds || FALLBACK_SMART_GEN_CONFIG.download_ttl_seconds;
  return {
    runId: last.runId,
    at: last.at,
    expired: !isWithinTtl(last, nowMs, ttlSeconds),
    ...(last.request ? { request: last.request } : {}),
  };
}
