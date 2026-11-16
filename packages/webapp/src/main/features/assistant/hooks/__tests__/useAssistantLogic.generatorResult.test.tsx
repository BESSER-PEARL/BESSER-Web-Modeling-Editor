/**
 * An assistant-requested generation (`trigger_generator`) reports its outcome
 * to the agent as a `generator_result` frontend event. When the model validates
 * with warnings and the user chooses to fix them first, the agent is told why
 * (`warnings_declined`) instead of only getting a failure.
 */

import React from 'react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { workspaceReducer } from '../../../../app/store/workspaceSlice';
import { errorReducer } from '../../../../app/store/errorManagementSlice';
import { specDrivenReducer } from '../../../../features/spec-driven';
import { ApollonEditorProvider } from '../../../editors';
import type { GenerationResult } from '../../../generation';

const fake = vi.hoisted(() => ({
  actionHandlers: [] as Array<(payload: Record<string, unknown>) => void>,
  sendFrontendEvent: vi.fn(() => 'sent' as const),
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
      fake.actionHandlers.push(handler);
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
    sendFrontendEvent = fake.sendFrontendEvent;
    get connected() { return true; }
    get connectionState() { return 'connected'; }
  }
  const sharedFake = new FakeAssistantClient();
  return { ...actual, AssistantClient: FakeAssistantClient, getSharedAssistantClient: () => sharedFake };
});

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

import { useAssistantLogic } from '../useAssistantLogic';

type Hook = ReturnType<typeof useAssistantLogic>;
type OnGenerate = NonNullable<Parameters<typeof useAssistantLogic>[0]['onGenerate']>;

function Harness({ apiRef, onGenerate }: { apiRef: { current: Hook | null }; onGenerate: OnGenerate }) {
  apiRef.current = useAssistantLogic({ isActive: true, switchDiagram: async () => true, onGenerate });
  return null;
}

function renderHarness(onGenerate: OnGenerate) {
  const apiRef: { current: Hook | null } = { current: null };
  const store = configureStore({
    reducer: { workspace: workspaceReducer, errors: errorReducer, specDriven: specDrivenReducer },
  });
  render(
    <Provider store={store}>
      <ApollonEditorProvider value={{ editor: undefined, setEditor: () => {} }}>
        <Harness apiRef={apiRef} onGenerate={onGenerate} />
      </ApollonEditorProvider>
    </Provider>,
  );
  return apiRef;
}

const triggerGenerator = async (generatorType: string) => {
  await act(async () => {
    fake.actionHandlers.forEach((handler) => handler({ action: 'trigger_generator', generatorType }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('generator_result sent to the agent', () => {
  it('reports warnings_declined when the user chose to fix the validation warnings first', async () => {
    const declined: GenerationResult = {
      ok: false,
      error: 'Generation cancelled to fix the validation warnings',
      reason: 'warnings_declined',
    };
    const onGenerate = vi.fn<OnGenerate>().mockResolvedValue(declined);
    const apiRef = renderHarness(onGenerate);
    await waitFor(() => expect(apiRef.current).not.toBeNull());

    await triggerGenerator('sql');

    expect(onGenerate).toHaveBeenCalledWith('sql', undefined);
    expect(fake.sendFrontendEvent).toHaveBeenCalledTimes(1);
    expect(fake.sendFrontendEvent).toHaveBeenCalledWith('generator_result', {
      ok: false,
      message: 'Generation cancelled to fix the validation warnings',
      metadata: { generatorType: 'sql', reason: 'warnings_declined' },
    });
  });

});
