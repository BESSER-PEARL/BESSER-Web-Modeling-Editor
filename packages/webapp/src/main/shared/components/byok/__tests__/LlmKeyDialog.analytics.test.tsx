/**
 * Product analytics for the shared key dialog: a save, a refused save and a
 * removal each send their event. The key, a base URL and a typed custom model
 * id never appear in one.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LlmKeyDialog, CUSTOM_MODEL_VALUE } from '../LlmKeyDialog';
import {
  getSpecDrivenConfig,
  peekSpecDrivenConfig,
  FALLBACK_SMART_GEN_CONFIG,
  type SpecDrivenConfig,
} from '../../../services/specDrivenConfig';

const CONFIG: SpecDrivenConfig = {
  ...FALLBACK_SMART_GEN_CONFIG,
  providers: [
    {
      id: 'anthropic', label: 'Anthropic (Claude)', hint: null, key_prefix: null,
      models: [
        { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', default: false },
        { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', default: false },
      ],
    },
    {
      id: 'mistral', label: 'Mistral', hint: null, key_prefix: null,
      models: [{ id: 'mistral-large-latest', label: 'Mistral Large', default: false }],
    },
  ],
};

vi.mock('../../../services/specDrivenConfig', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../../services/specDrivenConfig')>();
  return { ...mod, getSpecDrivenConfig: vi.fn(), peekSpecDrivenConfig: vi.fn() };
});

const track = vi.hoisted(() => vi.fn());
vi.mock('@/main/shared/services/analytics/events', () => ({ track }));

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const save = () => fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
const events = (name: string) => track.mock.calls.filter(([event]) => event === name).map(([, props]) => props);

beforeEach(() => {
  window.sessionStorage.clear();
  vi.clearAllMocks();
  vi.mocked(getSpecDrivenConfig).mockImplementation(() => Promise.resolve(CONFIG));
  vi.mocked(peekSpecDrivenConfig).mockImplementation(() => CONFIG);
});

describe('LlmKeyDialog analytics', () => {
  it('tracks a saved key with its catalog model and surface, never the key', () => {
    render(<LlmKeyDialog open onOpenChange={() => {}} surface="assistant" client={{ setUserApiKey: vi.fn() }} />);
    fireEvent.change(byId<HTMLInputElement>('llm-key-api-key'), { target: { value: 'sk-ant-secret' } });
    fireEvent.change(byId<HTMLSelectElement>('llm-key-model'), { target: { value: 'claude-haiku-4-5' } });
    save();

    const [props] = events('llm_key_saved');
    expect(props).toMatchObject({
      provider: 'anthropic',
      model_source: 'preset',
      model: 'claude-haiku-4-5',
      surface: 'assistant',
      armed_assistant: true,
    });
    expect(JSON.stringify(track.mock.calls)).not.toContain('sk-ant-secret');
  });

  it('never sends a custom model id the user typed', () => {
    render(<LlmKeyDialog open onOpenChange={() => {}} />);
    fireEvent.change(byId<HTMLInputElement>('llm-key-api-key'), { target: { value: 'sk-ant-secret' } });
    fireEvent.change(byId<HTMLSelectElement>('llm-key-model'), { target: { value: CUSTOM_MODEL_VALUE } });
    fireEvent.change(byId<HTMLInputElement>('llm-key-model-custom'), { target: { value: 'my-private-finetune' } });
    save();

    expect(events('llm_key_saved')[0]).toMatchObject({ model_source: 'custom', model: undefined });
    expect(JSON.stringify(track.mock.calls)).not.toContain('my-private-finetune');
  });

  it('tracks a save refused for a provider mismatch, and no saved event', () => {
    render(<LlmKeyDialog open onOpenChange={() => {}} />);
    fireEvent.change(byId<HTMLSelectElement>('llm-key-provider'), { target: { value: 'mistral' } });
    fireEvent.change(byId<HTMLInputElement>('llm-key-api-key'), { target: { value: 'sk-ant-mismatch' } });
    save();

    expect(events('llm_key_save_failed')).toEqual([{ reason: 'provider_mismatch', provider: 'mistral' }]);
    expect(events('llm_key_saved')).toHaveLength(0);
  });

  it('tracks a committed removal with the removed key provider', () => {
    window.sessionStorage.setItem('besser_llm_api_key', 'sk-ant-stored');
    window.sessionStorage.setItem('besser_llm_provider', 'anthropic');
    render(<LlmKeyDialog open onOpenChange={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /remove key/i }));
    save();

    expect(events('llm_key_removed')).toEqual([{ provider: 'anthropic' }]);
  });
});
