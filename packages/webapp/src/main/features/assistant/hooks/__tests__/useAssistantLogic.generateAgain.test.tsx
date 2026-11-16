/**
 * "Generate again" on a run card whose result expired starts a new run with
 * the project's recorded request through the normal run start, or, when none
 * was recorded, asks the agent to generate with the chips' own sentence.
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
  sendMessage: vi.fn(() => 'sent' as const),
  handleTrigger: vi.fn(() => Promise.resolve()),
  lastGeneration: undefined as { request?: string } | undefined,
}));

vi.mock('../../services', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services')>();
  const noopUnsub = () => {};
  class FakeAssistantClient {
    onMessage() { return noopUnsub; }
    onConnection() { return noopUnsub; }
    onTyping() { return noopUnsub; }
    onInjection() { return noopUnsub; }
    onAction() { return noopUnsub; }
    clearHandlers() {}
    connect() { return Promise.resolve(); }
    disconnect() {}
    resetSession() {}
    setContextProvider() {}
    setHistoryProvider() {}
    sendMessage = fake.sendMessage;
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
  return {
    ...actual,
    useSpecDrivenTrigger: () => ({ handleTrigger: fake.handleTrigger, abortActive: () => {} }),
    readLastGeneration: () => fake.lastGeneration,
  };
});

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

import { specDrivenReducer } from '../../../../features/spec-driven';
import { GENERATE_AGAIN_PROMPT, useAssistantLogic } from '../useAssistantLogic';

type Hook = ReturnType<typeof useAssistantLogic>;

function Harness({ apiRef }: { apiRef: { current: Hook | null } }) {
  apiRef.current = useAssistantLogic({ isActive: true, switchDiagram: async () => true });
  return null;
}

function renderHarness() {
  const apiRef: { current: Hook | null } = { current: null };
  const store = configureStore({
    reducer: { workspace: workspaceReducer, errors: errorReducer, specDriven: specDrivenReducer },
  });
  render(
    <Provider store={store}>
      <ApollonEditorProvider value={{ editor: undefined, setEditor: () => {} }}>
        <Harness apiRef={apiRef} />
      </ApollonEditorProvider>
    </Provider>,
  );
  return apiRef;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  fake.lastGeneration = undefined;
});

describe('Generate again', () => {
  it('starts a run with the recorded request', async () => {
    fake.lastGeneration = { request: 'Build a book catalogue with authors.' };
    const apiRef = renderHarness();
    await waitFor(() => expect(apiRef.current).not.toBeNull());

    await act(async () => {
      apiRef.current!.generateAgain();
    });

    expect(fake.handleTrigger).toHaveBeenCalledWith({
      action: 'trigger_smart_generator',
      instructions: 'Build a book catalogue with authors.',
    });
    expect(fake.sendMessage).not.toHaveBeenCalled();
  });

  it('asks the assistant to generate when no request was recorded', async () => {
    const apiRef = renderHarness();
    await waitFor(() => expect(apiRef.current).not.toBeNull());

    await act(async () => {
      apiRef.current!.generateAgain();
    });

    expect(fake.handleTrigger).not.toHaveBeenCalled();
    expect(fake.sendMessage).toHaveBeenCalledTimes(1);
    expect((fake.sendMessage.mock.calls[0] as unknown[])[0]).toBe(GENERATE_AGAIN_PROMPT);
    expect(GENERATE_AGAIN_PROMPT).toBe('generate the application');
  });
});
