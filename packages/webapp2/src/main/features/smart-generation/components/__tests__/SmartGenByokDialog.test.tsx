/**
 * Unit tests for SmartGenByokDialog.
 *
 * Covers:
 *   - Dialog reactivity: opens/closes based on Redux state
 *   - Saving writes to sessionStorage and dispatches the right actions
 *   - Cancel drops the pending trigger (no silent resume)
 *   - Clear stored key removes sessionStorage + flips the flag
 *   - Format hint is purely informational (doesn't block save)
 *   - Provider swap updates the hint
 */

import React from 'react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { smartGeneratorReducer, openByokDialog, setApiKeyPresent } from '../../state/smartGeneratorSlice';
import { workspaceReducer } from '../../../../app/store/workspaceSlice';
import { errorReducer } from '../../../../app/store/errorManagementSlice';
import { SmartGenByokDialog } from '../SmartGenByokDialog';
import {
  sessionStorageSmartGenApiKey,
  sessionStorageSmartGenProvider,
} from '../../../../shared/constants/constant';

function makeStore(preopen = true) {
  const store = configureStore({
    reducer: {
      workspace: workspaceReducer,
      errors: errorReducer,
      smartGenerator: smartGeneratorReducer,
    },
  });
  if (preopen) {
    store.dispatch(
      openByokDialog({
        action: 'trigger_smart_generator',
        instructions: 'build a thing',
        provider: 'anthropic',
      }),
    );
  }
  return store;
}

function renderDialog(preopen = true) {
  const store = makeStore(preopen);
  const result = render(
    <Provider store={store}>
      <SmartGenByokDialog />
    </Provider>,
  );
  return { store, ...result };
}

beforeEach(() => {
  window.sessionStorage.removeItem(sessionStorageSmartGenApiKey);
  window.sessionStorage.removeItem(sessionStorageSmartGenProvider);
});

afterEach(() => {
  // Radix Dialog portals persist between tests unless we explicitly
  // clean up the DOM. Without this, `getByLabelText` sees stale
  // elements from prior tests and fails with "multiple elements found".
  cleanup();
  window.sessionStorage.removeItem(sessionStorageSmartGenApiKey);
  window.sessionStorage.removeItem(sessionStorageSmartGenProvider);
});

describe('SmartGenByokDialog — visibility', () => {
  it('is not rendered when byokDialogOpen is false', () => {
    renderDialog(false);
    expect(screen.queryByText(/smart generator.*api key/i)).toBeNull();
  });

  it('renders when byokDialogOpen is true', () => {
    renderDialog(true);
    expect(screen.getByText(/smart generator.*api key/i)).toBeTruthy();
  });
});

