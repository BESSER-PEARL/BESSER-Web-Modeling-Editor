/**
 * The one LLM key module: BYOK (bring-your-own-key) storage and the provider list.
 *
 * ONE key for the whole app: the user's key is entered once (via the shared
 * LlmKeyDialog, reachable from the assistant drawer, the assistant popup, and
 * the Settings page) and read by the modeling assistant, the Spec-Driven Agent
 * and the Knowledge Graph AI tabs. Nothing else reads or writes these keys.
 *
 * The raw key lives ONLY in sessionStorage (tab-lifetime, cleared on tab
 * close) — never in localStorage, never in Redux, and it is NEVER logged.
 *
 * It lives in `shared/` (not a feature) so the shared dialog and every feature
 * can use it without violating feature isolation.
 */

import {
  sessionStorageLlmApiKey,
  sessionStorageLlmBaseUrl,
  sessionStorageLlmModel,
  sessionStorageLlmProvider,
  sessionStorageSpecDrivenFreeModel,
  sessionStorageSpecDrivenFreeTier,
  sessionStorageSpecDrivenMaxCostUsd,
  sessionStorageSpecDrivenMaxRuntimeSeconds,
} from '../constants/constant';

/**
 * Every LLM provider id the app knows. The app's own provider lists derive from
 * this one; what another service accepts is an explicit allowlist (below).
 * - 'local': the user's OpenAI-compatible server, sent on the wire as
 *   provider='openai' + a base_url; works only when the WME backend runs locally.
 * - 'pia': a gateway whose endpoint the server resolves from its model catalog;
 *   the dialog offers it only where the server lists it.
 * - 'nebius': Nebius Token Factory, an OpenAI-compatible endpoint the backend
 *   pins server-side (no base_url travels with the request).
 * - 'free': the keyless server-hosted tier (Spec-Driven Agent only). Never a
 *   stored key's provider: its opt-in has its own flag (below).
 * - 'sponsored': the server-paid demo tier, chosen only by a `?demo=` link;
 *   never offered in the dialog or stored.
 */
export const LLM_PROVIDERS = [
  'anthropic',
  'openai',
  'mistral',
  'nebius',
  'pia',
  'local',
  'free',
  'sponsored',
] as const;
export type LlmProviderId = (typeof LLM_PROVIDERS)[number];

/** The providers the key dialog offers (all but the demo-link tier). */
export type LlmProvider = Exclude<LlmProviderId, 'sponsored'>;

/** Providers a stored key can carry: the server-paid tiers take no key. */
export type KeyProvider = Exclude<LlmProviderId, 'free' | 'sponsored'>;
export const KEY_PROVIDERS: readonly KeyProvider[] = LLM_PROVIDERS.filter(
  (p): p is KeyProvider => p !== 'free' && p !== 'sponsored',
);

export const isLlmProviderId = (value: unknown): value is LlmProviderId =>
  typeof value === 'string' && (LLM_PROVIDERS as readonly string[]).includes(value);

export const isKeyProvider = (value: unknown): value is KeyProvider =>
  typeof value === 'string' && (KEY_PROVIDERS as readonly string[]).includes(value);

/**
 * Providers whose key the modeling assistant may receive: the agent's
 * SUPPORTED_PROVIDERS (modeling-agent `src/llm/byok.py`), plus 'pia' (a gateway
 * of its model catalog) and 'local' (sent as 'openai' + a base URL). An explicit
 * allowlist: a new key provider reaches the agent only once listed here.
 */
export const ASSISTANT_KEY_PROVIDERS: readonly KeyProvider[] = [
  'anthropic',
  'openai',
  'mistral',
  'nebius',
  'pia',
  'local',
];

export const isAssistantKeyProvider = (value: unknown): value is KeyProvider =>
  typeof value === 'string' && (ASSISTANT_KEY_PROVIDERS as readonly string[]).includes(value);

export interface LlmKey {
  provider: KeyProvider;
  apiKey: string;
  /** Explicit model override; undefined = use the backend default for the provider. */
  model?: string;
  /** The user's OpenAI-compatible base URL for the 'local' provider. */
  baseUrl?: string;
}

