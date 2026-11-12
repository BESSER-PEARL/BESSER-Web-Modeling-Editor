/**
 * The shared client reports the socket's life (connected, dropped, reconnected,
 * given up) and the replies it had to give up on (malformed, timed out), once
 * for both assistant surfaces.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const track = vi.hoisted(() => vi.fn());
vi.mock('../../../../shared/services/analytics/events', () => ({ track }));

import { AssistantClient } from '../AssistantClient';

class FakeSocket {
  static instances: FakeSocket[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  constructor(public url: string) {
    FakeSocket.instances.push(this);
  }
  send() {}
  close() {}
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  drop() {
    this.readyState = 3;
    this.onclose?.();
  }
  /** An abnormal drop (network lost): the browser fires `error`, then `close`. */
  fail() {
    this.readyState = 3;
    this.onerror?.(new Event('error'));
    this.onclose?.();
  }
}

const events = (name: string) => track.mock.calls.filter(([event]) => event === name).map(([, props]) => props);
const latest = () => FakeSocket.instances[FakeSocket.instances.length - 1];

beforeEach(() => {
  vi.useFakeTimers();
  FakeSocket.instances = [];
  track.mockClear();
  vi.stubGlobal('WebSocket', FakeSocket);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('AssistantClient analytics', () => {
  it('tracks connect, an unexpected drop and the reconnect with its attempt number', async () => {
    const client = new AssistantClient('ws://agent.test');
    const connecting = client.connect();
    latest().open();
    await connecting;
    expect(events('assistant_connection')).toEqual([{ state: 'connected', attempt: 0 }]);

    latest().drop();
    expect(events('assistant_connection')[1]).toEqual({ state: 'disconnected', attempt: 0 });

    await vi.advanceTimersByTimeAsync(2000);
    latest().open();
    expect(events('assistant_connection')[2]).toEqual({ state: 'reconnected', attempt: 1 });
    client.disconnect();
  });

  it('reports an abnormal drop, where error fires before close, once', async () => {
    const client = new AssistantClient('ws://agent.test');
    const connecting = client.connect();
    latest().open();
    await connecting;

    latest().fail();

    expect(events('assistant_connection')).toEqual([
      { state: 'connected', attempt: 0 },
      { state: 'disconnected', attempt: 0 },
    ]);
    client.disconnect();
  });

  it('does not report a deliberate disconnect as a drop', async () => {
    const client = new AssistantClient('ws://agent.test');
    const connecting = client.connect();
    latest().open();
    await connecting;
    client.disconnect();
    latest().onclose?.();
    expect(events('assistant_connection').filter((p) => (p as { state: string }).state === 'disconnected')).toHaveLength(0);
  });

  // Live on 2026-11-11 the agent took about 4 minutes to boot after a deploy;
  // tabs stopped after 8 attempts (about 2 minutes) and stayed disconnected
  // until reloaded.
  it('keeps reconnecting through a 5-minute agent outage and reports 8 failures', async () => {
    const client = new AssistantClient('ws://agent.test');
    const connecting = client.connect();
    latest().open();
    await connecting;
    latest().drop();

    const outageEnds = Date.now() + 5 * 60_000;
    while (Date.now() < outageEnds) {
      const before = FakeSocket.instances.length;
      await vi.advanceTimersByTimeAsync(30_000);
      if (FakeSocket.instances.length > before) latest().fail();
    }
    const afterOutage = FakeSocket.instances.length;
    await vi.advanceTimersByTimeAsync(30_000);

    expect(FakeSocket.instances.length).toBe(afterOutage + 1);
    latest().open();
    expect(client.connected).toBe(true);
    const failures = events('assistant_connection').filter((p) => (p as { state: string }).state === 'reconnect_failed');
    expect(failures).toEqual([1, 2, 3, 4, 5, 6, 7, 8].map((attempt) => ({ state: 'reconnect_failed', attempt })));
    client.disconnect();
  });

  it('tracks a malformed reply as a protocol error', () => {
    const client = new AssistantClient('ws://agent.test');
    (client as unknown as { handleMessage(e: MessageEvent): void }).handleMessage({ data: '{not json' } as MessageEvent);
    expect(events('assistant_client_error')).toEqual([{ kind: 'protocol' }]);
  });

  it('tracks the hard timeout when no reply ever arrives', () => {
    const client = new AssistantClient('ws://agent.test');
    const priv = client as unknown as { responseStartedAt: number; onResponseTick(): void };
    priv.responseStartedAt = Date.now() - 10 * 60 * 1000;
    priv.onResponseTick();
    expect(events('assistant_client_error')).toEqual([{ kind: 'timeout' }]);
  });
});
