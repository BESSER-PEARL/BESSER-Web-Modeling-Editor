/**
 * Smart Generator backend configuration.
 *
 * Fetches `GET /besser_api/smart-gen/config` ONCE per page load (the
 * promise is cached at module level) and falls back to hardcoded
 * defaults — mirroring the backend's current literals — when the
 * request fails or returns an unexpected shape. The BYOK dialog uses
 * this to prefill and clamp the user's budget inputs.
 */

import { SMART_GEN_CONFIG_ENDPOINT } from '../../../shared/constants/constant';

export interface SmartGenConfigCaps {
  /** Server-enforced ceiling for the per-run cost budget (USD). */
  max_cost_usd_hard_cap: number;
  /** Server-enforced ceiling for the per-run runtime budget (seconds). */
  max_runtime_seconds_hard_cap: number;
  /** Default cost budget applied when the request omits one (USD). */
  default_max_cost_usd: number;
  /** Default runtime budget applied when the request omits one (seconds). */
  default_max_runtime_seconds: number;
}

/** Keyless server-hosted "Free" tier advertisement. */
export interface SmartGenFreeTier {
  /** True when the server has a hosted open-weight endpoint configured. */
  available: boolean;
  /** The pinned model name (e.g. `qwen3-coder:30b`), or null when unavailable. */
  model: string | null;
}

export interface SmartGenConfig {
  caps: SmartGenConfigCaps;
  /**
   * How long (seconds) the backend keeps a finished run's output around
   * for download AND in-place editing. Drives the incremental
   * vibe-modify window: a follow-up run can `mode:'modify'` the previous
   * run only while it's still within this TTL.
   */
  download_ttl_seconds: number;
  features: Record<string, boolean>;
  default_models: Record<string, string>;
  supported_providers: string[];
  /** Whether the keyless free tier is offered (and its pinned model). */
  free_tier: SmartGenFreeTier;
}

/**
 * Hardcoded fallback used when the config endpoint is unreachable (old
 * backend, network failure). Values mirror the backend literals at the
 * time of writing: hard caps 2.0 USD / 900 s, defaults 1.0 USD / 600 s.
 */
export const FALLBACK_SMART_GEN_CONFIG: SmartGenConfig = {
  caps: {
    max_cost_usd_hard_cap: 2.0,
    max_runtime_seconds_hard_cap: 900,
    default_max_cost_usd: 1.0,
    default_max_runtime_seconds: 600,
  },
  // Mirrors the backend default (BESSER_LLM_DOWNLOAD_TTL_SECONDS = 1800).
  download_ttl_seconds: 1800,
  features: {},
  default_models: {
    anthropic: 'claude-sonnet-4-6',
    openai: 'gpt-4o',
    mistral: 'mistral-large-latest',
  },
  supported_providers: ['anthropic', 'openai', 'mistral'],
  // Off by default — an old backend that doesn't advertise it must not
  // surface a free option that would 500.
  free_tier: { available: false, model: null },
};

const _isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/**
 * Defensive normalisation — accepts the backend payload only when the
 * caps block is fully numeric; everything else merges over the fallback.
 */
function _normalize(raw: unknown): SmartGenConfig {
  const data = raw as Partial<SmartGenConfig> | null | undefined;
  const caps = data?.caps;
  if (
    !caps ||
    !_isFiniteNumber(caps.max_cost_usd_hard_cap) ||
    !_isFiniteNumber(caps.max_runtime_seconds_hard_cap) ||
    !_isFiniteNumber(caps.default_max_cost_usd) ||
    !_isFiniteNumber(caps.default_max_runtime_seconds)
  ) {
    return FALLBACK_SMART_GEN_CONFIG;
  }
  return {
    caps: {
      max_cost_usd_hard_cap: caps.max_cost_usd_hard_cap,
      max_runtime_seconds_hard_cap: caps.max_runtime_seconds_hard_cap,
      default_max_cost_usd: caps.default_max_cost_usd,
      default_max_runtime_seconds: caps.default_max_runtime_seconds,
    },
    download_ttl_seconds: _isFiniteNumber(data.download_ttl_seconds)
      ? data.download_ttl_seconds
      : FALLBACK_SMART_GEN_CONFIG.download_ttl_seconds,
    features:
      data.features && typeof data.features === 'object'
        ? data.features
        : FALLBACK_SMART_GEN_CONFIG.features,
    default_models:
      data.default_models && typeof data.default_models === 'object'
        ? data.default_models
        : FALLBACK_SMART_GEN_CONFIG.default_models,
    supported_providers: Array.isArray(data.supported_providers)
      ? data.supported_providers
      : FALLBACK_SMART_GEN_CONFIG.supported_providers,
    free_tier:
      data.free_tier && typeof data.free_tier === 'object'
        ? {
            available: data.free_tier.available === true,
            model:
              typeof data.free_tier.model === 'string' && data.free_tier.model
                ? data.free_tier.model
                : null,
          }
        : FALLBACK_SMART_GEN_CONFIG.free_tier,
  };
}

let _configPromise: Promise<SmartGenConfig> | null = null;

/**
 * Resolve the smart-gen config. Never rejects — failures resolve to
 * `FALLBACK_SMART_GEN_CONFIG` (and clear the cache so a later call can
 * retry against a recovered backend).
 */
export function getSmartGenConfig(): Promise<SmartGenConfig> {
  if (!_configPromise) {
    _configPromise = (async (): Promise<SmartGenConfig> => {
      try {
        const response = await fetch(SMART_GEN_CONFIG_ENDPOINT);
        if (!response.ok) {
          throw new Error(`config endpoint returned ${response.status}`);
        }
        return _normalize(await response.json());
      } catch (err) {
        console.warn('[smartGenConfig] falling back to defaults:', err);
        // Allow a retry on the next call — the backend may just be
        // restarting. The CURRENT caller still gets the fallback.
        _configPromise = null;
        return FALLBACK_SMART_GEN_CONFIG;
      }
    })();
  }
  return _configPromise;
}

/** Test-only: reset the module-level promise cache. */
export function _resetSmartGenConfigCacheForTests(): void {
  _configPromise = null;
}
