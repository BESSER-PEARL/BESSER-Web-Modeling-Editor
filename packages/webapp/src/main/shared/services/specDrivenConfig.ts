/**
 * Smart Generator backend configuration.
 *
 * Fetches `GET /besser_api/spec-driven/config` ONCE per page load (the
 * promise is cached at module level) and falls back to hardcoded
 * defaults — mirroring the backend's current literals — when the
 * request fails or returns an unexpected shape. The BYOK dialogs use
 * this to prefill and clamp the user's budget inputs and to offer the
 * free-tier model choice.
 *
 * Lives in `shared/` (not the spec-driven feature) because the unified
 * key dialog (`shared/components/byok/LlmKeyDialog`) needs the free-tier
 * advertisement too, and shared code must not import from features. The
 * spec-driven feature re-exports this module from its old path
 * (`features/spec-driven/services/specDrivenConfig`) so feature imports
 * and test mocks keep working unchanged.
 */

import { SMART_GEN_CONFIG_ENDPOINT } from '../constants/constant';

export interface SpecDrivenConfigCaps {
  /** Server-enforced ceiling for the per-run cost budget (USD). */
  max_cost_usd_hard_cap: number;
  /** Server-enforced ceiling for the per-run runtime budget (seconds). */
  max_runtime_seconds_hard_cap: number;
  /** Default cost budget applied when the request omits one (USD). */
  default_max_cost_usd: number;
  /** Default runtime budget applied when the request omits one (seconds). */
  default_max_runtime_seconds: number;
}

/** One model a free-tier request may explicitly choose. */
export interface SpecDrivenFreeModel {
  /** The model id, exactly as the server honors it in `llm_model`. */
  id: string;
  /** True for the server's default (primary) free model. */
  default: boolean;
}

/** Keyless server-hosted "Free" tier advertisement. */
export interface SpecDrivenFreeTier {
  /** True when the server has a hosted open-weight endpoint configured. */
  available: boolean;
  /** The pinned model name (e.g. `qwen3-coder:30b`), or null when unavailable. */
  model: string | null;
  /**
   * The model a facilitated pilot session should pre-select, or null/absent
   * when the server has none configured. Pilots are a small, known population
   * we deliberately spend more on; everyone else keeps the ordinary default.
   * Server-owned so it can be swapped without a frontend release.
   */
  pilot_model?: string | null;
  /**
   * The choosable free models — exactly the server's allowlist, in the
   * server's preference order (the primary, then any extra models the server
   * offers on the same endpoint, then a self-hosted fallback if configured).
   * Rendered verbatim, so the set of free models is a server-config change
   * with no frontend deploy. A single entry (or an old backend that doesn't
   * advertise the list) means there is no choice to offer.
   */
  models: SpecDrivenFreeModel[];
}

export interface SpecDrivenConfig {
  caps: SpecDrivenConfigCaps;
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
  free_tier: SpecDrivenFreeTier;
}

/**
 * Hardcoded fallback used when the config endpoint is unreachable (old
 * backend, network failure). Values mirror the backend literals at the
 * time of writing: hard caps 2.0 USD / 900 s, defaults 1.0 USD / 600 s.
 */
export const FALLBACK_SMART_GEN_CONFIG: SpecDrivenConfig = {
  // Mirrors the backend constants (constants.py), used only when GET
  // /spec-driven/config is unreachable. Must not UNDER-state the real ceilings:
  // a stale fallback silently becomes the binding limit in the UI and kills runs
  // the backend would have allowed (all four were stale on 2026-09-14).
  caps: {
    max_cost_usd_hard_cap: 5.0,
    max_runtime_seconds_hard_cap: 2400,
    default_max_cost_usd: 5.0,
    default_max_runtime_seconds: 1200,
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
  free_tier: { available: false, model: null, models: [] },
};

const _isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/**
 * Defensive normalisation — accepts the backend payload only when the
 * caps block is fully numeric; everything else merges over the fallback.
 */
function _normalize(raw: unknown): SpecDrivenConfig {
  const data = raw as Partial<SpecDrivenConfig> | null | undefined;
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
            models: _normalizeFreeModels(data.free_tier.models),
          }
        : FALLBACK_SMART_GEN_CONFIG.free_tier,
  };
}

