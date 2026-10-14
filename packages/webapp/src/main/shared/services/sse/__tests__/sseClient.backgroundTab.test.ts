/**
 * A stalled stream must be detected even when the tab's timers are frozen.
 *
 * The stall watchdog was armed only by `setInterval`, which browsers throttle in
 * a backgrounded tab (Chrome ~once a minute, frozen once freeze-eligible) — so
 * the one mechanism that could notice a dead transport was the one the browser
 * had stopped running, leaving the card frozen for minutes with no reconnect
 * attempt while the server kept writing events.
 *
 * These tests never advance the interval. Detection must come from the tab
 * being looked at again.
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

/** Delivers `head`, then stays open forever: no close, no error. */
function silentAfter(head: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of head) controller.enqueue(encoder.encode(chunk));
    },
  });
}

const FRAME_A = 'event: start\ndata: {"event":"start","runId":"abc"}\n\n';

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', {
    value: state,
    configurable: true,
  });
}

async function flush(times = 20) {
  for (let i = 0; i < times; i++) await Promise.resolve();
}

describe('streamSse — stall detection with frozen timers', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    setVisibility('visible');
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('detects the stall when the tab becomes visible again', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    globalThis.fetch = vi.fn().mockResolvedValue(okResponse(silentAfter([FRAME_A])));

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

    await flush();
    expect(received).toHaveLength(1);

    // The tab goes to the background and its interval stops ticking. Time
    // passes — note we advance the CLOCK but never run the interval.
    setVisibility('hidden');
    vi.setSystemTime(Date.now() + 5 * 60_000);
    await flush();
    expect(caught).toBeNull();

    // The user looks at the tab again.
    setVisibility('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    await consumer;

    expect(caught).toBeInstanceOf(SseStallError);
  });

  it('also wakes on window focus, for an occluded but "visible" tab', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    globalThis.fetch = vi.fn().mockResolvedValue(okResponse(silentAfter([FRAME_A])));

    let caught: unknown = null;
    const consumer = (async () => {
      try {
        for await (const _ of streamSse('/x', {}, { stallTimeoutMs: 60_000 })) {
          /* drain */
        }
      } catch (err) {
        caught = err;
      }
    })();

    await flush();
    // Switching applications can leave visibilityState 'visible'.
    vi.setSystemTime(Date.now() + 5 * 60_000);
    await flush();
    expect(caught).toBeNull();

    window.dispatchEvent(new Event('focus'));
    await consumer;

    expect(caught).toBeInstanceOf(SseStallError);
  });

  it('does not fire on a wake-up while the stream is still healthy', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    globalThis.fetch = vi.fn().mockResolvedValue(okResponse(silentAfter([FRAME_A])));

    let caught: unknown = null;
    let done = false;
    const consumer = (async () => {
      try {
        for await (const _ of streamSse('/x', {}, { stallTimeoutMs: 60_000 })) {
          /* drain */
        }
        done = true;
      } catch (err) {
        caught = err;
      }
    })();

    await flush();

    // Only 5s of silence — well inside the timeout.
    vi.setSystemTime(Date.now() + 5_000);
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));
    await flush();

    expect(caught).toBeNull();
    expect(done).toBe(false);

    void consumer;
  });

  it('ignores a visibilitychange that reports hidden', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    globalThis.fetch = vi.fn().mockResolvedValue(okResponse(silentAfter([FRAME_A])));

    let caught: unknown = null;
    const consumer = (async () => {
      try {
        for await (const _ of streamSse('/x', {}, { stallTimeoutMs: 60_000 })) {
          /* drain */
        }
      } catch (err) {
        caught = err;
      }
    })();

    await flush();
    vi.setSystemTime(Date.now() + 5 * 60_000);

    // A hidden-going event must not arm anything: the tab is not being read.
    setVisibility('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    await flush();
    expect(caught).toBeNull();

    setVisibility('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    await consumer;
    expect(caught).toBeInstanceOf(SseStallError);
  });
});
