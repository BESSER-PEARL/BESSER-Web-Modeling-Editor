/**
 * What a typed message tells the agent about the trace: the digest built once, from the message (its focus),
 * by the client's context provider, which a queued message also calls when it is finally sent.
 */

import React from 'react';
import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AssistantWorkspaceContext, SendStatus } from '../../services/assistant-types';
import { workspaceReducer } from '../../../../app/store/workspaceSlice';
import { errorReducer } from '../../../../app/store/errorManagementSlice';
import { specDrivenReducer } from '../../../../features/spec-driven';
import { ApollonEditorProvider } from '../../../editors';
import { createDefaultProject } from '../../../../shared/types/project';
import type { BesserProject } from '../../../../shared/types/project';

type Provider = (message?: string) => AssistantWorkspaceContext | undefined;

const _client = vi.hoisted(() => ({
  provider: undefined as ((message?: string) => unknown) | undefined,
  sent: [] as Array<{ message: string; override: Record<string, unknown> | undefined; base: Record<string, unknown> | undefined }>,
}));

vi.mock('../../services', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services')>();
  const noopUnsub = () => {};
  class FakeAssistantClient {
    constructor(options?: { contextProvider?: Provider }) {
      if (options?.contextProvider) _client.provider = options.contextProvider;
    }
    onMessage() { return noopUnsub; }
    onInjection() { return noopUnsub; }
    onAction() { return noopUnsub; }
    onConnection() { return noopUnsub; }
    onTyping() { return noopUnsub; }
    clearHandlers() {}
    connect() { return Promise.resolve(); }
    disconnect() {}
    resetSession() {}
    setContextProvider(provider: Provider) { _client.provider = provider; }
    setHistoryProvider() {}
    get turnId() { return null; }
    // Like the real client: the context provider is called with the message when the payload is built.
    sendMessage(message: string, _type?: string, override?: Record<string, unknown>): SendStatus {
      _client.sent.push({ message, override, base: _client.provider?.(message) as Record<string, unknown> | undefined });
      return 'sent';
    }
    sendVoiceMessage(): SendStatus { return 'sent'; }
    sendFrontendEvent(): SendStatus { return 'sent'; }
    get connected() { return true; }
    get connectionState() { return 'connected'; }
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

const digest = vi.hoisted(() => ({
  buildAssistantTraceDigest: vi.fn((_project: unknown, message?: string) => ({ focus: message ?? null })),
}));
vi.mock('../../services/traceDigestContext', () => digest);

vi.mock('../../../../shared/traceability/traceStore', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../shared/traceability/traceStore')>()),
  recordAssistantRequest: vi.fn(async () => {}),
}));
vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn(), warn: vi.fn() },
}));
vi.mock('../../../../shared/services/analytics/events', () => ({
  track: vi.fn(),
  errorProperties: () => ({ error_type: 'Error', network_error: false }),
}));

import { useAssistantLogic } from '../useAssistantLogic';

async function renderWith(project: BesserProject) {
  const workspace = { ...workspaceReducer(undefined, { type: 'init' }), project };
  const reducer = combineReducers({ workspace: workspaceReducer, errors: errorReducer, specDriven: specDrivenReducer });
  const store = configureStore({ reducer, preloadedState: { workspace } as never });
  const api: { current: ReturnType<typeof useAssistantLogic> | null } = { current: null };
  function Surface() {
    api.current = useAssistantLogic({ isActive: true, switchDiagram: async () => true });
    return null;
  }
  render(
    <Provider store={store}>
      <ApollonEditorProvider value={{ editor: undefined, setEditor: () => {} }}>
        <Surface />
      </ApollonEditorProvider>
    </Provider>,
  );
  await waitFor(() => expect(api.current).not.toBeNull());
  return async (text: string) => {
    await act(async () => {
      await api.current!.handleSubmit(undefined, { overrideText: text });
    });
  };
}

const recording = (on: boolean): BesserProject => {
  const project = createDefaultProject('Library', '', '');
  return { ...project, settings: { ...project.settings, traceabilityEnabled: on } } as BesserProject;
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  _client.sent = [];
});

describe('the trace digest of a typed message', () => {
  it('is built once, from the message, and not overridden by a digest without its focus', async () => {
    const submit = await renderWith(recording(true));
    digest.buildAssistantTraceDigest.mockClear();
    await submit('Who created Book?');

    expect(_client.sent).toHaveLength(1);
    const [{ override, base }] = _client.sent;
    // The client merges the override over its provider's context: the override must leave the digest to it.
    expect(override?.traceDigest).toBeUndefined();
    expect(base?.traceDigest).toEqual({ focus: 'Who created Book?' });
    expect(digest.buildAssistantTraceDigest.mock.calls.map(([, message]) => message)).toEqual(['Who created Book?']);
  });
});
