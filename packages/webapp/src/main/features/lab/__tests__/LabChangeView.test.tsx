/**
 * The change view (D4 W10): the chat of a change's thread, its header and its tabs. The chat engine is the real one
 * (`useAssistantLogic` in lab mode); the canvas and the preview are stubs, since their own tests cover them.
 */
import React from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { store } from '../../../app/store/store';
import { ApiError } from '../../../shared/api/api-client';
import {
  dropLabChange,
  getLabChange,
  getLabDiff,
  getLabHome,
  getLabReview,
  startLabRun,
  type LabChangeDetail,
  type LabHomeResponse,
  type LabThreadItem,
} from '../../../shared/api/lab';
import { resetGitHubAuthForTests, signInToGitHubForTests } from '../../../shared/services/github/githubAuth';
import { getOpenLabChange, requestLabView } from '../../../shared/services/labSession';
import { ProjectStorageRepository } from '../../../shared/services/storage/ProjectStorageRepository';
import { conversationStore } from '../../assistant';
import { LabAuthGate } from '../LabAuthGate';
import { LabChangeView } from '../LabChangeView';
import { labProposalChangeId } from '../labDone';
import { labProjectId } from '../labProject';

const lab = vi.hoisted(() => ({ connectCalls: 0 }));

vi.mock('../../../shared/constants/constant', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../shared/constants/constant')>()),
  LAB_BUILD: true,
}));
vi.mock('../../../shared/services/labConfig', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../shared/services/labConfig')>()),
  resolveLabEnabled: vi.fn(async () => true),
}));
vi.mock('../../../shared/api/lab', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../shared/api/lab')>()),
  getLabHome: vi.fn(),
  getLabChange: vi.fn(),
  getLabReview: vi.fn(),
  getLabDiff: vi.fn(),
  startLabRun: vi.fn(),
  dropLabChange: vi.fn(),
  openLabPullRequests: vi.fn(),
  updateLabChangeFromBase: vi.fn(),
  closeLabChange: vi.fn(),
}));
// The durable-run follow the chat uses for a run in progress.
const followSpecDrivenRun = vi.hoisted(() => vi.fn());
vi.mock('../../spec-driven/services/specDrivenSseClient', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  followSpecDrivenRun,
}));
// The modeling agent's socket is never opened in the lab build; a fake client proves it.
vi.mock('../../assistant/services', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../assistant/services')>();
  const unsubscribe = () => {};
  class FakeAssistantClient {
    onMessage() { return unsubscribe; }
    onConnection() { return unsubscribe; }
    onTyping() { return unsubscribe; }
    onInjection() { return unsubscribe; }
    onAction() { return unsubscribe; }
    clearHandlers() {}
    connect() { lab.connectCalls += 1; return Promise.resolve(); }
    disconnect() {}
    resetSession() {}
    setContextProvider() {}
    setHistoryProvider() {}
    sendHistoryWithNextMessage() {}
    restartWithHistoryOnNextMessage() {}
    sendMessage() { return 'sent'; }
    sendVoiceMessage() { return 'sent'; }
    sendFrontendEvent() { return 'sent'; }
    get connected() { return true; }
    get connectionState() { return 'connected'; }
  }
  const shared = new FakeAssistantClient();
  return { ...actual, AssistantClient: FakeAssistantClient, getSharedAssistantClient: () => shared };
});
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn(), update: vi.fn(), dismiss: vi.fn() }),
  ToastContainer: () => null,
}));
const confirm = vi.hoisted(() => ({ answer: true }));
vi.mock('../../../shared/services/confirm/globalConfirm', () => ({ globalConfirm: vi.fn(async () => confirm.answer) }));
// Stubs: the canvas and the preview have their own tests.
vi.mock('../../editors/EditorView', () => ({ EditorView: () => <div data-testid="lab-canvas" /> }));
vi.mock('../LabPreviewTab', () => ({
  LabPreviewTab: ({ visible }: { visible: boolean }) => <div data-testid="lab-preview" data-visible={String(visible)} />,
}));

const SESSION = 'gh-session-0123456789';
const CHANGE_ID = '0123456789ab';
const RUN = 'f'.repeat(32);
const NOW = Math.floor(Date.now() / 1000);

