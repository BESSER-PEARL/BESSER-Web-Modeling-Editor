/**
 * Unified BYOK key storage — regression tests.
 *
 * The load-bearing invariant: saving a real key clears the Spec-Driven Agent's
 * sticky "free tier" opt-in. Without it, a user who entered their OpenAI key via
 * the unified dialog (assistant popup / drawer / Settings) still had their
 * spec-driven run dispatched on the keyless free tier, because free is the
 * default and startRun's `freeSelected ? 'free' : key` picks free whenever the
 * flag is set — even with a key present.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  clearLlmKey,
  isKeyProvider,
  isLlmProviderId,
  KEY_PROVIDERS,
  LLM_PROVIDERS,
  readFreeTierSelected,
  readLlmBudget,
  readLlmKey,
  writeFreeTierSelected,
  writeLlmBudget,
  writeLlmKey,
} from '../llmKeyStorage';
import { sessionStorageSpecDrivenFreeTier } from '../../constants/constant';

beforeEach(() => {
  window.sessionStorage.clear();
});

afterEach(() => {
  window.sessionStorage.clear();
});

describe('writeLlmKey ↔ free-tier flag', () => {
  it('clears the sticky free-tier flag when a real key is saved', () => {
    // The user is on the default free tier...
    writeFreeTierSelected(true);
    expect(readFreeTierSelected()).toBe(true);

    // ...then pastes an OpenAI key via the unified dialog.
    const ok = writeLlmKey('openai', 'sk-test-123', 'gpt-4o');
    expect(ok).toBe(true);

    // The free opt-in must be gone so the run uses the key, not the free model.
    expect(readFreeTierSelected()).toBe(false);
    expect(window.sessionStorage.getItem(sessionStorageSpecDrivenFreeTier)).toBeNull();
  });

  it('persists the key/provider so readLlmKey() sees it', () => {
    writeLlmKey('openai', 'sk-test-123', 'gpt-4o');
    const key = readLlmKey();
    expect(key).not.toBeNull();
    expect(key?.provider).toBe('openai');
    expect(key?.apiKey).toBe('sk-test-123');
    expect(key?.model).toBe('gpt-4o');
  });

  it('removing the key does NOT force the free tier back on', () => {
    // Removing a key should leave the user keyless — not silently re-opt them
    // into free (they may want to enter a different key next).
    writeLlmKey('anthropic', 'sk-ant-123');
    expect(readFreeTierSelected()).toBe(false);
    clearLlmKey();
    expect(readFreeTierSelected()).toBe(false);
  });
});

describe('provider lists', () => {
  it('knows every provider once, and a key carries all but the server-paid tiers', () => {
    expect(LLM_PROVIDERS).toEqual([
      'anthropic', 'openai', 'mistral', 'nebius', 'pia', 'gateway', 'local', 'free', 'sponsored',
    ]);
    expect(KEY_PROVIDERS).toEqual(['anthropic', 'openai', 'mistral', 'nebius', 'pia', 'gateway', 'local']);
    expect(isLlmProviderId('sponsored')).toBe(true);
    expect(isLlmProviderId('gemini')).toBe(false);
    expect(isKeyProvider('free')).toBe(false);
    expect(isKeyProvider('sponsored')).toBe(false);
    expect(isKeyProvider(null)).toBe(false);
  });
});

describe('storage on disk', () => {
  // Users' saved keys live under these names; renaming one silently drops their key.
  it('writes the four besser_llm_* sessionStorage keys', () => {
    writeLlmKey('local', 'ollama', 'qwen2.5-coder:7b', 'http://localhost:11434/v1');
    expect(window.sessionStorage.getItem('besser_llm_api_key')).toBe('ollama');
    expect(window.sessionStorage.getItem('besser_llm_provider')).toBe('local');
    expect(window.sessionStorage.getItem('besser_llm_model')).toBe('qwen2.5-coder:7b');
    expect(window.sessionStorage.getItem('besser_llm_base_url')).toBe('http://localhost:11434/v1');
    expect(window.localStorage.getItem('besser_llm_api_key')).toBeNull();
  });

  it('reads a key written by an earlier release under the same names', () => {
    window.sessionStorage.setItem('besser_llm_api_key', 'sk-test-000');
    window.sessionStorage.setItem('besser_llm_provider', 'openai');
    window.sessionStorage.setItem('besser_llm_model', ' gpt-4o ');
    expect(readLlmKey()).toEqual({ apiKey: 'sk-test-000', provider: 'openai', model: 'gpt-4o', baseUrl: undefined });
  });

  it('ignores a key whose provider takes no key or is unknown', () => {
    window.sessionStorage.setItem('besser_llm_api_key', 'sk-test-000');
    for (const provider of ['free', 'sponsored', 'gemini']) {
      window.sessionStorage.setItem('besser_llm_provider', provider);
      expect(readLlmKey()).toBeNull();
    }
  });
});

describe('clearLlmKey', () => {
  it('removes the key, provider, model and base URL', () => {
    writeLlmKey('local', 'ollama', 'qwen2.5-coder:7b', 'http://localhost:11434/v1');
    clearLlmKey();
    for (const name of ['api_key', 'provider', 'model', 'base_url']) {
      expect(window.sessionStorage.getItem(`besser_llm_${name}`)).toBeNull();
    }
    expect(readLlmKey()).toBeNull();
  });

  it('keeps the run budget for the corrected key', () => {
    writeLlmKey('anthropic', 'sk-ant-test-000');
    writeLlmBudget({ maxCostUsd: 2, maxRuntimeSeconds: 600 });
    clearLlmKey();
    expect(readLlmBudget()).toEqual({ maxCostUsd: 2, maxRuntimeSeconds: 600 });
  });
});