/** True when sessionStorage is reachable (it's not in some SSR / privacy modes). */
function _hasSessionStorage(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
  } catch {
    return false;
  }
}

/** Read the currently stored unified BYOK key, or `null` if none / unavailable. */
export function readLlmKey(): LlmKey | null {
  if (!_hasSessionStorage()) return null;
  try {
    const apiKey = window.sessionStorage.getItem(sessionStorageLlmApiKey);
    const provider = window.sessionStorage.getItem(sessionStorageLlmProvider);
    if (!apiKey || !isKeyProvider(provider)) return null;
    const rawModel = window.sessionStorage.getItem(sessionStorageLlmModel);
    const model = rawModel && rawModel.trim() ? rawModel.trim() : undefined;
    const rawBase = window.sessionStorage.getItem(sessionStorageLlmBaseUrl);
    const baseUrl = rawBase && rawBase.trim() ? rawBase.trim() : undefined;
    return { apiKey, provider, model, baseUrl };
  } catch {
    return null;
  }
}

/**
 * Store the unified BYOK key in sessionStorage. Returns true on success.
 * Pass `model=undefined`/empty to clear a previously saved model preference.
 * `baseUrl` is the OpenAI-compatible endpoint for the 'local'/'pia' providers.
 */
export function writeLlmKey(
  provider: KeyProvider,
  apiKey: string,
  model?: string,
  baseUrl?: string,
): boolean {
  if (!_hasSessionStorage()) return false;
  try {
    window.sessionStorage.setItem(sessionStorageLlmApiKey, apiKey);
    window.sessionStorage.setItem(sessionStorageLlmProvider, provider);
    const trimmed = (model ?? '').trim();
    if (trimmed) {
      window.sessionStorage.setItem(sessionStorageLlmModel, trimmed);
    } else {
      window.sessionStorage.removeItem(sessionStorageLlmModel);
    }
    const trimmedBase = (baseUrl ?? '').trim();
    if (trimmedBase) {
      window.sessionStorage.setItem(sessionStorageLlmBaseUrl, trimmedBase);
    } else {
      window.sessionStorage.removeItem(sessionStorageLlmBaseUrl);
    }
    // Saving a real BYOK key means the user is no longer on the keyless free
    // tier — clear the sticky free-tier opt-in so the Spec-Driven Agent runs on
    // THIS key, not the free model. Doing it here makes every key-write path
    // agree, so "a saved key ⟹ not free tier" holds at the storage choke
    // point ("last action wins": picking free later re-sets the flag).
    window.sessionStorage.removeItem(sessionStorageSpecDrivenFreeTier);
    return true;
  } catch {
    return false;
  }
}

/** Remove the stored key, provider, model and base URL. No-op if sessionStorage is unavailable. */
export function clearLlmKey(): void {
  if (!_hasSessionStorage()) return;
  try {
    window.sessionStorage.removeItem(sessionStorageLlmApiKey);
    window.sessionStorage.removeItem(sessionStorageLlmProvider);
    window.sessionStorage.removeItem(sessionStorageLlmModel);
    window.sessionStorage.removeItem(sessionStorageLlmBaseUrl);
  } catch {
    /* ignore */
  }
}

/** Quick "do we have a key at all?" check that avoids exposing the value. */
export function hasLlmKey(): boolean {
  return readLlmKey() !== null;
}

/* ------------------------------------------------------------------ */
/*  Spec-Driven Agent run budget (max cost / max runtime)              */
/*  Not a secret, but session-scoped so it travels with the key.       */
/*  Not cleared with the key: an INVALID_KEY error wipes the key, but  */
/*  the budget should survive the re-entry of a corrected key.         */
/* ------------------------------------------------------------------ */

export interface LlmRunBudget {
  /** Per-run cost budget in USD. */
  maxCostUsd?: number;
  /** Per-run runtime budget in whole seconds. */
  maxRuntimeSeconds?: number;
}

