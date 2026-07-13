/**
 * Unified LLM BYOK (bring-your-own-key) session-storage helpers.
 *
 * ONE key for the whole app: the user's Anthropic / OpenAI / Mistral key is
 * entered once (via the shared LlmKeyDialog, reachable from the assistant
 * drawer, the assistant popup, and the Settings page) and read by BOTH the
 * assistant/modeling-agent AND the Spec-Driven (smart) generator.
 *
 * The raw key lives ONLY in sessionStorage (tab-lifetime, cleared on tab
 * close) — never in localStorage, never in Redux, and it is NEVER logged.
 *
 * This lives in `shared/` (not a feature) so the shared dialog can use it
 * without violating feature isolation. The per-feature helpers
 * (`features/assistant/services/byokStorage`, `features/smart-generation/
 * storage`) now target the same underlying keys.
 */

import {
  sessionStorageLlmApiKey,
  sessionStorageLlmBaseUrl,
  sessionStorageLlmModel,
  sessionStorageLlmProvider,
  sessionStorageSmartGenMaxCostUsd,
  sessionStorageSmartGenMaxRuntimeSeconds,
} from '../constants/constant';

// 'pia' and 'local' are OpenAI-compatible endpoints selected in the dialog for
// UX; on the wire they are sent as provider='openai' + a base_url (see the
// dialog / SSE client / AssistantClient). They only work when the WME backend
// runs locally (and, for 'pia', on the LIST VPN).
export type LlmProvider = 'anthropic' | 'openai' | 'mistral' | 'pia' | 'local';

export interface LlmKey {
  provider: LlmProvider;
  apiKey: string;
  /** Explicit model override; undefined = use the backend default for the provider. */
  model?: string;
  /** OpenAI-compatible base URL for the 'local'/'pia' providers. */
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

function _isProvider(value: string | null): value is LlmProvider {
  return (
    value === 'anthropic' ||
    value === 'openai' ||
    value === 'mistral' ||
    value === 'pia' ||
    value === 'local'
  );
}

/** Read the currently stored unified BYOK key, or `null` if none / unavailable. */
export function readLlmKey(): LlmKey | null {
  if (!_hasSessionStorage()) return null;
  try {
    const apiKey = window.sessionStorage.getItem(sessionStorageLlmApiKey);
    const provider = window.sessionStorage.getItem(sessionStorageLlmProvider);
    if (!apiKey || !_isProvider(provider)) return null;
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
  provider: LlmProvider,
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
    return true;
  } catch {
    return false;
  }
}

/** Remove the stored unified BYOK key. No-op if sessionStorage is unavailable. */
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
/*  Not a secret, but session-scoped so it travels with the key. Reads */
/*  the same keys the smart-generation feature uses, so the two stay   */
/*  consistent no matter which surface sets them.                       */
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
    const rawCost = window.sessionStorage.getItem(sessionStorageSmartGenMaxCostUsd);
    const rawRuntime = window.sessionStorage.getItem(sessionStorageSmartGenMaxRuntimeSeconds);
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
    window.sessionStorage.setItem(sessionStorageSmartGenMaxCostUsd, String(budget.maxCostUsd));
    window.sessionStorage.setItem(
      sessionStorageSmartGenMaxRuntimeSeconds,
      String(Math.round(budget.maxRuntimeSeconds)),
    );
    return true;
  } catch {
    return false;
  }
}
