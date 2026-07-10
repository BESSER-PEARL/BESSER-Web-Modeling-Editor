/**
 * LlmKeyDialog writes the UNIFIED besser_llm_* sessionStorage keys, so the same
 * key powers both the assistant and the Spec-Driven generator, and fires the
 * onSaved / client-arm side effects each caller depends on.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LlmKeyDialog } from '../LlmKeyDialog';

beforeEach(() => {
  window.sessionStorage.clear();
});

describe('LlmKeyDialog — unified BYOK key', () => {
  it('writes the unified besser_llm_* keys and calls onSaved', () => {
    const onSaved = vi.fn();
    render(<LlmKeyDialog open onOpenChange={() => {}} onSaved={onSaved} />);

    fireEvent.change(document.getElementById('llm-key-api-key') as HTMLInputElement, {
      target: { value: 'sk-ant-test-key' },
    });
    fireEvent.change(document.getElementById('llm-key-model') as HTMLSelectElement, {
      target: { value: 'claude-opus-4-6' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(window.sessionStorage.getItem('besser_llm_api_key')).toBe('sk-ant-test-key');
    expect(window.sessionStorage.getItem('besser_llm_provider')).toBe('anthropic');
    expect(window.sessionStorage.getItem('besser_llm_model')).toBe('claude-opus-4-6');
    expect(onSaved).toHaveBeenCalledWith({
      provider: 'anthropic',
      apiKey: 'sk-ant-test-key',
      model: 'claude-opus-4-6',
    });
  });

  it('arms a provided agent client on save', () => {
    const setUserApiKey = vi.fn();
    render(<LlmKeyDialog open onOpenChange={() => {}} client={{ setUserApiKey }} />);

    fireEvent.change(document.getElementById('llm-key-api-key') as HTMLInputElement, {
      target: { value: 'sk-ant-armed' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(setUserApiKey).toHaveBeenCalledTimes(1);
    expect(setUserApiKey).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'sk-ant-armed', provider: 'anthropic' }),
    );
  });

  it('refuses to save when the key prefix contradicts the selected provider', () => {
    const onSaved = vi.fn();
    render(<LlmKeyDialog open onOpenChange={() => {}} onSaved={onSaved} />);

    // Lock provider to Mistral, then paste an obviously-Anthropic key.
    fireEvent.change(document.getElementById('llm-key-provider') as HTMLSelectElement, {
      target: { value: 'mistral' },
    });
    fireEvent.change(document.getElementById('llm-key-api-key') as HTMLInputElement, {
      target: { value: 'sk-ant-mismatch' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(onSaved).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem('besser_llm_api_key')).toBeNull();
  });
});