/** Read the saved run budget, or `null` when none / unusable. */
export function readLlmBudget(): LlmRunBudget | null {
  if (!_hasSessionStorage()) return null;
  try {
    const rawCost = window.sessionStorage.getItem(sessionStorageSpecDrivenMaxCostUsd);
    const rawRuntime = window.sessionStorage.getItem(sessionStorageSpecDrivenMaxRuntimeSeconds);
    const budget: LlmRunBudget = {};
    if (rawCost !== null) {
      const cost = Number.parseFloat(rawCost);
      if (Number.isFinite(cost) && cost > 0) budget.maxCostUsd = cost;
    }
    if (rawRuntime !== null) {
      const runtime = Number.parseFloat(rawRuntime);
      if (Number.isFinite(runtime) && runtime > 0) budget.maxRuntimeSeconds = Math.round(runtime);
    }
    if (budget.maxCostUsd === undefined && budget.maxRuntimeSeconds === undefined) return null;
    return budget;
  } catch {
    return null;
  }
}

/** Persist the run budget. Returns true on success. */
export function writeLlmBudget(budget: { maxCostUsd: number; maxRuntimeSeconds: number }): boolean {
  if (!_hasSessionStorage()) return false;
  try {
    window.sessionStorage.setItem(sessionStorageSpecDrivenMaxCostUsd, String(budget.maxCostUsd));
    window.sessionStorage.setItem(
      sessionStorageSpecDrivenMaxRuntimeSeconds,
      String(Math.round(budget.maxRuntimeSeconds)),
    );
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/*  Keyless "Free" tier opt-in + explicit free-model choice            */
/*                                                                     */
/*  Stored on dedicated sessionStorage keys — deliberately NOT in the  */
/*  unified LLM key above (which is shared with the assistant): the    */
/*  free tier authorises a spec-driven run WITHOUT a key, and writing  */
/*  a placeholder into the shared key would break the assistant's own  */
/*  calls. Lives here (shared/) so the unified LlmKeyDialog can offer  */
/*  the free tier without importing from the spec-driven feature.      */
/* ------------------------------------------------------------------ */

/** True when the user has opted into the keyless free tier for the Spec-Driven Agent. */
export function readFreeTierSelected(): boolean {
  if (!_hasSessionStorage()) return false;
  try {
    return window.sessionStorage.getItem(sessionStorageSpecDrivenFreeTier) === '1';
  } catch {
    return false;
  }
}

/** Opt into (or out of) the keyless free tier. */
export function writeFreeTierSelected(selected: boolean): void {
  if (!_hasSessionStorage()) return;
  try {
    if (selected) {
      window.sessionStorage.setItem(sessionStorageSpecDrivenFreeTier, '1');
    } else {
      window.sessionStorage.removeItem(sessionStorageSpecDrivenFreeTier);
    }
  } catch {
    /* ignore */
  }
}

/**
 * The explicitly chosen free-tier model id, or `null` for the server's
 * default. Only ever holds an id from the server's advertised free-model
 * list (the backend enforces its allowlist regardless — an unknown id is
 * pinned back to the default model server-side).
 */
export function readFreeTierModel(): string | null {
  if (!_hasSessionStorage()) return null;
  try {
    const raw = window.sessionStorage.getItem(sessionStorageSpecDrivenFreeModel);
    return raw && raw.trim() ? raw.trim() : null;
  } catch {
    return null;
  }
}

/**
 * Persist the free-tier model choice. Pass `null` (or empty) to return to
 * the server's default — the stored id is then removed so the generate
 * request omits `llm_model`, exactly as before this choice existed.
 */
export function writeFreeTierModel(modelId: string | null): void {
  if (!_hasSessionStorage()) return;
  try {
    const trimmed = (modelId ?? '').trim();
    if (trimmed) {
      window.sessionStorage.setItem(sessionStorageSpecDrivenFreeModel, trimmed);
    } else {
      window.sessionStorage.removeItem(sessionStorageSpecDrivenFreeModel);
    }
  } catch {
    /* ignore */
  }
}
