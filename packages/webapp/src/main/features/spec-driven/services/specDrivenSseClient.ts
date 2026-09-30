/**
 * Thin Spec-Driven Agent client over the shared `streamSse` utility.
 *
 * Owns the request shape and the `AbortController`; yields typed
 * `SpecDrivenEvent` objects. The caller (typically `useSpecDrivenTrigger`)
 * handles state updates and chat-message injection.
 */

import {
  SMART_GEN_ENDPOINT,
  specDrivenRunEventsJsonUrl,
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
 * just stays pending forever and the run card freezes with no error
 * (e.g. an intermediary that stops forwarding after the first flush).
 * On stall the stream throws `SseStallError`, which
 * `useSpecDrivenTrigger` converts into an honest terminal error card.
 */
export const SPEC_DRIVEN_STREAM_STALL_TIMEOUT_MS = 60_000;
/**
 * Reconnect budget: ~2.5 minutes of backoff.
 *
 * It must outlast the outage: a TLS-inspecting corporate proxy can tear down
 * the open stream AND blackhole new connections for a minute or more while the
 * run keeps generating on the server. Any wake signal (tab focus, browser back
 * online) both retries immediately and refreshes the budget.
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

/**
 * Handshake deadline for the initial POST. Generous, because the server does
 * real work (model assembly) before the first byte; tight enough that a proxy
 * holding the response is caught in well under a minute rather than never.
 */
export const SPEC_DRIVEN_RESPONSE_TIMEOUT_MS = 45_000;

/**
 * Consecutive stream failures tolerated before the client stops trying to
 * stream and switches to polling for the rest of the run.
 *
 * One failure is ordinary flakiness. Two in a row, on a transport the server
 * heartbeats every ~2s, means something in the path is hostile to streaming
 * (e.g. a TLS-inspecting proxy) — reconnecting to the same stream just
 * repeats the failure. Polling is slower but terminates each request, so it
 * gets through.
 */
const STREAM_FAILURES_BEFORE_POLLING = 2;

/** How often the polling transport asks for new events. */
const POLL_INTERVAL_MS = 2_000;
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
  /**
   * Demo-link secret (`?demo=<token>`), sent only with provider 'sponsored'.
   * The backend refuses that tier without it — it spends the org's own key.
   */
  demoToken?: string;
  maxCostUsd?: number;
  maxRuntimeSeconds?: number;
  /**
   * Incremental modify: when `mode === 'modify'`, the backend edits
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

/** Opaque per-start key so a retried POST rejoins its run, not a new one. */
function newIdempotencyKey(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid.replace(/-/g, '');
  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`;
}

/**
 * Backoff for the run-start POST. Short: the user is staring at a spinner,
 * and a proxy-induced failure is usually immediate.
 */
const START_RETRY_BACKOFF_MS = [0, 1_000, 3_000, 6_000] as const;

/**
 * POST the run, retrying a transport-level failure.
 *
 * Startup needs its own protection: `withDurableReconnect` gives up unless a run
 * id is known, and the id only arrives on this very request's response header —
 * so a proxy that kills the initial POST produced "Failed to fetch" with zero
 * retries while the 8-attempt reconnect budget sat unused.
 *
 * Retries are safe because every attempt carries the same `Idempotency-Key`:
 * if attempt 1 did reach the server and start a run, attempt 2 attaches to
 * that run and replays it from the beginning instead of starting another.
 *
 * An HTTP response — including 4xx/5xx — means the request arrived and the
 * server made a decision, so it is surfaced rather than retried.
 */
async function* startWithRetry(
  firstAttempt: AsyncGenerator<SpecDrivenEvent, void, void>,
  makeAttempt: () => AsyncGenerator<SpecDrivenEvent, void, void>,
  signal: AbortSignal,
  runIdKnown: () => boolean,
): AsyncGenerator<SpecDrivenEvent, void, void> {
  // The first attempt is created by the caller so the request is issued as
  // eagerly as it was before retries existed — `startSpecDrivenRun` must not
  // become lazy just because it can now retry.
  let source = firstAttempt;
  let lastError: unknown;
  for (let attempt = 0; attempt < START_RETRY_BACKOFF_MS.length; attempt += 1) {
    if (signal.aborted) return;
    if (attempt > 0) {
      const delayMs = START_RETRY_BACKOFF_MS[attempt];
      if (delayMs > 0) await waitForReconnect(delayMs, signal);
      if (signal.aborted) return;
      source = makeAttempt();
    }
    let delivered = false;
    try {
      for await (const event of source) {
        delivered = true;
        yield event;
      }
      return;
    } catch (error) {
      if (signal.aborted) throw error;
      // The server answered; that is an outcome, not a transport failure.
      if (error instanceof SseHttpError) throw error;
      lastError = error;
      // Retrying the START is only right while the run has no identity. Once
      // an event has arrived, or the id came back on the response header,
      // the run exists — reattaching to it with a cursor is `withDurableRe-
      // connect`'s job, and POSTing again would only duplicate work.
      if (delivered || runIdKnown()) throw error;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error('Could not start the generation run.');
}

/**
 * Read a run to completion over plain JSON instead of SSE.
 *
 * The fallback transport for a path that will not carry a stream. Every
 * request terminates, so a buffering proxy releases it normally. Shares the
 * stream's sequence cursor, so switching mid-run neither loses nor repeats an
 * event — the caller's own `sequence > lastSequence` filter still applies.
 */
async function* pollSpecDrivenRun(
  runId: string,
  afterSequence: number,
  signal: AbortSignal,
): AsyncGenerator<SpecDrivenEvent, void, void> {
  let cursor = Math.max(0, Math.trunc(afterSequence));
  while (!signal.aborted) {
    const response = await fetch(
      specDrivenRunEventsJsonUrl(runId, cursor),
      { signal, headers: { Accept: 'application/json' } },
    );
    if (!response.ok) {
      let text = '';
      try {
        text = await response.text();
      } catch {
        /* ignore */
      }
      throw new SseHttpError(response.status, text);
    }
    const page = (await response.json()) as {
      events?: Array<{ sequence?: number; data?: SpecDrivenEvent }>;
      cursor?: number;
      hasMore?: boolean;
      status?: string;
    };

    const events = page.events ?? [];
    for (const item of events) {
      if (signal.aborted) return;
      const event = item.data;
      if (!event) continue;
      // Carry the sequence on the event so the caller's dedupe and cursor
      // bookkeeping work identically for both transports.
      const sequence = Math.trunc(item.sequence ?? 0);
      if (sequence > cursor) cursor = sequence;
      yield { ...event, sequence } as SpecDrivenEvent;
      if (isTerminalEvent(event)) return;
    }

    if (typeof page.cursor === 'number') cursor = Math.max(cursor, page.cursor);
    // A terminal event is the normal exit above. Reaching here with a
    // finished run means the log ended without one — stop rather than poll
    // a completed run forever.
    if (!page.hasMore && page.status && page.status !== 'running') return;
    if (page.hasMore) continue;
    await waitForReconnect(POLL_INTERVAL_MS, signal);
  }
}

/**
 * Follow the initial POST stream and transparently reattach to the durable
 * GET stream after a clean early EOF or transport error. Sequence numbers
 * provide both the replay cursor and duplicate suppression. Older backends
 * emit no sequence, so their behavior remains unchanged.
 *
 * After `STREAM_FAILURES_BEFORE_POLLING` consecutive failures the reattach
 * switches from SSE to the polling transport for the remainder of the run.
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
  // Consecutive stream failures. Reset by any event that actually arrives,
  // so a single bad reconnect on an otherwise healthy path does not
  // permanently downgrade the run to polling.
  let streamFailures = 0;
  let usePolling = false;

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
    if (receivedNewEvent) {
      streamFailures = 0;
    } else if (!usePolling) {
      streamFailures += 1;
      if (streamFailures >= STREAM_FAILURES_BEFORE_POLLING) {
        // Two silent failures in a row on a heartbeated transport: the path
        // will not carry a stream. Stop retrying SSE and poll instead.
        usePolling = true;
      }
    }
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
    source = usePolling
      ? pollSpecDrivenRun(runId, lastSequence, signal)
      : streamSse<SpecDrivenEvent>(
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

  // Both server-paid tiers ('free' keyless, 'sponsored' demo) MUST NOT carry
  // an api_key or a base_url — the server injects the endpoint + token, and
  // for 'sponsored' the model too. A key sent here would be ignored anyway;
  // omitting it keeps the wire honest about who is paying.
  const isServerPaid = params.provider === 'free' || params.provider === 'sponsored';

  const body: Record<string, unknown> = {
    project: params.project,
    instructions: params.instructions,
    provider: wireProvider,
  };
  if (!isServerPaid) body.api_key = params.apiKey;
  if (!isServerPaid && usesBaseUrl && params.baseUrl) body.base_url = params.baseUrl;
  // The demo secret travels with the tier it unlocks, and nowhere else.
  if (params.provider === 'sponsored' && params.demoToken) {
    body.demo_token = params.demoToken;
  }
  // llm_model: for the free tier the trigger hook only ever sets this to the
  // server's advertised non-default free model (the default omits it); the
  // backend enforces its {primary, fallback} allowlist regardless.
  if (params.llmModel) body.llm_model = params.llmModel;
  if (typeof params.maxCostUsd === 'number') body.max_cost_usd = params.maxCostUsd;
  if (typeof params.maxRuntimeSeconds === 'number') {
    body.max_runtime_seconds = params.maxRuntimeSeconds;
  }
  // Incremental modify — serialise as the backend's snake_case fields.
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
  // Research telemetry: tag the run with the `?pilot=` label + the per-tab
  // session id so the backend can attach its run summary to the same
  // telemetry session as the chat events. Absent for regular sessions.
  const telemetryParticipant = getPilotParticipant();
  if (telemetryParticipant) {
    body.telemetry_participant = telemetryParticipant;
    body.telemetry_session = getOrCreateAssistantSessionId();
  }

  // Starting a run is not idempotent, which is why the startup POST was never
  // retried — a retry could spawn a second run. A client-generated key lets
  // the server hand the retry the SAME run, so the retry below is safe.
  const idempotencyKey = newIdempotencyKey();

  const attempt = () =>
    streamSse<SpecDrivenEvent>(SMART_GEN_ENDPOINT, body, {
      signal: controller.signal,
      headers: { 'Idempotency-Key': idempotencyKey },
      onResponse: (response) => {
        const runId = response.headers.get('X-BESSER-Run-Id')?.trim();
        if (!runId || !/^[a-f0-9]{32}$/.test(runId)) return;
        acceptedCursor.runId = runId;
        params.onRunAccepted?.(runId);
      },
      // The backend heartbeats a cost tick every ~2s, so a minute of total
      // silence is a dead transport — surface it instead of hanging forever.
      stallTimeoutMs: SPEC_DRIVEN_STREAM_STALL_TIMEOUT_MS,
      // And bound the handshake itself, which the stall watchdog cannot cover
      // because it is only armed once the response exists.
      responseTimeoutMs: SPEC_DRIVEN_RESPONSE_TIMEOUT_MS,
    });

  const initialEvents = startWithRetry(
    attempt(),
    attempt,
    controller.signal,
    () => Boolean(acceptedCursor.runId),
  );
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
