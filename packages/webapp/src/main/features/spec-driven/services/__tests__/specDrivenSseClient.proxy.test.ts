/**
 * Surviving a TLS-inspecting corporate proxy (Netskope on LIST laptops).
 *
 * The proxy buffers a response body before releasing it, and an SSE body never
 * ends. Verified live with Netskope ON: REST returns 200 and the agent WebSocket
 * upgrades to 101; only the spec-driven stream fails, in two shapes.
 *
 *   A. the response headers are held, so `fetch` never settles — no run id, no
 *      stall watchdog (armed *after* the await), and the card hangs forever.
 *   B. the connection is torn down, and `withDurableReconnect` gives up unless a
 *      run id is already known, which on a fresh start it never is.
 *
 * Three guarantees are locked down here:
 *   1. the initial POST is bounded, so mode A becomes an error, not a hang;
 *   2. the initial POST is retried under one Idempotency-Key, so mode B
 *      recovers instead of failing on the first attempt;
 *   3. after two consecutive stream failures the client stops streaming and
 *      polls plain JSON, which a buffering proxy passes through.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  SPEC_DRIVEN_RESPONSE_TIMEOUT_MS,
  startSpecDrivenRun,
  followSpecDrivenRun,
} from '../specDrivenSseClient';
import * as sse from '../../../../shared/services/sse/sseClient';

const RUN_ID = 'b'.repeat(32);

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

function startParams() {
  return {
    project: { id: 'p1' } as any,
    instructions: 'Build a simple web app',
    provider: 'free' as any,
    apiKey: '',
  };
}

async function drain(events: AsyncGenerator<any, void, void>) {
  const seen: any[] = [];
  try {
    for await (const e of events) seen.push(e);
  } catch {
    /* the test asserts on what arrived, not on the throw */
  }
  return seen;
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('mode A — the handshake must be bounded', () => {
  it('passes a response timeout on the initial POST', async () => {
    const spy = vi.spyOn(sse, 'streamSse');
    spy.mockImplementation(() => streamOf([{ event: 'done', sequence: 5 }]) as any);

    const handle = startSpecDrivenRun(startParams() as any);
    await drain(handle.events);

    expect(spy).toHaveBeenCalled();
    const options = spy.mock.calls[0][2];
    // Without this the fetch can hang forever behind a buffering proxy.
    expect(options?.responseTimeoutMs).toBe(SPEC_DRIVEN_RESPONSE_TIMEOUT_MS);
    expect(options?.responseTimeoutMs).toBeGreaterThan(0);
  });
});

describe('mode B — the run start must be retried', () => {
  it('retries the initial POST instead of failing on the first error', async () => {
    vi.useFakeTimers();
    const spy = vi.spyOn(sse, 'streamSse');
    spy.mockImplementation(() => failingStream() as any);

    const handle = startSpecDrivenRun(startParams() as any);
    const consumer = drain(handle.events);
    await vi.advanceTimersByTimeAsync(30_000);
    await consumer;

    // Previously exactly one attempt was made and the error was fatal.
    expect(spy.mock.calls.length).toBeGreaterThan(1);
  });

  it('sends the same Idempotency-Key on every attempt', async () => {
    vi.useFakeTimers();
    const spy = vi.spyOn(sse, 'streamSse');
    spy.mockImplementation(() => failingStream() as any);

    const handle = startSpecDrivenRun(startParams() as any);
    const consumer = drain(handle.events);
    await vi.advanceTimersByTimeAsync(30_000);
    await consumer;

    const keys = spy.mock.calls.map(
      (call) => (call[2]?.headers ?? {})['Idempotency-Key'],
    );
    expect(keys.length).toBeGreaterThan(1);
    expect(keys.every((k) => typeof k === 'string' && k.length > 0)).toBe(true);
    // One key for all attempts — that is what makes the retry safe: the
    // server hands attempt 2 the run attempt 1 may already have started.
    expect(new Set(keys).size).toBe(1);
  });

  it('uses a fresh key for a different run', async () => {
    const spy = vi.spyOn(sse, 'streamSse');
    spy.mockImplementation(() => streamOf([{ event: 'done', sequence: 1 }]) as any);

    await drain(startSpecDrivenRun(startParams() as any).events);
    await drain(startSpecDrivenRun(startParams() as any).events);

    const keys = spy.mock.calls.map(
      (call) => (call[2]?.headers ?? {})['Idempotency-Key'],
    );
    expect(new Set(keys).size).toBe(2);
  });
});

describe('structural cure — fall back to polling', () => {
  it('stops streaming and polls JSON after repeated stream failures', async () => {
    vi.useFakeTimers();
    const streamSpy = vi.spyOn(sse, 'streamSse');
    streamSpy.mockImplementation(() => failingStream() as any);

    // The polling transport uses fetch directly, not streamSse.
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        events: [
          { sequence: 30, event: 'done', data: { event: 'done', fileCount: 2 } },
        ],
        cursor: 30,
        hasMore: false,
        status: 'completed',
      }),
    }));
    vi.stubGlobal('fetch', fetchMock as any);

    const handle = followSpecDrivenRun(RUN_ID, 12);
    const consumer = drain(handle.events);
    await vi.advanceTimersByTimeAsync(120_000);
    const seen = await consumer;

    expect(fetchMock).toHaveBeenCalled();
    const polledUrl = String((fetchMock.mock.calls[0] as unknown as unknown[])[0]);
    expect(polledUrl).toContain('/events.json');
    // The cursor carries over, so polling neither loses nor repeats events.
    expect(polledUrl).toContain('after=12');
    expect(seen.some((e) => e.event === 'done')).toBe(true);
  });

  it('keeps streaming while the stream is healthy', async () => {
    vi.useFakeTimers();
    const streamSpy = vi.spyOn(sse, 'streamSse');
    streamSpy.mockImplementation(
      () => streamOf([{ event: 'done', sequence: 40 }]) as any,
    );
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock as any);

    const handle = followSpecDrivenRun(RUN_ID, 0);
    const consumer = drain(handle.events);
    await vi.advanceTimersByTimeAsync(10_000);
    await consumer;

    // A working stream must never be downgraded to polling.
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
