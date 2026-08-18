/**
 * Voice-input regression tests for useAssistantLogic.
 *
 * Bug: on the drawer's WELCOME screen the welcome→chat split is gated on
 * `messages.length > 0`. The text path optimistically appends a user bubble,
 * so it flips to the chat view immediately. The voice path used to append
 * nothing — it only sent the audio and waited for the agent's transcription
 * echo — so the view never switched.
 *
 * The fix makes sendVoiceMessage optimistically append a "🎤 Transcribing…"
 * placeholder user bubble (flipping the view immediately), then REPLACE that
 * bubble in place when the transcription echo (an incoming `isUser` message)
 * arrives — so there is exactly ONE user bubble, never a duplicate. Failure
 * paths remove the placeholder so it never lingers.
 *
 * Strategy:
 *   - Mock the `../../services` barrel, overriding ONLY AssistantClient with a
 *     controllable fake (captures handlers, configurable sendVoiceMessage
 *     status, no real WebSocket). Everything else (RateLimiterService, etc.)
 *     stays real.
 *   - Render the real useAssistantLogic with a real Redux store +
 *     ApollonEditorContext provider (editor undefined is fine).
 *   - Drive the captured onMessage handler to simulate the transcription echo.
 */

import React from 'react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChatMessage, SendStatus } from '../../services/assistant-types';
import { workspaceReducer } from '../../../../app/store/workspaceSlice';
import { errorReducer } from '../../../../app/store/errorManagementSlice';
import { smartGeneratorReducer } from '../../../../features/smart-generation/state/smartGeneratorSlice';
import { ApollonEditorProvider } from '../../../editors/uml/apollon-editor-context';

/* ------------------------------------------------------------------ */
/*  Mock the AssistantClient (keep the rest of the barrel real)         */
/* ------------------------------------------------------------------ */

// Shared controller so tests can capture the registered handlers and tweak
// the sendVoiceMessage return status. `vi.hoisted` lets the mock factory
// (which is hoisted to the top of the module) reference it safely.
const _client = vi.hoisted(() => ({
  // The hook registers MULTIPLE onMessage subscribers on the shared client
  // (the conversation dispatcher AND a per-surface "clear generating" handler),
  // so the fake must keep all of them — storing only the last would drop the
  // dispatcher and the test's echoes would hit the wrong handler.
  messageHandlers: [] as Array<(m: ChatMessage) => void>,
  voiceSendStatus: 'sent' as SendStatus,
  sendVoiceCalls: 0,
}));

vi.mock('../../services', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services')>();
  const noopUnsub = () => {};
  class FakeAssistantClient {
    onMessage(handler: (m: ChatMessage) => void) {
      _client.messageHandlers.push(handler);
      return () => {
        _client.messageHandlers = _client.messageHandlers.filter((h) => h !== handler);
      };
    }
    onConnection() {
      return noopUnsub;
    }
    onTyping() {
      return noopUnsub;
    }
    onInjection() {
      return noopUnsub;
    }
    onAction() {
      return noopUnsub;
    }
    clearHandlers() {}
    connect() {
      return Promise.resolve();
    }
    disconnect() {}
    resetSession() {}
    setContextProvider() {}
    sendMessage(): SendStatus {
      return 'sent';
    }
    sendVoiceMessage(): SendStatus {
      _client.sendVoiceCalls += 1;
      return _client.voiceSendStatus;
    }
    sendFrontendEvent(): SendStatus {
      return 'sent';
    }
    get connected() {
      return true;
    }
    get connectionState() {
      return 'connected';
    }
  }
  // The hook obtains its client via getSharedAssistantClient() (a singleton),
  // NOT `new AssistantClient()` — so overriding the class alone leaves the hook
  // on a REAL client (which tries a real WebSocket). Return ONE shared fake so
  // the hook, useWebSocketConnection, and the conversation-store dispatchers all
  // talk to the instance whose onMessage the test drives.
  const sharedFake = new FakeAssistantClient();
  return {
    ...actual,
    AssistantClient: FakeAssistantClient,
    getSharedAssistantClient: () => sharedFake,
  };
});

