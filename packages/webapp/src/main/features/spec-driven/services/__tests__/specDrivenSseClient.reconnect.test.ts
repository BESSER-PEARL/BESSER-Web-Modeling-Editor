/**
 * A run must survive a network blackout longer than the retry budget.
 *
 * The budget was 4 attempts over ~11s. A corporate proxy (Netskope on LIST
 * laptops) inserting itself into the session tears down the open stream AND
 * blackholes new connections for a minute or more, so every attempt landed
 * inside the outage and the card abandoned a run still generating on the server
 * (2026-09-16, run ceccb1fcb5f1 at sequence 100 with zero subscribers).
 *
 * Two guarantees are locked down here:
 *   1. the automatic budget spans minutes, not seconds;
 *   2. a wake signal (tab focus / back online) retries immediately AND
 *      refreshes the budget, so returning to the tab always reattaches.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  SPEC_DRIVEN_MAX_RECONNECT_ATTEMPTS,
  followSpecDrivenRun,
} from '../specDrivenSseClient';
import * as sse from '../../../../shared/services/sse/sseClient';

function failingStream(): AsyncGenerator<never, void, void> {
  return (async function* () {
    throw new TypeError('Failed to fetch');
  })();
}

function streamOf(events: unknown[]): AsyncGenerator<any, void, void> {
  return (async function* () {
    for (const e of events) yield e;
  })();
}

/** Sequence must exceed any already delivered, or dedup correctly drops it. */
const DONE = { event: 'done', sequence: 99, fileCount: 3 };

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('reconnect budget', () => {
  it('allows many more attempts than the old 4', () => {
    expect(SPEC_DRIVEN_MAX_RECONNECT_ATTEMPTS).toBeGreaterThanOrEqual(8);
  });

  it('keeps retrying across a blackout far longer than 11 seconds', async () => {
    vi.useFakeTimers();
    const spy = vi.spyOn(sse, 'streamSse');
    // Every attempt fails, as during a proxy blackout.
    spy.mockImplementation(() => failingStream() as any);
    // After two dead streams the client stops streaming and polls instead,
    // so "still trying" has to be counted across BOTH transports.
    const fetchMock = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    vi.stubGlobal('fetch', fetchMock as any);
    const attempts = () => spy.mock.calls.length + fetchMock.mock.calls.length;

    const handle = followSpecDrivenRun('a'.repeat(32), 12);
    const consumer = (async () => {
      try {
        for await (const _ of handle.events) { /* drain */ }
      } catch { /* expected eventually */ }
    })();

    // 11s was the entire old budget; we must still be trying well past it.
    await vi.advanceTimersByTimeAsync(11_000);
    const callsAt11s = attempts();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(attempts()).toBeGreaterThan(callsAt11s);

    handle.abort();
    await consumer;
  });

  it('retries immediately when the tab is focused, without waiting out the backoff', async () => {
    vi.useFakeTimers();
    const spy = vi.spyOn(sse, 'streamSse');
    spy.mockImplementation(() => failingStream() as any);

    const fetchMock = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    vi.stubGlobal('fetch', fetchMock as any);
    // Counted across both transports: by this point the client has given up
    // on streaming and is polling, but the wake behaviour is the same.
    const attempts = () => spy.mock.calls.length + fetchMock.mock.calls.length;

    const handle = followSpecDrivenRun('b'.repeat(32), 0);
    const consumer = (async () => {
      try {
        for await (const _ of handle.events) { /* drain */ }
      } catch { /* expected */ }
    })();

    // Burn the short backoffs (0, 1s, 3s, 7s) so we sit in a LONG one (15s).
    await vi.advanceTimersByTimeAsync(12_000);
    const beforeFocus = attempts();

    // Focus must cut the 15s wait short — advance almost no time at all.
    window.dispatchEvent(new Event('focus'));
    await vi.advanceTimersByTimeAsync(10);

    expect(attempts()).toBeGreaterThan(beforeFocus);

    handle.abort();
    await consumer;
  });

  it('replays from the last sequence it actually received', async () => {
    vi.useFakeTimers();
    const spy = vi.spyOn(sse, 'streamSse');
    let attempt = 0;
    spy.mockImplementation(() => {
      attempt += 1;
      if (attempt === 1) {
        return streamOf([
          { event: 'phase', sequence: 40, phase: 'gap' },
          { event: 'phase', sequence: 41, phase: 'customize' },
        ]) as any;
      }
      return streamOf([DONE]) as any;
    });

    const handle = followSpecDrivenRun('c'.repeat(32), 0);
    const consumer = (async () => {
      for await (const _ of handle.events) { /* drain */ }
    })();
    await vi.advanceTimersByTimeAsync(5_000);
    await consumer;

    // The reconnect URL must carry the highest sequence seen (41), not 0.
    const reconnectUrl = String(spy.mock.calls.at(-1)?.[0] ?? '');
    expect(reconnectUrl).toContain('41');
  });
});
