/**
 * The welcome entrance replays on every open by re-keying its wrappers. Those
 * wrappers are siblings, and once they shared one key React kept the stale
 * copies on each open: the welcome screen stacked 4-5 times. The composer must
 * also stay mounted across open/close (it owns attached files).
 */

import React from 'react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { specDrivenReducer } from '../../../spec-driven/state/specDrivenSlice';

vi.mock('../../hooks/useAssistantLogic', () => ({
  useAssistantLogic: () => ({
    messages: [],
    inputValue: '',
    setInputValue: () => {},
    isGenerating: false,
    connectionStatus: 'connected',
    rateLimitStatus: { requestsLastMinute: 0, requestsLastHour: 0, cooldownRemaining: 0 },
    messageMeta: {},
    progressSteps: [],
    lastSentMessage: '',
    messageListContainerRef: { current: null },
    showScrollToBottom: false,
    scrollMessagesToBottom: () => {},
    handleSubmit: async () => {},
    sendVoiceMessage: async () => {},
    stopGenerating: () => {},
    requestNewChat: () => {},
    reportIssue: async () => {},
    assistantClient: {},
  }),
}));
vi.mock('../AssistantByokDialog', () => ({ AssistantByokDialog: () => null }));

import { AssistantWorkspaceDrawer } from '../AssistantWorkspaceDrawer';

beforeAll(() => {
  if (!('ResizeObserver' in window)) {
    (window as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('AssistantWorkspaceDrawer welcome entrance', () => {
  it('renders one welcome screen after repeated open/close, keeping the composer mounted', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = configureStore({ reducer: { specDriven: specDrivenReducer } });
    const tree = (open: boolean) => (
      <Provider store={store}>
        <AssistantWorkspaceDrawer open={open} onOpenChange={() => {}} />
      </Provider>
    );

    // Query the DOM directly: the closed sheet is aria-hidden, and the bug is
    // duplicated nodes regardless of visibility.
    const { container, rerender } = render(tree(false));
    const composer = container.querySelector('textarea');
    expect(composer).not.toBeNull();
    for (let i = 0; i < 3; i++) {
      rerender(tree(true));
      rerender(tree(false));
    }
    rerender(tree(true));

    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(container.querySelectorAll('textarea')).toHaveLength(1);
    expect(container.querySelector('textarea')).toBe(composer);
    const keyWarnings = consoleError.mock.calls.filter((args) => String(args[0]).includes('same key'));
    expect(keyWarnings).toHaveLength(0);
  });
});
