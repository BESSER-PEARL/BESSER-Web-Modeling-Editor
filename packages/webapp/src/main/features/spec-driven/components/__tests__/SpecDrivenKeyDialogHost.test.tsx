/**
 * Unit tests for SpecDrivenKeyDialogHost — the Redux adapter that shows the
 * shared LlmKeyDialog for the Spec-Driven Agent (it replaced the dedicated
 * SpecDrivenByokDialog).
 *
 * Covers the pending-run state machine the old dialog guaranteed:
 *   - Saving a key with a run pending approves the trigger (resume effect
 *     then starts the run) — the close that follows a save is NOT a cancel
 *   - Confirming the free tier with a run pending approves a keyless run
 *   - Cancelling clears the trigger and fires the "key cancelled" event
 *   - Settings mode (no pending run) opens on the key-entry flow even when
 *     the free tier is the recorded selection (preferKeyEntry)
 */

import React from 'react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { openByokDialog, specDrivenReducer } from '../../state/specDrivenSlice';
import { workspaceReducer } from '../../../../app/store/workspaceSlice';
import { errorReducer } from '../../../../app/store/errorManagementSlice';
import { SpecDrivenKeyDialogHost } from '../SpecDrivenKeyDialogHost';
import {
  getSpecDrivenConfig,
  FALLBACK_SMART_GEN_CONFIG,
} from '../../../../shared/services/specDrivenConfig';

// Mock the SHARED config service (LlmKeyDialog imports it from shared/).
// Default: free tier unavailable — matching scenario (b), where the dialog
// opens because the server offers no free tier.
vi.mock('../../../../shared/services/specDrivenConfig', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../../../shared/services/specDrivenConfig')>();
  return {
    ...mod,
    getSpecDrivenConfig: vi.fn(() => Promise.resolve(mod.FALLBACK_SMART_GEN_CONFIG)),
  };
});

const PENDING = {
  action: 'trigger_smart_generator' as const,
  instructions: 'build a thing',
  provider: 'anthropic' as const,
};

const FREE_CONFIG = {
  ...FALLBACK_SMART_GEN_CONFIG,
  free_tier: {
    available: true,
    model: 'meituan/LongCat-2.0:free',
    models: [
      { id: 'meituan/LongCat-2.0:free', default: true },
      { id: 'qwen3.8:27b', default: false },
    ],
  },
};

function makeStore() {
  return configureStore({
    reducer: {
      workspace: workspaceReducer,
      errors: errorReducer,
      specDriven: specDrivenReducer,
    },
  });
}

function renderHost() {
  const store = makeStore();
  const result = render(
    <Provider store={store}>
      <SpecDrivenKeyDialogHost />
    </Provider>,
  );
  return { store, ...result };
}

beforeEach(() => {
  window.sessionStorage.clear();
  vi.clearAllMocks();
  vi.mocked(getSpecDrivenConfig).mockImplementation(() =>
    Promise.resolve(FALLBACK_SMART_GEN_CONFIG),
  );
});

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
});

describe('SpecDrivenKeyDialogHost — visibility and modes', () => {
  it('is not rendered until openByokDialog is dispatched', () => {
    renderHost();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders the run mode (title + "Save & run") for a pending trigger', () => {
    const { store } = renderHost();
    act(() => {
      store.dispatch(openByokDialog(PENDING));
    });
    expect(screen.getByText(/spec-driven agent — run/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /save & run/i })).toBeTruthy();
  });

  it('renders the settings mode (default title, plain Save) without a trigger', () => {
    const { store } = renderHost();
    act(() => {
      store.dispatch(openByokDialog(null));
    });
    expect(screen.getByText(/use your own api key/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /^save$/i })).toBeTruthy();
  });
});

