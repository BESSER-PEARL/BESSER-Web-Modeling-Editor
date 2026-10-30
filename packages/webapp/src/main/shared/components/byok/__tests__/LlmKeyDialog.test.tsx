/**
 * LlmKeyDialog writes the UNIFIED besser_llm_* sessionStorage keys, so the same
 * key powers both the assistant and the Spec-Driven generator, and fires the
 * onSaved / client-arm side effects each caller depends on.
 *
 * The free tier: the dialog reads GET /spec-driven/config (mocked here) and,
 * when the server advertises the keyless free tier, offers it in the provider
 * dropdown with the server's free-model choice.
 *
 * The providers and models come from the same config (the server's model
 * catalog); CATALOG below stands in for it. The gateway in it is fictional.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { LlmKeyDialog } from '../LlmKeyDialog';
import {
  getSpecDrivenConfig,
  peekSpecDrivenConfig,
  FALLBACK_SMART_GEN_CONFIG,
  type SpecDrivenConfig,
} from '../../../services/specDrivenConfig';

const models = (...entries: [string, string, boolean?][]) =>
  entries.map(([id, label, isDefault]) => ({ id, label, default: isDefault === true }));

const CATALOG = [
  {
    id: 'anthropic', label: 'Anthropic (Claude)', hint: null, key_prefix: null,
    models: models(
      ['claude-fable-5-1', 'Claude Fable 5.1 — most capable'],
      ['claude-opus-5-5', 'Claude Opus 5.5 — top tier'],
      ['claude-opus-4-6', 'Claude Opus 4.6 — previous generation'],
      ['claude-haiku-4-5', 'Claude Haiku 4.5 — fast & cheap'],
    ),
  },
  {
    id: 'openai', label: 'OpenAI (GPT)', hint: null, key_prefix: null,
    models: models(['gpt-6-sol', 'GPT-6 Sol — balanced'], ['gpt-6-luna', 'GPT-6 Luna — fast & cheap']),
  },
  {
    id: 'mistral', label: 'Mistral', hint: null, key_prefix: null,
    models: models(['mistral-large-latest', 'Mistral Large — most capable']),
  },
  {
    id: 'nebius', label: 'Nebius Token Factory', hint: null, key_prefix: null,
    models: models(['Qwen/Qwen3-30B-A3B-Instruct-2507', 'Qwen3 30B A3B Instruct', true]),
  },
  {
    id: 'local', label: 'Local (self-hosted)', hint: null, key_prefix: null,
    models: models(['qwen2.5-coder:7b', 'qwen2.5-coder:7b — code', true], ['llama3.1:8b', 'llama3.1:8b']),
  },
  {
    id: 'pia', label: 'Example gateway', hint: 'Your gateway key (starts with sk-).', key_prefix: 'sk-',
    models: models(
      ['gpt-6-luna', 'GPT-6 Luna — routine work'],
      ['claude-sonnet-5-5', 'Claude Sonnet 5.5 — default', true],
      ['claude-haiku-4-5-20251001', 'Claude Haiku 4.5'],
    ),
  },
];

const CATALOG_CONFIG: SpecDrivenConfig = { ...FALLBACK_SMART_GEN_CONFIG, providers: CATALOG };

// Mock the shared config service so the dialog never hits the network. The
// default advertises NO free tier — the pre-existing tests below exercise
// exactly the BYOK-only dropdown — and has already been loaded once, as it
// has by the time a user opens the dialog.
vi.mock('../../../services/specDrivenConfig', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../../services/specDrivenConfig')>();
  return {
    ...mod,
    getSpecDrivenConfig: vi.fn(),
    peekSpecDrivenConfig: vi.fn(),
  };
});

beforeEach(() => {
  window.sessionStorage.clear();
  vi.clearAllMocks();
  // clearAllMocks wipes call data but NOT implementations — restore the
  // defaults so per-test overrides don't leak.
  vi.mocked(getSpecDrivenConfig).mockImplementation(() => Promise.resolve(CATALOG_CONFIG));
  vi.mocked(peekSpecDrivenConfig).mockImplementation(() => CATALOG_CONFIG);
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

  it('shows quality/speed/cost guidance near the model selector (#6)', () => {
    render(<LlmKeyDialog open onOpenChange={() => {}} />);
    // Helper note that explains the trade-off so users choose well.
    expect(screen.getByText(/cost more and run slower/i)).toBeTruthy();
    // The model dropdown still carries the data-driven per-model hints
    // (from the server catalog) — the guidance note complements them.
    const modelSelect = document.getElementById('llm-key-model') as HTMLSelectElement;
    expect(modelSelect).toBeTruthy();
    expect(modelSelect.textContent).toMatch(/fast & cheap/i);
    expect(modelSelect.textContent).toMatch(/most capable/i);
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

  it('saves the gateway provider with no base URL: the server resolves it', () => {
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
    expect(window.sessionStorage.getItem('besser_llm_base_url')).toBeNull();
    expect(setUserApiKey).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'pia', baseUrl: undefined }),
    );
  });

  it("takes the gateway's name and key hint from the catalog", () => {
    render(<LlmKeyDialog open onOpenChange={() => {}} />);
    const select = document.getElementById('llm-key-provider') as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.textContent)).toContain('Example gateway');

    fireEvent.change(select, { target: { value: 'pia' } });
    expect(screen.getByText('Your gateway key (starts with sk-).')).toBeTruthy();
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

  describe('preferProvider', () => {
    const providerSelect = () => document.getElementById('llm-key-provider') as HTMLSelectElement;

    it('opens on the preferred provider when no key is saved', () => {
      render(<LlmKeyDialog open onOpenChange={() => {}} preferProvider="openai" />);

      expect(providerSelect().value).toBe('openai');
    });

    it('opens on the preferred provider even when a key for another one is saved', () => {
      window.sessionStorage.setItem('besser_llm_api_key', 'sk-ant-saved');
      window.sessionStorage.setItem('besser_llm_provider', 'anthropic');

      render(<LlmKeyDialog open onOpenChange={() => {}} preferProvider="openai" />);

      expect(providerSelect().value).toBe('openai');
    });

    it('saves a key for the preferred provider, replacing the saved one', () => {
      window.sessionStorage.setItem('besser_llm_api_key', 'sk-ant-saved');
      window.sessionStorage.setItem('besser_llm_provider', 'anthropic');
      const onSaved = vi.fn();
      render(<LlmKeyDialog open onOpenChange={() => {}} preferProvider="openai" onSaved={onSaved} />);

      fireEvent.change(document.getElementById('llm-key-api-key') as HTMLInputElement, {
        target: { value: 'sk-openai-key' },
      });
      fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

      expect(window.sessionStorage.getItem('besser_llm_api_key')).toBe('sk-openai-key');
      expect(window.sessionStorage.getItem('besser_llm_provider')).toBe('openai');
      expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ provider: 'openai', apiKey: 'sk-openai-key' }));
    });

    it("does not carry the saved provider's model into the preferred provider's form", () => {
      window.sessionStorage.setItem('besser_llm_api_key', 'pia-saved');
      window.sessionStorage.setItem('besser_llm_provider', 'pia');
      window.sessionStorage.setItem('besser_llm_model', 'gpt-5.4');
      window.sessionStorage.setItem('besser_llm_base_url', 'https://pia.example/v1');

      render(<LlmKeyDialog open onOpenChange={() => {}} preferProvider="anthropic" />);

      expect(providerSelect().value).toBe('anthropic');
      expect(document.getElementById('llm-key-model-custom')).toBeNull();
      expect((document.getElementById('llm-key-model') as HTMLSelectElement).value).not.toBe('gpt-5.4');
    });

    it('changes nothing for callers that do not ask', () => {
      window.sessionStorage.setItem('besser_llm_api_key', 'sk-ant-saved');
      window.sessionStorage.setItem('besser_llm_provider', 'anthropic');

      render(<LlmKeyDialog open onOpenChange={() => {}} />);

      expect(providerSelect().value).toBe('anthropic');
    });
  });

  it('offers Nebius Token Factory with the Qwen3-30B-A3B endpoint preselectable', () => {
    render(<LlmKeyDialog open onOpenChange={() => {}} />);

    const select = document.getElementById('llm-key-provider') as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.value)).toContain('nebius');

    fireEvent.change(select, { target: { value: 'nebius' } });
    const models = document.getElementById('llm-key-model') as HTMLSelectElement;
    expect(Array.from(models.options).map((o) => o.value)).toContain(
      'Qwen/Qwen3-30B-A3B-Instruct-2507',
    );
  });

  it('saves a Nebius key with NO base URL (the backend pins the endpoint)', () => {
    const onSaved = vi.fn();
    render(<LlmKeyDialog open onOpenChange={() => {}} onSaved={onSaved} />);

    fireEvent.change(document.getElementById('llm-key-provider') as HTMLSelectElement, {
      target: { value: 'nebius' },
    });
    fireEvent.change(document.getElementById('llm-key-api-key') as HTMLInputElement, {
      target: { value: 'nebius-secret-key' },
    });
    fireEvent.change(document.getElementById('llm-key-model') as HTMLSelectElement, {
      target: { value: 'Qwen/Qwen3-30B-A3B-Instruct-2507' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(window.sessionStorage.getItem('besser_llm_provider')).toBe('nebius');
    expect(window.sessionStorage.getItem('besser_llm_model')).toBe(
      'Qwen/Qwen3-30B-A3B-Instruct-2507',
    );
    // No base_url: a request carrying one would hit the backend's SSRF gate
    // (BESSER_LLM_ALLOW_CUSTOM_BASE_URL, off by default) and be rejected.
    expect(window.sessionStorage.getItem('besser_llm_base_url')).toBeNull();
    expect(onSaved).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'nebius', baseUrl: undefined }),
    );
  });

  it('ships a Nebius key to the modeling agent, which now routes it to Nebius', () => {
    // modeling-agent's byok.py accepts nebius (OpenAI-compatible Token Factory
    // endpoint), so the assistant runs on the user's key like other providers.
    const setUserApiKey = vi.fn();
    render(<LlmKeyDialog open onOpenChange={() => {}} client={{ setUserApiKey }} />);

    fireEvent.change(document.getElementById('llm-key-provider') as HTMLSelectElement, {
      target: { value: 'nebius' },
    });
    fireEvent.change(document.getElementById('llm-key-api-key') as HTMLInputElement, {
      target: { value: 'nebius-secret-key' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(setUserApiKey).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'nebius', apiKey: 'nebius-secret-key' }),
    );
    // The key is also stored — the Spec-Driven Agent reads it from here.
    expect(window.sessionStorage.getItem('besser_llm_api_key')).toBe('nebius-secret-key');
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

describe('LlmKeyDialog — remove key and error announcement', () => {
  const seedKey = () => {
    window.sessionStorage.setItem('besser_llm_api_key', 'sk-ant-stored');
    window.sessionStorage.setItem('besser_llm_provider', 'anthropic');
  };

  it('stages "Remove key" so Cancel keeps the stored key', () => {
    seedKey();
    const onRemoved = vi.fn();
    const onOpenChange = vi.fn();
    render(<LlmKeyDialog open onOpenChange={onOpenChange} onRemoved={onRemoved} />);

    fireEvent.click(screen.getByRole('button', { name: /remove key/i }));
    expect(window.sessionStorage.getItem('besser_llm_api_key')).toBe('sk-ant-stored');
    expect(onRemoved).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(window.sessionStorage.getItem('besser_llm_api_key')).toBe('sk-ant-stored');
    expect(onRemoved).not.toHaveBeenCalled();
  });

  it('Undo restores the Remove key button without touching storage', () => {
    seedKey();
    render(<LlmKeyDialog open onOpenChange={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /remove key/i }));
    fireEvent.click(screen.getByRole('button', { name: /^undo$/i }));
    expect(screen.getByRole('button', { name: /remove key/i })).toBeTruthy();
    expect(window.sessionStorage.getItem('besser_llm_api_key')).toBe('sk-ant-stored');
  });

  it('commits the staged removal on Save and disarms the client', () => {
    seedKey();
    const onRemoved = vi.fn();
    const setUserApiKey = vi.fn();
    render(
      <LlmKeyDialog open onOpenChange={() => {}} onRemoved={onRemoved} client={{ setUserApiKey }} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /remove key/i }));
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(window.sessionStorage.getItem('besser_llm_api_key')).toBeNull();
    expect(onRemoved).toHaveBeenCalledTimes(1);
    expect(setUserApiKey).toHaveBeenCalledWith({ apiKey: '' });
  });

  it('announces a provider mismatch and links it to the key field', () => {
    render(<LlmKeyDialog open onOpenChange={() => {}} />);
    fireEvent.change(document.getElementById('llm-key-provider') as HTMLSelectElement, {
      target: { value: 'mistral' },
    });
    const input = document.getElementById('llm-key-api-key') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'sk-ant-mismatch' } });

    const alert = screen.getByRole('alert');
    expect(alert.id).toBe('llm-key-mismatch');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toContain('llm-key-mismatch');
  });

  it('labels the default model option "Recommended default"', () => {
    render(<LlmKeyDialog open onOpenChange={() => {}} />);
    const select = document.getElementById('llm-key-model') as HTMLSelectElement;
    expect(select.options[0].textContent).toBe('Recommended default');
  });
});

describe('LlmKeyDialog — model pickers', () => {
  function modelOptions(provider: string): string[] {
    render(<LlmKeyDialog open onOpenChange={() => {}} />);
    fireEvent.change(document.getElementById('llm-key-provider') as HTMLSelectElement, {
      target: { value: provider },
    });
    const select = document.getElementById('llm-key-model') as HTMLSelectElement;
    return Array.from(select.options).map((o) => o.value);
  }

  it("renders the catalog's models in its order", () => {
    expect(modelOptions('anthropic')).toEqual([
      '',
      'claude-fable-5-1',
      'claude-opus-5-5',
      'claude-opus-4-6',
      'claude-haiku-4-5',
      '__custom__',
    ]);
  });

  it("offers the gateway's catalog models, its default first", () => {
    expect(modelOptions('pia')).toEqual([
      '',
      'claude-sonnet-5-5',
      'gpt-6-luna',
      'claude-haiku-4-5-20251001',
      '__custom__',
    ]);
  });

  it('offers a model the server catalog adds, with no frontend change', () => {
    vi.mocked(peekSpecDrivenConfig).mockReturnValue({
      ...CATALOG_CONFIG,
      providers: CATALOG.map((p) =>
        p.id === 'openai' ? { ...p, models: models(['gpt-9-nova', 'GPT-9 Nova']) } : p,
      ),
    });
    expect(modelOptions('openai')).toEqual(['', 'gpt-9-nova', '__custom__']);
  });

  it('labels the new models clearly', () => {
    render(<LlmKeyDialog open onOpenChange={() => {}} />);
    const select = document.getElementById('llm-key-model') as HTMLSelectElement;
    expect(select.textContent).toMatch(/Claude Fable 5\.1/);
    expect(select.textContent).toMatch(/Claude Opus 5\.5/);
    fireEvent.change(document.getElementById('llm-key-provider') as HTMLSelectElement, {
      target: { value: 'openai' },
    });
    expect(select.textContent).toMatch(/GPT-6 Sol/);
  });

  it('maps a stored dated Haiku id onto the claude-haiku-4-5 preset', () => {
    window.sessionStorage.setItem('besser_llm_api_key', 'sk-ant-stored');
    window.sessionStorage.setItem('besser_llm_provider', 'anthropic');
    window.sessionStorage.setItem('besser_llm_model', 'claude-haiku-4-5-20251001');
    const onSaved = vi.fn();
    render(<LlmKeyDialog open onOpenChange={() => {}} onSaved={onSaved} />);

    const select = document.getElementById('llm-key-model') as HTMLSelectElement;
    expect(select.value).toBe('claude-haiku-4-5');
    expect(document.getElementById('llm-key-model-custom')).toBeNull();

    fireEvent.change(document.getElementById('llm-key-api-key') as HTMLInputElement, {
      target: { value: 'sk-ant-stored' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(window.sessionStorage.getItem('besser_llm_model')).toBe('claude-haiku-4-5');
  });

  it('keeps a stored id that is no longer a preset as a working custom model', () => {
    window.sessionStorage.setItem('besser_llm_api_key', 'sk-ant-stored');
    window.sessionStorage.setItem('besser_llm_provider', 'anthropic');
    window.sessionStorage.setItem('besser_llm_model', 'claude-opus-4-1');
    const onSaved = vi.fn();
    render(<LlmKeyDialog open onOpenChange={() => {}} onSaved={onSaved} />);

    expect((document.getElementById('llm-key-model') as HTMLSelectElement).value).toBe(
      '__custom__',
    );
    expect(
      (document.getElementById('llm-key-model-custom') as HTMLInputElement).value,
    ).toBe('claude-opus-4-1');

    fireEvent.change(document.getElementById('llm-key-api-key') as HTMLInputElement, {
      target: { value: 'sk-ant-stored' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(onSaved).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'anthropic', model: 'claude-opus-4-1' }),
    );
  });

  // pia/local have no server-side default model: "Recommended default" would
  // let the backend request a model the gateway does not serve.
  it.each([
    ['pia', 'claude-sonnet-5-5'],
    ['local', 'qwen2.5-coder:7b'],
  ])('preselects the first %s preset when switching provider', (provider, firstPreset) => {
    render(<LlmKeyDialog open onOpenChange={() => {}} />);
    const model = document.getElementById('llm-key-model') as HTMLSelectElement;
    expect(model.value).toBe('');

    fireEvent.change(document.getElementById('llm-key-provider') as HTMLSelectElement, {
      target: { value: provider },
    });
    expect(model.value).toBe(firstPreset);
  });

  it('replaces a preset the PIA gateway does not serve with its first preset', () => {
    render(<LlmKeyDialog open onOpenChange={() => {}} />);
    const model = document.getElementById('llm-key-model') as HTMLSelectElement;
    fireEvent.change(model, { target: { value: 'claude-fable-5-1' } });

    fireEvent.change(document.getElementById('llm-key-provider') as HTMLSelectElement, {
      target: { value: 'pia' },
    });
    expect(model.value).toBe('claude-sonnet-5-5');
  });

  it('keeps "Recommended default" when switching to a provider with a server default', () => {
    render(<LlmKeyDialog open onOpenChange={() => {}} />);
    fireEvent.change(document.getElementById('llm-key-provider') as HTMLSelectElement, {
      target: { value: 'openai' },
    });
    expect((document.getElementById('llm-key-model') as HTMLSelectElement).value).toBe('');
  });

  it('keeps the dated Haiku id on the gateway, whose list carries it', () => {
    window.sessionStorage.setItem('besser_llm_api_key', 'sk-pia');
    window.sessionStorage.setItem('besser_llm_provider', 'pia');
    window.sessionStorage.setItem('besser_llm_model', 'claude-haiku-4-5-20251001');
    render(<LlmKeyDialog open onOpenChange={() => {}} />);

    expect((document.getElementById('llm-key-model') as HTMLSelectElement).value).toBe(
      'claude-haiku-4-5-20251001',
    );
  });
});

describe('LlmKeyDialog — model catalog', () => {
  const providerValues = () =>
    Array.from((document.getElementById('llm-key-provider') as HTMLSelectElement).options).map(
      (o) => o.value,
    );

  it('does not offer the gateway on a server whose catalog has none', () => {
    const withoutGateway = { ...CATALOG_CONFIG, providers: CATALOG.filter((p) => p.id !== 'pia') };
    vi.mocked(peekSpecDrivenConfig).mockReturnValue(withoutGateway);
    vi.mocked(getSpecDrivenConfig).mockResolvedValue(withoutGateway);
    render(<LlmKeyDialog open onOpenChange={() => {}} />);

    expect(providerValues()).not.toContain('pia');
  });

  it('falls back to the vendors with default and custom models when the config is unreadable', async () => {
    vi.mocked(peekSpecDrivenConfig).mockReturnValue(null);
    vi.mocked(getSpecDrivenConfig).mockResolvedValue(FALLBACK_SMART_GEN_CONFIG);
    render(<LlmKeyDialog open onOpenChange={() => {}} />);
    await waitFor(() => expect(vi.mocked(getSpecDrivenConfig)).toHaveBeenCalled());

    expect(providerValues()).toEqual(['anthropic', 'openai', 'mistral', 'nebius', 'local']);
    const modelSelect = document.getElementById('llm-key-model') as HTMLSelectElement;
    expect(Array.from(modelSelect.options).map((o) => o.value)).toEqual(['', '__custom__']);
  });

  it('restores a stored gateway key once the catalog arrives on a first open', async () => {
    window.sessionStorage.setItem('besser_llm_api_key', 'sk-pia');
    window.sessionStorage.setItem('besser_llm_provider', 'pia');
    window.sessionStorage.setItem('besser_llm_model', 'gpt-6-luna');
    vi.mocked(peekSpecDrivenConfig).mockReturnValue(null);
    render(<LlmKeyDialog open onOpenChange={() => {}} />);

    const providerSelect = document.getElementById('llm-key-provider') as HTMLSelectElement;
    await waitFor(() => expect(providerSelect.value).toBe('pia'));
    expect((document.getElementById('llm-key-model') as HTMLSelectElement).value).toBe('gpt-6-luna');
  });

  it('keeps a model picked before the catalog arrives', async () => {
    vi.mocked(peekSpecDrivenConfig).mockReturnValue(null);
    let resolve: (cfg: SpecDrivenConfig) => void = () => {};
    vi.mocked(getSpecDrivenConfig).mockReturnValue(new Promise((r) => { resolve = r; }));
    render(<LlmKeyDialog open onOpenChange={() => {}} />);
    const modelSelect = document.getElementById('llm-key-model') as HTMLSelectElement;
    fireEvent.change(modelSelect, { target: { value: '__custom__' } });

    resolve(CATALOG_CONFIG);
    await waitFor(() =>
      expect(Array.from(modelSelect.options).map((o) => o.value)).toContain('claude-fable-5-1'),
    );
    expect(modelSelect.value).toBe('__custom__');
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
      ...CATALOG_CONFIG,
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

  it('renders every advertised free model, including a third cloud option', async () => {
    // The server can add a free model on its own endpoint (e.g. one with no
    // daily request quota) purely by extending the config payload — the picker
    // renders the list verbatim and the default stays the default.
    mockFreeConfig({
      available: true,
      model: 'meituan/LongCat-2.0:free',
      models: [
        { id: 'meituan/LongCat-2.0:free', default: true },
        { id: 'poolside/laguna-s-2.1-free', default: false },
        { id: 'qwen3.8:27b', default: false },
      ],
    });
    await renderAndSelectFree();

    const group = screen.getByRole('radiogroup', { name: /free model/i });
    const radios = within(group).getAllByRole('radio') as HTMLInputElement[];
    expect(radios.map((r) => r.value)).toEqual([
      'meituan/LongCat-2.0:free',
      'poolside/laguna-s-2.1-free',
      'qwen3.8:27b',
    ]);
    // A vendor-prefixed alt is not mislabelled as self-hosted.
    expect(within(group).getByText('poolside/laguna-s-2.1-free')).toBeTruthy();
    expect(radios[0].checked).toBe(true);

    // Picking it stores that exact id (the backend honors it and pins
    // anything else to the default).
    fireEvent.click(radios[1]);
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(window.sessionStorage.getItem('besser_smart_gen_free_model')).toBe(
      'poolside/laguna-s-2.1-free',
    );
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
