/**
 * Lab mode comes from the `lab` field of `GET /spec-driven/config`: only a
 * server that says `lab.enabled: true` makes this instance a BESSER Lab.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getLabEnabled, isLabConfigKnown, peekLabEnabled, resolveLabEnabled } from '../labConfig';
import { _resetSpecDrivenConfigCacheForTests, getSpecDrivenConfig } from '../specDrivenConfig';

const CONFIG = {
  caps: {
    max_cost_usd_hard_cap: 5,
    max_runtime_seconds_hard_cap: 2400,
    default_max_cost_usd: 5,
    default_max_runtime_seconds: 2400,
  },
};

const serve = (body: unknown) =>
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })),
  );

beforeEach(() => {
  _resetSpecDrivenConfigCacheForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  _resetSpecDrivenConfigCacheForTests();
});

describe('lab config', () => {
  it('is enabled when the server says so, and peeking answers once the config has loaded', async () => {
    serve({ ...CONFIG, lab: { enabled: true } });

    expect(peekLabEnabled()).toBe(false);
    await expect(getLabEnabled()).resolves.toBe(true);
    expect(peekLabEnabled()).toBe(true);
    expect((await getSpecDrivenConfig()).lab).toEqual({ enabled: true });
  });

  it('is off on a server without the field (every instance that is not a lab)', async () => {
    serve(CONFIG);

    await expect(getLabEnabled()).resolves.toBe(false);
    expect(peekLabEnabled()).toBe(false);
    expect((await getSpecDrivenConfig()).lab).toEqual({ enabled: false });
  });

  it('is off for anything but a literal true', async () => {
    serve({ ...CONFIG, lab: { enabled: 'yes' } });

    await expect(getLabEnabled()).resolves.toBe(false);
  });

  it('is off when the config cannot be loaded', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(getLabEnabled()).resolves.toBe(false);
    expect(peekLabEnabled()).toBe(false);
    expect(isLabConfigKnown()).toBe(false);
  });

  // E2E A-3: with the lab backend down, a failed config load read as "not a lab" sent the message to the modeling agent.
  describe('resolveLabEnabled', () => {
    const okResponse = (body: unknown) =>
      new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

    it('says "not known" (null), not "off", when the config cannot be loaded after a retry', async () => {
      vi.useFakeTimers();
      try {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
        vi.stubGlobal('fetch', fetchMock);
        const answer = resolveLabEnabled();
        await vi.runAllTimersAsync();
        await expect(answer).resolves.toBeNull();
        expect(fetchMock).toHaveBeenCalledTimes(2);
      } finally {
        vi.useRealTimers();
      }
    });

    it('answers from the retry when the backend comes back', async () => {
      vi.useFakeTimers();
      try {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.stubGlobal(
          'fetch',
          vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue(okResponse({ ...CONFIG, lab: { enabled: true } })),
        );
        const answer = resolveLabEnabled();
        await vi.runAllTimersAsync();
        await expect(answer).resolves.toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });

    it('is false on a server that answered without the lab', async () => {
      serve(CONFIG);
      await expect(resolveLabEnabled()).resolves.toBe(false);
    });
  });

  it('tells a server that answered from one that could not be reached', async () => {
    serve(CONFIG);
    expect(isLabConfigKnown()).toBe(false);
    await getLabEnabled();
    expect(isLabConfigKnown()).toBe(true);
  });
});
