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
  sessionStorageLlmModel,
  sessionStorageLlmProvider,
} from '../constants/constant';

export type LlmProvider = 'anthropic' | 'openai' | 'mistral';

export interface LlmKey {
  provider: LlmProvider;
  apiKey: string;
  /** Explicit model override; undefined = use the backend default for the provider. */
  model?: string;
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
  return value === 'anthropic' || value === 'openai' || value === 'mistral';
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
    return { apiKey, provider, model };
  } catch {
    return null;
  }
}

/**
 * Store the unified BYOK key in sessionStorage. Returns true on success.
 * Pass `model=undefined`/empty to clear a previously saved model preference.
 */
export function writeLlmKey(provider: LlmProvider, apiKey: string, model?: string): boolean {
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
  } catch {
    /* ignore */
  }
}

/** Quick "do we have a key at all?" check that avoids exposing the value. */
export function hasLlmKey(): boolean {
  return readLlmKey() !== null;
}
