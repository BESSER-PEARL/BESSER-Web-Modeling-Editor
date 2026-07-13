/**
 * Unit tests for the smart-gen config service.
 *
 * Covers:
 *   - Happy path: backend payload is normalised and returned
 *   - Module-level promise cache: only ONE fetch per page load
 *   - Fallback on network failure / non-OK status / malformed payload
 *   - Failure clears the cache so a later call can retry
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  FALLBACK_SMART_GEN_CONFIG,
  getSmartGenConfig,
  _resetSmartGenConfigCacheForTests,
} from '../smartGenConfig';

const BACKEND_CONFIG = {
  caps: {
    max_cost_usd_hard_cap: 3.5,
    max_runtime_seconds_hard_cap: 1200,
    default_max_cost_usd: 0.75,
    default_max_runtime_seconds: 480,
  },
  auth: { required: true, provider: 'github' },
  features: { gap_analysis: true },
  default_models: { anthropic: 'claude-sonnet-4-6', openai: 'gpt-4o' },
  supported_providers: ['anthropic', 'openai'],
};

beforeEach(() => {
  _resetSmartGenConfigCacheForTests();
});

afterEach(() => {
  vi.restoreAllMocks();
  _resetSmartGenConfigCacheForTests();
});

describe('getSmartGenConfig', () => {
  it('returns the backend payload when the fetch succeeds', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(BACKEND_CONFIG), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const config = await getSmartGenConfig();
    expect(config.caps.max_cost_usd_hard_cap).toBe(3.5);
    expect(config.caps.default_max_runtime_seconds).toBe(480);
    expect(config.features).toEqual({ gap_analysis: true });
    expect(config.auth).toEqual({ required: true, provider: 'github' });
    expect(config.supported_providers).toEqual(['anthropic', 'openai']);
  });

  it('caches the promise — repeated calls cause exactly one fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(BACKEND_CONFIG), { status: 200 }),
    );
    globalThis.fetch = fetchMock;

    const [a, b] = await Promise.all([getSmartGenConfig(), getSmartGenConfig()]);
    await getSmartGenConfig();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
  });

  it('falls back to the hardcoded defaults when the fetch rejects', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down'));

    const config = await getSmartGenConfig();
    expect(config).toEqual(FALLBACK_SMART_GEN_CONFIG);
    expect(config.caps.max_cost_usd_hard_cap).toBe(2.0);
    expect(config.caps.max_runtime_seconds_hard_cap).toBe(900);
    expect(config.caps.default_max_cost_usd).toBe(1.0);
    expect(config.caps.default_max_runtime_seconds).toBe(600);
  });

  it('falls back on a non-OK status', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('nope', { status: 404 }));

    const config = await getSmartGenConfig();
    expect(config).toEqual(FALLBACK_SMART_GEN_CONFIG);
  });

  it('falls back when the payload caps are malformed', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ caps: { max_cost_usd_hard_cap: 'a lot' } }), {
        status: 200,
      }),
    );

    const config = await getSmartGenConfig();
    expect(config).toEqual(FALLBACK_SMART_GEN_CONFIG);
  });

  it('retries after a failure (failure does not poison the cache)', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('backend restarting'))
      .mockResolvedValueOnce(
        new Response(JSON.stringify(BACKEND_CONFIG), { status: 200 }),
      );
    globalThis.fetch = fetchMock;

    const first = await getSmartGenConfig();
    expect(first).toEqual(FALLBACK_SMART_GEN_CONFIG);

    const second = await getSmartGenConfig();
    expect(second.caps.max_cost_usd_hard_cap).toBe(3.5);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
