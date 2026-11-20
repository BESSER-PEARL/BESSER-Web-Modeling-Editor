/**
 * The chat in the lab build (D4 W11, D2 WP7): it is the open change's thread. A message goes to the open change
 * (`startLabRun` with its `changeId`) instead of the modeling agent; without an open change the chat says so and
 * sends nothing; a refusal shows the server's sentence; another open change replaces the conversation with its
 * thread, and a run of it in progress is followed; nothing is kept in the browser. The review of the open change's
 * pull requests posts review cards, and a merged change closes itself. In a public build none of this runs.
 */
import React from 'react';
import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SendStatus } from '../../services/assistant-types';
import { workspaceReducer } from '../../../../app/store/workspaceSlice';
import { errorReducer } from '../../../../app/store/errorManagementSlice';
import { specDrivenReducer } from '../../../../features/spec-driven';
import { ApollonEditorProvider } from '../../../editors';
import {
  closeLabChange,
  getLabChange,
  getLabReview,
  openLabPullRequests,
  startLabRun,
  updateLabChangeFromBase,
  type LabChangeDetail,
  type LabReviewResponse,
  type LabThreadItem,
} from '../../../../shared/api/lab';
import { SseHttpError } from '../../../../shared/api/sseClient';
import { ApiError } from '../../../../shared/api/api-client';
import { setOpenLabChange } from '../../../../shared/services/labSession';
import { reportError } from '../../../../shared/services/errors/reportError';
import { createDefaultProject } from '../../../../shared/types/project';

const lab = vi.hoisted(() => ({
  /** The editor build: `LAB_BUILD`. */
  build: true,
  /** What the server config says, for the modeling agent's socket (`useWebSocketConnection`). */
  serverEnabled: true,
  session: 'gh-session-0123456789' as string | null,
  login: 'ana',
  sendMessageCalls: 0,
  sendVoiceCalls: 0,
  connectCalls: 0,
}));

vi.mock('../../../../shared/constants/constant', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../shared/constants/constant')>();
  return {
    ...actual,
    get LAB_BUILD() {
      return lab.build;
    },
  };
});
vi.mock('../../../../shared/services/labConfig', () => ({
  getLabEnabled: async () => lab.serverEnabled,
  isLabConfigKnown: () => true,
  resolveLabEnabled: async () => lab.serverEnabled,
  peekLabEnabled: () => lab.serverEnabled,
}));

vi.mock('../../../../shared/services/github/githubAuth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../shared/services/github/githubAuth')>();
  return {
    ...actual,
    getGitHubSession: () => lab.session,
    getGitHubAuthState: () => ({ ...actual.getGitHubAuthState(), username: lab.login, session: lab.session }),
  };
});

vi.mock('../../../../shared/api/lab', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../shared/api/lab')>()),
  startLabRun: vi.fn(),
  openLabPullRequests: vi.fn(),
  getLabChange: vi.fn(),
  getLabReview: vi.fn(),
  closeLabChange: vi.fn(),
  updateLabChangeFromBase: vi.fn(),
}));