const HOME = (login: string, isAdmin = false): LabHomeResponse => ({
  user: { login, isAdmin },
  bases: [],
  runs: { inProgress: [], cap: 2 },
  meters: {
    month: '2026-11',
    user: { spentUsd: 3, reservedUsd: 0, capUsd: 75 },
    instance: { spentUsd: 20, reservedUsd: 0, capUsd: 300 },
  },
  previewSlots: 1,
  linkMode: 'reflink',
  memory: { enabled: true, reason: '', count: 0, max: 60 },
});

const classModel = (...classNames: string[]) => ({
  version: '3.0.0',
  type: 'ClassDiagram',
  size: { width: 0, height: 0 },
  interactive: { elements: {}, relationships: {} },
  elements: Object.fromEntries(
    classNames.map((name) => [`id-${name}`, { id: `id-${name}`, name, type: 'Class', owner: null, bounds: { x: 0, y: 0, width: 160, height: 100 }, attributes: [], methods: [] }]),
  ),
  relationships: {},
  assessments: {},
});

function change(overrides: Partial<LabChangeDetail> = {}): LabChangeDetail {
  return {
    changeId: CHANGE_ID,
    title: 'Note element',
    kind: 'editor_element',
    status: 'open',
    outcome: null,
    owner: 'jordi',
    phase: 'built',
    repos: ['frontend'],
    behind: {},
    run: null,
    pullRequests: [],
    cost: { usd: 1.2, turns: 20, elapsedSeconds: 300, runs: 2 },
    requestedBy: ['jordi'],
    createdAt: NOW - 3600,
    updatedAt: NOW - 60,
    closedAt: null,
    branches: { frontend: 'lab/note-element' },
    bases: [],
    view: null,
    thread: [],
    runs: [],
    ...overrides,
  };
}

const message = (id: string, login: string, text: string, at: number, model: Record<string, unknown> | null = null): LabThreadItem => ({
  type: 'message', id, at, login, text, action: 'auto', model,
});

/** What the router sent the change view: shown so a test can see the state being cleared. */
const StateProbe: React.FC = () => {
  const location = useLocation();
  return <pre data-testid="router-state">{JSON.stringify(location.state)}</pre>;
};

async function renderView(detail: LabChangeDetail, { login = 'ana', isAdmin = false, entry = `/c/${CHANGE_ID}` as string | { pathname: string; state: unknown } } = {}) {
  vi.mocked(getLabHome).mockResolvedValue(HOME(login, isAdmin));
  signInToGitHubForTests(SESSION, login);
  vi.mocked(getLabChange).mockResolvedValue(detail);
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[entry]}>
        <LabAuthGate>
          <Routes>
            <Route path="/c/:changeId" element={<><LabChangeView /><StateProbe /></>} />
            <Route path="/" element={<p>Home</p>} />
          </Routes>
        </LabAuthGate>
      </MemoryRouter>
    </Provider>,
  );
  await screen.findByRole('heading', { level: 1 });
}

beforeEach(() => {
  localStorage.clear();
  resetGitHubAuthForTests();
  conversationStore.clear();
  confirm.answer = true;
  lab.connectCalls = 0;
  vi.mocked(startLabRun).mockReset().mockImplementation(() => ({
    controller: new AbortController(),
    abort: () => {},
    events: (async function* () {})(),
  }));
  vi.mocked(getLabReview).mockReset().mockImplementation(async (_session, changeId) => ({
    changeId, pullRequests: [], lifecycle: 'open', closable: false, closableNote: '', nextPollSeconds: null, fetchedAt: 0,
  }));
  vi.mocked(getLabDiff).mockReset().mockResolvedValue({ changeId: CHANGE_ID, repos: [] } as never);
  vi.mocked(dropLabChange).mockReset();
  followSpecDrivenRun.mockReset();
});
afterEach(() => {
  cleanup();
});

