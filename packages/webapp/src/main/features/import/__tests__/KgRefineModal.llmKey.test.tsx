/* @vitest-environment jsdom */
/**
 * The AI tab uses the app's one shared key store (llmKeyStorage) instead of a
 * private input. The AI endpoints call OpenAI, so only an OpenAI key can be
 * used; any other saved key is explained and the shared key dialog is offered.
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
vi.mock('../../../shared/services/specDrivenConfig', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../../shared/services/specDrivenConfig')>();
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

  it('asks for an OpenAI key when none is saved, and cannot analyze without one', () => {
    renderAiTab();
    describe_('a library system');

    expect(screen.getByTestId('kg-refine-key-missing')).toHaveTextContent('needs an OpenAI API key');
    expect(analyze()).toBeDisabled();
  });

  it('explains that another provider\'s saved key does not work here', () => {
    save('anthropic', 'sk-ant-assistant-key');
    renderAiTab();
    describe_('a library system');

    expect(screen.getByTestId('kg-refine-key-missing')).toHaveTextContent('Anthropic (Claude)');
    expect(screen.getByTestId('kg-refine-key-missing')).toHaveTextContent('OpenAI keys only');
    expect(analyze()).toBeDisabled();
  });

  it('uses a saved OpenAI key without ever showing it', () => {
    save('openai', OPENAI_KEY);
    const { container } = renderAiTab();
    describe_('  a library system ');

    expect(screen.getByTestId('kg-refine-key-ready')).toBeInTheDocument();
    expect(container.ownerDocument.body.innerHTML).not.toContain(OPENAI_KEY);
    expect(analyze()).toBeEnabled();

    fireEvent.click(analyze());
    expect(refine.runLlmFullCleanup).toHaveBeenCalledWith('  a library system ', OPENAI_KEY);
  });

  it('needs a description even with a key', () => {
    save('openai', OPENAI_KEY);
    renderAiTab();

    expect(analyze()).toBeDisabled();
  });

  it('lets the user add an OpenAI key through the shared dialog, then use it', () => {
    renderAiTab();
    describe_('a library system');

    fireEvent.click(screen.getByTestId('kg-refine-add-key'));
    const dialog = screen.getByText(/replaces the key saved before/i).closest('[role="dialog"]') as HTMLElement;
    expect((document.getElementById('llm-key-provider') as HTMLSelectElement).value).toBe('openai');

    fireEvent.change(document.getElementById('llm-key-api-key') as HTMLInputElement, { target: { value: OPENAI_KEY } });
    fireEvent.click(within(dialog).getByRole('button', { name: /^save$/i }));

    expect(window.sessionStorage.getItem('besser_llm_provider')).toBe('openai');
    expect(screen.getByTestId('kg-refine-key-ready')).toBeInTheDocument();
    expect(analyze()).toBeEnabled();
  });

  it('warns in the dialog that saving replaces the assistant\'s key', () => {
    save('anthropic', 'sk-ant-assistant-key');
    renderAiTab();

    fireEvent.click(screen.getByTestId('kg-refine-add-key'));

    expect(screen.getByText(/replaces the key saved before/i)).toBeInTheDocument();
  });

  it('can change an OpenAI key that is already saved', () => {
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