/**
 * Keep only well-formed `{id, default}` entries. An old backend without the
 * list (or a malformed payload) normalises to `[]` — the UI then offers no
 * model choice, which matches the pinned-model behavior of that backend.
 */
function _normalizeFreeModels(raw: unknown): SpecDrivenFreeModel[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (entry): entry is { id: string; default?: unknown } =>
        !!entry &&
        typeof entry === 'object' &&
        typeof (entry as { id?: unknown }).id === 'string' &&
        ((entry as { id: string }).id.trim().length > 0),
    )
    .map((entry) => ({ id: entry.id.trim(), default: entry.default === true }));
}

/**
 * Resolve the `llm_model` a free-tier run should send for a stored model
 * choice: the stored id only when the server currently advertises it as a
 * NON-default free model; `undefined` otherwise (the default choice — and a
 * stale or unknown id — omits `llm_model`, the exact wire shape of a run
 * without any choice; the backend pins unknown ids to its default anyway).
 */
export function resolveFreeRunModel(
  freeTier: SpecDrivenFreeTier,
  storedChoice: string | null,
): string | undefined {
  if (!storedChoice) return undefined;
  const match = (freeTier.models ?? []).find((m) => m.id === storedChoice);
  return match && !match.default ? match.id : undefined;
}

/**
 * Display label for a free-tier model — the id itself plus a short qualifier.
 * No model names are hardcoded, so the server can add or swap free models on its
 * own, and both BYOK dialogs present the same choice identically.
 *
 * The self-hosted test is the Ollama `name:tag` shape, NOT "has no vendor
 * prefix": a cloud model such as `gpt-5.6-luna` is also slashless and would be
 * labelled "(self-hosted)", misleading about who pays. `:free` is excluded
 * because that suffix marks a vendor's free tier, not our hardware.
 */
export function freeModelLabel(model: SpecDrivenFreeModel): string {
  if (model.default) return `${model.id} (default)`;
  const isOllamaTag = model.id.includes(':') && !model.id.endsWith(':free');
  if (isOllamaTag) return `${model.id} (self-hosted)`;
  return model.id;
}

/**
 * The free-model id to pre-select, honouring a pilot session.
 *
 * Returns the server's `pilot_model` when this tab is a pilot session AND the
 * server still advertises that id as choosable; otherwise the ordinary default.
 * The advertised-list check matters because pre-selecting an id the server would
 * refuse just pins the run back to the default with no explanation.
 *
 * `isPilot` is injected rather than read here so this stays a pure function.
 */
export function preferredFreeModelId(
  freeTier: SpecDrivenFreeTier,
  isPilot: boolean,
): string {
  const models = freeTier.models ?? [];
  if (isPilot && freeTier.pilot_model) {
    const offered = models.some((m) => m.id === freeTier.pilot_model);
    if (offered) return freeTier.pilot_model;
  }
  return defaultFreeModelId(models);
}

/** The default free-model id from the server's advertised list, or `''`. */
export function defaultFreeModelId(models: readonly SpecDrivenFreeModel[]): string {
  return models.find((m) => m.default)?.id ?? models[0]?.id ?? '';
}

let _configPromise: Promise<SpecDrivenConfig> | null = null;

/**
 * Resolve the smart-gen config. Never rejects — failures resolve to
 * `FALLBACK_SMART_GEN_CONFIG` (and clear the cache so a later call can
 * retry against a recovered backend).
 */
export function getSpecDrivenConfig(): Promise<SpecDrivenConfig> {
  if (!_configPromise) {
    _configPromise = (async (): Promise<SpecDrivenConfig> => {
      try {
        const response = await fetch(SMART_GEN_CONFIG_ENDPOINT);
        if (!response.ok) {
          throw new Error(`config endpoint returned ${response.status}`);
        }
        return _normalize(await response.json());
      } catch (err) {
        console.warn('[specDrivenConfig] falling back to defaults:', err);
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
export function _resetSpecDrivenConfigCacheForTests(): void {
  _configPromise = null;
}