describe('SmartGenByokDialog — save flow', () => {
  it('saves the key to sessionStorage and dispatches setApiKeyPresent', () => {
    const { store } = renderDialog(true);
    const input = (document.getElementById('smart-gen-api-key') as HTMLInputElement) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'sk-ant-abc123-TEST' } });
    const saveBtn = screen.getByRole('button', { name: /save.*start/i });
    fireEvent.click(saveBtn);

    const state = store.getState().smartGenerator;
    expect(state.apiKeyInStore).toBe(true);
    expect(state.byokDialogOpen).toBe(false);
    expect(state.provider).toBe('anthropic');
    expect(window.sessionStorage.getItem(sessionStorageSmartGenApiKey)).toBe(
      'sk-ant-abc123-TEST',
    );
    expect(window.sessionStorage.getItem(sessionStorageSmartGenProvider)).toBe(
      'anthropic',
    );
  });

  it('trims whitespace before saving', () => {
    renderDialog(true);
    const input = (document.getElementById('smart-gen-api-key') as HTMLInputElement) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '   sk-ant-trimmed   ' } });
    fireEvent.click(screen.getByRole('button', { name: /save.*start/i }));
    expect(window.sessionStorage.getItem(sessionStorageSmartGenApiKey)).toBe(
      'sk-ant-trimmed',
    );
  });

  it('save button is disabled when input is empty', () => {
    renderDialog(true);
    const btn = screen.getByRole('button', { name: /save.*start/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('save button is enabled once a key is typed', () => {
    renderDialog(true);
    const input = (document.getElementById('smart-gen-api-key') as HTMLInputElement) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'sk-ant-hello' } });
    const btn = screen.getByRole('button', { name: /save.*start/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });
});

describe('SmartGenByokDialog — format hint', () => {
  it('shows an amber hint when the key does not match the expected prefix', () => {
    renderDialog(true);
    const input = (document.getElementById('smart-gen-api-key') as HTMLInputElement) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'wrong-format-key' } });
    expect(screen.getByText(/doesn.t look like.*anthropic/i)).toBeTruthy();
  });

  it('does not block save when the format hint is showing', () => {
    const { store } = renderDialog(true);
    const input = (document.getElementById('smart-gen-api-key') as HTMLInputElement) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'not-a-sk-key' } });
    fireEvent.click(screen.getByRole('button', { name: /save.*start/i }));
    expect(store.getState().smartGenerator.byokDialogOpen).toBe(false);
    expect(window.sessionStorage.getItem(sessionStorageSmartGenApiKey)).toBe(
      'not-a-sk-key',
    );
  });

  it('switching to OpenAI provider changes the expected prefix', () => {
    renderDialog(true);
    const providerSelect = (document.getElementById('smart-gen-provider') as HTMLSelectElement) as HTMLSelectElement;
    fireEvent.change(providerSelect, { target: { value: 'openai' } });
    const input = (document.getElementById('smart-gen-api-key') as HTMLInputElement) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'sk-anthropic-looking' } });
    // `sk-anthropic-looking` starts with `sk-` so it's valid for OpenAI
    expect(screen.queryByText(/doesn.t look like/i)).toBeNull();
  });
});

describe('SmartGenByokDialog — cancel flow', () => {
  it('cancel closes the dialog AND clears the pending trigger', () => {
    const { store } = renderDialog(true);
    expect(store.getState().smartGenerator.pendingTrigger).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    const state = store.getState().smartGenerator;
    expect(state.byokDialogOpen).toBe(false);
    expect(state.pendingTrigger).toBeNull();
    expect(window.sessionStorage.getItem(sessionStorageSmartGenApiKey)).toBeNull();
  });
});