describe('LabChangeView chat', () => {
  it('renders the senders of a thread with two logins, and opens the change for the chat', async () => {
    await renderView(change({
      thread: [message('m1', 'jordi', 'Add a Note element to class diagrams', NOW - 300), message('m2', 'ana', 'Give it a colour too', NOW - 200)],
    }));
    expect(getOpenLabChange()).toBe(CHANGE_ID);
    expect(await screen.findByText('Add a Note element to class diagrams')).toBeTruthy();
    expect(screen.getByText('Give it a colour too')).toBeTruthy();
    expect(screen.getByText('@jordi')).toBeTruthy();
    expect(screen.getByText('@ana')).toBeTruthy();
    expect(lab.connectCalls).toBe(0);
  });

  it("shows the continuation line on another user's change only", async () => {
    await renderView(change({ owner: 'jordi' }), { login: 'ana' });
    expect(screen.getByTestId('lab-change-continuation')).toHaveTextContent(
      "@jordi's change. Your messages continue it and are signed with your login.",
    );
    cleanup();
    await renderView(change({ owner: 'ana' }), { login: 'ana' });
    expect(screen.queryByTestId('lab-change-continuation')).toBeNull();
  });

  it('follows a run of the change in progress, and gives the composer over to it', async () => {
    followSpecDrivenRun.mockReturnValue({ controller: new AbortController(), abort: () => {}, events: (async function* () {})() });
    await renderView(change({
      phase: 'running',
      run: { runId: RUN, changeId: CHANGE_ID, login: 'jordi', step: 'build', startedAt: NOW - 180 },
      thread: [
        message('m1', 'jordi', 'Build it', NOW - 200),
        { type: 'run', runId: RUN, at: NOW - 180, login: 'jordi', status: 'running', lab: null, error: null, costUsd: null, planVersion: null },
      ],
    }));
    await waitFor(() => expect(followSpecDrivenRun).toHaveBeenCalledWith(RUN, 0, SESSION));
    expect(screen.getByTestId('lab-change-running')).toHaveTextContent("@jordi's build is running (3 min).");
    expect(screen.getByRole('button', { name: 'Stop' })).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it("sends the home's first message once, then clears it from the history entry", async () => {
    await renderView(change({ status: 'draft', phase: 'draft', title: '' }), {
      entry: { pathname: `/c/${CHANGE_ID}`, state: { labStart: { message: 'Add a TOML generator', issue: { repo: 'besser', number: 744 } } } },
    });
    await waitFor(() => expect(startLabRun).toHaveBeenCalledTimes(1));
    expect(vi.mocked(startLabRun).mock.calls[0][0]).toMatchObject({
      message: 'Add a TOML generator\n\nbesser#744',
      changeId: CHANGE_ID,
      githubSession: SESSION,
    });
    await waitFor(() => expect(screen.getByTestId('router-state')).toHaveTextContent('null'));
    // A later read of the change does not send it again.
    await act(async () => {
      requestLabView({ kind: 'changes', changeId: CHANGE_ID });
    });
    await act(async () => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(startLabRun).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('New change');
  });
});

describe('LabChangeView model', () => {
  // D4 test 10 (canvas part): a browser without the change's project rebuilds it from the thread.
  it("rebuilds the canvas project from the thread when this browser has none, and opens the Model tab", async () => {
    expect(ProjectStorageRepository.getAllProjects()).toEqual([]);
    await renderView(change({
      phase: 'planned',
      thread: [
        message('m1', 'jordi', 'Add a Note element', NOW - 300),
        {
          type: 'run', runId: 'r1', at: NOW - 200, login: 'jordi', status: 'done', error: null, costUsd: 0.4, planVersion: 1,
          lab: {
            step: 'plan', changeId: CHANGE_ID, title: 'Note element', kind: 'editor_element', plan: null,
            modelProposal: { title: 'Note metamodel', diagramType: 'ClassDiagram', model: classModel('Note', 'Page') },
            repoChanges: [], checks: [], checklist: [], summary: '', stopReason: 'completed', finalText: '', report: null,
            pullRequests: [], cost: { usd: 0.4, turns: 5, elapsedSeconds: 60, runs: 1 }, issues: [], noteProposals: [],
          },
        },
      ],
    }));
    expect(await screen.findByTestId('lab-canvas')).toBeTruthy();
    const project = ProjectStorageRepository.loadProject(labProjectId(CHANGE_ID))!;
    const [diagram] = project.diagrams.ClassDiagram;
    expect(labProposalChangeId(diagram)).toBe(CHANGE_ID);
    expect(Object.keys((diagram.model as { elements: object }).elements)).toEqual(['id-Note', 'id-Page']);
    expect(store.getState().workspace.project?.id).toBe(labProjectId(CHANGE_ID));
    // The proposal banner sits above the canvas, in the Model tab.
    expect(screen.getByRole('region', { name: 'Proposed model' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Model', selected: true })).toBeTruthy();
  });

  it('opens the Changes tab of a built change by default, and says when a change has no model', async () => {
    await renderView(change({ phase: 'built' }));
    expect(screen.getByRole('tab', { name: 'Changes', selected: true })).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Model' }));
    expect(await screen.findByTestId('lab-model-empty')).toBeTruthy();
  });
});

describe('LabChangeView tabs and views', () => {
  it('opens Try it from ?tab=try, visible while the page is', async () => {
    await renderView(change(), { entry: `/c/${CHANGE_ID}?tab=try` });
    expect(screen.getByRole('tab', { name: 'Try it', selected: true })).toBeTruthy();
    expect(screen.getByTestId('lab-preview')).toHaveAttribute('data-visible', 'true');
  });

  it('keeps Try it hidden and not visible on another tab', async () => {
    await renderView(change());
    expect(screen.getByTestId('lab-preview')).toHaveAttribute('data-visible', 'false');
  });

  it("opens the view a card asks for: the pull-request dialog, Try it, the Changes tab with the diff", async () => {
    await renderView(change({ view: null }));
    await act(async () => {
      requestLabView({ kind: 'pullRequest', changeId: CHANGE_ID });
    });
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Open pull request' })).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    await act(async () => {
      requestLabView({ kind: 'tryIt', changeId: CHANGE_ID });
    });
    expect(screen.getByTestId('lab-preview')).toHaveAttribute('data-visible', 'true');

    await act(async () => {
      requestLabView({ kind: 'changes', changeId: CHANGE_ID, file: { repo: 'frontend', path: 'a.ts' } });
    });
    // The diff dialog is modal: the tabs behind it are hidden from the accessibility tree.
    expect(screen.getByRole('tab', { name: 'Changes', selected: true, hidden: true })).toBeTruthy();
    await waitFor(() => expect(getLabDiff).toHaveBeenCalledWith(SESSION, CHANGE_ID, undefined));

    // A request for another change is not this view's.
    await act(async () => {
      requestLabView({ kind: 'tryIt', changeId: 'another' });
    });
    expect(screen.getByRole('tab', { name: 'Changes', selected: true, hidden: true })).toBeTruthy();
  });

  it('says a change that does not exist any more may have been dropped', async () => {
    vi.mocked(getLabHome).mockResolvedValue(HOME('ana'));
    signInToGitHubForTests(SESSION, 'ana');
    vi.mocked(getLabChange).mockRejectedValue(new ApiError(404, 'No change.', 'No change.'));
    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={[`/c/${CHANGE_ID}`]}>
          <LabAuthGate>
            <Routes>
              <Route path="/c/:changeId" element={<LabChangeView />} />
            </Routes>
          </LabAuthGate>
        </MemoryRouter>
      </Provider>,
    );
    expect(await screen.findByTestId('lab-change-not-found')).toHaveTextContent('It may have been dropped.');
    expect(screen.getByRole('link', { name: 'Back to changes' })).toHaveAttribute('href', '/');
  });
});

describe('LabChangeView drop', () => {
  const openMenu = () => fireEvent.keyDown(screen.getByRole('button', { name: 'More actions' }), { key: 'ArrowDown' });

  it("is not offered to a teammate on another user's change", async () => {
    await renderView(change({ owner: 'jordi' }), { login: 'ana' });
    openMenu();
    expect(await screen.findByRole('menuitem', { name: /Try this change/ })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: /Drop change/ })).toBeNull();
  });

  it('is offered to an admin, and drops the change after the confirmation', async () => {
    vi.mocked(dropLabChange).mockResolvedValue({ changes: [] });
    await renderView(change({ owner: 'jordi' }), { login: 'ana', isAdmin: true });
    openMenu();
    await act(async () => {
      fireEvent.click(await screen.findByRole('menuitem', { name: /Drop change/ }));
    });
    await waitFor(() => expect(dropLabChange).toHaveBeenCalledWith(SESSION, CHANGE_ID));
    expect(await screen.findByText('Home')).toBeTruthy();
  });

  it('is offered to the owner, and does nothing when the owner cancels', async () => {
    confirm.answer = false;
    await renderView(change({ owner: 'ana' }), { login: 'ana' });
    openMenu();
    await act(async () => {
      fireEvent.click(await screen.findByRole('menuitem', { name: /Drop change/ }));
    });
    expect(dropLabChange).not.toHaveBeenCalled();
  });
});
