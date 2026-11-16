/**
 * The agent's `show_trace` reply: a button under the answer (a suggested action) that opens the Traceability
 * page, never a navigation by itself, never a model edit, and checked before it is shown.
 */

import React from 'react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AssistantActionPayload, ChatMessage, InjectionCommand, SendStatus } from '../../services/assistant-types';
import { workspaceReducer } from '../../../../app/store/workspaceSlice';
import { errorReducer } from '../../../../app/store/errorManagementSlice';
import { specDrivenReducer } from '../../../../features/spec-driven';
import { ApollonEditorProvider } from '../../../editors';

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
    setHistoryProvider() {}
    get turnId() {
      return null;
    }
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
  recordAssistantReply: vi.fn((_project: unknown, _kind: string, _text: string, _usage?: unknown) => {}),
  endAssistantConversation: vi.fn((_project: unknown) => {}),
}));
vi.mock('../../../../shared/traceability/traceStore', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../shared/traceability/traceStore')>()),
  ...trace,
}));

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));
vi.mock('../../../../shared/services/analytics/events', () => ({
  track: vi.fn(),
  errorProperties: () => ({ error_type: 'Error', network_error: false }),
}));

import { useAssistantLogic } from '../useAssistantLogic';
import { INJECTION_FALLBACK_MESSAGE } from '../../services';
import { conversationStore, voicePlaceholderIdRef } from '../assistantConversationStore';

interface SurfaceAPI {
  submit: (text: string) => Promise<void>;
  clear: () => void;
  meta: () => Record<string, { suggestedActions?: Array<Record<string, unknown>> }>;
}

function Surface({ apiRef }: { apiRef: { current: SurfaceAPI | null } }) {
  const hook = useAssistantLogic({ isActive: true, switchDiagram: async () => true });
  apiRef.current = { submit: (text) => hook.handleSubmit(undefined, { overrideText: text }), clear: hook.clearConversation, meta: () => hook.messageMeta as any };
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
const chips = (api: { current: SurfaceAPI | null }) => Object.values(api.current!.meta()).flatMap((m) => m.suggestedActions ?? []);

beforeEach(() => {
  conversationStore.clear();
  voicePlaceholderIdRef.current = null;
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('show_trace', () => {
  const setup = async () => {
    const drawer = renderTwoSurfaces();
    await waitFor(() => expect(drawer.current).not.toBeNull());
    await act(async () => {
      await drawer.current!.submit('what is out of date?');
    });
    emitMessage({ message: 'Two files are out of date.' });
    return drawer;
  };

  it('attaches a button to the answer, labelled with the action\'s message, and does not navigate or edit the model', async () => {
    const api = await setup();
    await emitAction({ action: 'show_trace', view: 'lineage', artifactId: 'book', message: 'Open the lineage of Book' });
    await waitFor(() => expect(chips(api)).toEqual([
      { label: 'Open the lineage of Book', prompt: '', action: 'show-trace', traceView: 'lineage', traceArtifactId: 'book' },
    ]));
    // Not an answer, and so not recorded as one (it carries no llmUsage here).
    expect(trace.recordAssistantReply).not.toHaveBeenCalled();
  });

  it('takes the artifact as optional, shows a replay once, and records the turn\'s usage like any terminal reply', async () => {
    const api = await setup();
    const usage = { model: 'm', provider: 'openai', inputTokens: 1, outputTokens: 2 };
    await emitAction({ action: 'show_trace', view: 'timeline', message: 'Open the project timeline', llmUsage: usage });
    await emitAction({ action: 'show_trace', view: 'timeline', message: 'Open the project timeline', llmUsage: usage });
    await waitFor(() => expect(chips(api)).toEqual([{ label: 'Open the project timeline', prompt: '', action: 'show-trace', traceView: 'timeline' }]));
    expect(trace.recordAssistantReply.mock.calls.map(([, kind, text]) => [kind, text])).toEqual([['answer', ''], ['answer', '']]);
  });

  it('ignores an unknown view or a payload that is not an object of strings', async () => {
    const api = await setup();
    await emitAction({ action: 'show_trace', view: 'elements', message: 'Open it' });
    await emitAction({ action: 'show_trace', view: ['lineage'], message: 'x' } as unknown as AssistantActionPayload);
    await emitAction({ action: 'show_trace', message: 'no view' });
    await new Promise((r) => setTimeout(r, 50));
    expect(chips(api)).toEqual([]);
  });
});
