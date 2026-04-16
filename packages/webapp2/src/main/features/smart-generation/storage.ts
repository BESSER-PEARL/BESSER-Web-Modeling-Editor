/**
 * BYOK (bring-your-own-key) session storage helpers for the Smart Generator.
 *
 * The user's Anthropic / OpenAI API key is stored ONLY in `sessionStorage`
 * (tab-lifetime, cleared on tab close). It is never written to localStorage
 * or to Redux state. This module is the only place in the frontend that
 * touches the raw key.
 *
 * The optional ``llmModel`` is stored alongside the key so the user's
 * preferred model (e.g. ``o1`` for OpenAI reasoning, ``claude-opus-4-6``
 * for top-tier Claude) persists across runs in the same tab without
 * depending on the modeling agent's payload hint.
 */

import {
  sessionStorageSmartGenApiKey,
  sessionStorageSmartGenLlmModel,
  sessionStorageSmartGenProvider,
} from '../../shared/constants/constant';
import type { SmartGenProvider } from './types';

export interface SessionKey {
  provider: SmartGenProvider;
  apiKey: string;
  /** Explicit model override; undefined = use backend default for the provider. */
  llmModel?: string;
}

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
    if (!apiKey || !provider) return null;
    if (provider !== 'anthropic' && provider !== 'openai') return null;
    const rawLlmModel = window.sessionStorage.getItem(sessionStorageSmartGenLlmModel);
    const llmModel = rawLlmModel && rawLlmModel.trim() ? rawLlmModel.trim() : undefined;
    return { apiKey, provider, llmModel };
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
