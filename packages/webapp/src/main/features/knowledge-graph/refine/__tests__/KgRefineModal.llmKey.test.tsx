/* @vitest-environment jsdom */
/**
 * The AI tab uses the app's one shared key store (llmKeyStorage) instead of a
 * private input. The AI endpoints take an Anthropic, OpenAI, Mistral or Nebius
 * key and send it with its provider; a key for a provider that needs a custom
 * endpoint (PIA, local) cannot be used, so it is explained and the shared key
 * dialog is offered.
 */
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const refine = vi.hoisted(() => ({
  staticStatus: 'success',
  staticReport: { kgSignature: 's', diagramType: 'ClassDiagram', issueCount: 0, issues: [] },
  runStatic: vi.fn().mockResolvedValue(null),
  applyStatic: vi.fn(),
  llmStatus: 'idle',
  llmReport: null,
  runLlmFullCleanup: vi.fn().mockResolvedValue(null),
  runLlmOrphanClassification: vi.fn(),
  applyLlm: vi.fn(),
  reset: vi.fn(),
}));
vi.mock('../useKgRefine', () => ({ useKgRefine: () => refine }));
// The dialog asks the server for the free-tier advertisement when it opens.
vi.mock('../../../../shared/services/specDrivenConfig', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../../../shared/services/specDrivenConfig')>();
  return { ...mod, getSpecDrivenConfig: vi.fn(() => Promise.resolve(mod.FALLBACK_SMART_GEN_CONFIG)) };
});

import { KgRefineModal } from '../KgRefineModal';

const OPENAI_KEY = 'sk-openai-saved-key-123';

const save = (provider: string, apiKey: string) => {
  window.sessionStorage.setItem('besser_llm_api_key', apiKey);
  window.sessionStorage.setItem('besser_llm_provider', provider);
};
const renderAiTab = () => render(<KgRefineModal open onClose={vi.fn()} initialTab="llm" />);
const describe_ = (text: string) =>
  fireEvent.change(screen.getByTestId('kg-refine-description'), { target: { value: text } });
const analyze = () => screen.getByTestId('kg-refine-llm-analyze') as HTMLButtonElement;

beforeEach(() => {
  window.sessionStorage.clear();
  vi.clearAllMocks();
  refine.runLlmFullCleanup.mockResolvedValue(null);
});

describe('KgRefineModal AI tab: the key comes from the shared store', () => {
  it('no longer has an input of its own for the key', () => {
    renderAiTab();

    expect(screen.queryByTestId('kg-refine-api-key')).toBeNull();
    expect(document.querySelector('input[type="password"]')).toBeNull();
  });

  it('asks for a key when none is saved, and cannot analyze without one', () => {
    renderAiTab();
    describe_('a library system');

    expect(screen.getByTestId('kg-refine-key-missing')).toHaveTextContent('needs an API key');
    expect(analyze()).toBeDisabled();
  });

  it.each([
    ['local', 'Local (self-hosted)'],
    ['pia', 'PIA (LIST)'],
  ])("explains that a %s key does not work here: it needs a custom endpoint", (provider, label) => {
    save(provider, 'sk-custom-endpoint-key');
    renderAiTab();
    describe_('a library system');

    expect(screen.getByTestId('kg-refine-key-missing')).toHaveTextContent(label);
    expect(screen.getByTestId('kg-refine-key-missing')).toHaveTextContent('cannot use');
    expect(analyze()).toBeDisabled();
  });

  it.each([
    ['openai', 'OpenAI (GPT)'],
    ['anthropic', 'Anthropic (Claude)'],
    ['mistral', 'Mistral'],
    ['nebius', 'Nebius Token Factory'],
  ])('uses a saved %s key, with its provider, without ever showing it', (provider, label) => {
    save(provider, OPENAI_KEY);
    const { container } = renderAiTab();
    describe_('  a library system ');

    expect(screen.getByTestId('kg-refine-key-ready')).toHaveTextContent(label);
    expect(container.ownerDocument.body.innerHTML).not.toContain(OPENAI_KEY);
    expect(analyze()).toBeEnabled();

    fireEvent.click(analyze());
    expect(refine.runLlmFullCleanup).toHaveBeenCalledWith('  a library system ', {
      provider,
      apiKey: OPENAI_KEY,
      model: undefined,
    });
  });

  it("sends the model the user chose in the key dialog", () => {
    save('anthropic', 'sk-ant-key');
    window.sessionStorage.setItem('besser_llm_model', 'claude-haiku-4-5');
    renderAiTab();
    describe_('a library system');

    fireEvent.click(analyze());

    expect(refine.runLlmFullCleanup).toHaveBeenCalledWith('a library system', {
      provider: 'anthropic',
      apiKey: 'sk-ant-key',
      model: 'claude-haiku-4-5',
    });
  });

  it('needs a description even with a key', () => {
    save('openai', OPENAI_KEY);
    renderAiTab();

    expect(analyze()).toBeDisabled();
  });

  it('lets the user add a key through the shared dialog, then use it', () => {
    renderAiTab();
    describe_('a library system');

    fireEvent.click(screen.getByTestId('kg-refine-add-key'));
    const dialog = screen.getByText(/replaces the key saved before/i).closest('[role="dialog"]') as HTMLElement;
    expect((document.getElementById('llm-key-provider') as HTMLSelectElement).value).toBe('anthropic');

    // The dialog infers the provider from the key's prefix, so an Anthropic-style key stays on Anthropic.
    fireEvent.change(document.getElementById('llm-key-api-key') as HTMLInputElement, {
      target: { value: 'sk-ant-new-key-123' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: /^save$/i }));

    expect(window.sessionStorage.getItem('besser_llm_provider')).toBe('anthropic');
    expect(screen.getByTestId('kg-refine-key-ready')).toBeInTheDocument();
    expect(analyze()).toBeEnabled();
  });

  it("warns in the dialog that saving replaces the assistant's key", () => {
    save('local', 'sk-custom-endpoint-key');
    renderAiTab();

    fireEvent.click(screen.getByTestId('kg-refine-add-key'));

    expect(screen.getByText(/replaces the key saved before/i)).toBeInTheDocument();
  });

  it('can change a key that is already saved', () => {
    save('openai', OPENAI_KEY);
    renderAiTab();

    fireEvent.click(screen.getByTestId('kg-refine-change-key'));

    expect(document.getElementById('llm-key-provider')).not.toBeNull();
  });

  it('picks up a key saved elsewhere the next time the modal opens', () => {
    const { rerender } = render(<KgRefineModal open={false} onClose={vi.fn()} initialTab="llm" />);
    save('openai', OPENAI_KEY);

    rerender(<KgRefineModal open onClose={vi.fn()} initialTab="llm" />);

    expect(screen.getByTestId('kg-refine-key-ready')).toBeInTheDocument();
  });
});
