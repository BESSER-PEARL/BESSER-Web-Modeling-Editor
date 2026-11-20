/**
 * E2E A-4: a lab run card's "Manage changes" navigated to /lab, but the full-screen
 * chat sheet stayed over the lab page, so the click seemed to do nothing; opening
 * /lab directly showed the sheet over the page too.
 */

import React from 'react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { specDrivenReducer } from '../../../spec-driven';
import { workspaceReducer } from '../../../../app/store/workspaceSlice';

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
vi.mock('../StartFromRepoDialog', () => ({ StartFromRepoDialog: () => null }));
vi.mock('../../../github/components/RepoChatHeader', () => ({ RepoChatHeader: () => null }));

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
});

const navigation: { go: (path: string) => void } = { go: () => undefined };
function NavigationProbe() {
  const navigate = useNavigate();
  navigation.go = navigate;
  return null;
}

function renderDrawer(path: string, onOpenChange: (open: boolean) => void) {
  const store = configureStore({ reducer: { specDriven: specDrivenReducer, workspace: workspaceReducer } });
  render(
    <MemoryRouter initialEntries={[path]}>
      <Provider store={store}>
        <NavigationProbe />
        <AssistantWorkspaceDrawer open onOpenChange={onOpenChange} />
      </Provider>
    </MemoryRouter>,
  );
}

describe('the chat sheet and the lab page', () => {
  it('closes when the app navigates to the lab page', () => {
    const onOpenChange = vi.fn();
    renderDrawer('/', onOpenChange);
    expect(onOpenChange).not.toHaveBeenCalledWith(false);

    act(() => navigation.go('/lab'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('is closed when the lab page is opened directly', () => {
    const onOpenChange = vi.fn();
    renderDrawer('/lab', onOpenChange);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('stays open on a navigation to another page', () => {
    const onOpenChange = vi.fn();
    renderDrawer('/', onOpenChange);
    act(() => navigation.go('/project-settings'));
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
