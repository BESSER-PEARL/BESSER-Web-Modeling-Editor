/**
 * Thin Smart Generator client over the shared `streamSse` utility.
 *
 * Owns the request shape and the `AbortController`; yields typed
 * `SmartGenEvent` objects. The caller (typically `useSmartGenTrigger`)
 * handles state updates and chat-message injection.
 */

import { SMART_GEN_ENDPOINT } from '../../../shared/constants/constant';
import { streamSse } from '../../../shared/services/sse/sseClient';
import type {
  SmartGenEvent,
  SmartGenMode,
  SmartGenPrimaryKind,
  SmartGenProvider,
} from '../types';

export interface StartSmartGenRunParams {
  /** The full BesserProject payload (same shape as /generate-output-from-project). */
  project: unknown;
  instructions: string;
  provider: SmartGenProvider;
  apiKey: string;
  llmModel?: string;
  maxCostUsd?: number;
  maxRuntimeSeconds?: number;
  /**
   * Incremental vibe-modify: when `mode === 'modify'`, the backend edits
   * the app produced by `baseRunId` in place instead of rebuilding.
   * `baseRunId` is a 32-hex run id from a previous successful run.
   * Serialised as `base_run_id` / `mode` to match the backend contract.
   */
  baseRunId?: string;
  mode?: SmartGenMode;
  primaryKindOverride?: SmartGenPrimaryKind;
  targetGeneratorOverride?: string;
  /** Explicit approved-plan choice to bypass the deterministic Phase-1 generator. */
  skipDeterministicGenerator?: boolean;
}

export interface SmartGenRunHandle {
  /** The event stream — each iteration yields one parsed SmartGenEvent. */
  events: AsyncGenerator<SmartGenEvent, void, void>;
  /** Abort the run (cancels fetch + reader). */
  abort: () => void;
  /** Underlying AbortController for advanced consumers. */
  controller: AbortController;
}

/**
 * Start a smart-generation run and return a handle whose `events`
 * async generator yields parsed SSE events. The caller is responsible
 * for iterating and dispatching.
 *
 * The API key travels only in the POST body. It is never added to the
 * URL, headers, or any Redux state.
 */
export function startSmartGenRun(
  params: StartSmartGenRunParams,
): SmartGenRunHandle {
  const controller = new AbortController();

  const body: Record<string, unknown> = {
    project: params.project,
    instructions: params.instructions,
    api_key: params.apiKey,
    provider: params.provider,
  };
  if (params.llmModel) body.llm_model = params.llmModel;
  if (typeof params.maxCostUsd === 'number') body.max_cost_usd = params.maxCostUsd;
  if (typeof params.maxRuntimeSeconds === 'number') {
    body.max_runtime_seconds = params.maxRuntimeSeconds;
  }
  // Incremental vibe-modify — serialise as the backend's snake_case fields.
  // `mode` defaults to 'generate' server-side, so only send it when set;
  // `base_run_id` only travels with a 'modify' run.
  if (params.mode) body.mode = params.mode;
  if (params.baseRunId) body.base_run_id = params.baseRunId;
  if (params.primaryKindOverride) {
    body.primary_kind_override = params.primaryKindOverride;
  }
  if (params.targetGeneratorOverride) {
    body.target_generator_override = params.targetGeneratorOverride;
  }
  if (params.skipDeterministicGenerator === true) {
    body.skip_deterministic_generator = true;
  }

  const events = streamSse<SmartGenEvent>(SMART_GEN_ENDPOINT, body, {
    signal: controller.signal,
  });

  return {
    events,
    abort: () => controller.abort(),
    controller,
  };
}
