/**
 * Thin Smart Generator client over the shared `streamSse` utility.
 *
 * Owns the request shape and the `AbortController`; yields typed
 * `SpecDrivenEvent` objects. The caller (typically `useSpecDrivenTrigger`)
 * handles state updates and chat-message injection.
 */

import {
  SMART_GEN_ENDPOINT,
  specDrivenRunEventsUrl,
} from '../../../shared/constants/constant';
import {
  SseHttpError,
  streamSse,
} from '../../../shared/services/sse/sseClient';

/**
 * Liveness bound for the run stream. The backend's cost emitter puts a
 * `cost` tick on the stream every ~2s (`cost_emitter_interval_seconds` in
 * `GET /spec-driven/config`) for the ENTIRE run, so a healthy stream is
 * never silent for more than a few seconds. 60s of TOTAL silence (~30
 * missed ticks) therefore means the transport died mid-response — a
 * condition a streaming `fetch` otherwise never surfaces: `reader.read()`
 * just stays pending forever and the run card freezes with no error.
 * Observed in production via a browser↔edge path that stopped forwarding
 * after the first flush while the same origin streamed perfectly over a
 * direct connection. On stall the stream throws `SseStallError`, which
 * `useSpecDrivenTrigger` converts into an honest terminal error card.
 */
export const SPEC_DRIVEN_STREAM_STALL_TIMEOUT_MS = 60_000;
/**
 * Reconnect budget.
 *
 * This used to be 4 attempts over ~11s, which is shorter than the outage it
 * has to survive. A corporate proxy (Netskope on LIST laptops) inserting
 * itself into the session tears down the open stream AND blackholes new
 * connections for a minute or more; all four attempts landed inside that
 * window, so the UI reported "Failed to fetch" and abandoned a run that was
 * still generating happily on the server. Reloading the page hit the same
 * budget on the reattach path and failed the same way (2026-09-16).
 *
 * The run itself survives on the server for far longer than this, so the
 * client should be patient: ~2.5 minutes of backoff, and any wake signal
 * (tab focus, or the browser coming back online) both retries IMMEDIATELY
 * and refreshes the budget — so returning to the tab always reattaches
 * rather than showing a dead error.
 */
export const SPEC_DRIVEN_MAX_RECONNECT_ATTEMPTS = 8;
const RECONNECT_BACKOFF_MS = [0, 1_000, 3_000, 7_000, 15_000, 30_000, 30_000, 60_000] as const;

/**
 * After the automatic budget is spent, keep the run rescuable for this long:
 * a wake signal inside the window restarts the whole budget. Runs are capped
 * server-side at 20 minutes, so waiting a few of them costs nothing and means
 * "come back to the tab" is always the answer to a dead-looking card.
 */
const POST_BUDGET_WAKE_WINDOW_MS = 10 * 60_000;
import {
  getOrCreateAssistantSessionId,
  getPilotParticipant,
} from '../../../shared/services/telemetry/pilotTelemetry';
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
  /** Called as soon as the backend accepts the run, before body event #1. */
  onRunAccepted?: (runId: string) => void;
}

export interface SpecDrivenRunHandle {
  /** The event stream — each iteration yields one parsed SpecDrivenEvent. */
  events: AsyncGenerator<SpecDrivenEvent, void, void>;
  /** Abort the run (cancels fetch + reader). */
  abort: () => void;
  /** Underlying AbortController for advanced consumers. */
  controller: AbortController;
}

function isTerminalEvent(event: SpecDrivenEvent): boolean {
  if (event.event === 'done') return true;
  if (event.event !== 'error') return false;
  return !['COST_CAP', 'TIMEOUT', 'INCOMPLETE'].includes(event.code);
}

/**
 * Signals that the network is worth retrying RIGHT NOW rather than at the
 * end of a long backoff: the user came back to the tab, or the browser
 * regained connectivity. Both are the moment a proxy transition has settled.
 */
