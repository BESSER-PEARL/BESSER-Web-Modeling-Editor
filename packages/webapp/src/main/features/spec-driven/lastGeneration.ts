/** The project's last Spec-Driven run as this browser knows it, for the modeling agent's context. */

import { archiveTtlSeconds, peekServerSpecDrivenConfig } from '../../shared/services/specDrivenConfig';
import { readProjectLastRun, readProjectRunRequest } from '../../shared/services/storage/specDrivenRunRecords';
import { isWithinTtl } from './runModeDecision';

/**
 * The `lastGeneration` field the editor sends to the modeling agent. The run
 * fields describe the project's last finished run (the base of a modify run);
 * `request` is what its latest run was started with, kept even when that run
 * failed or was stopped, so it can come without them.
 */
export interface LastGeneration {
  runId?: string;
  /** Epoch ms at which the run finished. */
  at?: number;
  /**
   * The server no longer holds the run's download, from which it edits the
   * run: the next run starts from scratch. Absent while the server's lifetime
   * is unknown.
   */
  expired?: boolean;
  /** The user's own words the project's latest run was started with. */
  request?: string;
}

export function readLastGeneration(projectId: string | undefined, nowMs: number = Date.now()): LastGeneration | undefined {
  if (!projectId) return undefined;
  const last = readProjectLastRun(projectId);
  const request = readProjectRunRequest(projectId);
  if (!last && !request) return undefined;
  const config = peekServerSpecDrivenConfig();
  return {
    ...(last ? { runId: last.runId, at: last.at } : {}),
    ...(last && config ? { expired: !isWithinTtl(last, nowMs, archiveTtlSeconds(config)) } : {}),
    ...(request ? { request } : {}),
  };
}