describe('SmartGenByokDialog — model selector', () => {
  it('saves the chosen preset model alongside the key and provider', () => {
    renderDialog(true);
    // Default Anthropic preset is claude-sonnet-4-6.
    const input = (document.getElementById('smart-gen-api-key') as HTMLInputElement);
    fireEvent.change(input, { target: { value: 'sk-ant-test-key' } });

    // Switch model dropdown to Opus
    const modelSelect = (document.getElementById('smart-gen-model') as HTMLSelectElement);
    fireEvent.change(modelSelect, { target: { value: 'claude-opus-4-6' } });

    fireEvent.click(screen.getByRole('button', { name: /save.*start/i }));
    expect(window.sessionStorage.getItem('besser_smart_gen_llm_model')).toBe('claude-opus-4-6');
  });

  it('saves a custom model ID typed by the user', () => {
    renderDialog(true);
    const input = (document.getElementById('smart-gen-api-key') as HTMLInputElement);
    fireEvent.change(input, { target: { value: 'sk-ant-test-key' } });

    const modelSelect = (document.getElementById('smart-gen-model') as HTMLSelectElement);
    fireEvent.change(modelSelect, { target: { value: '__custom__' } });

    const customInput = document.getElementById('smart-gen-model-custom') as HTMLInputElement;
    fireEvent.change(customInput, { target: { value: 'claude-opus-4-7-20260101' } });

    fireEvent.click(screen.getByRole('button', { name: /save.*start/i }));
    expect(window.sessionStorage.getItem('besser_smart_gen_llm_model')).toBe(
      'claude-opus-4-7-20260101',
    );
  });

  it('blocks save when Custom is selected but the input is empty', () => {
    const { store } = renderDialog(true);
    const input = (document.getElementById('smart-gen-api-key') as HTMLInputElement);
    fireEvent.change(input, { target: { value: 'sk-ant-test-key' } });

    const modelSelect = (document.getElementById('smart-gen-model') as HTMLSelectElement);
    fireEvent.change(modelSelect, { target: { value: '__custom__' } });
    // Leave custom input empty — save should fail with an error and NOT close
    fireEvent.click(screen.getByRole('button', { name: /save.*start/i }));

    expect(store.getState().smartGenerator.byokDialogOpen).toBe(true);
    expect(screen.getByText(/custom model id is empty/i)).toBeTruthy();
  });

  it('rejects a custom model ID with invalid characters', () => {
    const { store } = renderDialog(true);
    const input = (document.getElementById('smart-gen-api-key') as HTMLInputElement);
    fireEvent.change(input, { target: { value: 'sk-ant-test-key' } });

    const modelSelect = (document.getElementById('smart-gen-model') as HTMLSelectElement);
    fireEvent.change(modelSelect, { target: { value: '__custom__' } });
    const customInput = document.getElementById('smart-gen-model-custom') as HTMLInputElement;
    fireEvent.change(customInput, { target: { value: 'evil"; rm -rf /' } });

    fireEvent.click(screen.getByRole('button', { name: /save.*start/i }));
    expect(store.getState().smartGenerator.byokDialogOpen).toBe(true);
    expect(screen.getByText(/may only contain letters/i)).toBeTruthy();
  });

  it('resets the model choice when the provider changes to one without that preset', () => {
    renderDialog(true);
    // Start Anthropic with Opus selected
    const modelSelect = (document.getElementById('smart-gen-model') as HTMLSelectElement);
    fireEvent.change(modelSelect, { target: { value: 'claude-opus-4-6' } });

    // Switch provider to OpenAI — the Anthropic model should not leak
    const providerSelect = (document.getElementById('smart-gen-provider') as HTMLSelectElement);
    fireEvent.change(providerSelect, { target: { value: 'openai' } });

    const refreshed = (document.getElementById('smart-gen-model') as HTMLSelectElement);
    // The dropdown should now show OpenAI presets. The default is
    // whatever ``MODEL_PRESETS.openai[0]`` is — currently gpt-5.4.
    // Just assert it's one of the known OpenAI presets, not a specific
    // model name, so bumping the default doesn't break this test.
    const validOpenaiPresets = ['gpt-5.4', 'gpt-5', 'o1', 'o1-mini', 'gpt-4o', 'gpt-4o-mini'];
    expect(validOpenaiPresets).toContain(refreshed.value);
    // And it must NOT still be the Anthropic model that was selected
    // before the provider swap.
    expect(refreshed.value).not.toBe('claude-opus-4-6');
  });
});

describe('SmartGenByokDialog — clear stored key', () => {
  it('clear button appears when apiKeyInStore flag is true', () => {
    const { store } = renderDialog(true);
    expect(screen.queryByRole('button', { name: /clear stored key/i })).toBeNull();
    act(() => {
      store.dispatch(setApiKeyPresent(true));
    });
    expect(screen.getByRole('button', { name: /clear stored key/i })).toBeTruthy();
  });

  it('clear removes the stored key and flips the flag', () => {
    const { store } = renderDialog(true);
    act(() => {
      store.dispatch(setApiKeyPresent(true));
    });
    window.sessionStorage.setItem(sessionStorageSmartGenApiKey, 'sk-old');
    window.sessionStorage.setItem(sessionStorageSmartGenProvider, 'anthropic');

    fireEvent.click(screen.getByRole('button', { name: /clear stored key/i }));

    expect(window.sessionStorage.getItem(sessionStorageSmartGenApiKey)).toBeNull();
    expect(window.sessionStorage.getItem(sessionStorageSmartGenProvider)).toBeNull();
    expect(store.getState().smartGenerator.apiKeyInStore).toBe(false);
  });
});
