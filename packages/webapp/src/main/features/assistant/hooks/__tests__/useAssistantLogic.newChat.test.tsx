/**
 * #1 — "New Chat" must ask before it discards the conversation.
 *
 * `requestNewChat` is the guarded handler the New Chat control calls: it
 * confirms first, then delegates to `clearConversation` (which resets the
 * backend session and, via specDriven.abortActive, cancels a running
 * generation). When a Spec-Driven run is active the confirm copy also warns
 * that the running generation will be stopped.
 */

import React from 'react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { workspaceReducer } from '../../../../app/store/workspaceSlice';
import { errorReducer } from '../../../../app/store/errorManagementSlice';
import {
  specDrivenReducer,
  claimRunSlot,
} from '../../../../features/spec-driven/state/specDrivenSlice';
import { ApollonEditorProvider } from '../../../editors/uml/apollon-editor-context';

const _client = vi.hoisted(() => ({ resetSessionCalls: 0 }));

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
    resetSession() { _client.resetSessionCalls += 1; }
    setContextProvider() {}
    sendMessage() { return 'sent' as const; }
    sendVoiceMessage() { return 'sent' as const; }
    sendFrontendEvent() { return 'sent' as const; }
    get connected() { return true; }
    get connectionState() { return 'connected'; }
  }
  const sharedFake = new FakeAssistantClient();
  return {
    ...actual,
    AssistantClient: FakeAssistantClient,
    getSharedAssistantClient: () => sharedFake,
  };
});

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

vi.mock('../../../../shared/services/analytics/lazy-analytics', () => ({
  getPostHog: () => null,
}));

import { useAssistantLogic } from '../useAssistantLogic';
import { conversationStore } from '../assistantConversationStore';

interface HarnessAPI {
  requestNewChat: () => void;
}

function Harness({ apiRef }: { apiRef: { current: HarnessAPI | null } }) {
  const hook = useAssistantLogic({ isActive: true, switchDiagram: async () => true });
  apiRef.current = { requestNewChat: hook.requestNewChat };
  return <div data-testid="count">{hook.messages.length}</div>;
}

function makeStore() {
  return configureStore({
    reducer: {
      workspace: workspaceReducer,
      errors: errorReducer,
      specDriven: specDrivenReducer,
    },
  });
}

function renderHarness() {
  const apiRef: { current: HarnessAPI | null } = { current: null };
  const store = makeStore();
  const utils = render(
    <Provider store={store}>
      <ApollonEditorProvider value={{ editor: undefined, setEditor: () => {} }}>
        <Harness apiRef={apiRef} />
      </ApollonEditorProvider>
    </Provider>,
  );
  return { apiRef, store, ...utils };
}

let confirmSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  _client.resetSessionCalls = 0;
  conversationStore.clear();
  confirmSpy = vi.fn().mockReturnValue(true);
  vi.stubGlobal('confirm', confirmSpy);
  // jsdom exposes window.confirm; point it at the same spy.
  window.confirm = confirmSpy as unknown as typeof window.confirm;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('useAssistantLogic — New Chat confirmation (#1)', () => {
  it('asks for confirmation before clearing the conversation', async () => {
    const { apiRef } = renderHarness();
    await waitFor(() => expect(apiRef.current).not.toBeNull());

    act(() => apiRef.current!.requestNewChat());

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    // Accepted → clearConversation ran (backend session reset).
    expect(_client.resetSessionCalls).toBe(1);
  });

  it('does NOT clear the conversation when the user cancels the confirm', async () => {
    confirmSpy.mockReturnValue(false);
    const { apiRef } = renderHarness();
    await waitFor(() => expect(apiRef.current).not.toBeNull());

    act(() => apiRef.current!.requestNewChat());

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(_client.resetSessionCalls).toBe(0);
  });

  it('uses plain copy when no generation is running', async () => {
    const { apiRef } = renderHarness();
    await waitFor(() => expect(apiRef.current).not.toBeNull());

    act(() => apiRef.current!.requestNewChat());

    const msg = String(confirmSpy.mock.calls[0][0]);
    expect(msg).toMatch(/cleared/i);
    expect(msg).not.toMatch(/generation will be stopped/i);
  });

  it('warns that a running generation will be stopped when a run is active', async () => {
    const { apiRef, store } = renderHarness();
    await waitFor(() => expect(apiRef.current).not.toBeNull());

    // Mark a Spec-Driven run as in-flight (global run slot claimed).
    act(() => {
      store.dispatch(claimRunSlot());
    });

    act(() => apiRef.current!.requestNewChat());

    const msg = String(confirmSpy.mock.calls[0][0]);
    expect(msg).toMatch(/generation will be stopped/i);
  });
});
