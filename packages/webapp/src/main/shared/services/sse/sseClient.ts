/**
 * Generic fetch-based SSE (Server-Sent Events) reader.
 *
 * The browser's native `EventSource` only supports GET, but we need to
 * POST a JSON body (project payload + BYOK API key) to start a smart-
 * generation run. This utility wraps `fetch` + `ReadableStream` to yield
 * parsed SSE event objects as an async generator.
 *
 * Each SSE frame looks like:
 *
 *     event: <name>
 *     data: <json>
 *
 *     (blank line terminator)
 *
 * Frames are terminated by a blank line (`\n\n` or `\r\n\r\n`). We
 * support both terminators and mixed terminators within the same stream
 * (some proxies rewrite line endings). Comment frames (`:heartbeat`)
 * and empty-data frames are silently skipped per the SSE spec.
 *
 * Multi-line `data:` fields are concatenated with `\n` per the spec,
 * though the current backend always emits a single-line JSON body per
 * frame.
 *
 * Abort is supported via an `AbortSignal` — the fetch is aborted, the
 * reader is cancelled, and the generator returns cleanly.
 */

export interface StreamSseOptions {
  signal?: AbortSignal;
  /** HTTP method. POST remains the backward-compatible default. */
  method?: 'GET' | 'POST';
  /** Extra headers to merge into the request. */
  headers?: Record<string, string>;
  /** Observe accepted response metadata before the stream body is read. */
  onResponse?: (response: Response) => void;
  /**
   * Liveness bound: when set, the stream is declared DEAD after this many
   * milliseconds without a single byte arriving, and the generator throws
   * `SseStallError` instead of waiting forever.
   *
   * Rationale: a streaming `fetch` whose transport dies mid-response (a
   * proxy hop that stops forwarding, a QUIC/H3 path that silently
   * blackholes, a NAT that reaps the flow) leaves `reader.read()` pending
   * indefinitely — no error, no close, no event. To the consumer that is
   * indistinguishable from a slow-but-alive stream, so a run card fed by
   * the stream freezes forever with zero signal. Endpoints with a
   * heartbeat contract (the spec-driven backend emits a cost tick every
   * ~2s for the whole run) can bound liveness tightly: tens of seconds of
   * TOTAL silence is a dead transport, not a slow run. Only opt in for
   * streams with such a contract — omit for streams that may legitimately
   * go quiet.
   */
  stallTimeoutMs?: number;
  /**
   * Bound on the INITIAL response, i.e. how long `fetch` may take to return
   * its headers. Distinct from `stallTimeoutMs`, which only starts once the
   * body is being read.
   *
   * Rationale: `stallTimeoutMs` is armed *after* `await fetch(...)` resolves,
   * so it cannot protect the handshake. A TLS-inspecting proxy (Netskope on
   * LIST laptops) holds a response it intends to scan, and an SSE body never
   * finishes, so the promise may never settle: `onResponse` never fires, the
   * run id in `X-BESSER-Run-Id` is never read, the watchdog is never armed
   * and the caller's reconnect logic is never reached. The UI sits on
   * "Waiting for the first event…" forever while the run completes happily
   * on the server. Bounding the handshake turns that silent hang into an
   * honest error the caller can retry or fall back from.
   */
  responseTimeoutMs?: number;
}

/**
 * Thrown when `responseTimeoutMs` elapses before the response headers
 * arrive. Distinct from `SseStallError`: nothing was ever established, so
 * there is no run to reconnect to — the caller must retry the request
 * itself, or switch transport.
 */
export class SseResponseTimeoutError extends Error {
  readonly waitedMs: number;
  constructor(waitedMs: number) {
    super(
      `SSE request timed out after ${Math.round(waitedMs / 1000)}s ` +
        'waiting for response headers',
    );
    this.waitedMs = waitedMs;
    this.name = 'SseResponseTimeoutError';
  }
}

export class SseHttpError extends Error {
  readonly status: number;
  readonly body: string;
  constructor(status: number, body: string) {
    super(`SSE request failed: ${status}`);
    this.status = status;
    this.body = body;
    this.name = 'SseHttpError';
  }
}

