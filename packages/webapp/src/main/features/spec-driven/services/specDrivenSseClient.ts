/**
 * Thin Smart Generator client over the shared `streamSse` utility.
 *
 * Owns the request shape and the `AbortController`; yields typed
 * `SpecDrivenEvent` objects. The caller (typically `useSpecDrivenTrigger`)
 * handles state updates and chat-message injection.
 */

import { SMART_GEN_ENDPOINT } from '../../../shared/constants/constant';
import { streamSse } from '../../../shared/services/sse/sseClient';
import type {
  SpecDrivenEvent,
  SpecDrivenMode,
  SpecDrivenPrimaryKind,
  SpecDrivenProvider,
} from '../types';

export interface StartSpecDrivenRunParams {
  /** The full BesserProject payload (same shape as /generate-output-from-project). */
  project: unknown;
  instructions: string;
  provider: SpecDrivenProvider;
  apiKey: string;
  llmModel?: string;
  /** OpenAI-compatible base URL for the 'pia'/'local' providers. */
  baseUrl?: string;
  maxCostUsd?: number;
  maxRuntimeSeconds?: number;
  /**
   * Incremental vibe-modify: when `mode === 'modify'`, the backend edits
   * the app produced by `baseRunId` in place instead of rebuilding.
   * `baseRunId` is a 32-hex run id from a previous successful run.
   * Serialised as `base_run_id` / `mode` to match the backend contract.
   */
  baseRunId?: string;
  mode?: SpecDrivenMode;
  primaryKindOverride?: SpecDrivenPrimaryKind;
  targetGeneratorOverride?: string;
  /** Explicit approved-plan choice to bypass the deterministic Phase-1 generator. */
  skipDeterministicGenerator?: boolean;
}

export interface SpecDrivenRunHandle {
  /** The event stream — each iteration yields one parsed SpecDrivenEvent. */
  events: AsyncGenerator<SpecDrivenEvent, void, void>;
  /** Abort the run (cancels fetch + reader). */
  abort: () => void;
  /** Underlying AbortController for advanced consumers. */
  controller: AbortController;
}

/**
 * Start a spec-driven run and return a handle whose `events`
 * async generator yields parsed SSE events. The caller is responsible
 * for iterating and dispatching.
 *
 * The API key travels only in the POST body. It is never added to the
 * URL, headers, or any Redux state.
 */
export function startSpecDrivenRun(
  params: StartSpecDrivenRunParams,
): SpecDrivenRunHandle {
  const controller = new AbortController();

  // 'pia' / 'local' are OpenAI-compatible endpoints: send them to the backend
  // as provider='openai' + base_url so the server builds an OpenAI client
  // pointed at the gateway / local server.
  const usesBaseUrl = params.provider === 'pia' || params.provider === 'local';
  const wireProvider = usesBaseUrl ? 'openai' : params.provider;

  // The keyless free tier sends provider='free' and MUST NOT carry an api_key
  // or a base_url — the server injects the hosted endpoint + token + model.
  const isFree = params.provider === 'free';

  const body: Record<string, unknown> = {
    project: params.project,
    instructions: params.instructions,
    provider: wireProvider,
  };
  if (!isFree) body.api_key = params.apiKey;
  if (!isFree && usesBaseUrl && params.baseUrl) body.base_url = params.baseUrl;
  // Free tier's model is pinned server-side; never send a client model for it.
  if (!isFree && params.llmModel) body.llm_model = params.llmModel;
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

  const events = streamSse<SpecDrivenEvent>(SMART_GEN_ENDPOINT, body, {
    signal: controller.signal,
  });

  return {
    events,
    abort: () => controller.abort(),
    controller,
  };
}
