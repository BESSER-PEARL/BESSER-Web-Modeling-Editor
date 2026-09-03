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
  getSpecDrivenConfig,
  resolveFreeRunModel,
  _resetSpecDrivenConfigCacheForTests,
  type SpecDrivenFreeTier,
} from '../specDrivenConfig';

const BACKEND_CONFIG = {
  caps: {
    max_cost_usd_hard_cap: 3.5,
    max_runtime_seconds_hard_cap: 1200,
    default_max_cost_usd: 0.75,
    default_max_runtime_seconds: 480,
  },
  features: { gap_analysis: true },
  default_models: { anthropic: 'claude-sonnet-4-6', openai: 'gpt-4o' },
  supported_providers: ['anthropic', 'openai'],
};

beforeEach(() => {
  _resetSpecDrivenConfigCacheForTests();
});

afterEach(() => {
  vi.restoreAllMocks();
  _resetSpecDrivenConfigCacheForTests();
});

describe('getSpecDrivenConfig', () => {
  it('returns the backend payload when the fetch succeeds', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(BACKEND_CONFIG), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const config = await getSpecDrivenConfig();
    expect(config.caps.max_cost_usd_hard_cap).toBe(3.5);
    expect(config.caps.default_max_runtime_seconds).toBe(480);
    expect(config.features).toEqual({ gap_analysis: true });
    expect(config.supported_providers).toEqual(['anthropic', 'openai']);
  });

  it('caches the promise — repeated calls cause exactly one fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(BACKEND_CONFIG), { status: 200 }),
    );
    globalThis.fetch = fetchMock;

    const [a, b] = await Promise.all([getSpecDrivenConfig(), getSpecDrivenConfig()]);
    await getSpecDrivenConfig();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
  });

  it('falls back to the hardcoded defaults when the fetch rejects', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down'));

    const config = await getSpecDrivenConfig();
    expect(config).toEqual(FALLBACK_SMART_GEN_CONFIG);
    expect(config.caps.max_cost_usd_hard_cap).toBe(2.0);
    expect(config.caps.max_runtime_seconds_hard_cap).toBe(900);
    expect(config.caps.default_max_cost_usd).toBe(1.0);
    expect(config.caps.default_max_runtime_seconds).toBe(600);
  });

  it('falls back on a non-OK status', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('nope', { status: 404 }));

    const config = await getSpecDrivenConfig();
    expect(config).toEqual(FALLBACK_SMART_GEN_CONFIG);
  });

  it('falls back when the payload caps are malformed', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ caps: { max_cost_usd_hard_cap: 'a lot' } }), {
        status: 200,
      }),
    );

    const config = await getSpecDrivenConfig();
    expect(config).toEqual(FALLBACK_SMART_GEN_CONFIG);
  });

  it('normalises the free-tier model list (well-formed entries only)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ...BACKEND_CONFIG,
          free_tier: {
            available: true,
            model: 'meituan/LongCat-2.0:free',
            models: [
              { id: 'meituan/LongCat-2.0:free', default: true },
              { id: 'qwen3.8:27b', default: false },
              { id: '', default: false }, // malformed — dropped
              { notAnId: true }, // malformed — dropped
            ],
          },
        }),
        { status: 200 },
      ),
    );

    const config = await getSpecDrivenConfig();
    expect(config.free_tier.models).toEqual([
      { id: 'meituan/LongCat-2.0:free', default: true },
      { id: 'qwen3.8:27b', default: false },
    ]);
  });

  it('normalises a missing free-tier model list (old backend) to []', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ...BACKEND_CONFIG,
          free_tier: { available: true, model: 'qwen3-coder:30b' },
        }),
        { status: 200 },
      ),
    );

    const config = await getSpecDrivenConfig();
    expect(config.free_tier.available).toBe(true);
    expect(config.free_tier.models).toEqual([]);
  });

  it('retries after a failure (failure does not poison the cache)', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('backend restarting'))
      .mockResolvedValueOnce(
        new Response(JSON.stringify(BACKEND_CONFIG), { status: 200 }),
      );
    globalThis.fetch = fetchMock;

    const first = await getSpecDrivenConfig();
    expect(first).toEqual(FALLBACK_SMART_GEN_CONFIG);

    const second = await getSpecDrivenConfig();
    expect(second.caps.max_cost_usd_hard_cap).toBe(3.5);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('resolveFreeRunModel', () => {
  const FREE_TIER: SpecDrivenFreeTier = {
    available: true,
    model: 'meituan/LongCat-2.0:free',
    models: [
      { id: 'meituan/LongCat-2.0:free', default: true },
      { id: 'qwen3.8:27b', default: false },
    ],
  };

  it('returns the stored id when it is an advertised non-default model', () => {
    expect(resolveFreeRunModel(FREE_TIER, 'qwen3.8:27b')).toBe('qwen3.8:27b');
  });

  it('omits llm_model for the default choice (identical wire shape to today)', () => {
    expect(resolveFreeRunModel(FREE_TIER, 'meituan/LongCat-2.0:free')).toBeUndefined();
  });

  it('omits llm_model when nothing is stored', () => {
    expect(resolveFreeRunModel(FREE_TIER, null)).toBeUndefined();
  });

  it('omits llm_model for a stale id the server no longer advertises', () => {
    expect(resolveFreeRunModel(FREE_TIER, 'gpt-4o')).toBeUndefined();
  });

  it('tolerates a config without a models list (old backend)', () => {
    const legacy = { available: true, model: 'qwen3-coder:30b' } as SpecDrivenFreeTier;
    expect(resolveFreeRunModel(legacy, 'qwen3.8:27b')).toBeUndefined();
  });
});
