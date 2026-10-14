import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RuntimeSettingsSection } from '../runtime/sections/RuntimeSettingsSection';
import type { AgentRuntimeConfig } from '../../../shared/services/storage/local-storage-repository';

// Radix Select calls scrollIntoView on open, which jsdom may lack.
beforeAll(() => {
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
});

const baseConfig = {
  agentPlatform: 'websocket',
  agentPlatformUseStreamlit: false,
  intentRecognitionTechnology: 'llm-based',
  agentLlmName: 'gpt',
} as AgentRuntimeConfig;

const renderSection = (config: Partial<AgentRuntimeConfig> = {}) => {
  const update = vi.fn();
  render(
    <RuntimeSettingsSection
      agentRuntimeConfig={{ ...baseConfig, ...config }}
      updateAgentRuntimeConfig={update}
      agentLLMElements={[{ id: '1', name: 'gpt' }]}
    />,
  );
  return update;
};

const openSelect = (trigger: HTMLElement) => {
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: 'mouse' });
};

describe('RuntimeSettingsSection themed controls', () => {
  it('keeps the selects reachable by their labels (no native <select>)', () => {
    renderSection();
    expect(screen.getByRole('combobox', { name: 'Platform' })).toHaveTextContent('WebSocket');
    expect(screen.getByRole('combobox', { name: /Intent Recognition/i })).toBeInTheDocument();
    expect(document.querySelector('select:not([aria-hidden="true"])')).toBeNull();
  });

  it('switching platform away from websocket clears the Streamlit flag', () => {
    const update = renderSection({ agentPlatformUseStreamlit: true });
    openSelect(screen.getByRole('combobox', { name: 'Platform' }));
    fireEvent.click(screen.getByRole('option', { name: 'Telegram' }));
    expect(update).toHaveBeenCalledWith({ agentPlatform: 'telegram', agentPlatformUseStreamlit: false });
  });

  it('the empty "use default" LLM option still reports an empty string', () => {
    const update = renderSection();
    openSelect(screen.getByRole('combobox', { name: /LLM/i }));
    fireEvent.click(screen.getByRole('option', { name: /default/i }));
    expect(update).toHaveBeenCalledWith({ agentLlmName: '' });
  });

  it('the Streamlit checkbox toggles via its label text', () => {
    const update = renderSection();
    fireEvent.click(screen.getByText(/Streamlit/i));
    expect(update).toHaveBeenCalledWith({ agentPlatformUseStreamlit: true });
  });
});
