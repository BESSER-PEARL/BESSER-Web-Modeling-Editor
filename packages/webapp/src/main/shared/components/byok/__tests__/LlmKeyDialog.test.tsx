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

  it('saves the Local (self-hosted) provider with a base URL', () => {
    const onSaved = vi.fn();
    render(<LlmKeyDialog open onOpenChange={() => {}} onSaved={onSaved} />);

    fireEvent.change(document.getElementById('llm-key-provider') as HTMLSelectElement, {
      target: { value: 'local' },
    });
    fireEvent.change(document.getElementById('llm-key-api-key') as HTMLInputElement, {
      target: { value: 'ollama' },
    });
    fireEvent.change(document.getElementById('llm-key-base-url') as HTMLInputElement, {
      target: { value: 'http://localhost:11434/v1' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(window.sessionStorage.getItem('besser_llm_provider')).toBe('local');
    expect(window.sessionStorage.getItem('besser_llm_base_url')).toBe('http://localhost:11434/v1');
    expect(onSaved).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'local', baseUrl: 'http://localhost:11434/v1' }),
    );
  });

  it('saves the PIA (LIST) provider with the fixed gateway base URL', () => {
    const setUserApiKey = vi.fn();
    render(<LlmKeyDialog open onOpenChange={() => {}} client={{ setUserApiKey }} />);

    fireEvent.change(document.getElementById('llm-key-provider') as HTMLSelectElement, {
      target: { value: 'pia' },
    });
    fireEvent.change(document.getElementById('llm-key-api-key') as HTMLInputElement, {
      target: { value: 'sk-pia-key' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(window.sessionStorage.getItem('besser_llm_provider')).toBe('pia');
    expect(window.sessionStorage.getItem('besser_llm_base_url')).toBe(
      'https://gateway.pia.private.list.lu/v1',
    );
    // The dialog passes provider='pia' + baseUrl; AssistantClient maps it to openai on the wire.
    expect(setUserApiKey).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'pia',
        baseUrl: 'https://gateway.pia.private.list.lu/v1',
      }),
    );
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