// The durable-run follow the trigger hook uses for a run in progress.
const followSpecDrivenRun = vi.hoisted(() => vi.fn());
vi.mock('../../../spec-driven/services/specDrivenSseClient', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  followSpecDrivenRun,
}));

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
      return true;
    }
    get connectionState() {
      return 'connected';
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

const CHANGE_A = '0123456789ab';
const CHANGE_B = 'ba9876543210';
const RUN = 'f'.repeat(32);

function Harness({ apiRef }: { apiRef: { current: UseAssistantLogicReturn | null } }) {
  apiRef.current = useAssistantLogic({ isActive: true, switchDiagram: async () => true, surface: 'workspace' });
  return null;
}

/** The chat with a project open, as the change view has its `lab-<id>` project open. */
function renderHarness() {
  const apiRef: { current: UseAssistantLogicReturn | null } = { current: null };
  const store = configureStore({
    reducer: combineReducers({ workspace: workspaceReducer, errors: errorReducer, specDriven: specDrivenReducer }),
    preloadedState: {
      workspace: { ...workspaceReducer(undefined, { type: 'init' }), project: createDefaultProject('Lab change', '', '') },
    },
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

const detail = (changeId: string, thread: LabThreadItem[]): LabChangeDetail =>
  ({ changeId, title: 'A change', owner: 'jordi', run: null, thread }) as unknown as LabChangeDetail;

const THREADS: Record<string, LabThreadItem[]> = {
  [CHANGE_A]: [
    { type: 'message', id: 'a1', at: 100, login: 'jordi', text: 'Add a note element', action: 'auto', model: null },
    { type: 'notice', at: 101, login: 'jordi', text: 'development was merged into the change.' },
  ],
  [CHANGE_B]: [{ type: 'message', id: 'b1', at: 200, login: 'ana', text: 'Add a TOML generator', action: 'auto', model: null }],
};

const contents = () => conversationStore.getMessages().map((m) => `${m.role}: ${m.content}`);

async function submit(api: { current: UseAssistantLogicReturn | null }, text: string, files?: FileList) {
  await act(async () => {
    await api.current!.handleSubmit(undefined, { overrideText: text, experimental_attachments: files });
  });
}

async function openChange(changeId: string | null) {
  await act(async () => {
    setOpenLabChange(changeId);
  });
}

beforeEach(() => {
  lab.build = true;
  lab.serverEnabled = true;
  lab.session = 'gh-session-0123456789';
  lab.login = 'ana';
  lab.sendMessageCalls = 0;
  lab.sendVoiceCalls = 0;
  lab.connectCalls = 0;
  conversationStore.clear();
  window.localStorage.clear();
  vi.mocked(startLabRun).mockImplementation(emptyRun);
  vi.mocked(getLabChange).mockImplementation(async (_session, changeId) => detail(changeId, THREADS[changeId] ?? []));
  vi.mocked(getLabReview).mockImplementation(async (_session, changeId) => ({
    changeId,
    pullRequests: [],
    lifecycle: 'open',
    closable: false,
    closableNote: '',
    nextPollSeconds: null,
    fetchedAt: 0,
  }));
});

afterEach(() => {
  setOpenLabChange(null);
  cleanup();
  vi.clearAllMocks();
});

describe('sending a message in the lab build', () => {
  it('answers and sends nothing when no change is open', async () => {
    const api = renderHarness();
    await submit(api, 'Add a note element');
    expect(startLabRun).not.toHaveBeenCalled();
    expect(lab.sendMessageCalls).toBe(0);
    expect(contents()).toEqual(['user: Add a note element', 'assistant: Open a change or start a new one first.']);
  });

  it('sends it to the open change, with its id and the GitHub session, not to the modeling agent', async () => {
    const api = renderHarness();
    await openChange(CHANGE_A);
    // The first open loads labThread (and the run card it imports) cold, which can take over 1 s under load.
    await waitFor(() => expect(contents()).toContain('user: Add a note element'), { timeout: 5000 });
    await submit(api, 'Also give it a colour');
    await waitFor(() => expect(startLabRun).toHaveBeenCalledTimes(1));
    expect(vi.mocked(startLabRun).mock.calls[0][0]).toMatchObject({
      message: 'Also give it a colour',
      githubSession: 'gh-session-0123456789',
      changeId: CHANGE_A,
      review: undefined,
    });
    expect(lab.sendMessageCalls).toBe(0);
  });

  it("shows the server's sentence when it refuses the run", async () => {
    vi.mocked(startLabRun).mockImplementation(() => ({
      controller: new AbortController(),
      abort: () => {},
      events: (async function* () {
        throw new SseHttpError(429, JSON.stringify({ detail: { code: 'runs_full', message: '2 of 2 runs are in progress: @jordi on "Note".' } }));
      })(),
    }));
    const api = renderHarness();
    await openChange(CHANGE_A);
    await submit(api, 'Build it');
    await waitFor(() => expect(contents()).toContain('assistant: 2 of 2 runs are in progress: @jordi on "Note".'));
  });

  it('answers with a sign-in prompt and sends nothing when the tab has no GitHub session', async () => {
    lab.session = null;
    const api = renderHarness();
    await openChange(CHANGE_A);
    await submit(api, 'Add a note element');
    expect(startLabRun).not.toHaveBeenCalled();
    expect(contents()).toContain('assistant: Sign in with GitHub to use BESSER Lab, then send your message again.');
  });

  it('refuses attachments instead of dropping them silently', async () => {
    const api = renderHarness();
    await openChange(CHANGE_A);
    const file = new File(['x'], 'mockup.png', { type: 'image/png' });
    const files = { 0: file, length: 1, item: () => file, [Symbol.iterator]: [file][Symbol.iterator].bind([file]) };
    await submit(api, 'Use this', files as unknown as FileList);
    expect(startLabRun).not.toHaveBeenCalled();
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

describe('the open change', () => {
  it("replaces the conversation with each change's thread, and keeps none of it in the browser", async () => {
    renderHarness();
    await openChange(CHANGE_A);
    await waitFor(() =>
      expect(contents()).toEqual(['user: Add a note element', 'assistant: development was merged into the change.']),
    );
    const [message] = conversationStore.getMessages();
    expect(message.sender).toEqual({ login: 'jordi', self: false });

    await openChange(CHANGE_B);
    await waitFor(() => expect(contents()).toEqual(['user: Add a TOML generator']));
    expect(getLabChange).toHaveBeenCalledWith('gh-session-0123456789', CHANGE_B);

    // Not bound to the open project, so not written to this browser's conversation store or the project.
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(conversationStore.getProjectId()).toBeNull();
    expect(Object.keys(window.localStorage).filter((key) => key.includes('conversation'))).toEqual([]);
  });

  it('follows a run of the change in progress through its event log', async () => {
    vi.mocked(getLabChange).mockResolvedValueOnce(
      detail(CHANGE_A, [
        { type: 'message', id: 'a1', at: 100, login: 'jordi', text: 'Build it', action: 'build', model: null },
        { type: 'run', runId: RUN, at: 101, login: 'jordi', status: 'running', lab: null, error: null, costUsd: null, planVersion: null },
      ]),
    );
    followSpecDrivenRun.mockReturnValue({
      controller: new AbortController(),
      abort: () => {},
      events: (async function* () {})(),
    });
    renderHarness();
    await openChange(CHANGE_A);
    await waitFor(() => expect(followSpecDrivenRun).toHaveBeenCalledWith(RUN, 0, 'gh-session-0123456789'));
  });

  it('says why its thread could not be read', async () => {
    vi.mocked(getLabChange).mockRejectedValueOnce(new ApiError(404, 'No change 0123456789ab.'));
    renderHarness();
    await openChange(CHANGE_A);
    await waitFor(() =>
      expect(contents()).toEqual(["assistant: This change's conversation could not be read: No change 0123456789ab."]),
    );
  });
});

describe('the review of the open change', () => {
  const review = (overrides: Partial<LabReviewResponse>): LabReviewResponse => ({
    changeId: CHANGE_A,
    pullRequests: [],
    lifecycle: 'open',
    closable: false,
    closableNote: '',
    nextPollSeconds: null,
    fetchedAt: 0,
    ...overrides,
  });

  it('posts a review card when something is new, and closes a merged change itself', async () => {
    vi.mocked(getLabReview).mockResolvedValue(review({ lifecycle: 'merged', closable: true }));
    vi.mocked(closeLabChange).mockResolvedValue(detail(CHANGE_A, []));
    renderHarness();
    await openChange(CHANGE_A);
    await waitFor(() => expect(closeLabChange).toHaveBeenCalledWith('gh-session-0123456789', CHANGE_A));
    expect(conversationStore.getMessages().some((m) => m.labReview?.changeId === CHANGE_A)).toBe(true);
    // The notice is the server's, in the thread every viewer reads: the chat re-reads it.
    await waitFor(() => expect(getLabChange).toHaveBeenCalledTimes(2));
  });

  it("sends a review task as a lab message to the card's change", async () => {
    const api = renderHarness();
    await openChange(CHANGE_A);
    await act(async () => {
      await api.current!.handleLabReviewAction(CHANGE_A, { kind: 'addressComments', repo: 'frontend', commentIds: ['c1', 'c2'] });
    });
    await waitFor(() => expect(startLabRun).toHaveBeenCalledTimes(1));
    expect(vi.mocked(startLabRun).mock.calls[0][0]).toMatchObject({
      changeId: CHANGE_A,
      action: 'auto',
      review: { task: 'address_comments', repo: 'frontend', commentIds: ['c1', 'c2'] },
      message: 'Address the 2 selected review comments on the Web editor pull request.',
    });
  });

  it('updates a repository from its base and closes on request, then re-reads the thread', async () => {
    vi.mocked(updateLabChangeFromBase).mockResolvedValue({ repo: 'besser', outcome: 'updated', conflicts: [], message: 'Updated.' });
    vi.mocked(closeLabChange).mockResolvedValue(detail(CHANGE_A, []));
    const api = renderHarness();
    await openChange(CHANGE_A);
    await waitFor(() => expect(getLabChange).toHaveBeenCalledTimes(1));
    await act(async () => {
      await api.current!.handleLabReviewAction(CHANGE_A, { kind: 'updateFromBase', repo: 'besser' });
      await api.current!.handleLabReviewAction(CHANGE_A, { kind: 'close' });
    });
    expect(updateLabChangeFromBase).toHaveBeenCalledWith('gh-session-0123456789', CHANGE_A, 'besser');
    expect(closeLabChange).toHaveBeenCalledWith('gh-session-0123456789', CHANGE_A);
    expect(getLabChange).toHaveBeenCalledTimes(3);
  });
});

describe('in a public build', () => {
  it('sends to the modeling agent and makes no lab request, even with a change id in the lab session', async () => {
    lab.build = false;
    lab.serverEnabled = false;
    const api = renderHarness();
    await openChange(CHANGE_A);
    await submit(api, 'Create a library model');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(lab.sendMessageCalls).toBe(1);
    expect(startLabRun).not.toHaveBeenCalled();
    expect(getLabChange).not.toHaveBeenCalled();
    // D2: no request to /lab/review.
    expect(getLabReview).not.toHaveBeenCalled();
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

  // One switch decides lab mode: the build (LAB_BUILD), not the server config read at run time.
  it('is not opened by a lab build even before the server config says lab', async () => {
    lab.serverEnabled = false;
    const api = renderHarness();
    await waitFor(() => expect(api.current!.connectionStatus).toBe('connected'));
    expect(lab.connectCalls).toBe(0);
  });

  it('is opened on any other instance', async () => {
    lab.build = false;
    lab.serverEnabled = false;
    renderHarness();
    await waitFor(() => expect(lab.connectCalls).toBe(1));
  });
});

/** Puts a finished lab run card in the conversation, as the trigger hook leaves it. */
function labCard(step: 'plan' | 'build', changeId: string) {
  const card = {
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
      createdAt: new Date(),
      specDriven: { runId: `${prev.length}`.padStart(32, 'a'), phases: [], warnings: [], text: '', status: 'done', lab: card },
    } as never,
  ]);
}

describe('what a lab message asks for', () => {
  async function onChange() {
    const api = renderHarness();
    await openChange(CHANGE_A);
    await waitFor(() => expect(contents().length).toBe(2));
    return api;
  }

  it('revises the plan when the user replies to a plan card, instead of starting the build', async () => {
    const api = await onChange();
    act(() => labCard('plan', CHANGE_A));
    await submit(api, 'Rename Note to Memo');
    await waitFor(() => expect(startLabRun).toHaveBeenCalledTimes(1));
    expect(vi.mocked(startLabRun).mock.calls[0][0]).toMatchObject({ action: 'plan', changeId: CHANGE_A });
  });

  it('builds the plan only from the "Build this plan" button, for the card change', async () => {
    const api = await onChange();
    act(() => labCard('plan', CHANGE_A));
    await act(async () => {
      api.current!.buildLabPlan(CHANGE_A);
    });
    await waitFor(() => expect(startLabRun).toHaveBeenCalledTimes(1));
    expect(vi.mocked(startLabRun).mock.calls[0][0]).toMatchObject({ action: 'build', message: 'Build this plan.' });
    expect(contents()).toContain('user: Build this plan.');
  });

  it('continues a built change with a plain message', async () => {
    const api = await onChange();
    act(() => labCard('build', CHANGE_A));
    await submit(api, 'Also add a docs page');
    await waitFor(() => expect(startLabRun).toHaveBeenCalledTimes(1));
    expect(vi.mocked(startLabRun).mock.calls[0][0]).toMatchObject({ action: 'auto' });
  });

  it('keeps the text in the composer and shows no message while a lab run is in flight', async () => {
    // A run whose stream stays open: its card is live and the run slot is taken.
    vi.mocked(startLabRun).mockImplementation(() => ({
      controller: new AbortController(),
      abort: () => {},
      events: (async function* () {
        yield { event: 'start', runId: RUN, provider: 'anthropic' };
        await new Promise<void>(() => undefined);
      })(),
    }));
    const api = await onChange();
    await submit(api, 'Add a note element');
    await waitFor(() => expect(startLabRun).toHaveBeenCalledTimes(1));
    vi.mocked(reportError).mockClear();

    act(() => api.current!.setInputValue('Also add a docs page'));
    await act(async () => {
      await api.current!.handleSubmit(undefined);
    });
    expect(startLabRun).toHaveBeenCalledTimes(1);
    expect(reportError).toHaveBeenCalledWith('BESSER Lab is already running — please wait for it to finish or click Stop.');
    expect(api.current!.inputValue).toBe('Also add a docs page');
    expect(contents().filter((line) => line.startsWith('user:'))).toEqual(['user: Add a note element', 'user: Add a note element']);
  });
});

describe('Push to the pull requests', () => {
  it("pushes, then shows the pull requests from the change's thread", async () => {
    vi.mocked(openLabPullRequests).mockResolvedValue({
      pullRequests: [{ repo: 'frontend', number: 41, url: 'https://github.com/o/editor/pull/41', branch: 'lab/ana/note', base: 'develop' }],
      checksNote: 'The quick checks passed.',
    });
    const api = renderHarness();
    await openChange(CHANGE_A);
    await waitFor(() => expect(contents().length).toBe(2));
    vi.mocked(getLabChange).mockResolvedValueOnce(
      detail(CHANGE_A, [
        ...THREADS[CHANGE_A],
        {
          type: 'pull_requests',
          at: 102,
          login: 'ana',
          pullRequests: [{ repo: 'frontend', number: 41, url: 'https://github.com/o/editor/pull/41', branch: 'lab/ana/note', base: 'develop' }],
          checksNote: 'The quick checks passed.',
        },
      ]),
    );
    await act(async () => {
      await api.current!.openPullRequest(CHANGE_A);
    });
    expect(openLabPullRequests).toHaveBeenCalledWith('gh-session-0123456789', CHANGE_A);
    expect(contents()[2]).toBe(
      'assistant: @ana opened or updated the draft pull requests:\n' +
        '- [Web editor #41](https://github.com/o/editor/pull/41): `lab/ana/note` into `develop`\n' +
        '\n' +
        'The quick checks passed.',
    );
    expect(contents()).toHaveLength(3);
  });

  it('rejects with the refusal, for the card to show it in place rather than as a toast (E2E A-6)', async () => {
    const refusal = new ApiError(409, 'The change touches .github/workflows/ci.yml, which the sign-in token cannot push.');
    vi.mocked(openLabPullRequests).mockRejectedValue(refusal);
    const api = renderHarness();
    await act(async () => {
      await expect(api.current!.openPullRequest(CHANGE_A)).rejects.toBe(refusal);
    });
    expect(reportError).not.toHaveBeenCalled();
    expect(contents()).toEqual([]);
  });

  it('asks the user to sign in when the tab has no GitHub session', async () => {
    lab.session = null;
    const api = renderHarness();
    await act(async () => {
      await api.current!.openPullRequest(CHANGE_A);
    });
    expect(openLabPullRequests).not.toHaveBeenCalled();
    expect(contents()).toEqual(['assistant: Sign in with GitHub to use BESSER Lab, then send your message again.']);
  });
});
