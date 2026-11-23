/**
 * The `trigger_smart_generator` action is rebuilt field by field before a run
 * starts: a field the agent adds reaches the run only when it is copied here.
 */
import React from 'react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { workspaceReducer } from '../../../../app/store/workspaceSlice';
import { errorReducer } from '../../../../app/store/errorManagementSlice';
import { ApollonEditorProvider } from '../../../editors';

const fake = vi.hoisted(() => ({
  handleTrigger: vi.fn((_payload: Record<string, unknown>) => Promise.resolve()),
  onAction: [] as Array<(payload: Record<string, unknown>) => void>,
}));

vi.mock('../../services', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services')>();
  const noopUnsub = () => {};
  class FakeAssistantClient {
    onMessage() { return noopUnsub; }
    onConnection() { return noopUnsub; }
    onTyping() { return noopUnsub; }
    onInjection() { return noopUnsub; }
    onAction(handler: (payload: Record<string, unknown>) => void) {
      fake.onAction.push(handler);
      return noopUnsub;
    }
    clearHandlers() {}
    connect() { return Promise.resolve(); }
    disconnect() {}
    resetSession() {}
    setContextProvider() {}
    setHistoryProvider() {}
    sendMessage() { return 'sent' as const; }
    sendVoiceMessage() { return 'sent' as const; }
    sendFrontendEvent() { return 'sent' as const; }
    get connected() { return true; }
    get connectionState() { return 'connected'; }
    get turnId() { return null; }
  }
  const sharedFake = new FakeAssistantClient();
  return { ...actual, AssistantClient: FakeAssistantClient, getSharedAssistantClient: () => sharedFake };
});

vi.mock('../../../spec-driven', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../spec-driven')>();
  return { ...actual, useSpecDrivenTrigger: () => ({ handleTrigger: fake.handleTrigger, abortActive: () => {} }) };
});

vi.mock('../../../../shared/services/specDrivenConfig', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../../../shared/services/specDrivenConfig')>();
  return { ...mod, getSpecDrivenConfig: () => Promise.resolve(mod.FALLBACK_SMART_GEN_CONFIG) };
});

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

import { specDrivenReducer } from '../../../../features/spec-driven';
import { useAssistantLogic } from '../useAssistantLogic';

function Harness() {
  useAssistantLogic({ isActive: true, switchDiagram: async () => true, surface: 'workspace' });
  return null;
}

function renderHarness() {
  const store = configureStore({
    reducer: { workspace: workspaceReducer, errors: errorReducer, specDriven: specDrivenReducer },
  });
  render(
    <Provider store={store}>
      <ApollonEditorProvider value={{ editor: undefined, setEditor: () => {} }}>
        <Harness />
      </ApollonEditorProvider>
    </Provider>,
  );
}

async function trigger(payload: Record<string, unknown>) {
  renderHarness();
  await waitFor(() => expect(fake.onAction.length).toBeGreaterThan(0));
  await act(async () => {
    fake.onAction.forEach((handler) => handler({ action: 'trigger_smart_generator', instructions: 'try again', ...payload }));
  });
  await waitFor(() => expect(fake.handleTrigger).toHaveBeenCalled());
  return fake.handleTrigger.mock.calls[0][0];
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('trigger_smart_generator fields', () => {
  it("passes on the agent's remember_newest: false", async () => {
    expect((await trigger({ remember_newest: false })).rememberNewest).toBe(false);
  });

  it('leaves it out when the agent does not send it', async () => {
    expect((await trigger({})).rememberNewest).toBeUndefined();
  });
});
