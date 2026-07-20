/**
 * BYOK (bring-your-own-key) session storage helpers for the Smart Generator.
 *
 * The user's Anthropic / OpenAI / Mistral API key is stored ONLY in
 * `sessionStorage` (tab-lifetime, cleared on tab close). It is never written to localStorage
 * or to Redux state. This module is the only place in the frontend that
 * touches the raw key.
 *
 * The optional ``llmModel`` is stored alongside the key so the user's
 * preferred model (e.g. ``o1`` for OpenAI reasoning, ``claude-opus-4-6``
 * for top-tier Claude) persists across runs in the same tab without
 * depending on the modeling agent's payload hint.
 */

import {
  localStorageSmartGenLastRunPrefix,
  sessionStorageLlmBaseUrl,
  sessionStorageSmartGenApiKey,
  sessionStorageSmartGenFreeTier,
  sessionStorageSmartGenLlmModel,
  sessionStorageSmartGenMaxCostUsd,
  sessionStorageSmartGenMaxRuntimeSeconds,
  sessionStorageSmartGenProvider,
} from '../../shared/constants/constant';
import { isValidRunId, type LastRunRecord } from './runModeDecision';
import type { SmartGenProvider } from './types';

export interface SessionKey {
  provider: SmartGenProvider;
  apiKey: string;
  /** Explicit model override; undefined = use backend default for the provider. */
  llmModel?: string;
  /** OpenAI-compatible base URL for the 'local'/'pia' providers. */
  baseUrl?: string;
}

const _VALID_PROVIDERS: ReadonlySet<string> = new Set([
  'anthropic',
  'openai',
  'mistral',
  'pia',
  'local',
  'free',
]);

/** True when sessionStorage is reachable (it's not in some SSR / privacy modes). */
function _hasSessionStorage(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
  } catch {
    return false;
  }
}

/** Read the currently stored BYOK key, or `null` if none / unavailable. */
export function readSessionKey(): SessionKey | null {
  if (!_hasSessionStorage()) return null;
  try {
    const apiKey = window.sessionStorage.getItem(sessionStorageSmartGenApiKey);
    const provider = window.sessionStorage.getItem(sessionStorageSmartGenProvider);
    if (!apiKey || !provider || !_VALID_PROVIDERS.has(provider)) return null;
    const rawLlmModel = window.sessionStorage.getItem(sessionStorageSmartGenLlmModel);
    const llmModel = rawLlmModel && rawLlmModel.trim() ? rawLlmModel.trim() : undefined;
    const rawBase = window.sessionStorage.getItem(sessionStorageLlmBaseUrl);
    const baseUrl = rawBase && rawBase.trim() ? rawBase.trim() : undefined;
    return { apiKey, provider: provider as SmartGenProvider, llmModel, baseUrl };
  } catch {
    return null;
  }
}

/**
 * Store a BYOK key in sessionStorage. Returns true on success.
 *
 * Pass ``llmModel=undefined`` (or empty string) to clear any previously
 * saved model preference; the backend will then fall back to the default
 * model for the provider.
 */
export function writeSessionKey(
  provider: SmartGenProvider,
  apiKey: string,
  llmModel?: string,
): boolean {
  if (!_hasSessionStorage()) return false;
  try {
    window.sessionStorage.setItem(sessionStorageSmartGenApiKey, apiKey);
    window.sessionStorage.setItem(sessionStorageSmartGenProvider, provider);
    const trimmed = (llmModel ?? '').trim();
    if (trimmed) {
      window.sessionStorage.setItem(sessionStorageSmartGenLlmModel, trimmed);
    } else {
      window.sessionStorage.removeItem(sessionStorageSmartGenLlmModel);
    }
    return true;
  } catch {
    return false;
  }
}

/** Remove the stored BYOK key. No-op if sessionStorage is unavailable. */
export function clearSessionKey(): void {
  if (!_hasSessionStorage()) return;
  try {
    window.sessionStorage.removeItem(sessionStorageSmartGenApiKey);
    window.sessionStorage.removeItem(sessionStorageSmartGenProvider);
    window.sessionStorage.removeItem(sessionStorageSmartGenLlmModel);
  } catch {
    /* ignore */
  }
}

/** Quick "do we have a key at all?" check that avoids exposing the value. */
export function hasSessionKey(): boolean {
  return readSessionKey() !== null;
}

/* ------------------------------------------------------------------ */
/*  Keyless "Free" tier opt-in                                          */
/*                                                                      */
/*  Stored on its OWN sessionStorage flag — deliberately NOT in the     */
/*  unified LLM key (which is shared with the assistant). The free tier */
/*  authorises a smart-gen run WITHOUT a key; the trigger consults this */
/*  alongside readSessionKey().                                         */
/* ------------------------------------------------------------------ */

