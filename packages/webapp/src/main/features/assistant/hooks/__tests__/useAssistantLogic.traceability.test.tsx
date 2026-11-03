/**
 * The conversation with the assistant is recorded in the project trace: each request, the agent's
 * progress and its answer or error, once each even with the widget and the drawer both mounted.
 * What the client writes itself (the "still working" notice, a fallback injection text) is not the
 * agent's and is not recorded.
 */

import React from 'react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AssistantActionPayload, ChatMessage, InjectionCommand, SendStatus } from '../../services/assistant-types';
import { workspaceReducer } from '../../../../app/store/workspaceSlice';
import { errorReducer } from '../../../../app/store/errorManagementSlice';
import { specDrivenReducer } from '../../../../features/spec-driven/state/specDrivenSlice';
import { ApollonEditorProvider } from '../../../editors/uml/apollon-editor-context';

const _client = vi.hoisted(() => ({
  messageHandlers: [] as Array<(m: ChatMessage) => void>,
  injectionHandlers: [] as Array<(c: InjectionCommand) => void>,
  actionHandlers: [] as Array<(p: AssistantActionPayload) => void>,
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
    onInjection(handler: (c: InjectionCommand) => void) {
      _client.injectionHandlers.push(handler);
      return noopUnsub;
    }
    onAction(handler: (p: AssistantActionPayload) => void) {
      _client.actionHandlers.push(handler);
      return () => {
        _client.actionHandlers = _client.actionHandlers.filter((h) => h !== handler);
      };
    }
    onConnection() {
      return noopUnsub;
    }
    onTyping() {
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
      return 'sent';
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
  const sharedFake = new FakeAssistantClient();
  return { ...actual, AssistantClient: FakeAssistantClient, getSharedAssistantClient: () => sharedFake };
});

vi.mock('../useModelInjection', () => ({
  useModelInjection: () => ({
    handleInjection: async () => {},
    ensureTargetDiagramReady: async () => true,
    handleUndo: () => {},
    undoAvailable: false,
    refreshUndoState: () => {},
  }),
}));

const trace = vi.hoisted(() => ({
  recordAssistantRequest: vi.fn(async (_project: unknown, _text: string) => {}),
  recordAssistantReply: vi.fn((_project: unknown, _kind: string, _text: string) => {}),
  endAssistantConversation: vi.fn((_project: unknown) => {}),
}));
vi.mock('../../../../shared/traceability/traceStore', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../shared/traceability/traceStore')>()),
  ...trace,
}));

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));
vi.mock('../../../../shared/services/analytics/lazy-analytics', () => ({
  getPostHog: () => null,
}));

import { useAssistantLogic } from '../useAssistantLogic';
import { INJECTION_FALLBACK_MESSAGE } from '../../services';
import { conversationStore, voicePlaceholderIdRef } from '../assistantConversationStore';

interface SurfaceAPI {
  submit: (text: string) => Promise<void>;
  clear: () => void;
}

function Surface({ apiRef }: { apiRef: { current: SurfaceAPI | null } }) {
  const hook = useAssistantLogic({ isActive: true, switchDiagram: async () => true });
  apiRef.current = { submit: (text) => hook.handleSubmit(undefined, { overrideText: text }), clear: hook.clearConversation };
  return null;
}

/** The widget and the drawer, sharing one client. */
function renderTwoSurfaces() {
  const drawer: { current: SurfaceAPI | null } = { current: null };
  const store = configureStore({ reducer: { workspace: workspaceReducer, errors: errorReducer, specDriven: specDrivenReducer } });
  render(
    <Provider store={store}>
      <ApollonEditorProvider value={{ editor: undefined, setEditor: () => {} }}>
        <Surface apiRef={drawer} />
        <Surface apiRef={{ current: null }} />
      </ApollonEditorProvider>
    </Provider>,
  );
  return drawer;
}

const emitMessage = (message: Partial<ChatMessage>) =>
  act(() => {
    const msg = { id: `m_${Math.random()}`, action: 'assistant_message', timestamp: new Date(), isUser: false, ...message } as ChatMessage;
    _client.messageHandlers.forEach((h) => h(msg));
  });
const emitAction = (payload: AssistantActionPayload) =>
  act(async () => {
    _client.actionHandlers.forEach((h) => h(payload));
  });
const emitInjection = (message: string) =>
  act(async () => {
    _client.injectionHandlers.forEach((h) => h({ action: 'modify_model', message } as InjectionCommand));
  });
const replies = () => trace.recordAssistantReply.mock.calls.map(([, kind, text]) => [kind, text]);

beforeEach(() => {
  // The handler lists are not reset: the shared dispatchers are wired once per module, and each
  // surface's own handlers unsubscribe when it unmounts.
  conversationStore.clear();
  voicePlaceholderIdRef.current = null;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('useAssistantLogic records the conversation in the trace', () => {
  it('records the request, the progress and the answer once each', async () => {
    const drawer = renderTwoSurfaces();
    await waitFor(() => expect(drawer.current).not.toBeNull());

    await act(async () => {
      await drawer.current!.submit('create a library');
    });
    expect(trace.recordAssistantRequest.mock.calls.map(([, text]) => text)).toEqual(['create a library']);

    await emitAction({ action: 'progress', message: 'Designing the classes', step: 1, total: 2 });
    await emitInjection('Added Library and Book.');
    await emitInjection(INJECTION_FALLBACK_MESSAGE); // the client's words, not the agent's
    // The agent's reply arrives as an action and, for display, as a message: recorded once.
    await emitAction({ action: 'assistant_message', message: 'Your library is ready.' });
    emitMessage({ message: 'Your library is ready.' });
    emitMessage({ message: 'Still working on this — generating a full system can take a couple of minutes.' });
    await emitAction({ action: 'stream_done', streamId: 's1', fullText: 'Anything else?' });

    await waitFor(() =>
      expect(replies()).toEqual([
        ['progress', '[1/2] Designing the classes'],
        ['answer', 'Added Library and Book.'],
        ['answer', 'Your library is ready.'],
        ['answer', 'Anything else?'],
      ]),
    );
  });

  it('records an error, a transcribed voice request, and the end of the conversation', async () => {
    const drawer = renderTwoSurfaces();
    await waitFor(() => expect(drawer.current).not.toBeNull());

    emitMessage({ action: 'user_message', message: 'add a Book class', isUser: true });
    emitMessage({ action: 'agent_error', message: 'The assistant is taking too long to respond. Please try again.' });
    act(() => drawer.current!.clear());

    expect(trace.recordAssistantRequest.mock.calls.map(([, text]) => text)).toEqual(['add a Book class']);
    expect(replies()).toEqual([['error', 'The assistant is taking too long to respond. Please try again.']]);
    expect(trace.endAssistantConversation).toHaveBeenCalledTimes(1);
  });
});