// Quiet toasts.
vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

// Avoid lazy analytics import side effects.
vi.mock('../../../../shared/services/analytics/lazy-analytics', () => ({
  getPostHog: () => null,
}));

/* ------------------------------------------------------------------ */
/*  Harness                                                            */
/* ------------------------------------------------------------------ */

// Imported AFTER vi.mock calls are hoisted so the hook picks up the fake.
import { useAssistantLogic } from '../useAssistantLogic';
import { conversationStore } from '../assistantConversationStore';

interface HarnessAPI {
  sendVoiceMessage: (blob: Blob) => Promise<void>;
  getMessages: () => Array<{ id: string; role: string; content: string }>;
}

function Harness({ apiRef }: { apiRef: { current: HarnessAPI | null } }) {
  const hook = useAssistantLogic({
    isActive: true,
    switchDiagram: async () => true,
  });
  apiRef.current = {
    sendVoiceMessage: hook.sendVoiceMessage,
    getMessages: () =>
      hook.messages.map((m) => ({ id: m.id, role: m.role, content: m.content })),
  };
  return <div data-testid="count">{hook.messages.length}</div>;
}

function makeStore() {
  return configureStore({
    reducer: {
      workspace: workspaceReducer,
      errors: errorReducer,
      smartGenerator: smartGeneratorReducer,
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

/** Drive ALL registered onMessage handlers with a transcription echo. */
function emitTranscriptionEcho(text: string) {
  const msg: ChatMessage = {
    id: `echo_${Math.random()}`,
    action: 'user_message',
    message: text,
    isUser: true,
    timestamp: new Date(),
  };
  act(() => {
    _client.messageHandlers.forEach((h) => h(msg));
  });
}

/** Drive ALL registered onMessage handlers with an assistant message. */
function emitAssistantMessage(text: string, action = 'assistant_message') {
  const msg: ChatMessage = {
    id: `asst_${Math.random()}`,
    action,
    message: text,
    isUser: false,
    timestamp: new Date(),
  };
  act(() => {
    _client.messageHandlers.forEach((h) => h(msg));
  });
}

const AUDIO = new Blob(['fake-audio'], { type: 'audio/wav' });

beforeEach(() => {
  _client.voiceSendStatus = 'sent';
  _client.sendVoiceCalls = 0;
  // NOTE: don't null `_client.messageHandler` here. The shared fake's onMessage
  // is wired EXACTLY ONCE (wireConversationDispatchers is idempotent via a
  // module-level `dispatchersWired` flag), so nulling it would leave tests 2..n
  // with no handler. The wired closure calls `currentHandlers`, which each
  // mount repoints at the live surface — so it always drives the current test.
  // The conversation store is a MODULE-LEVEL singleton shared by every mounted
  // useAssistantLogic instance — it is NOT reset by a fresh Redux store. Clear
  // it so each test starts from an empty message list; otherwise bubbles leak
  // across tests and the length assertions climb (1 → 3 → 4 → 5 …).
  conversationStore.clear();
});

afterEach(() => {
  // Unmount surfaces so a test's hook instance can't linger and keep receiving
  // events into the next test (the shared client + conversation store persist).
  cleanup();
  vi.clearAllMocks();
});

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('useAssistantLogic — voice optimistic placeholder', () => {
  it('appends a placeholder user bubble immediately on record-send (view switches)', async () => {
    const { apiRef } = renderHarness();
    await waitFor(() => expect(apiRef.current).not.toBeNull());

    expect(apiRef.current!.getMessages()).toHaveLength(0);

    await act(async () => {
      await apiRef.current!.sendVoiceMessage(AUDIO);
    });

    const msgs = apiRef.current!.getMessages();
    // The placeholder makes messages.length > 0 -> hasConversation -> chat view.
    expect(msgs).toHaveLength(1);
    expect(msgs[0].role).toBe('user');
    expect(msgs[0].content).toContain('Transcribing');
    expect(_client.sendVoiceCalls).toBe(1);
  });

  it('replaces the placeholder with the transcription (exactly ONE user bubble)', async () => {
    const { apiRef } = renderHarness();
    await waitFor(() => expect(apiRef.current).not.toBeNull());

    await act(async () => {
      await apiRef.current!.sendVoiceMessage(AUDIO);
    });
    const placeholderId = apiRef.current!.getMessages()[0].id;

    // The agent's transcription echo arrives.
    emitTranscriptionEcho('📢 add a Book class');

    const msgs = apiRef.current!.getMessages();
    // Still exactly ONE user bubble — replaced in place, not appended.
    const userBubbles = msgs.filter((m) => m.role === 'user');
    expect(userBubbles).toHaveLength(1);
    expect(userBubbles[0].id).toBe(placeholderId); // same bubble, replaced
    expect(userBubbles[0].content).toBe('📢 add a Book class');
    expect(userBubbles[0].content).not.toContain('Transcribing');
  });

  it('then shows the assistant reply as a separate bubble', async () => {
    const { apiRef } = renderHarness();
    await waitFor(() => expect(apiRef.current).not.toBeNull());

    await act(async () => {
      await apiRef.current!.sendVoiceMessage(AUDIO);
    });
    emitTranscriptionEcho('add a Book class');
    emitAssistantMessage('Done — added a Book class.');

    const msgs = apiRef.current!.getMessages();
    expect(msgs.filter((m) => m.role === 'user')).toHaveLength(1);
    expect(msgs.filter((m) => m.role === 'assistant')).toHaveLength(1);
    expect(msgs.find((m) => m.role === 'assistant')!.content).toContain('Done');
  });

  it('removes the placeholder when the send fails (no lingering bubble)', async () => {
    _client.voiceSendStatus = 'error';
    const { apiRef } = renderHarness();
    await waitFor(() => expect(apiRef.current).not.toBeNull());

    await act(async () => {
      await apiRef.current!.sendVoiceMessage(AUDIO);
    });

    // Send returned 'error' -> placeholder cleaned up, list back to empty.
    expect(apiRef.current!.getMessages()).toHaveLength(0);
  });

  it('keeps the placeholder when the send is queued (reconnect path)', async () => {
    _client.voiceSendStatus = 'queued';
    const { apiRef } = renderHarness();
    await waitFor(() => expect(apiRef.current).not.toBeNull());

    await act(async () => {
      await apiRef.current!.sendVoiceMessage(AUDIO);
    });

    // Queued will be sent on reconnect; the placeholder must remain so the
    // view stays switched and the echo can replace it later.
    const msgs = apiRef.current!.getMessages();
    expect(msgs).toHaveLength(1);
    expect(msgs[0].content).toContain('Transcribing');

    // And when it finally transcribes, it still replaces in place.
    emitTranscriptionEcho('queued transcription');
    expect(apiRef.current!.getMessages().filter((m) => m.role === 'user')).toHaveLength(1);
    expect(apiRef.current!.getMessages()[0].content).toBe('queued transcription');
  });

  it('drops the stuck placeholder when an agent_error/timeout arrives via onMessage', async () => {
    const { apiRef } = renderHarness();
    await waitFor(() => expect(apiRef.current).not.toBeNull());

    await act(async () => {
      await apiRef.current!.sendVoiceMessage(AUDIO);
    });
    expect(apiRef.current!.getMessages()).toHaveLength(1);

    // No transcription ever comes; instead the response-timeout synthetic
    // agent_error lands on onMessage.
    emitAssistantMessage('The assistant is taking too long to respond.', 'agent_error');

    const msgs = apiRef.current!.getMessages();
    // The stuck "Transcribing…" bubble is gone; only the error remains.
    expect(msgs.filter((m) => m.content.includes('Transcribing'))).toHaveLength(0);
    expect(msgs.filter((m) => m.role === 'assistant')).toHaveLength(1);
  });
});
