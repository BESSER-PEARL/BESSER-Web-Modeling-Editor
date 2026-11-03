import {
  errorProperties,
  track,
  type SpecRunProperties,
  type SpecRunStage,
  type SpecRunTier,
} from '../../shared/services/analytics/events';
import type { SpecDrivenRunResult } from './hooks/useSpecDrivenTrigger';

/** The run being tracked: its set-up properties and when it began (`Date.now()`). */
export interface RunAnalytics {
  properties: SpecRunProperties;
  startedAt: number;
}

/** What a terminal path knows beyond the run result. */
export interface RunFinishDetails {
  stage?: SpecRunStage;
  error?: unknown;
  /** Set by the server's CANCELLED event: `abandoned` = stopped after the client disconnected. */
  cancelReason?: 'user' | 'abandoned';
  eventsReceived?: number;
  /** From the `done` event. */
  stats?: { fileCount?: number; changedFileCount?: number; tokensUsed?: number; isZip?: boolean };
}

/** Providers whose model id is free text the user typed, not a catalog id. */
const FREE_TEXT_MODEL_PROVIDERS = new Set(['local']);

export function runProperties(input: {
  tier: SpecRunTier;
  provider: string;
  llmModel?: string;
  runMode?: 'generate' | 'modify';
  explicitMode: boolean;
  maxCostUsd?: number;
  maxRuntimeSeconds?: number;
  targetGenerator?: string;
  primaryKind?: string;
  skipDeterministic?: boolean;
  reattached?: boolean;
}): SpecRunProperties {
  return {
    run_mode: input.runMode,
    tier: input.tier,
    provider: input.provider,
    llm_model: FREE_TEXT_MODEL_PROVIDERS.has(input.provider) ? undefined : input.llmModel,
    explicit_mode: input.explicitMode,
    has_budget: input.maxCostUsd !== undefined || input.maxRuntimeSeconds !== undefined,
    max_cost_usd: input.maxCostUsd,
    max_runtime_s: input.maxRuntimeSeconds,
    target_generator: input.targetGenerator,
    primary_kind: input.primaryKind,
    skip_deterministic: input.skipDeterministic === true,
    reattached: input.reattached === true,
  };
}

/** Send the one terminal event of a run: completed, cancelled or failed. */
export function trackRunFinished(
  run: RunAnalytics | null,
  result: SpecDrivenRunResult,
  details: RunFinishDetails = {},
): void {
  if (!run) return;
  const base = {
    ...run.properties,
    duration_ms: Math.max(0, Date.now() - run.startedAt),
    cost_usd: result.costUsd,
  };
  if (result.ok) {
    const unenforced = result.verificationCounts?.shippedUnenforced ?? 0;
    track('spec_run_completed', {
      ...base,
      outcome: result.incomplete ? 'incomplete' : unenforced > 0 ? 'unenforced' : 'success',
      generator_used: result.generatorUsed,
      file_count: details.stats?.fileCount,
      changed_file_count: details.stats?.changedFileCount,
      tokens_used: details.stats?.tokensUsed,
      is_zip: details.stats?.isZip,
      blocker_count: result.blockerCount ?? 0,
      verified: result.verificationCounts?.verified,
      not_verified: result.verificationCounts?.notVerified,
      shipped_unenforced: result.verificationCounts?.shippedUnenforced,
    });
    return;
  }
  const stage = details.stage ?? 'server';
  if (result.errorCode === 'CANCELLED') {
    track('spec_run_cancelled', { ...base, reason: details.cancelReason ?? 'user', stage });
    return;
  }
  track('spec_run_failed', {
    ...base,
    ...(details.error !== undefined ? errorProperties(details.error) : {}),
    error_code: result.errorCode ?? 'INTERNAL',
    stage,
    events_received: details.eventsReceived,
  });
}
