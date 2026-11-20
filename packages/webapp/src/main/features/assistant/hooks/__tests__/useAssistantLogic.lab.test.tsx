/**
 * The chat on a BESSER Lab instance: text goes to the lab agent (`startLabRun`)
 * instead of the modeling agent's WebSocket, a tab without a GitHub session is
 * answered with a sign-in prompt, voice and attachments are refused, and the
 * run card's "Open pull request" posts the links into the chat. Off a lab the
 * chat is unchanged.
 */
import React from 'react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SendStatus } from '../../services/assistant-types';
import { workspaceReducer } from '../../../../app/store/workspaceSlice';
import { errorReducer } from '../../../../app/store/errorManagementSlice';
import { specDrivenReducer } from '../../../../features/spec-driven';
import { ApollonEditorProvider } from '../../../editors';
import { openLabPullRequests, startLabRun } from '../../../../shared/api/lab';
import { ApiError } from '../../../../shared/api/api-client';
import { reportError } from '../../../../shared/services/errors/reportError';

const lab = vi.hoisted(() => ({
  enabled: true,
  /** What the server config says once loaded; `enabled` is the hook's answer at mount. */
  serverEnabled: true,
  session: 'gh-session-0123456789' as string | null,
  sendMessageCalls: 0,
  sendVoiceCalls: 0,
  connectCalls: 0,
  /** False: the server config could not be loaded (`serverEnabled` is then the fallback's false). */
  configKnown: true,
  /** Whether the modeling agent's socket is open. */
  agentConnected: true,
}));

vi.mock('../../../../shared/hooks/useLabMode', () => ({ useLabMode: () => lab.enabled }));
vi.mock('../../../../shared/services/labConfig', () => ({
  getLabEnabled: async () => lab.configKnown && lab.serverEnabled,
  isLabConfigKnown: () => lab.configKnown,
  resolveLabEnabled: async () => (lab.configKnown ? lab.serverEnabled : null),
}));

vi.mock('../../../../shared/services/github/githubAuth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../shared/services/github/githubAuth')>()),
  getGitHubSession: () => lab.session,
}));

vi.mock('../../../../shared/api/lab', () => ({ startLabRun: vi.fn(), openLabPullRequests: vi.fn() }));

vi.mock('../../../../shared/services/errors/reportError', () => ({ reportError: vi.fn(), notifyError: vi.fn() }));

vi.mock('../../services', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services')>();
  const noopUnsub = () => {};
  class FakeAssistantClient {
    onMessage() {
      return noopUnsub;
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
      lab.connectCalls += 1;
      return Promise.resolve();
    }
    disconnect() {}
    resetSession() {}
    setContextProvider() {}
    setHistoryProvider() {}
    sendHistoryWithNextMessage() {}
    restartWithHistoryOnNextMessage() {}
    sendMessage(): SendStatus {
      lab.sendMessageCalls += 1;
      return 'sent';
    }
    sendVoiceMessage(): SendStatus {
      lab.sendVoiceCalls += 1;
      return 'sent';
    }
    sendFrontendEvent(): SendStatus {
      return 'sent';
    }
    get connected() {
      return lab.agentConnected;
    }
    get connectionState() {
      return lab.agentConnected ? 'connected' : 'disconnected';
    }
  }
  const sharedFake = new FakeAssistantClient();
  return { ...actual, AssistantClient: FakeAssistantClient, getSharedAssistantClient: () => sharedFake };
});

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

vi.mock('../../../../shared/services/analytics/events', () => ({
  track: vi.fn(),
  errorProperties: () => ({ error_type: 'Error', network_error: false }),
}));

// Imported after the mocks so the hook picks up the fakes.
import { useAssistantLogic, type UseAssistantLogicReturn } from '../useAssistantLogic';
import { conversationStore } from '../assistantConversationStore';

function Harness({ apiRef }: { apiRef: { current: UseAssistantLogicReturn | null } }) {
  apiRef.current = useAssistantLogic({ isActive: true, switchDiagram: async () => true, surface: 'workspace' });
  return null;
}

