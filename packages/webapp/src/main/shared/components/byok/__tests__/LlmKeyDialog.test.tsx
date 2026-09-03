/**
 * LlmKeyDialog writes the UNIFIED besser_llm_* sessionStorage keys, so the same
 * key powers both the assistant and the Spec-Driven generator, and fires the
 * onSaved / client-arm side effects each caller depends on.
 *
 * The free tier: the dialog reads GET /spec-driven/config (mocked here) and,
 * when the server advertises the keyless free tier, offers it in the provider
 * dropdown with the server's free-model choice.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { LlmKeyDialog } from '../LlmKeyDialog';
import {
  getSpecDrivenConfig,
  FALLBACK_SMART_GEN_CONFIG,
} from '../../../services/specDrivenConfig';

// Mock the shared config service so the dialog never hits the network. The
// default (fallback) advertises NO free tier — the pre-existing tests below
// exercise exactly the old BYOK-only dropdown.
vi.mock('../../../services/specDrivenConfig', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../../services/specDrivenConfig')>();
  return {
    ...mod,
    getSpecDrivenConfig: vi.fn(() => Promise.resolve(mod.FALLBACK_SMART_GEN_CONFIG)),
  };
});

beforeEach(() => {
  window.sessionStorage.clear();
  vi.clearAllMocks();
  // clearAllMocks wipes call data but NOT implementations — restore the
  // default (free tier unavailable) so per-test overrides don't leak.
  vi.mocked(getSpecDrivenConfig).mockImplementation(() =>
    Promise.resolve(FALLBACK_SMART_GEN_CONFIG),
  );
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

  it('does NOT offer the Free provider when the server does not advertise it', async () => {
    render(<LlmKeyDialog open onOpenChange={() => {}} />);
    await waitFor(() => {
      expect(vi.mocked(getSpecDrivenConfig)).toHaveBeenCalled();
    });
    const select = document.getElementById('llm-key-provider') as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).not.toContain('free');
  });
});

describe('LlmKeyDialog — keyless free tier', () => {
  const TWO_MODEL_FREE_TIER = {
    available: true,
    model: 'meituan/LongCat-2.0:free',
    models: [
      { id: 'meituan/LongCat-2.0:free', default: true },
      { id: 'qwen3.8:27b', default: false },
    ],
  };

  function mockFreeConfig(freeTier = TWO_MODEL_FREE_TIER) {
    vi.mocked(getSpecDrivenConfig).mockResolvedValue({
      ...FALLBACK_SMART_GEN_CONFIG,
      free_tier: freeTier,
    });
  }

  async function renderAndSelectFree(props: Partial<React.ComponentProps<typeof LlmKeyDialog>> = {}) {
    const result = render(<LlmKeyDialog open onOpenChange={() => {}} {...props} />);
    // The Free option appears once the async config load resolves.
    const select = document.getElementById('llm-key-provider') as HTMLSelectElement;
    await waitFor(() => {
      expect(Array.from(select.options).map((o) => o.value)).toContain('free');
    });
    fireEvent.change(select, { target: { value: 'free' } });
    return result;
  }

  it('offers "Free — included, no key required" and hides the key + model inputs', async () => {
    mockFreeConfig();
    await renderAndSelectFree();

    expect(screen.getByText('Free — included, no key required')).toBeTruthy();
    expect(document.getElementById('llm-key-api-key')).toBeNull();
    expect(document.getElementById('llm-key-model')).toBeNull();
  });

  it('shows the server-advertised free models with derived labels', async () => {
    mockFreeConfig();
    await renderAndSelectFree();

    const group = screen.getByRole('radiogroup', { name: /free model/i });
    const radios = within(group).getAllByRole('radio');
    expect(radios).toHaveLength(2);
    expect(within(group).getByText('meituan/LongCat-2.0:free (default)')).toBeTruthy();
    expect(within(group).getByText('qwen3.8:27b (self-hosted)')).toBeTruthy();
    // The default entry is pre-selected.
    expect((radios[0] as HTMLInputElement).checked).toBe(true);
  });

  it('saves the free opt-in with a non-default model choice, leaving the BYOK key untouched', async () => {
    mockFreeConfig();
    // A previously stored BYOK key must survive a free-tier save (the
    // assistant keeps using it).
    window.sessionStorage.setItem('besser_llm_api_key', 'sk-ant-existing');
    window.sessionStorage.setItem('besser_llm_provider', 'anthropic');
    const onSaved = vi.fn();
    const setUserApiKey = vi.fn();
    await renderAndSelectFree({ onSaved, client: { setUserApiKey } });

    const group = screen.getByRole('radiogroup', { name: /free model/i });
    const fallbackRadio = within(group)
      .getAllByRole('radio')
      .find((r) => (r as HTMLInputElement).value === 'qwen3.8:27b') as HTMLInputElement;
    fireEvent.click(fallbackRadio);
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(window.sessionStorage.getItem('besser_smart_gen_free_tier')).toBe('1');
    expect(window.sessionStorage.getItem('besser_smart_gen_free_model')).toBe('qwen3.8:27b');
    // The unified BYOK key is untouched and the agent socket is NOT re-armed.
    expect(window.sessionStorage.getItem('besser_llm_api_key')).toBe('sk-ant-existing');
    expect(setUserApiKey).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'free', apiKey: '', model: 'qwen3.8:27b' }),
    );
  });

  it('stores no model id for the default choice (wire shape identical to today)', async () => {
    mockFreeConfig();
    await renderAndSelectFree();

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(window.sessionStorage.getItem('besser_smart_gen_free_tier')).toBe('1');
    expect(window.sessionStorage.getItem('besser_smart_gen_free_model')).toBeNull();
  });

  it('falls back to the default for a stale stored model id', async () => {
    mockFreeConfig();
    window.sessionStorage.setItem('besser_smart_gen_free_model', 'no-longer-advertised');
    await renderAndSelectFree();

    const group = screen.getByRole('radiogroup', { name: /free model/i });
    const radios = within(group).getAllByRole('radio') as HTMLInputElement[];
    expect(radios.find((r) => r.value === 'meituan/LongCat-2.0:free')?.checked).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(window.sessionStorage.getItem('besser_smart_gen_free_model')).toBeNull();
  });

  it('preselects Free when the free tier is the recorded latest choice', async () => {
    mockFreeConfig();
    window.sessionStorage.setItem('besser_smart_gen_free_tier', '1');
    render(<LlmKeyDialog open onOpenChange={() => {}} />);

    const select = document.getElementById('llm-key-provider') as HTMLSelectElement;
    await waitFor(() => {
      expect(select.value).toBe('free');
    });
  });

  it('offers no model choice when the server advertises a single free model', async () => {
    mockFreeConfig({
      available: true,
      model: 'qwen3-coder:30b',
      models: [{ id: 'qwen3-coder:30b', default: true }],
    });
    await renderAndSelectFree();

    expect(screen.queryByRole('radiogroup', { name: /free model/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(window.sessionStorage.getItem('besser_smart_gen_free_tier')).toBe('1');
  });

  it('saving a BYOK key afterwards clears the free-tier opt-in (last action wins)', async () => {
    mockFreeConfig();
    window.sessionStorage.setItem('besser_smart_gen_free_tier', '1');
    render(<LlmKeyDialog open onOpenChange={() => {}} />);
    const select = document.getElementById('llm-key-provider') as HTMLSelectElement;
    await waitFor(() => {
      expect(select.value).toBe('free');
    });

    // Switch back to a paid provider and save a real key.
    fireEvent.change(select, { target: { value: 'anthropic' } });
    fireEvent.change(document.getElementById('llm-key-api-key') as HTMLInputElement, {
      target: { value: 'sk-ant-back-to-byok' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(window.sessionStorage.getItem('besser_llm_api_key')).toBe('sk-ant-back-to-byok');
    expect(window.sessionStorage.getItem('besser_smart_gen_free_tier')).toBeNull();
  });
});