describe('SpecDrivenKeyDialogHost — pending-run continuation', () => {
  it('saving a key approves the pending trigger and closes the dialog', () => {
    const { store } = renderHost();
    act(() => {
      store.dispatch(openByokDialog(PENDING));
    });

    fireEvent.change(document.getElementById('llm-key-api-key') as HTMLInputElement, {
      target: { value: 'sk-ant-run-key' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save & run/i }));

    const state = store.getState().specDriven;
    // The trigger SURVIVES, approved — the trigger hook's resume effect
    // consumes it and starts the run. It must NOT be dropped as a cancel.
    expect(state.pendingTrigger).toEqual(
      expect.objectContaining({ ...PENDING, planApproved: true }),
    );
    expect(state.byokDialogOpen).toBe(false);
    expect(state.apiKeyInStore).toBe(true);
    // The key landed in the unified store the trigger hook reads.
    expect(window.sessionStorage.getItem('besser_llm_api_key')).toBe('sk-ant-run-key');
  });

  it('confirming the free tier approves a keyless run', async () => {
    vi.mocked(getSpecDrivenConfig).mockResolvedValue(FREE_CONFIG);
    const { store } = renderHost();
    act(() => {
      store.dispatch(openByokDialog(PENDING));
    });

    const select = document.getElementById('llm-key-provider') as HTMLSelectElement;
    await waitFor(() => {
      expect(Array.from(select.options).map((o) => o.value)).toContain('free');
    });
    fireEvent.change(select, { target: { value: 'free' } });
    fireEvent.click(screen.getByRole('button', { name: /save & run/i }));

    const state = store.getState().specDriven;
    expect(state.pendingTrigger).toEqual(
      expect.objectContaining({ ...PENDING, planApproved: true }),
    );
    expect(state.byokDialogOpen).toBe(false);
    // Keyless: the free flag authorises the run; no key, no key-present flag.
    expect(window.sessionStorage.getItem('besser_smart_gen_free_tier')).toBe('1');
    expect(window.sessionStorage.getItem('besser_llm_api_key')).toBeNull();
    expect(state.apiKeyInStore).toBe(false);
  });

  it('cancelling clears the trigger and fires the key-cancelled event', () => {
    const cancelledSpy = vi.fn();
    window.addEventListener('wme:specdriven-key-cancelled', cancelledSpy);
    const { store } = renderHost();
    act(() => {
      store.dispatch(openByokDialog(PENDING));
    });

    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));

    const state = store.getState().specDriven;
    expect(state.pendingTrigger).toBeNull();
    expect(state.byokDialogOpen).toBe(false);
    expect(cancelledSpy).toHaveBeenCalledTimes(1);
    window.removeEventListener('wme:specdriven-key-cancelled', cancelledSpy);
  });

  it('cancelling in settings mode fires no key-cancelled event', () => {
    const cancelledSpy = vi.fn();
    window.addEventListener('wme:specdriven-key-cancelled', cancelledSpy);
    const { store } = renderHost();
    act(() => {
      store.dispatch(openByokDialog(null));
    });

    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));

    expect(store.getState().specDriven.byokDialogOpen).toBe(false);
    expect(cancelledSpy).not.toHaveBeenCalled();
    window.removeEventListener('wme:specdriven-key-cancelled', cancelledSpy);
  });
});

describe('SpecDrivenKeyDialogHost — settings mode (chat "use your own API key" link)', () => {
  it('opens on the key-entry flow even when the free tier is the recorded selection', async () => {
    vi.mocked(getSpecDrivenConfig).mockResolvedValue(FREE_CONFIG);
    // The user ran on the free tier before (the trigger records the opt-in).
    window.sessionStorage.setItem('besser_smart_gen_free_tier', '1');
    const { store } = renderHost();
    act(() => {
      store.dispatch(openByokDialog(null));
    });

    const select = document.getElementById('llm-key-provider') as HTMLSelectElement;
    // The Free entry is offered...
    await waitFor(() => {
      expect(Array.from(select.options).map((o) => o.value)).toContain('free');
    });
    // ...but NOT preselected — the link's intent is entering a key.
    expect(select.value).toBe('anthropic');
    expect(document.getElementById('llm-key-api-key')).not.toBeNull();
  });

  it('saving a key in settings mode flips the key-present flag and closes', () => {
    const { store } = renderHost();
    act(() => {
      store.dispatch(openByokDialog(null));
    });

    fireEvent.change(document.getElementById('llm-key-api-key') as HTMLInputElement, {
      target: { value: 'sk-ant-settings-key' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    const state = store.getState().specDriven;
    expect(state.apiKeyInStore).toBe(true);
    expect(state.byokDialogOpen).toBe(false);
    expect(state.pendingTrigger).toBeNull();
  });
});