function renderHarness() {
  const apiRef: { current: UseAssistantLogicReturn | null } = { current: null };
  const store = configureStore({
    reducer: { workspace: workspaceReducer, errors: errorReducer, specDriven: specDrivenReducer },
  });
  render(
    <Provider store={store}>
      <ApollonEditorProvider value={{ editor: undefined, setEditor: () => {} }}>
        <Harness apiRef={apiRef} />
      </ApollonEditorProvider>
    </Provider>,
  );
  return apiRef;
}

/** A lab stream that ends at once; what the run does with its events is the trigger hook's test. */
const emptyRun = () => ({
  controller: new AbortController(),
  abort: () => {},
  events: (async function* () {})(),
});

const contents = () => conversationStore.getMessages().map((m) => `${m.role}: ${m.content}`);

async function submit(api: { current: UseAssistantLogicReturn | null }, text: string, files?: FileList) {
  await act(async () => {
    await api.current!.handleSubmit(undefined, { overrideText: text, experimental_attachments: files });
  });
}

beforeEach(() => {
  lab.enabled = true;
  lab.serverEnabled = true;
  lab.session = 'gh-session-0123456789';
  lab.sendMessageCalls = 0;
  lab.sendVoiceCalls = 0;
  lab.connectCalls = 0;
  lab.configKnown = true;
  lab.agentConnected = true;
  conversationStore.clear();
  vi.mocked(startLabRun).mockImplementation(emptyRun);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('sending a message on a lab instance', () => {
  it('sends it to the lab agent with the GitHub session, not to the modeling agent', async () => {
    const api = renderHarness();
    await submit(api, 'Add a note element to class diagrams');
    expect(startLabRun).toHaveBeenCalledTimes(1);
    expect(vi.mocked(startLabRun).mock.calls[0][0]).toMatchObject({
      message: 'Add a note element to class diagrams',
      githubSession: 'gh-session-0123456789',
    });
    expect(lab.sendMessageCalls).toBe(0);
    expect(contents()[0]).toBe('user: Add a note element to class diagrams');
  });

  it('answers with a sign-in prompt and sends nothing when the tab has no GitHub session', async () => {
    lab.session = null;
    const api = renderHarness();
    await submit(api, 'Add a note element');
    expect(startLabRun).not.toHaveBeenCalled();
    expect(lab.sendMessageCalls).toBe(0);
    expect(contents()).toEqual([
      'user: Add a note element',
      'assistant: Sign in with GitHub to use BESSER Lab, then send your message again.',
    ]);
  });

  it('refuses attachments instead of dropping them silently', async () => {
    const api = renderHarness();
    const file = new File(['x'], 'mockup.png', { type: 'image/png' });
    const files = { 0: file, length: 1, item: () => file, [Symbol.iterator]: [file][Symbol.iterator].bind([file]) };
    await submit(api, 'Use this', files as unknown as FileList);
    expect(startLabRun).not.toHaveBeenCalled();
    expect(lab.sendMessageCalls).toBe(0);
    expect(reportError).toHaveBeenCalledWith('BESSER Lab reads text only: describe the change in your message.');
  });

  it('answers a voice message instead of sending it to the modeling agent', async () => {
    const api = renderHarness();
    await act(async () => {
      await api.current!.sendVoiceMessage(new Blob(['audio'], { type: 'audio/wav' }));
    });
    expect(lab.sendVoiceCalls).toBe(0);
    expect(startLabRun).not.toHaveBeenCalled();
    expect(contents()).toEqual(['assistant: BESSER Lab does not take voice messages: type the change instead.']);
  });
});

describe('sending a message on any other instance', () => {
  it('still goes to the modeling agent', async () => {
    lab.enabled = false;
    lab.serverEnabled = false;
    const api = renderHarness();
    await submit(api, 'Create a library model');
    expect(lab.sendMessageCalls).toBe(1);
    expect(startLabRun).not.toHaveBeenCalled();
  });
});

describe('a lab instance whose config had not answered when the chat mounted', () => {
  it('waits for the config and sends the message to the lab, not to the modeling agent', async () => {
    lab.enabled = false;
    const api = renderHarness();
    await submit(api, 'Add a note element');
    expect(lab.sendMessageCalls).toBe(0);
    expect(startLabRun).toHaveBeenCalledTimes(1);
  });
});

// E2E A-3: the lab backend was down; the config load failed, read as "not a lab", and the message went down the
// modeling agent's path with no answer.
describe('when the server config cannot be loaded', () => {
  it('sends nothing, says the server cannot be reached and keeps the text in the composer', async () => {
    lab.enabled = false;
    lab.configKnown = false;
    lab.agentConnected = false;
    const api = renderHarness();
    act(() => api.current!.setInputValue('Also give each Term a language code'));
    await act(async () => {
      await api.current!.handleSubmit(undefined);
    });
    expect(startLabRun).not.toHaveBeenCalled();
    expect(lab.sendMessageCalls).toBe(0);
    expect(reportError).toHaveBeenCalledWith(
      'The BESSER server cannot be reached, so your message was not sent. Try again in a moment.',
    );
    expect(api.current!.inputValue).toBe('Also give each Term a language code');
    expect(contents()).toEqual([]);
    expect(api.current!.connectionStatus).toBe('disconnected');
  });

  it('still goes to the modeling agent when its socket is open (not a lab, the backend is down)', async () => {
    lab.enabled = false;
    lab.configKnown = false;
    const api = renderHarness();
    await submit(api, 'Create a library model');
    expect(lab.sendMessageCalls).toBe(1);
    expect(startLabRun).not.toHaveBeenCalled();
  });
});

// E2E A (modeling agent websocket): on a lab every page opened the socket, toasted "Could not reach the AI assistant"
// and showed "Disconnected"; the drawer's pending prompt waited for that socket forever.
describe("the modeling agent's socket", () => {
  it('is not opened on a lab, and the chat shows the lab backend as connected', async () => {
    const api = renderHarness();
    await waitFor(() => expect(api.current!.connectionStatus).toBe('connected'));
    expect(lab.connectCalls).toBe(0);
  });

  it('is opened on any other instance', async () => {
    lab.enabled = false;
    lab.serverEnabled = false;
    renderHarness();
    await waitFor(() => expect(lab.connectCalls).toBe(1));
  });
});

/** Puts a finished lab run card in the conversation, as the trigger hook leaves it. */
function labCard(step: 'plan' | 'build', changeId: string) {
  const lab = {
    step,
    changeId,
    title: 'Note element',
    kind: 'metamodel',
    plan: step === 'plan' ? { kind: 'metamodel', title: 'Note element', summary: 's', steps: [], repos: [], questions: [] } : null,
    repoChanges: [],
    checks: [],
    checklist: [],
    summary: '',
    stopReason: 'completed',
  };
  conversationStore.setMessages((prev) => [
    ...prev,
    {
      id: `card-${prev.length}`,
      role: 'assistant',
      content: '',
      specDriven: { runId: `${prev.length}`.padStart(32, 'a'), phases: [], warnings: [], text: '', status: 'done', lab },
    } as never,
  ]);
}

describe('what a lab message asks for', () => {
  it('revises the plan when the user replies to a plan card, instead of starting the build', async () => {
    const api = renderHarness();
    act(() => labCard('plan', 'c1'));
    await submit(api, 'Rename Note to Memo');
    expect(vi.mocked(startLabRun).mock.calls[0][0]).toMatchObject({ action: 'plan' });
  });

  it('builds the plan only from the "Build this plan" button, for the card change', async () => {
    const api = renderHarness();
    act(() => labCard('plan', 'c1'));
    await act(async () => {
      api.current!.buildLabPlan('c1');
    });
    expect(vi.mocked(startLabRun).mock.calls[0][0]).toMatchObject({ action: 'build', message: 'Build this plan.' });
    expect(contents()).toContain('user: Build this plan.');
  });

  it('continues a built change with a plain message', async () => {
    const api = renderHarness();
    act(() => labCard('build', 'c1'));
    await submit(api, 'Also add a docs page');
    expect(vi.mocked(startLabRun).mock.calls[0][0]).toMatchObject({ action: 'auto' });
  });

  it('keeps the text in the composer and shows no message while a lab run is in flight', async () => {
    // A run whose stream stays open: its card is live and the run slot is taken.
    vi.mocked(startLabRun).mockImplementation(() => ({
      controller: new AbortController(),
      abort: () => {},
      events: (async function* () {
        yield { event: 'start', runId: 'f'.repeat(32), provider: 'anthropic' };
        await new Promise<void>(() => undefined);
      })(),
    }));
    const api = renderHarness();
    await submit(api, 'Add a note element');
    expect(startLabRun).toHaveBeenCalledTimes(1);
    vi.mocked(reportError).mockClear();

    act(() => api.current!.setInputValue('Also add a docs page'));
    await act(async () => {
      await api.current!.handleSubmit(undefined);
    });
    expect(startLabRun).toHaveBeenCalledTimes(1);
    expect(reportError).toHaveBeenCalledWith(
      'BESSER Lab is already running — please wait for it to finish or click Stop.',
    );
    expect(api.current!.inputValue).toBe('Also add a docs page');
    expect(contents().filter((line) => line.startsWith('user:'))).toEqual(['user: Add a note element']);
  });
});

describe('Open pull request', () => {
  it('posts a link to each draft pull request in the chat, and which checks passed under them', async () => {
    vi.mocked(openLabPullRequests).mockResolvedValue({
      pullRequests: [
        { repo: 'frontend', number: 41, url: 'https://github.com/o/editor/pull/41', branch: 'lab/jordi/note', base: 'develop' },
        { repo: 'besser', number: 7, url: 'https://github.com/o/besser/pull/7', branch: 'lab/jordi/note', base: 'development' },
      ],
      checksNote: 'The checks of the touched areas passed; the full suites run in CI.',
    });
    const api = renderHarness();
    await act(async () => {
      await api.current!.openPullRequest('c1');
    });
    expect(openLabPullRequests).toHaveBeenCalledWith('gh-session-0123456789', 'c1');
    expect(contents()).toEqual([
      'assistant: Opened the draft pull requests:\n' +
        '- [Web editor #41](https://github.com/o/editor/pull/41): `lab/jordi/note` into `develop`\n' +
        '- [BESSER #7](https://github.com/o/besser/pull/7): `lab/jordi/note` into `development`\n' +
        '\n' +
        'The checks of the touched areas passed; the full suites run in CI.',
    ]);
  });

  it('rejects with the refusal, for the card to show it in place rather than as a toast (E2E A-6)', async () => {
    const refusal = new ApiError(409, 'The change touches .github/workflows/ci.yml, which the sign-in token cannot push.');
    vi.mocked(openLabPullRequests).mockRejectedValue(refusal);
    const api = renderHarness();
    await act(async () => {
      await expect(api.current!.openPullRequest('c1')).rejects.toBe(refusal);
    });
    expect(reportError).not.toHaveBeenCalled();
    expect(contents()).toEqual([]);
  });

  it('asks the user to sign in when the tab has no GitHub session', async () => {
    lab.session = null;
    const api = renderHarness();
    await act(async () => {
      await api.current!.openPullRequest('c1');
    });
    expect(openLabPullRequests).not.toHaveBeenCalled();
    expect(contents()).toEqual(['assistant: Sign in with GitHub to use BESSER Lab, then send your message again.']);
  });

  it("opens nothing for an older card whose change is not the active one, and says so", async () => {
    // Phase 1's null answer, which the route no longer gives; W4-D rewrites this test.
    vi.mocked(openLabPullRequests).mockResolvedValue(null as never);
    const api = renderHarness();
    await act(async () => {
      await api.current!.openPullRequest('c-older');
    });
    expect(openLabPullRequests).toHaveBeenCalledWith('gh-session-0123456789', 'c-older');
    expect(contents()).toEqual([
      'assistant: No pull request was opened: this card’s change is not the active one. Resume it on the lab page first.',
    ]);
  });
});
