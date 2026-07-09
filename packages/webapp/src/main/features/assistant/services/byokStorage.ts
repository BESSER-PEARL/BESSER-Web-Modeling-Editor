/**
 * BYOK (bring-your-own-key) session storage helpers for the AI assistant.
 *
 * The user's Anthropic / OpenAI / Mistral API key is stored ONLY in
 * `sessionStorage` (tab-lifetime, cleared on tab close). It is never written
 * to localStorage or to Redux state. This module is the only place in the
 * assistant feature that touches the raw key.
 *
 * Intentionally self-contained: it does NOT import from the smart-generation
 * feature (feature isolation). The assistant keeps its own independent key,
 * separate from the Spec-Driven Agent's BYOK key.
 *
 * The raw key is NEVER logged anywhere.
 */

import {
  sessionStorageAssistantApiKey,
  sessionStorageAssistantModel,
  sessionStorageAssistantProvider,
} from '../../../shared/constants/constant';

export type AssistantApiProvider = 'anthropic' | 'openai' | 'mistral';

export interface AssistantApiKey {
  provider: AssistantApiProvider;
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

function _isProvider(value: string | null): value is AssistantApiProvider {
  return value === 'anthropic' || value === 'openai' || value === 'mistral';
}

/** Read the currently stored assistant BYOK key, or `null` if none / unavailable. */
export function readAssistantApiKey(): AssistantApiKey | null {
  if (!_hasSessionStorage()) return null;
  try {
    const apiKey = window.sessionStorage.getItem(sessionStorageAssistantApiKey);
    const provider = window.sessionStorage.getItem(sessionStorageAssistantProvider);
    if (!apiKey || !_isProvider(provider)) return null;
    const rawModel = window.sessionStorage.getItem(sessionStorageAssistantModel);
    const model = rawModel && rawModel.trim() ? rawModel.trim() : undefined;
    return { apiKey, provider, model };
  } catch {
    return null;
  }
}

/**
 * Store an assistant BYOK key in sessionStorage. Returns true on success.
 *
 * Pass `model=undefined` (or empty string) to clear any previously saved
 * model preference; the backend then falls back to its default for the provider.
 */
export function writeAssistantApiKey(
  provider: AssistantApiProvider,
  apiKey: string,
  model?: string,
): boolean {
  if (!_hasSessionStorage()) return false;
  try {
    window.sessionStorage.setItem(sessionStorageAssistantApiKey, apiKey);
    window.sessionStorage.setItem(sessionStorageAssistantProvider, provider);
    const trimmed = (model ?? '').trim();
    if (trimmed) {
      window.sessionStorage.setItem(sessionStorageAssistantModel, trimmed);
    } else {
      window.sessionStorage.removeItem(sessionStorageAssistantModel);
    }
    return true;
  } catch {
    return false;
  }
}

/** Remove the stored assistant BYOK key. No-op if sessionStorage is unavailable. */
export function clearAssistantApiKey(): void {
  if (!_hasSessionStorage()) return;
  try {
    window.sessionStorage.removeItem(sessionStorageAssistantApiKey);
    window.sessionStorage.removeItem(sessionStorageAssistantProvider);
    window.sessionStorage.removeItem(sessionStorageAssistantModel);
  } catch {
    /* ignore */
  }
}

/** Quick "do we have a key at all?" check that avoids exposing the value. */
export function hasAssistantApiKey(): boolean {
  return readAssistantApiKey() !== null;
}
