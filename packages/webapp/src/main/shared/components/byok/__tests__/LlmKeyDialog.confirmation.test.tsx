/**
 * Saving in the key dialog is confirmed on screen and reaches the open
 * assistant connection at once, from every surface: a surface without a
 * client (the chat's "set up your own API key" link, Settings) used to write
 * the key silently and leave the live connection on the old one.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'react-toastify';

import { LlmKeyDialog } from '../LlmKeyDialog';
import {
  FALLBACK_SMART_GEN_CONFIG,
  getSpecDrivenConfig,
  peekSpecDrivenConfig,
  type SpecDrivenConfig,
} from '../../../services/specDrivenConfig';
import { LLM_KEY_ARM_EVENT, type LlmKeyArmRequest } from '../../../services/llmKeyStorage';

vi.mock('react-toastify', () => ({
  toast: { success: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

vi.mock('../../../services/specDrivenConfig', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../../services/specDrivenConfig')>();
  return { ...mod, getSpecDrivenConfig: vi.fn(), peekSpecDrivenConfig: vi.fn() };
});

const CONFIG: SpecDrivenConfig = {
  ...FALLBACK_SMART_GEN_CONFIG,
  providers: [
    {
      id: 'openai', label: 'OpenAI (GPT)', hint: null, key_prefix: null,
      models: [{ id: 'gpt-test-large', label: 'GPT Test Large', default: false }],
    },
  ],
  free_tier: {
    available: true,
    model: 'free-model-a',
    models: [
      { id: 'free-model-a', default: true },
      { id: 'free-model-b', default: false },
    ],
  },
};

const typeKeyAndSave = (key: string, model?: string) => {
  fireEvent.change(document.getElementById('llm-key-provider') as HTMLSelectElement, {
    target: { value: 'openai' },
  });
  fireEvent.change(document.getElementById('llm-key-api-key') as HTMLInputElement, { target: { value: key } });
  if (model) {
    fireEvent.change(document.getElementById('llm-key-model') as HTMLSelectElement, { target: { value: model } });
  }
  fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
};

let armListener: ((event: Event) => void) | null = null;
const answerArmRequests = (result: 'sent' | 'error') => {
  const listener = vi.fn((event: Event) => {
    (event as CustomEvent<LlmKeyArmRequest>).detail.result = result;
  });
  armListener = listener;
  window.addEventListener(LLM_KEY_ARM_EVENT, listener);
  return listener;
};

beforeEach(() => {
  window.sessionStorage.clear();
  vi.clearAllMocks();
  vi.mocked(getSpecDrivenConfig).mockResolvedValue(CONFIG);
  vi.mocked(peekSpecDrivenConfig).mockReturnValue(CONFIG);
});

afterEach(() => {
  if (armListener) window.removeEventListener(LLM_KEY_ARM_EVENT, armListener);
  armListener = null;
});

describe('LlmKeyDialog: confirming a saved key', () => {
  it('names the provider and the chosen model, never the key, and arms the given client', () => {
    const setUserApiKey = vi.fn(() => 'sent' as const);
    render(<LlmKeyDialog open onOpenChange={() => {}} client={{ setUserApiKey }} />);

    typeKeyAndSave('sk-secret-value', 'gpt-test-large');

    expect(setUserApiKey).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'sk-secret-value', provider: 'openai', model: 'gpt-test-large' }),
    );
    expect(toast.success).toHaveBeenCalledTimes(1);
    const message = String(vi.mocked(toast.success).mock.calls[0][0]);
    expect(message).toContain('OpenAI (GPT)');
    expect(message).toContain('gpt-test-large');
    expect(message).not.toContain('sk-secret-value');
  });

  it("names the provider's default model when none is chosen", () => {
    render(<LlmKeyDialog open onOpenChange={() => {}} client={{ setUserApiKey: vi.fn(() => 'sent' as const) }} />);

    typeKeyAndSave('sk-secret-value');

    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('the default model'));
  });

  it('arms the open assistant connection when the dialog has no client', () => {
    const listener = answerArmRequests('sent');
    render(<LlmKeyDialog open onOpenChange={() => {}} />);

    typeKeyAndSave('sk-secret-value');

    expect(listener).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it('warns that the key applies after reconnecting when the connection is down', () => {
    answerArmRequests('error');
    render(<LlmKeyDialog open onOpenChange={() => {}} />);

    typeKeyAndSave('sk-secret-value');

    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.warning).toHaveBeenCalledWith(expect.stringMatching(/saved.*reconnects/i));
  });

  it('warns the same way when the given client cannot send', () => {
    render(<LlmKeyDialog open onOpenChange={() => {}} client={{ setUserApiKey: vi.fn(() => 'error' as const) }} />);

    typeKeyAndSave('sk-secret-value');

    expect(toast.warning).toHaveBeenCalledWith(expect.stringMatching(/reconnects/i));
  });

  it('confirms choosing the free tier', async () => {
    render(<LlmKeyDialog open onOpenChange={() => {}} />);
    const select = document.getElementById('llm-key-provider') as HTMLSelectElement;
    await waitFor(() => expect(Array.from(select.options).map((o) => o.value)).toContain('free'));
    fireEvent.change(select, { target: { value: 'free' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/^Free tier selected/));
  });

  it('confirms removing the key and clears it on the open connection', () => {
    window.sessionStorage.setItem('besser_llm_api_key', 'sk-old');
    window.sessionStorage.setItem('besser_llm_provider', 'openai');
    const listener = answerArmRequests('sent');
    render(<LlmKeyDialog open onOpenChange={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: /remove key/i }));
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(window.sessionStorage.getItem('besser_llm_api_key')).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith('API key removed from this tab.');
  });
});
