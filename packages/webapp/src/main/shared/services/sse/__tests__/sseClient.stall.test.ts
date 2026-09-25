/**
 * Stall-watchdog tests for the generic SSE client.
 *
 * The production failure this locks down: a streaming fetch whose
 * transport dies mid-response (an edge/proxy hop that stops forwarding
 * after the first flush) leaves `reader.read()` pending FOREVER — no
 * error, no close, no event. The consumer can't tell a dead stream from
 * a slow one, so the spec-driven run card froze at its first events for
 * the whole run with zero signal. With `stallTimeoutMs` set, the client
 * now declares the stream dead after that much total silence and throws
 * `SseStallError` so callers can terminate honestly.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { SseStallError, streamSse } from '../sseClient';

const encoder = new TextEncoder();

function okResponse(stream: ReadableStream<Uint8Array>): Response {
  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

/** A stream that delivers `head` immediately, then goes silent forever
 * (the connection stays "open": no close, no error — the production
 * dead-transport signature). */
function silentAfter(head: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of head) controller.enqueue(encoder.encode(chunk));
      // ...and never close.
    },
  });
}

const FRAME_A = 'event: start\ndata: {"event":"start","runId":"abc"}\n\n';
const FRAME_B = 'event: phase\ndata: {"event":"phase","phase":"select"}\n\n';

describe('streamSse — stall watchdog', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('yields the early frames, then throws SseStallError after total silence', async () => {
    vi.useFakeTimers({
      toFake: ['setInterval', 'clearInterval', 'Date'],
    });
    globalThis.fetch = vi.fn().mockResolvedValue(okResponse(silentAfter([FRAME_A, FRAME_B])));

    const received: unknown[] = [];
    let caught: unknown = null;
    const consumer = (async () => {
      try {
        for await (const ev of streamSse('/x', {}, { stallTimeoutMs: 60_000 })) {
          received.push(ev);
        }
      } catch (err) {
        caught = err;
      }
    })();

    // Let the head frames flow (microtasks only — no timers involved).
    for (let i = 0; i < 20; i++) await Promise.resolve();
    expect(received).toEqual([
      { event: 'start', runId: 'abc' },
      { event: 'phase', phase: 'select' },
    ]);
    expect(caught).toBeNull();

    // A dead-silent minute: the watchdog declares the stream dead.
    await vi.advanceTimersByTimeAsync(61_000);
    await consumer;

    expect(caught).toBeInstanceOf(SseStallError);
    expect((caught as SseStallError).silentMs).toBeGreaterThanOrEqual(60_000);
    expect(String(caught)).toMatch(/stalled/i);
  });

  it('does not fire while frames keep arriving within the window, and completes cleanly', async () => {
    vi.useFakeTimers({
      toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'Date'],
    });
    // Frames delivered 30s apart — always inside the 60s window.
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        controller = c;
        c.enqueue(encoder.encode(FRAME_A));
      },
    });
    globalThis.fetch = vi.fn().mockResolvedValue(okResponse(stream));

    const received: unknown[] = [];
    const consumer = (async () => {
      for await (const ev of streamSse('/x', {}, { stallTimeoutMs: 60_000 })) {
        received.push(ev);
      }
    })();

    for (let i = 0; i < 20; i++) await Promise.resolve();
    await vi.advanceTimersByTimeAsync(30_000);
    controller.enqueue(encoder.encode(FRAME_B));
    for (let i = 0; i < 20; i++) await Promise.resolve();
    await vi.advanceTimersByTimeAsync(30_000);
    controller.close();
    await consumer;

    expect(received).toEqual([
      { event: 'start', runId: 'abc' },
      { event: 'phase', phase: 'select' },
    ]);
  });

  it('without stallTimeoutMs a silent stream stays pending (backward-compatible opt-in)', async () => {
    vi.useFakeTimers({
      toFake: ['setInterval', 'clearInterval', 'Date'],
    });
    globalThis.fetch = vi.fn().mockResolvedValue(okResponse(silentAfter([FRAME_A])));

    let settled = false;
    const consumer = (async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ev of streamSse('/x', {})) {
        /* consume */
      }
    })().then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );
    void consumer;

    for (let i = 0; i < 20; i++) await Promise.resolve();
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    for (let i = 0; i < 20; i++) await Promise.resolve();
    // No watchdog was armed — the stream is still (silently) pending.
    expect(settled).toBe(false);
  });
});
