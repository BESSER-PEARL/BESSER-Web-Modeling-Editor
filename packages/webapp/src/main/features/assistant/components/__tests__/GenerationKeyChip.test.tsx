/**
 * The chip beside the chat says what the next generation will use, by the
 * same rule the run start applies, and follows a key saved meanwhile.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

import { GenerationKeyChip } from '../GenerationKeyChip';
import {
  FALLBACK_SMART_GEN_CONFIG,
  getSpecDrivenConfig,
  peekServerSpecDrivenConfig,
  peekSpecDrivenConfig,
  type SpecDrivenConfig,
} from '../../../../shared/services/specDrivenConfig';
import { writeFreeTierSelected, writeLlmKey } from '../../../../shared/services/llmKeyStorage';

vi.mock('../../../../shared/services/specDrivenConfig', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../../../shared/services/specDrivenConfig')>();
  return { ...mod, getSpecDrivenConfig: vi.fn(), peekSpecDrivenConfig: vi.fn(), peekServerSpecDrivenConfig: vi.fn() };
});

const config = (freeOffered: boolean): SpecDrivenConfig => ({
  ...FALLBACK_SMART_GEN_CONFIG,
  providers: [{ id: 'openai', label: 'OpenAI (GPT)', hint: null, key_prefix: null, models: [] }],
  free_tier: { ...FALLBACK_SMART_GEN_CONFIG.free_tier, available: freeOffered },
});

const useConfig = (freeOffered: boolean) => {
  vi.mocked(peekSpecDrivenConfig).mockReturnValue(config(freeOffered));
  vi.mocked(peekServerSpecDrivenConfig).mockReturnValue(config(freeOffered));
  vi.mocked(getSpecDrivenConfig).mockResolvedValue(config(freeOffered));
};

const renderChip = async (onClick = vi.fn()) => {
  render(<GenerationKeyChip onClick={onClick} />);
  await act(async () => {});
  return screen.getByRole('button');
};

beforeEach(() => {
  window.sessionStorage.clear();
  useConfig(true);
});

describe('GenerationKeyChip', () => {
  it('shows the provider and model of a stored key', async () => {
    writeLlmKey('openai', 'sk-secret-value', 'gpt-test-large');
    const chip = await renderChip();
    expect(chip.textContent).toBe('OpenAI (GPT) · gpt-test-large');
    expect(chip.outerHTML).not.toContain('sk-secret-value');
  });

  it("shows the provider's default model when the key has none", async () => {
    writeLlmKey('openai', 'sk-secret-value');
    expect((await renderChip()).textContent).toBe('OpenAI (GPT) · default model');
  });

  it('shows the free tier when it is selected, even with a stored key', async () => {
    writeLlmKey('openai', 'sk-secret-value');
    writeFreeTierSelected(true);
    expect((await renderChip()).textContent).toBe('Free model');
  });

  it('shows the free tier a first run would default to', async () => {
    expect((await renderChip()).textContent).toBe('Free model');
  });

  it('says there is no key when the server offers no free tier', async () => {
    useConfig(false);
    expect((await renderChip()).textContent).toBe('No API key');
  });

  it('follows a key saved after it rendered, and opens the dialog on click', async () => {
    useConfig(false);
    const onClick = vi.fn();
    const chip = await renderChip(onClick);
    act(() => {
      writeLlmKey('openai', 'sk-secret-value', 'gpt-test-large');
    });
    expect(chip.textContent).toBe('OpenAI (GPT) · gpt-test-large');
    fireEvent.click(chip);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('shows nothing while only the unknown server config could tell', async () => {
    vi.mocked(peekServerSpecDrivenConfig).mockReturnValue(null);
    vi.mocked(getSpecDrivenConfig).mockReturnValue(new Promise(() => {}));
    render(<GenerationKeyChip onClick={vi.fn()} />);
    await act(async () => {});
    expect(screen.queryByRole('button')).toBeNull();
  });
});
