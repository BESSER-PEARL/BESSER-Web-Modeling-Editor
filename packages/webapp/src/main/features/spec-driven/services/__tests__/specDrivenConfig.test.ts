/**
 * Unit tests for the smart-gen config service.
 *
 * Covers:
 *   - Happy path: backend payload is normalised and returned
 *   - Module-level promise cache: only ONE fetch per page load
 *   - Fallback on network failure / non-OK status / malformed payload
 *   - Failure clears the cache so a later call can retry
 *   - Free-model list: normalisation, run-model resolution, derived labels
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  FALLBACK_SMART_GEN_CONFIG,
  defaultFreeModelId,
  freeModelLabel,
  preferredFreeModelId,
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
    // These must mirror the backend constants. A fallback that UNDER-states
    // the real ceilings silently becomes the binding limit in the UI and kills
    // runs the backend would have allowed.
    expect(config.caps.max_cost_usd_hard_cap).toBe(5.0);
    expect(config.caps.max_runtime_seconds_hard_cap).toBe(2400);
    expect(config.caps.default_max_cost_usd).toBe(5.0);
    expect(config.caps.default_max_runtime_seconds).toBe(1200);
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

  it('normalises a free-tier list of any length (server adds a model)', async () => {
    // The server may offer extra models on its own endpoint alongside the
    // default (e.g. an unmetered one with no daily quota). The list is passed
    // through verbatim — order and the single default preserved — so no
    // frontend change is needed when the server adds one.
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ...BACKEND_CONFIG,
          free_tier: {
            available: true,
            model: 'meituan/LongCat-2.0:free',
            models: [
              { id: 'meituan/LongCat-2.0:free', default: true },
              { id: 'poolside/laguna-s-2.1-free', default: false },
              { id: 'qwen3.8:27b', default: false },
            ],
          },
        }),
        { status: 200 },
      ),
    );

    const config = await getSpecDrivenConfig();
    expect(config.free_tier.models).toEqual([
      { id: 'meituan/LongCat-2.0:free', default: true },
      { id: 'poolside/laguna-s-2.1-free', default: false },
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
      { id: 'poolside/laguna-s-2.1-free', default: false },
      { id: 'qwen3.8:27b', default: false },
    ],
  };

  it('returns the stored id when it is an advertised non-default model', () => {
    expect(resolveFreeRunModel(FREE_TIER, 'qwen3.8:27b')).toBe('qwen3.8:27b');
  });

  // A pilot's run is the one case where "send nothing" is NOT neutral: the
  // server fills the gap with BESSER_FREE_LLM_PILOT_MODEL. So a pilot's
  // deliberate pick has to travel even when it is the public default —
  // otherwise choosing LongCat would silently hand them the pilot model.
  it('sends a pilot the DEFAULT model explicitly when they picked it', () => {
    expect(resolveFreeRunModel(FREE_TIER, 'meituan/LongCat-2.0:free', true))
      .toBe('meituan/LongCat-2.0:free');
  });

  it('still omits the default for a non-pilot', () => {
    expect(resolveFreeRunModel(FREE_TIER, 'meituan/LongCat-2.0:free', false))
      .toBeUndefined();
  });

  it('sends a pilot their non-default pick unchanged', () => {
    expect(resolveFreeRunModel(FREE_TIER, 'qwen3.8:27b', true)).toBe('qwen3.8:27b');
  });

  it('omits an unadvertised stored id for a pilot too', () => {
    // Letting a stale id through would pin the run to something the server
    // does not serve; the pilot default is the better landing place.
    expect(resolveFreeRunModel(FREE_TIER, 'retired-model', true)).toBeUndefined();
  });

  it('omits nothing-stored for a pilot, so the SERVER applies their model', () => {
    expect(resolveFreeRunModel(FREE_TIER, null, true)).toBeUndefined();
  });

  it('returns a non-default model on the server default endpoint too', () => {
    // Nothing here distinguishes "same endpoint as the default" from
    // "self-hosted fallback" — the server owns that routing, the client only
    // echoes the id it was offered.
    expect(resolveFreeRunModel(FREE_TIER, 'poolside/laguna-s-2.1-free')).toBe(
      'poolside/laguna-s-2.1-free',
    );
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

describe('freeModelLabel', () => {
  it('marks the default entry', () => {
    expect(freeModelLabel({ id: 'meituan/LongCat-2.0:free', default: true })).toBe(
      'meituan/LongCat-2.0:free (default)',
    );
  });

  it('does NOT call a slashless cloud model self-hosted', () => {
    // The rule used to be "no vendor prefix => self-hosted", which held only
    // while the Ollama box was the one slashless entry. gpt-5.6-luna has no
    // prefix and is a PAID cloud model; labelling it self-hosted is untrue and
    // misleads about who pays.
    expect(freeModelLabel({ id: 'gpt-5.6-luna', default: false })).toBe(
      'gpt-5.6-luna',
    );
  });

  it('keeps the vendor free-tier suffix out of the self-hosted label', () => {
    expect(freeModelLabel({ id: 'poolside/laguna-s-2.1-free', default: false })).toBe(
      'poolside/laguna-s-2.1-free',
    );
    expect(
      freeModelLabel({ id: 'inclusionai/ling-3.0-flash-sante:free', default: false }),
    ).toBe('inclusionai/ling-3.0-flash-sante:free');
  });

  it('marks a bare (Ollama-style) non-default id as self-hosted', () => {
    expect(freeModelLabel({ id: 'qwen3.8:27b', default: false })).toBe(
      'qwen3.8:27b (self-hosted)',
    );
  });

  it('leaves a vendor-prefixed non-default id unqualified', () => {
    // Another cloud model the server offers alongside the default: its id
    // already names the vendor, and it is NOT self-hosted, so no qualifier.
    expect(freeModelLabel({ id: 'poolside/laguna-s-2.1-free', default: false })).toBe(
      'poolside/laguna-s-2.1-free',
    );
  });
});

describe('defaultFreeModelId', () => {
  it('returns the flagged default regardless of its position', () => {
    expect(
      defaultFreeModelId([
        { id: 'poolside/laguna-s-2.1-free', default: false },
        { id: 'meituan/LongCat-2.0:free', default: true },
      ]),
    ).toBe('meituan/LongCat-2.0:free');
  });

  it('falls back to the first entry when nothing is flagged', () => {
    expect(defaultFreeModelId([{ id: 'a', default: false }, { id: 'b', default: false }])).toBe(
      'a',
    );
  });

  it('returns an empty string for an empty list', () => {
    expect(defaultFreeModelId([])).toBe('');
  });
});

describe('preferredFreeModelId', () => {
  const tier = (extra: Record<string, unknown> = {}) =>
    ({
      available: true,
      model: 'meituan/LongCat-2.0:free',
      models: [
        { id: 'meituan/LongCat-2.0:free', default: true },
        { id: 'gpt-5.6-luna', default: false },
        { id: 'qwen3-coder:30b', default: false },
      ],
      ...extra,
    }) as never;

  it('gives an ordinary visitor the server default', () => {
    expect(preferredFreeModelId(tier({ pilot_model: 'gpt-5.6-luna' }), false)).toBe(
      'meituan/LongCat-2.0:free',
    );
  });

  it('gives a pilot session the server pilot model', () => {
    expect(preferredFreeModelId(tier({ pilot_model: 'gpt-5.6-luna' }), true)).toBe(
      'gpt-5.6-luna',
    );
  });

  it('falls back to the default when no pilot model is configured', () => {
    expect(preferredFreeModelId(tier(), true)).toBe('meituan/LongCat-2.0:free');
    expect(preferredFreeModelId(tier({ pilot_model: null }), true)).toBe(
      'meituan/LongCat-2.0:free',
    );
  });

  it('ignores a pilot model the server no longer advertises', () => {
    // Pre-selecting an id the server would refuse pins the run back to the
    // default with no explanation, so treat it as unset.
    expect(preferredFreeModelId(tier({ pilot_model: 'retired-model' }), true)).toBe(
      'meituan/LongCat-2.0:free',
    );
  });
});
