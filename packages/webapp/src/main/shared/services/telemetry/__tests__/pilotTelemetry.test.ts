/**
 * Pilot-experiment telemetry — regression tests.
 *
 * The load-bearing invariants:
 *  - collection is OFF by default: without a valid `?pilot=` label nothing is
 *    stored and nothing is ever posted;
 *  - the telemetry session id is the assistant's per-tab session id (one id,
 *    never two);
 *  - every send is fire-and-forget: a rejected/throwing fetch never surfaces.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  assistantSessionStorageKey,
  emitDeliveryEvent,
  getOrCreateAssistantSessionId,
  getPilotParticipant,
  initPilotModeFromUrl,
  isPilotSession,
  sendTelemetryEvent,
} from '../pilotTelemetry';
import { BACKEND_URL, sessionStoragePilotParticipant } from '../../../constants/constant';

const setUrl = (search: string) => {
  window.history.replaceState({}, '', `/${search}`);
};

beforeEach(() => {
  window.sessionStorage.clear();
  setUrl('');
});

afterEach(() => {
  window.sessionStorage.clear();
  setUrl('');
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('initPilotModeFromUrl', () => {
  it('stores a valid participant label from ?pilot=', () => {
    setUrl('?pilot=P3');
    initPilotModeFromUrl();
    expect(getPilotParticipant()).toBe('P3');
    expect(isPilotSession()).toBe(true);
    expect(window.sessionStorage.getItem(sessionStoragePilotParticipant)).toBe('P3');
  });

  it('ignores labels that fail the contract pattern', () => {
    for (const bad of ['P 3', 'p3!', 'a'.repeat(17), '', 'läbel']) {
      window.sessionStorage.clear();
      setUrl(`?pilot=${encodeURIComponent(bad)}`);
      initPilotModeFromUrl();
      expect(getPilotParticipant()).toBeNull();
    }
  });

  it('is a no-op without the parameter — pilot mode stays off', () => {
    initPilotModeFromUrl();
    expect(getPilotParticipant()).toBeNull();
    expect(isPilotSession()).toBe(false);
  });

  it('keeps the label for the tab across later URL changes', () => {
    setUrl('?pilot=P7');
    initPilotModeFromUrl();
    setUrl(''); // SPA navigation strips the query
    expect(getPilotParticipant()).toBe('P7');
  });
});

describe('getPilotParticipant validation on read', () => {
  it('rejects a corrupted stored value', () => {
    window.sessionStorage.setItem(sessionStoragePilotParticipant, 'not a valid label!');
    expect(getPilotParticipant()).toBeNull();
  });
});

describe('getOrCreateAssistantSessionId', () => {
  it('reuses an existing assistant session id instead of inventing a second one', () => {
    window.sessionStorage.setItem(assistantSessionStorageKey, 'session-abc');
    expect(getOrCreateAssistantSessionId()).toBe('session-abc');
  });

  it('creates and persists one id when none exists', () => {
    const id = getOrCreateAssistantSessionId();
    expect(id).toBeTruthy();
    expect(window.sessionStorage.getItem(assistantSessionStorageKey)).toBe(id);
    expect(getOrCreateAssistantSessionId()).toBe(id);
  });
});

describe('sendTelemetryEvent', () => {
  it('does not post anything without a participant label', () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    vi.stubGlobal('fetch', fetchMock);

    sendTelemetryEvent('delivery', { action: 'download' });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts a contract-shaped event with keepalive when pilot mode is active', () => {
    window.sessionStorage.setItem(sessionStoragePilotParticipant, 'P3');
    window.sessionStorage.setItem(assistantSessionStorageKey, 'session-abc');
    const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    vi.stubGlobal('fetch', fetchMock);

    emitDeliveryEvent('download', 'run-123');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${BACKEND_URL}/telemetry/event`);
    expect(init.method).toBe('POST');
    expect(init.keepalive).toBe(true);
    expect(JSON.parse(init.body as string)).toEqual({
      session: 'session-abc',
      participant: 'P3',
      kind: 'delivery',
      payload: { action: 'download', runId: 'run-123' },
    });
  });

  it('omits the runId key when none is at hand', () => {
    window.sessionStorage.setItem(sessionStoragePilotParticipant, 'P3');
    const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    vi.stubGlobal('fetch', fetchMock);

    emitDeliveryEvent('continue_from_repo');

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string).payload).toEqual({ action: 'continue_from_repo' });
  });

  it('swallows a rejected fetch — fire-and-forget never surfaces errors', async () => {
    window.sessionStorage.setItem(sessionStoragePilotParticipant, 'P3');
    const fetchMock = vi.fn(() => Promise.reject(new Error('network down')));
    vi.stubGlobal('fetch', fetchMock);

    expect(() => sendTelemetryEvent('friction', { what: 'retry' })).not.toThrow();
    // Let the rejected promise settle; an unhandled rejection would fail the test.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('swallows a synchronously-throwing fetch', () => {
    window.sessionStorage.setItem(sessionStoragePilotParticipant, 'P3');
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        throw new Error('fetch unavailable');
      }),
    );

    expect(() => sendTelemetryEvent('prompt', { text: 'hello' })).not.toThrow();
  });
});
