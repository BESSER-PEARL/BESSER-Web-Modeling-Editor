import { afterEach, describe, expect, it, vi } from 'vitest';

import { _resetBesserVersionCacheForTests, loadBesserVersion } from '../besserVersion';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  _resetBesserVersionCacheForTests();
});

describe('loadBesserVersion — timeout', () => {
  it('resolves undefined (never rejects) when the backend hangs past the timeout', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const result = loadBesserVersion();
    await vi.advanceTimersByTimeAsync(3000);
    await expect(result).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('resolves undefined on a non-OK response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, statusText: 'x', json: async () => ({}) })));
    await expect(loadBesserVersion()).resolves.toBeUndefined();
  });
});
