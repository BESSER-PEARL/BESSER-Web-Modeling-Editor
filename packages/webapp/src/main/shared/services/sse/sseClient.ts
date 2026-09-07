/**
 * Generic POST-body SSE (Server-Sent Events) reader.
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
  /** Extra headers to merge into the POST request. */
  headers?: Record<string, string>;
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
 * POST `body` to `url` with `Accept: text/event-stream` and yield each
 * parsed SSE event. The caller is responsible for validating the
 * generic-typed result against its own schema.
 */
export async function* streamSse<T = unknown>(
  url: string,
  body: unknown,
  options: StreamSseOptions = {},
): AsyncGenerator<T, void, void> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...options.headers,
    },
    body: JSON.stringify(body),
    signal: options.signal,
  });

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
  const stallTimeoutMs = options.stallTimeoutMs;
  if (typeof stallTimeoutMs === 'number' && stallTimeoutMs > 0) {
    const checkEveryMs = Math.max(1000, Math.min(5000, Math.floor(stallTimeoutMs / 4)));
    stallWatchdog = setInterval(() => {
      if (Date.now() - lastActivityAt >= stallTimeoutMs) {
        stallDetected = true;
        void reader.cancel().catch(() => {
          /* the read loop's own error handling covers the rest */
        });
      }
    }, checkEveryMs);
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
            // eslint-disable-next-line no-console
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
    try {
      await reader.cancel();
    } catch {
      /* ignore */
    }
  }
}