/**
 * Thrown by `streamSse` when `stallTimeoutMs` is set and the stream went
 * completely silent for that long. Consumers distinguish this from a clean
 * EOF (the server closed) and from an abort (the user cancelled): a stall
 * means the transport died while the producer may well still be running.
 */
export class SseStallError extends Error {
  /** How long the stream had been silent when it was declared dead. */
  readonly silentMs: number;
  constructor(silentMs: number) {
    super(
      `SSE stream stalled: no data received for ${Math.round(silentMs / 1000)}s`,
    );
    this.silentMs = silentMs;
    this.name = 'SseStallError';
  }
}

/** Find the next SSE frame terminator in `buffer`, supporting LF and CRLF. */
function _findFrameBoundary(buffer: string): { idx: number; len: number } | null {
  // Find whichever separator appears earliest. indexOf returns -1 if not found.
  const lfIdx = buffer.indexOf('\n\n');
  const crlfIdx = buffer.indexOf('\r\n\r\n');
  if (lfIdx === -1 && crlfIdx === -1) return null;
  if (lfIdx === -1) return { idx: crlfIdx, len: 4 };
  if (crlfIdx === -1) return { idx: lfIdx, len: 2 };
  // Both found — pick the earlier one. Note: `\r\n\r\n` always starts
  // at an earlier index than the `\n\n` inside it (since `\r\n\r\n`
  // includes the `\n\n` at offset +1), so preferring the smaller
  // index correctly takes the full CRLF sequence.
  if (crlfIdx < lfIdx) return { idx: crlfIdx, len: 4 };
  return { idx: lfIdx, len: 2 };
}

/**
 * Fetch `url` with `Accept: text/event-stream` and yield parsed events.
 * POST requests JSON-encode `body`; GET requests intentionally omit it.
 */
