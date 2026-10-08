/**
 * Widget + drawer mounted together share ONE client and ONE conversation, and
 * replies run through a single last-writer-wins dispatcher (the surface that
 * mounted last). Per-turn state that the send side writes and the reply side
 * reads must therefore be shared too, or the two surfaces disagree:
 *  - voice sent from the drawer left "🎤 Transcribing…" stuck, because the
 *    widget's handler looked for the placeholder in its own (empty) ref;
 *  - auto-fix ran once per page load: the sending surface reset its own
 *    `attempted` flag, the dispatch winner's flag stayed spent forever.
 */

import React from 'react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChatMessage, InjectionCommand, SendStatus } from '../../services/assistant-types';
import { workspaceReducer } from '../../../../app/store/workspaceSlice';
import { errorReducer } from '../../../../app/store/errorManagementSlice';
import { specDrivenReducer } from '../../../../features/spec-driven/state/specDrivenSlice';
import { ApollonEditorProvider } from '../../../editors/uml/apollon-editor-context';

const _client = vi.hoisted(() => ({
  messageHandlers: [] as Array<(m: ChatMessage) => void>,
  injectionHandlers: [] as Array<(c: InjectionCommand) => void>,
  sentMessages: [] as string[],
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
    onConnection() {
      return noopUnsub;
    }
    onTyping() {
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
    sendMessage(text: string): SendStatus {
      _client.sentMessages.push(text);
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

// The real injection path needs a live editor; the auto-fix loop only cares
// that an applied ClassDiagram model is reported back through onModelApplied.
vi.mock('../useModelInjection', () => ({
  useModelInjection: (options: { onModelApplied?: (info: any) => void }) => ({
    handleInjection: async (command: InjectionCommand) => {
      options.onModelApplied?.({ action: command.action, diagramType: 'ClassDiagram', model: {} });
    },
    ensureTargetDiagramReady: async () => true,
    handleUndo: () => {},
    undoAvailable: false,
    refreshUndoState: () => {},
  }),
}));

const validateDiagramMock = vi.hoisted(() => vi.fn());
vi.mock('../../../../shared/services/validation/validateDiagram', () => ({
  validateDiagram: validateDiagramMock,
}));

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));
vi.mock('../../../../shared/services/analytics/lazy-analytics', () => ({
  getPostHog: () => null,
}));

import { useAssistantLogic } from '../useAssistantLogic';
import { autoFixRef, conversationStore, voicePlaceholderIdRef } from '../assistantConversationStore';

interface SurfaceAPI {
  sendVoiceMessage: (blob: Blob) => Promise<void>;
  submit: (text: string) => Promise<void>;
}

function Surface({ apiRef }: { apiRef: { current: SurfaceAPI | null } }) {
  const hook = useAssistantLogic({ isActive: true, switchDiagram: async () => true });
  apiRef.current = {
    sendVoiceMessage: hook.sendVoiceMessage,
    submit: (text) => hook.handleSubmit(undefined, { overrideText: text }),
  };
  return null;
}

/** Mount the drawer first and the widget second, so the widget wins dispatch. */
function renderTwoSurfaces() {
  const drawer: { current: SurfaceAPI | null } = { current: null };
  const widget: { current: SurfaceAPI | null } = { current: null };
  const store = configureStore({
    reducer: { workspace: workspaceReducer, errors: errorReducer, specDriven: specDrivenReducer },
  });
  const tree = (showWidget: boolean) => (
    <Provider store={store}>
      <ApollonEditorProvider value={{ editor: undefined, setEditor: () => {} }}>
        <Surface apiRef={drawer} />
        {showWidget && <Surface apiRef={widget} />}
      </ApollonEditorProvider>
    </Provider>
  );
  const { rerender } = render(tree(true));
  const unmountWidget = () => rerender(tree(false));
  return { drawer, widget, unmountWidget };
}

function emit(message: Partial<ChatMessage>) {
  const msg = { id: `m_${Math.random()}`, action: 'assistant_message', timestamp: new Date(), ...message } as ChatMessage;
  act(() => {
    _client.messageHandlers.forEach((h) => h(msg));
  });
}

async function emitInjection() {
  await act(async () => {
    _client.injectionHandlers.forEach((h) => h({ action: 'modify_model' } as InjectionCommand));
  });
}

const repairRequests = () => _client.sentMessages.filter((m) => m.startsWith('[auto-fix]'));

beforeEach(() => {
  _client.sentMessages = [];
  conversationStore.clear();
  voicePlaceholderIdRef.current = null;
  autoFixRef.current = { attempted: false, fixInFlight: false, progressMessageId: null };
  validateDiagramMock.mockResolvedValue({ errors: ['Class "Book" has no attributes'] });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('useAssistantLogic with widget and drawer both mounted', () => {
  it('voice sent from the drawer resolves its placeholder when the widget receives the echo', async () => {
    const { drawer } = renderTwoSurfaces();
    await waitFor(() => expect(drawer.current).not.toBeNull());

    await act(async () => {
      await drawer.current!.sendVoiceMessage(new Blob(['a'], { type: 'audio/wav' }));
    });
    emit({ action: 'user_message', message: 'add a Book class', isUser: true });

    const messages = conversationStore.getMessages();
    expect(messages.filter((m) => m.content.includes('Transcribing'))).toHaveLength(0);
    const userBubbles = messages.filter((m) => m.role === 'user');
    expect(userBubbles).toHaveLength(1);
    expect(userBubbles[0].content).toBe('add a Book class');
  });

  it('explains a cancelled API-key prompt once, not once per mounted surface', async () => {
    const { drawer, unmountWidget } = renderTwoSurfaces();
    await waitFor(() => expect(drawer.current).not.toBeNull());
    const noKeyMessages = () =>
      conversationStore.getMessages().filter((m) => m.content.startsWith('No API key set'));

    act(() => {
      window.dispatchEvent(new Event('wme:specdriven-key-cancelled'));
    });
    expect(noKeyMessages()).toHaveLength(1);

    // The listener outlives one surface unmounting (ref-counted, not per surface).
    unmountWidget();
    act(() => {
      window.dispatchEvent(new Event('wme:specdriven-key-cancelled'));
    });
    expect(noKeyMessages()).toHaveLength(2);
  });

  it('auto-fix triggers again on a failure after a second message in the same page load', async () => {
    const { drawer } = renderTwoSurfaces();
    await waitFor(() => expect(drawer.current).not.toBeNull());

    // Turn 1: the drawer sends, the applied model fails validation -> one repair.
    await act(async () => {
      await drawer.current!.submit('create a library');
    });
    emit({ message: 'done', isUser: false });
    await emitInjection();
    await waitFor(() => expect(repairRequests()).toHaveLength(1));

    // Turn 2: a fresh user message grants a fresh repair attempt. Step past the
    // rate limiter's 1 s cooldown so the submit is not throttled.
    vi.setSystemTime(Date.now() + 5000);
    await act(async () => {
      await drawer.current!.submit('add a Member class');
    });
    emit({ message: 'done', isUser: false });
    await emitInjection();
    await waitFor(() => expect(repairRequests()).toHaveLength(2));
  });
});
