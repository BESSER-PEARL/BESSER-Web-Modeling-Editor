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

  it('does not report a deliberate disconnect as a drop', async () => {
    const client = new AssistantClient('ws://agent.test');
    const connecting = client.connect();
    latest().open();
    await connecting;
    client.disconnect();
    latest().onclose?.();
    expect(events('assistant_connection').filter((p) => (p as { state: string }).state === 'disconnected')).toHaveLength(0);
  });

  it('reports giving up once, after the last reconnect attempt', () => {
    const client = new AssistantClient('ws://agent.test');
    const priv = client as unknown as { reconnectAttempts: number; attemptReconnect(): void };
    priv.reconnectAttempts = 8;
    priv.attemptReconnect();
    priv.attemptReconnect();
    expect(events('assistant_connection')).toEqual([{ state: 'gave_up', attempt: 8 }]);
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
