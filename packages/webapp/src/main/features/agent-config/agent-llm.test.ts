/**
 * Unit tests for the new LLM provider families added to the agent config surface.
 *
 * Validates three things the reviewer asked for:
 *  1. normalizeAgentLLMElement preserves every new provider key (doesn't silently
 *     fall back to 'openai').
 *  2. AGENT_LLM_PROVIDER_OPTIONS contains a labelled entry for every new key.
 *  3. VALID_AGENT_LLM_PROVIDERS (local-storage whitelist) includes every new key.
 *  4. The legacy 'huggingfaceapi' spelling is still accepted and is canonicalised
 *     to 'huggingface_api' rather than silently reset to the default.
 */

import { describe, it, expect } from 'vitest';
import {
  AGENT_LLM_PROVIDER_OPTIONS,
  normalizeAgentLLMElement,
  type AgentLLMElementProvider,
} from './AgentConfigurationPanel';
import { VALID_AGENT_LLM_PROVIDERS } from '../../shared/services/storage/local-storage-repository';

const NEW_PROVIDERS: AgentLLMElementProvider[] = [
  'mistral',
  'deepseek',
  'google',
  'meta',
  'anthropic',
  'qwen',
  'xai',
  'groq',
  'together',
  'openrouter',
];

const ALL_EXPECTED_PROVIDERS: AgentLLMElementProvider[] = [
  'openai',
  'huggingface',
  'huggingface_api',
  'replicate',
  'ollama',
  ...NEW_PROVIDERS,
];

// ---------------------------------------------------------------------------
// normalizeAgentLLMElement — provider field round-trip
// ---------------------------------------------------------------------------

describe('normalizeAgentLLMElement', () => {
  it.each(NEW_PROVIDERS)('preserves provider "%s" without falling back to openai', (provider) => {
    const result = normalizeAgentLLMElement({ type: 'AgentLLM', provider, id: 'test-id' }, 'fallback');
    expect(result.provider).toBe(provider);
  });

  it('falls back to openai for an unknown provider', () => {
    const result = normalizeAgentLLMElement({ type: 'AgentLLM', provider: 'atlantis-ai' }, 'fallback');
    expect(result.provider).toBe('openai');
  });

  it('falls back to openai when provider is missing', () => {
    const result = normalizeAgentLLMElement({ type: 'AgentLLM' }, 'fallback');
    expect(result.provider).toBe('openai');
  });

  it('preserves openai', () => {
    const result = normalizeAgentLLMElement({ type: 'AgentLLM', provider: 'openai', id: 'x' }, 'x');
    expect(result.provider).toBe('openai');
  });
});

// ---------------------------------------------------------------------------
// AGENT_LLM_PROVIDER_OPTIONS — dropdown completeness
// ---------------------------------------------------------------------------

describe('AGENT_LLM_PROVIDER_OPTIONS', () => {
  const optionValues = AGENT_LLM_PROVIDER_OPTIONS.map((o) => o.value);

  it.each(NEW_PROVIDERS)('has an entry for provider "%s"', (provider) => {
    expect(optionValues).toContain(provider);
  });

  it('every option has a non-empty label', () => {
    for (const option of AGENT_LLM_PROVIDER_OPTIONS) {
      expect(option.label.trim().length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// VALID_AGENT_LLM_PROVIDERS — local-storage whitelist completeness
// ---------------------------------------------------------------------------

describe('VALID_AGENT_LLM_PROVIDERS', () => {
  it.each(NEW_PROVIDERS)('includes new provider "%s"', (provider) => {
    expect(VALID_AGENT_LLM_PROVIDERS).toContain(provider);
  });

  it.each(ALL_EXPECTED_PROVIDERS)('includes expected provider "%s"', (provider) => {
    expect(VALID_AGENT_LLM_PROVIDERS).toContain(provider);
  });
});

// ---------------------------------------------------------------------------
// Legacy alias handling
//
// Configs saved before the canonical 'huggingface_api' key existed still carry
// the no-underscore spelling. Every read path must accept it; without these
// cases a whitelist could drop the alias and silently reset a user's provider
// to 'openai', which is exactly what happened before this was centralised.
// ---------------------------------------------------------------------------

describe('legacy provider alias', () => {
  it('canonicalises the legacy huggingfaceapi spelling instead of resetting it', () => {
    const el = normalizeAgentLLMElement({ provider: 'huggingfaceapi' }, 'id-1');
    expect(el.provider).toBe('huggingface_api');
  });

  it('keeps the legacy spelling on the local-storage whitelist', () => {
    expect(VALID_AGENT_LLM_PROVIDERS).toContain('huggingfaceapi');
  });

  it('still falls back to openai for genuinely unknown providers', () => {
    expect(normalizeAgentLLMElement({ provider: 'not-a-provider' }, 'id-2').provider).toBe('openai');
    expect(normalizeAgentLLMElement({ provider: undefined }, 'id-3').provider).toBe('openai');
  });

  it('does not offer the legacy spelling as a selectable dropdown option', () => {
    expect(AGENT_LLM_PROVIDER_OPTIONS.map((o) => o.value)).not.toContain('huggingfaceapi');
  });
});
