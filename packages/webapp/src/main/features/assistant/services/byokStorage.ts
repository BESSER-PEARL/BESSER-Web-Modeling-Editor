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
  sessionStorageLlmBaseUrl,
} from '../../../shared/constants/constant';

export type AssistantApiProvider = 'anthropic' | 'openai' | 'mistral' | 'pia' | 'local';

export interface AssistantApiKey {
  provider: AssistantApiProvider;
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

function _isProvider(value: string | null): value is AssistantApiProvider {
  return (
    value === 'anthropic' ||
    value === 'openai' ||
    value === 'mistral' ||
    value === 'pia' ||
    value === 'local'
  );
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
    const rawBase = window.sessionStorage.getItem(sessionStorageLlmBaseUrl);
    const baseUrl = rawBase && rawBase.trim() ? rawBase.trim() : undefined;
    return { apiKey, provider, model, baseUrl };
  } catch {
    return null;
  }
}
// NOTE: write/clear/has helpers removed as dead code — the assistant's key is
// written via the unified shared BYOK dialog; only the read path is used here.
