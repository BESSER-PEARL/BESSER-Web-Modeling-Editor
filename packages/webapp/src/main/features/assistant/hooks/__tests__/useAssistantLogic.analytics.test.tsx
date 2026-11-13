/**
 * Product analytics for the modeling assistant: a sent message, a blocked one,
 * a reply with its latency, an agent error and a confirmed New Chat each send
 * their event, with content-free properties only.
 */

import React from 'react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { workspaceReducer } from '../../../../app/store/workspaceSlice';
import { errorReducer } from '../../../../app/store/errorManagementSlice';
import { specDrivenReducer } from '../../../../features/spec-driven';
import { BesserEditorProvider } from '../../../editors';

const fake = vi.hoisted(() => ({
  rateLimitAllowed: true,
  sendResult: 'sent' as 'sent' | 'queued' | 'error',
  actionHandlers: [] as Array<(payload: Record<string, unknown>) => void>,
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
    sendMessage() { return fake.sendResult; }
    sendVoiceMessage() { return fake.sendResult; }
    sendFrontendEvent() { return 'sent' as const; }
    get connected() { return true; }
    get connectionState() { return 'connected'; }
  }
  class FakeRateLimiter {
    async checkRateLimit() {
      return fake.rateLimitAllowed ? { allowed: true } : { allowed: false, reason: 'slow down' };
    }
    getRateLimitStatus() {
      return { requestsLastMinute: 0, requestsLastHour: 0, cooldownRemaining: 0 };
    }
  }
  const sharedFake = new FakeAssistantClient();
  return {
    ...actual,
    AssistantClient: FakeAssistantClient,
    RateLimiterService: FakeRateLimiter,
    getSharedAssistantClient: () => sharedFake,
  };
});

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

const track = vi.hoisted(() => vi.fn());
vi.mock('../../../../shared/services/analytics/events', () => ({
  track,
  errorProperties: () => ({ error_type: 'Error', network_error: false }),
}));

import { useAssistantLogic } from '../useAssistantLogic';
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
      <BesserEditorProvider value={{ editor: undefined, setEditor: () => {} }}>
        <Harness apiRef={apiRef} />
      </BesserEditorProvider>
    </Provider>,
  );
  return apiRef;
}

const events = (name: string) => track.mock.calls.filter(([event]) => event === name).map(([, props]) => props);

/** Send through the single-dispatch action handler, as the shared client does. */
const emitAction = async (payload: Record<string, unknown>) => {
  await act(async () => {
    fake.actionHandlers.forEach((handler) => handler(payload));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

beforeEach(() => {
  fake.rateLimitAllowed = true;
  fake.sendResult = 'sent';
  conversationStore.clear();
  window.confirm = vi.fn().mockReturnValue(true) as unknown as typeof window.confirm;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('assistant analytics', () => {
  it('tracks a sent message with counts and the key provider, never its text', async () => {
    const apiRef = renderHarness();
    await waitFor(() => expect(apiRef.current).not.toBeNull());

    await act(async () => {
      await apiRef.current!.handleSubmit(undefined, { overrideText: 'Create a Library class' });
    });

    const [props] = events('assistant_message');
    expect(props).toMatchObject({ input: 'text', send_result: 'sent', message_length: 22, attachment_count: 0, uses_own_key: false });
    expect(JSON.stringify(props)).not.toContain('Library');
  });

  it('records a failed send as send_result error', async () => {
    fake.sendResult = 'error';
    const apiRef = renderHarness();
    await waitFor(() => expect(apiRef.current).not.toBeNull());

    await act(async () => {
      await apiRef.current!.handleSubmit(undefined, { overrideText: 'hello' });
    });

    expect(events('assistant_message')[0]).toMatchObject({ send_result: 'error' });
  });

  it('tracks a message blocked by the rate limiter, and sends nothing else', async () => {
    fake.rateLimitAllowed = false;
    const apiRef = renderHarness();
    await waitFor(() => expect(apiRef.current).not.toBeNull());

    await act(async () => {
      await apiRef.current!.handleSubmit(undefined, { overrideText: 'hello' });
    });

    expect(events('assistant_message_blocked')).toEqual([{ reason: 'rate_limited' }]);
    expect(events('assistant_message')).toHaveLength(0);
  });

  it('tracks a reply with its latency, once per send', async () => {
    const apiRef = renderHarness();
    await waitFor(() => expect(apiRef.current).not.toBeNull());
    await act(async () => {
      await apiRef.current!.handleSubmit(undefined, { overrideText: 'hello' });
    });

    await emitAction({ action: 'assistant_message', message: 'Hi there' });
    await emitAction({ action: 'assistant_message', message: 'And more' });

    const replies = events('assistant_reply');
    expect(replies).toHaveLength(2);
    expect(replies[0]).toMatchObject({ action: 'assistant_message', latency_ms: expect.any(Number) });
    expect(replies[1]).toMatchObject({ action: 'assistant_message', latency_ms: undefined });
  });

  it('tracks an agent error by code, not as a reply', async () => {
    const apiRef = renderHarness();
    await waitFor(() => expect(apiRef.current).not.toBeNull());

    await emitAction({ action: 'agent_error', message: 'quota exceeded for acme', errorCode: 'rate_limit', retryable: true });

    expect(events('assistant_error')).toEqual([{ error_code: 'rate_limit', retryable: true, needs_api_key: true }]);
    expect(events('assistant_reply')).toHaveLength(0);
  });

  it('tracks a confirmed New Chat but not a cancelled one', async () => {
    const apiRef = renderHarness();
    await waitFor(() => expect(apiRef.current).not.toBeNull());

    (window.confirm as unknown as ReturnType<typeof vi.fn>).mockReturnValueOnce(false);
    act(() => apiRef.current!.requestNewChat());
    expect(events('assistant_new_chat')).toHaveLength(0);

    act(() => apiRef.current!.requestNewChat());
    expect(events('assistant_new_chat')).toEqual([{ had_spec_run: false, message_count: 0 }]);
  });
});
