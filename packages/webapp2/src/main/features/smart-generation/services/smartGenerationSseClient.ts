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

  const events = streamSse<SmartGenEvent>(SMART_GEN_ENDPOINT, body, {
    signal: controller.signal,
  });

  return {
    events,
    abort: () => controller.abort(),
    controller,
  };
}
