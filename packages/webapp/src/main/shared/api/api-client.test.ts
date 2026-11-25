import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from './api-client';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function pendingFetch() {
  const fetch = vi.fn((_url: unknown, options: RequestInit) => new Promise<Response>((_resolve, reject) => {
    const signal = options.signal!;
    if (signal.aborted) reject(signal.reason);
    else signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  }));
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

describe('API request cancellation', () => {
  it('forwards caller cancellation to fetch and cleans up the timeout', async () => {
    vi.useFakeTimers();
    const fetch = pendingFetch();
    const caller = new AbortController();
    const request = apiClient.post('/generate-gui-audio', {}, { signal: caller.signal, timeout: 600000 });
    const rejected = expect(request).rejects.toMatchObject({ name: 'AbortError' });
    caller.abort();
    await rejected;
    expect(fetch.mock.calls[0][1].signal!.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('still applies the timeout when a caller signal is supplied', async () => {
    vi.useFakeTimers(); pendingFetch();
    const caller = new AbortController();
    const request = apiClient.get('/slow', { signal: caller.signal, timeout: 20 });
    const rejected = expect(request).rejects.toMatchObject({ name: 'TimeoutError' });
    await vi.advanceTimersByTimeAsync(20);
    await rejected;
    expect(caller.signal.aborted).toBe(false);
  });
});