/** True when the user has opted into the keyless free tier for smart-gen. */
export function readFreeTierSelected(): boolean {
  if (!_hasSessionStorage()) return false;
  try {
    return window.sessionStorage.getItem(sessionStorageSmartGenFreeTier) === '1';
  } catch {
    return false;
  }
}

/** Opt into (or out of) the keyless free tier. */
export function writeFreeTierSelected(selected: boolean): void {
  if (!_hasSessionStorage()) return;
  try {
    if (selected) {
      window.sessionStorage.setItem(sessionStorageSmartGenFreeTier, '1');
    } else {
      window.sessionStorage.removeItem(sessionStorageSmartGenFreeTier);
    }
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/*  Run budget (max cost / max runtime)                                 */
/* ------------------------------------------------------------------ */

export interface SessionBudget {
  /** Per-run cost budget in USD. */
  maxCostUsd?: number;
  /** Per-run runtime budget in whole seconds. */
  maxRuntimeSeconds?: number;
}

/**
 * Read the user's saved run budget, or `null` when none is stored /
 * the stored values are unusable. The budget is NOT a secret — it
 * still lives in sessionStorage so it travels with the key/model it
 * applies to and resets on tab close, matching the BYOK lifecycle.
 *
 * Intentionally NOT cleared by `clearSessionKey` (an INVALID_KEY error
 * wipes the key, but the user's budget preference should survive the
 * re-entry of a corrected key).
 */
export function readSessionBudget(): SessionBudget | null {
  if (!_hasSessionStorage()) return null;
  try {
    const rawCost = window.sessionStorage.getItem(sessionStorageSmartGenMaxCostUsd);
    const rawRuntime = window.sessionStorage.getItem(
      sessionStorageSmartGenMaxRuntimeSeconds,
    );
    const budget: SessionBudget = {};
    if (rawCost !== null) {
      const cost = Number.parseFloat(rawCost);
      if (Number.isFinite(cost) && cost > 0) budget.maxCostUsd = cost;
    }
    if (rawRuntime !== null) {
      const runtime = Number.parseFloat(rawRuntime);
      if (Number.isFinite(runtime) && runtime > 0) {
        budget.maxRuntimeSeconds = Math.round(runtime);
      }
    }
    if (budget.maxCostUsd === undefined && budget.maxRuntimeSeconds === undefined) {
      return null;
    }
    return budget;
  } catch {
    return null;
  }
}

/** Persist the user's run budget. Returns true on success. */
export function writeSessionBudget(budget: {
  maxCostUsd: number;
  maxRuntimeSeconds: number;
}): boolean {
  if (!_hasSessionStorage()) return false;
  try {
    window.sessionStorage.setItem(
      sessionStorageSmartGenMaxCostUsd,
      String(budget.maxCostUsd),
    );
    window.sessionStorage.setItem(
      sessionStorageSmartGenMaxRuntimeSeconds,
      String(Math.round(budget.maxRuntimeSeconds)),
    );
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/*  Per-project last successful run (incremental vibe-modify)           */
/*                                                                      */
/*  Unlike the BYOK key/budget above (sessionStorage, tab-lifetime),    */
/*  the last-run pointer lives in LOCALSTORAGE so a follow-up "add      */
/*  feature X" can still edit the previous app in place after a reload. */
/*  It is not a secret — just a run id + timestamp keyed by project.    */
/* ------------------------------------------------------------------ */

/** True when localStorage is reachable (it's not in some privacy modes). */
function _hasLocalStorage(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  } catch {
    return false;
  }
}

const _lastRunKey = (projectId: string): string =>
  `${localStorageSmartGenLastRunPrefix}${projectId}`;

/**
 * Read the stored last successful run for a project, or `null` when none
 * / unusable. Validates the run id (32-hex) and timestamp so a corrupted
 * or hand-edited entry degrades to "no last run" (a fresh build) rather
 * than sending a bad `base_run_id`.
 */
export function readProjectLastRun(projectId: string): LastRunRecord | null {
  if (!projectId || !_hasLocalStorage()) return null;
  try {
    const raw = window.localStorage.getItem(_lastRunKey(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LastRunRecord> | null;
    if (!parsed || !isValidRunId(parsed.runId)) return null;
    const at = typeof parsed.at === 'number' && Number.isFinite(parsed.at) ? parsed.at : 0;
    return { runId: parsed.runId, at };
  } catch {
    return null;
  }
}

/** Persist the last successful run for a project. No-op on failure. */
export function writeProjectLastRun(
  projectId: string,
  runId: string,
  at: number,
): void {
  if (!projectId || !isValidRunId(runId) || !_hasLocalStorage()) return;
  try {
    window.localStorage.setItem(
      _lastRunKey(projectId),
      JSON.stringify({ runId, at }),
    );
  } catch {
    /* ignore */
  }
}
