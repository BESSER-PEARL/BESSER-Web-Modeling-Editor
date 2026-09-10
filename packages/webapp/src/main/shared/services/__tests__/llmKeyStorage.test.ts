/**
 * Unified BYOK key storage — regression tests.
 *
 * The load-bearing invariant: saving a real key clears the Spec-Driven Agent's
 * sticky "free tier" opt-in. Without it, a user who entered their OpenAI key via
 * the unified dialog (assistant popup / drawer / Settings) still had their
 * smart-gen run dispatched on the keyless free qwen tier, because free is the
 * default and startRun's `freeSelected ? 'free' : key` picks free whenever the
 * flag is set — even with a key present.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  clearLlmKey,
  readFreeTierSelected,
  readLlmKey,
  writeFreeTierSelected,
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

    // The free opt-in must be gone so the run uses the key, not qwen.
    expect(readFreeTierSelected()).toBe(false);
    expect(window.sessionStorage.getItem(sessionStorageSpecDrivenFreeTier)).toBeNull();
  });

  it('persists the key/provider so smart-gen readSessionKey() sees it', () => {
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
