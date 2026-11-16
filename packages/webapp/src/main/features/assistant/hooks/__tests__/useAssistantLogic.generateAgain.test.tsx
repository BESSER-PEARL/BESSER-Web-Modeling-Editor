/**
 * "Generate again" on a run card whose result expired first asks, naming the
 * key the run will use; on a yes it starts a new run with the project's
 * recorded request through the normal run start, or, when none was recorded,
 * asks the agent to generate with the chips' own sentence. Only the latest
 * run's card offers it.
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
  confirm: vi.fn((_options: { title: string; description: string }) => Promise.resolve(true)),
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
    readGenerationKey: () => ({ tier: 'own', provider: 'openai', model: 'gpt-test-large' }),
  };
});

vi.mock('../../../../shared/services/confirm/globalConfirm', () => ({
  globalConfirm: (options: { title: string; description: string }) => fake.confirm(options),
}));

vi.mock('../../../../shared/services/specDrivenConfig', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../../../shared/services/specDrivenConfig')>();
  return { ...mod, getSpecDrivenConfig: () => Promise.resolve(mod.FALLBACK_SMART_GEN_CONFIG) };
});

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

import { specDrivenReducer } from '../../../../features/spec-driven';
import { GENERATE_AGAIN_PROMPT, useAssistantLogic } from '../useAssistantLogic';
import { conversationStore } from '../assistantConversationStore';

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
  fake.confirm.mockImplementation(() => Promise.resolve(true));
  conversationStore.clear();
});

describe('Generate again', () => {
  it('starts a run with the recorded request', async () => {
    fake.lastGeneration = { request: 'Build a book catalogue with authors.' };
    const apiRef = renderHarness();
    await waitFor(() => expect(apiRef.current).not.toBeNull());

    await act(async () => {
      apiRef.current!.generateAgain();
    });

    expect(fake.confirm).toHaveBeenCalledTimes(1);
    expect(fake.confirm.mock.calls[0][0].description).toBe(
      'It is built again from the model and the original request. The run uses: OpenAI (GPT) · gpt-test-large.',
    );
    expect(fake.handleTrigger).toHaveBeenCalledWith({
      action: 'trigger_smart_generator',
      instructions: 'Build a book catalogue with authors.',
    });
    expect(fake.sendMessage).not.toHaveBeenCalled();
  });

  it('starts nothing when the user declines', async () => {
    fake.lastGeneration = { request: 'Build a book catalogue with authors.' };
    fake.confirm.mockImplementation(() => Promise.resolve(false));
    const apiRef = renderHarness();
    await waitFor(() => expect(apiRef.current).not.toBeNull());

    await act(async () => {
      apiRef.current!.generateAgain();
    });

    expect(fake.confirm).toHaveBeenCalledTimes(1);
    expect(fake.handleTrigger).not.toHaveBeenCalled();
    expect(fake.sendMessage).not.toHaveBeenCalled();
  });

  it("names the conversation's latest run as the one that offers it", async () => {
    const card = (id: string, runId: string) => ({
      id, role: 'assistant', content: '',
      specDriven: { runId, phases: [], warnings: [], text: '', status: 'done' as const },
    });
    conversationStore.setMessages([card('m1', 'a'.repeat(32)), { id: 'm2', role: 'user', content: 'more' }, card('m3', 'b'.repeat(32))]);
    const apiRef = renderHarness();
    await waitFor(() => expect(apiRef.current).not.toBeNull());
    expect(apiRef.current!.latestRunId).toBe('b'.repeat(32));
  });

  it('asks the assistant to generate when no request was recorded', async () => {
    const apiRef = renderHarness();
    await waitFor(() => expect(apiRef.current).not.toBeNull());

    await act(async () => {
      apiRef.current!.generateAgain();
    });

    expect(fake.confirm.mock.calls[0][0].description).toBe(
      'The assistant is asked to generate it again. The run uses: OpenAI (GPT) · gpt-test-large.',
    );
    expect(fake.handleTrigger).not.toHaveBeenCalled();
    expect(fake.sendMessage).toHaveBeenCalledTimes(1);
    expect((fake.sendMessage.mock.calls[0] as unknown[])[0]).toBe(GENERATE_AGAIN_PROMPT);
    expect(GENERATE_AGAIN_PROMPT).toBe('generate the application');
  });
});