export async function* streamSse<T = unknown>(
  url: string,
  body: unknown,
  options: StreamSseOptions = {},
): AsyncGenerator<T, void, void> {
  const method = options.method ?? 'POST';
  const hasBody = method === 'POST' && body !== undefined;

  // Bound the handshake. The caller's AbortSignal still aborts; this adds a
  // deadline of our own so a proxy that swallows the response headers cannot
  // park the request forever (see `responseTimeoutMs`).
  const responseTimeoutMs = options.responseTimeoutMs;
  const handshakeController = new AbortController();
  let handshakeTimer: ReturnType<typeof setTimeout> | null = null;
  let handshakeTimedOut = false;
  const abortHandshake = () => handshakeController.abort();
  if (options.signal) {
    if (options.signal.aborted) handshakeController.abort();
    else options.signal.addEventListener('abort', abortHandshake, { once: true });
  }
  if (typeof responseTimeoutMs === 'number' && responseTimeoutMs > 0) {
    handshakeTimer = setTimeout(() => {
      handshakeTimedOut = true;
      handshakeController.abort();
    }, responseTimeoutMs);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Accept: 'text/event-stream',
        ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
      body: hasBody ? JSON.stringify(body) : undefined,
      signal: handshakeController.signal,
    });
  } catch (error) {
    // Our deadline fired, not the caller's abort — report it as such so the
    // caller retries instead of treating the run as cancelled.
    if (handshakeTimedOut && !options.signal?.aborted) {
      throw new SseResponseTimeoutError(responseTimeoutMs as number);
    }
    throw error;
  } finally {
    if (handshakeTimer) clearTimeout(handshakeTimer);
    options.signal?.removeEventListener('abort', abortHandshake);
  }
  options.onResponse?.(response);

  if (!response.ok) {
    let text = '';
    try {
      text = await response.text();
    } catch {
      /* ignore */
    }
    throw new SseHttpError(response.status, text);
  }

  if (!response.body) {
    throw new SseHttpError(response.status, 'Response had no body stream');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  // ---- Stall watchdog (opt-in) ----
  // `reader.cancel()` resolves a pending `read()` as `{done: true}`, so
  // the loop below exits; `stallDetected` then converts that exit into an
  // `SseStallError` instead of a silent clean EOF. Cancelling the reader
  // also tells the browser to tear the response down, so the server (or
  // the first live proxy hop) learns the client is gone.
  let lastActivityAt = Date.now();
  let stallDetected = false;
  let stallWatchdog: ReturnType<typeof setInterval> | null = null;
  let releaseWakeChecks: (() => void) | null = null;
  const stallTimeoutMs = options.stallTimeoutMs;
  if (typeof stallTimeoutMs === 'number' && stallTimeoutMs > 0) {
    const checkEveryMs = Math.max(1000, Math.min(5000, Math.floor(stallTimeoutMs / 4)));

    const checkForStall = () => {
      if (stallDetected) return;
      if (Date.now() - lastActivityAt >= stallTimeoutMs) {
        stallDetected = true;
        void reader.cancel().catch(() => {
          /* the read loop's own error handling covers the rest */
        });
      }
    };

    stallWatchdog = setInterval(checkForStall, checkEveryMs);

    // The interval alone is not enough. Browsers throttle `setInterval` in a
    // backgrounded or occluded tab (Chrome: ~once a minute, and frozen
    // outright once the tab is discarded-eligible), which is exactly the
    // state a tab is in while its owner presents from another window. A run
    // whose transport died then sat frozen for ~7 minutes with the reconnect
    // path below never reached, because the only thing that could arm it was
    // a timer the browser had stopped running (observed 2026-09-16, run
    // 1f227045c804: no reconnect request was ever issued).
    //
    // Re-check the moment the tab is looked at again, so a frozen tab
    // recovers on the very next glance instead of waiting for a timer that
    // may never tick.
    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      const onWake = () => {
        if (document.visibilityState !== 'hidden') checkForStall();
      };
      document.addEventListener('visibilitychange', onWake);
      // Switching applications can leave `visibilityState` as 'visible' while
      // the tab is occluded and still throttled, so take the window's focus
      // as a second wake signal.
      if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener('focus', onWake);
      }
      releaseWakeChecks = () => {
        document.removeEventListener('visibilitychange', onWake);
        if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
          window.removeEventListener('focus', onWake);
        }
      };
    }
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        // Final decode (flush any incomplete UTF-8 sequence).
        buffer += decoder.decode();
        break;
      }
      lastActivityAt = Date.now();
      buffer += decoder.decode(value, { stream: true });

      // Drain complete frames from the buffer.
      while (true) {
        const boundary = _findFrameBoundary(buffer);
        if (boundary === null) break;
        const frame = buffer.slice(0, boundary.idx);
        buffer = buffer.slice(boundary.idx + boundary.len);

        // Parse the frame into `data:` lines, ignoring `event:`,
        // `id:`, `retry:`, and comment lines (`:...`).
        const dataLines: string[] = [];
        for (const line of frame.split(/\r?\n/)) {
          // Comment frames (keep-alive heartbeats) start with `:`.
          if (line.startsWith(':')) continue;
          if (!line.startsWith('data:')) continue;
          // Preserve exact content after the colon and an optional single space.
          const raw = line.slice(5);
          dataLines.push(raw.startsWith(' ') ? raw.slice(1) : raw);
        }
        if (dataLines.length === 0) continue;

        const payload = dataLines.join('\n');
        // Per SSE spec, an empty data payload is a valid keep-alive.
        if (!payload.trim()) continue;

        try {
          yield JSON.parse(payload) as T;
        } catch {
          // Malformed frame — skip and keep going rather than
          // poisoning the stream. Log for dev visibility.
          if (typeof console !== 'undefined') {
            console.warn('[streamSse] skipping malformed frame:', payload.slice(0, 200));
          }
          continue;
        }
      }
    }
    if (stallDetected) {
      throw new SseStallError(Date.now() - lastActivityAt);
    }
  } finally {
    if (stallWatchdog !== null) {
      clearInterval(stallWatchdog);
    }
    if (releaseWakeChecks !== null) {
      releaseWakeChecks();
    }
    try {
      await reader.cancel();
    } catch {
      /* ignore */
    }
  }
}