function onWakeSignal(handler: () => void): () => void {
  const listeners: Array<() => void> = [];
  const add = (
    target: { addEventListener?: Function; removeEventListener?: Function } | undefined,
    type: string,
    guard?: () => boolean,
  ) => {
    if (!target || typeof target.addEventListener !== 'function') return;
    const fn = () => {
      if (!guard || guard()) handler();
    };
    target.addEventListener(type, fn);
    listeners.push(() => target.removeEventListener?.(type, fn));
  };

  const doc = typeof document !== 'undefined' ? document : undefined;
  add(doc, 'visibilitychange', () => doc?.visibilityState !== 'hidden');
  const win = typeof window !== 'undefined' ? window : undefined;
  add(win, 'focus');
  add(win, 'online');

  return () => {
    for (const off of listeners) off();
  };
}

/**
 * Wait out the backoff, but cut it short on a wake signal.
 *
 * Resolves `true` when a wake signal ended the wait early — the caller uses
 * that to refresh the reconnect budget, so a user returning to the tab is
 * never told the run is unrecoverable just because a blackout outlasted the
 * automatic retries.
 */
function waitForReconnect(delayMs: number, signal: AbortSignal): Promise<boolean> {
  if (signal.aborted) return Promise.resolve(false);
  if (delayMs <= 0) return Promise.resolve(false);
  return new Promise<boolean>((resolve, reject) => {
    let settled = false;
    const finish = (woke: boolean) => {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout(timer);
      releaseWake();
      signal.removeEventListener('abort', onAbort);
      resolve(woke);
    };
    const onAbort = () => {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout(timer);
      releaseWake();
      reject(new DOMException('aborted', 'AbortError'));
    };
    const releaseWake = onWakeSignal(() => finish(true));
    const timer = globalThis.setTimeout(() => finish(false), delayMs);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Follow the initial POST stream and transparently reattach to the durable
 * GET stream after a clean early EOF or transport error. Sequence numbers
 * provide both the replay cursor and duplicate suppression. Older backends
 * emit no sequence, so their behavior remains unchanged.
 */
async function* withDurableReconnect(
  initial: AsyncGenerator<SpecDrivenEvent, void, void>,
  signal: AbortSignal,
  initialCursor: { runId?: string; sequence?: number } = {},
): AsyncGenerator<SpecDrivenEvent, void, void> {
  let source = initial;
  let runId = initialCursor.runId;
  let lastSequence = Math.max(0, Math.trunc(initialCursor.sequence ?? 0));
  let durableConfirmed = Boolean(initialCursor.runId);
  let terminalSeen = false;
  let reconnectAttempts = 0;
  let lastTransportError: unknown;

  while (!signal.aborted) {
    let receivedNewEvent = false;
    try {
      for await (const event of source) {
        if (signal.aborted) return;
        if (event.event === 'start') runId = event.runId;

        const sequence =
          typeof event.sequence === 'number' && Number.isFinite(event.sequence)
            ? Math.trunc(event.sequence)
            : 0;
        if (sequence > 0 && sequence <= lastSequence) continue;
        if (sequence > 0) {
          lastSequence = sequence;
          durableConfirmed = true;
          receivedNewEvent = true;
        }

        terminalSeen = terminalSeen || isTerminalEvent(event);
        yield event;
        if (terminalSeen) return;
      }
      if (signal.aborted || terminalSeen) return;
      lastTransportError = new Error(
        'The generation stream closed before reporting a final result.',
      );
    } catch (error) {
      if (signal.aborted) throw error;
      // A missing/invalid replay resource is definitive. Retrying it only
      // delays the error and leaves stale recovery records around longer.
      if (
        error instanceof SseHttpError &&
        [404, 410, 422].includes(error.status)
      ) {
        throw error;
      }
      lastTransportError = error;
    }

    // The initial POST exposes the id in a response header before event #1.
    // Re-read the shared cursor after a transport failure so even a body that
    // drops immediately can replay from sequence zero.
    if (initialCursor.runId) {
      runId ??= initialCursor.runId;
      durableConfirmed = true;
    }

    // A stream that produced durable progress is healthy again; only bound
    // consecutive failed reconnects, not the total number over a long run.
    if (receivedNewEvent) reconnectAttempts = 0;
    if (!runId || !durableConfirmed) {
      if (lastTransportError) throw lastTransportError;
      return;
    }
    if (reconnectAttempts >= SPEC_DRIVEN_MAX_RECONNECT_ATTEMPTS) {
      // The budget is spent, but the run may still be alive on the server.
      // Give the user one last chance to rescue it by coming back to the
      // tab: wait for a wake signal and, if one arrives, start over with a
      // fresh budget instead of declaring the run dead.
      const wokeAfterBudget = await waitForReconnect(
        POST_BUDGET_WAKE_WINDOW_MS,
        signal,
      );
      if (!wokeAfterBudget) {
        throw lastTransportError instanceof Error
          ? lastTransportError
          : new Error('Unable to reconnect to the generation run.');
      }
      reconnectAttempts = 0;
    }

    const delayMs = RECONNECT_BACKOFF_MS[reconnectAttempts] ?? 60_000;
    reconnectAttempts += 1;
    // A wake signal means the network just changed under us — retry now and
    // restore the budget rather than counting this against it.
    const wokeEarly = await waitForReconnect(delayMs, signal);
    if (wokeEarly) reconnectAttempts = 0;
    source = streamSse<SpecDrivenEvent>(
      specDrivenRunEventsUrl(runId, lastSequence),
      undefined,
      {
        method: 'GET',
        signal,
        stallTimeoutMs: SPEC_DRIVEN_STREAM_STALL_TIMEOUT_MS,
      },
    );
  }
}

/** Attach to a run that survived a page reload or component restart. */
export function followSpecDrivenRun(
  runId: string,
  afterSequence = 0,
): SpecDrivenRunHandle {
  const controller = new AbortController();
  const cursor = Math.max(0, Math.trunc(afterSequence));
  const initialEvents = streamSse<SpecDrivenEvent>(
    specDrivenRunEventsUrl(runId, cursor),
    undefined,
    {
      method: 'GET',
      signal: controller.signal,
      stallTimeoutMs: SPEC_DRIVEN_STREAM_STALL_TIMEOUT_MS,
    },
  );
  return {
    events: withDurableReconnect(initialEvents, controller.signal, {
      runId,
      sequence: cursor,
    }),
    abort: () => controller.abort(),
    controller,
  };
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
  const acceptedCursor: { runId?: string } = {};

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
  // llm_model: for the free tier the trigger hook only ever sets this to the
  // server's advertised non-default free model (the default omits it); the
  // backend enforces its {primary, fallback} allowlist regardless.
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
  // Pilot experiment: tag the run with the participant label + the per-tab
  // session id so the backend runner can attach its run summary to the same
  // telemetry session as the chat events. Absent for regular sessions.
  const telemetryParticipant = getPilotParticipant();
  if (telemetryParticipant) {
    body.telemetry_participant = telemetryParticipant;
    body.telemetry_session = getOrCreateAssistantSessionId();
  }

  const initialEvents = streamSse<SpecDrivenEvent>(SMART_GEN_ENDPOINT, body, {
    signal: controller.signal,
    onResponse: (response) => {
      const runId = response.headers.get('X-BESSER-Run-Id')?.trim();
      if (!runId || !/^[a-f0-9]{32}$/.test(runId)) return;
      acceptedCursor.runId = runId;
      params.onRunAccepted?.(runId);
    },
    // The backend heartbeats a cost tick every ~2s, so a minute of total
    // silence is a dead transport — surface it instead of hanging forever.
    stallTimeoutMs: SPEC_DRIVEN_STREAM_STALL_TIMEOUT_MS,
  });
  const events = withDurableReconnect(
    initialEvents,
    controller.signal,
    acceptedCursor,
  );

  return {
    events,
    abort: () => controller.abort(),
    controller,
  };
}
