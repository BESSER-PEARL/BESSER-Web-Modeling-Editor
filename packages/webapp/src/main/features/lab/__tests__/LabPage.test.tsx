import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetGitHubAuthForTests, signInToGitHubForTests } from '../../../shared/services/github/githubAuth';

const SESSION = 'session-abcdef123';

const LAB_STATE = {
  enabled: true,
  user: 'jordi',
  change: {
    step: 'build',
    changeId: 'c1',
    title: 'Note element',
    kind: 'editor_element',
    repoChanges: [
      {
        repo: 'frontend',
        branch: 'lab/jordi/note-element',
        base: 'develop',
        files: [
          { path: 'packages/editor/src/main/packages/components.ts', status: 'modified' },
          { path: 'packages/editor/src/main/packages/uml-class-diagram/note/note.ts', status: 'added' },
        ],
      },
      { repo: 'besser', branch: 'lab/jordi/note-element', base: 'development', files: [{ path: 'docs/old.rst', status: 'deleted' }] },
      { repo: 'modeling_agent', branch: 'lab/jordi/note-element', base: 'main', files: [] },
    ],
    checks: [],
    checklist: [],
    summary: '',
    stopReason: 'completed',
  },
  parked: [{ changeId: 'c0', title: 'Older idea', kind: 'generator', createdAt: 1763500000 }],
  preview: {
    enabled: true,
    services: [
      { name: 'backend', running: true, detail: 'port 9100' },
      { name: 'modeling-agent', running: false, detail: 'exited with 1' },
    ],
  },
  run: null as { runId: string; startedAt: number } | null,
};
const NO_CHANGE = { ...LAB_STATE, change: null };

const mocks = vi.hoisted(() => ({
  labEnabled: true,
  configKnown: true,
  chat: {
    messages: [] as Array<{ id: string; role: string; content: string }>,
    isGenerating: false,
  },
  handleSubmit: vi.fn(),
  getLabState: vi.fn(),
  openLabPullRequests: vi.fn(),
  parkLabChange: vi.fn(),
  resumeLabChange: vi.fn(),
  dropLabChange: vi.fn(),
  resetLabPreview: vi.fn(),
  cancelSpecDrivenRun: vi.fn(),
  // The slice fields the page reads to know whether a run is in flight.
  store: { specDriven: { runStatus: 'idle', runs: {} as Record<string, unknown> } },
  globalConfirm: vi.fn(),
  reportError: vi.fn(),
}));

vi.mock('../../../shared/services/labConfig', () => ({
  getLabEnabled: async () => mocks.labEnabled,
  peekLabEnabled: () => false,
  isLabConfigKnown: () => mocks.configKnown,
}));
vi.mock('../../../shared/api/lab', () => ({
  getLabState: mocks.getLabState,
  openLabPullRequests: mocks.openLabPullRequests,
  parkLabChange: mocks.parkLabChange,
  resumeLabChange: mocks.resumeLabChange,
  dropLabChange: mocks.dropLabChange,
  resetLabPreview: mocks.resetLabPreview,
}));
// The chat hook has its own tests; the page only lays out what it returns.
vi.mock('../../assistant', () => ({
  useAssistantLogic: () => ({
    ...mocks.chat,
    inputValue: '',
    setInputValue: vi.fn(),
    progressSteps: [],
    messageListContainerRef: { current: null },
    handleSubmit: mocks.handleSubmit,
    sendVoiceMessage: vi.fn(),
    stopGenerating: vi.fn(),
    latestRunId: undefined,
    buildLabPlan: vi.fn(),
  }),
}));
vi.mock('../../../shared/api/specDriven', () => ({ cancelSpecDrivenRun: mocks.cancelSpecDrivenRun }));
vi.mock('../../../shared/services/confirm/globalConfirm', () => ({ globalConfirm: mocks.globalConfirm }));
vi.mock('../../../shared/services/errors/reportError', () => ({ reportError: mocks.reportError, notifyError: () => vi.fn() }));
vi.mock('../../../app/store/hooks', () => ({
  useAppDispatch: () => vi.fn(),
  useAppSelector: (select: (state: typeof mocks.store) => unknown) => select(mocks.store),
}));
vi.mock('../../../app/store/workspaceSlice', () => ({ switchDiagramTypeThunk: vi.fn() }));

// After the mocks: the page imports them.
const { LabPage } = await import('../LabPage');

const page = () => (
  <MemoryRouter initialEntries={['/lab']}>
    <LabPage />
  </MemoryRouter>
);

const renderPage = async () => {
  const result = render(page());
  await waitFor(() => expect(screen.queryByText(/Loading the lab|Reading the working copy/)).toBeNull());
  return result;
};

describe('LabPage', () => {
  beforeEach(() => {
    mocks.labEnabled = true;
    mocks.configKnown = true;
    mocks.chat.messages = [];
    mocks.chat.isGenerating = false;
    mocks.store.specDriven = { runStatus: 'idle', runs: {} };
    vi.clearAllMocks();
    mocks.getLabState.mockResolvedValue(LAB_STATE);
    signInToGitHubForTests(SESSION, 'jordi');
  });
  afterEach(() => resetGitHubAuthForTests());

  it('says so on an instance that is not a lab, and asks the server nothing', async () => {
    mocks.labEnabled = false;
    await renderPage();
    expect(screen.getByText('BESSER Lab is not enabled on this instance.')).toBeTruthy();
    expect(mocks.getLabState).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('asks for a GitHub sign-in before reading the lab state', async () => {
    resetGitHubAuthForTests();
    await renderPage();
    expect(screen.getByRole('button', { name: 'Sign in with GitHub' })).toBeTruthy();
    expect(mocks.getLabState).not.toHaveBeenCalled();
  });

  it('shows the user, the changed files per repository, the parked changes and the preview', async () => {
    await renderPage();
    expect(mocks.getLabState).toHaveBeenCalledWith(SESSION);
    expect(screen.getByText('Signed in as jordi')).toBeTruthy();
    expect(screen.getByText('Note element')).toBeTruthy();
    expect(screen.getByText('editor element')).toBeTruthy();

    const editor = within(screen.getByRole('group', { name: 'Web editor' }));
    expect(editor.getByText('lab/jordi/note-element')).toBeTruthy();
    expect(editor.getByText('packages/editor/src/main/packages/components.ts')).toBeTruthy();
    expect(editor.getByText('added')).toBeTruthy();
    expect(editor.getByText('modified')).toBeTruthy();
    const besser = within(screen.getByRole('group', { name: 'BESSER' }));
    expect(besser.getByText('docs/old.rst')).toBeTruthy();
    expect(besser.getByText('deleted')).toBeTruthy();
    // A repository the change did not touch is not listed.
    expect(screen.queryByRole('group', { name: 'Modeling agent' })).toBeNull();

    expect(screen.getByText('Older idea')).toBeTruthy();
    // One active change at a time: resuming waits until this one is parked or dropped.
    expect((screen.getByRole('button', { name: 'Resume Older idea' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Reset the editor to development' }) as HTMLButtonElement).disabled).toBe(true);

    const preview = within(screen.getByRole('region', { name: 'Preview' }));
    expect(preview.getByText('backend').parentElement?.textContent).toContain('running');
    expect(preview.getByText('modeling-agent').parentElement?.textContent).toContain('stopped');
    expect(preview.getByText('exited with 1')).toBeTruthy();
  });

  it('parks the change and shows the state the server returns', async () => {
    mocks.parkLabChange.mockResolvedValue(NO_CHANGE);
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Park' }));
    await waitFor(() => expect(screen.getByText('No active change. Describe one in the chat to start.')).toBeTruthy());
    expect(mocks.parkLabChange).toHaveBeenCalledWith(SESSION);
    expect((screen.getByRole('button', { name: 'Resume Older idea' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('resumes a parked change by its id', async () => {
    mocks.getLabState.mockResolvedValue(NO_CHANGE);
    mocks.resumeLabChange.mockResolvedValue(LAB_STATE);
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Resume Older idea' }));
    await waitFor(() => expect(screen.getByText('Note element')).toBeTruthy());
    expect(mocks.resumeLabChange).toHaveBeenCalledWith(SESSION, 'c0');
  });

  it('drops the change only after the user confirms', async () => {
    mocks.dropLabChange.mockResolvedValue(NO_CHANGE);
    mocks.globalConfirm.mockResolvedValueOnce(false);
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Drop' }));
    await waitFor(() => expect(mocks.globalConfirm).toHaveBeenCalledTimes(1));
    expect(mocks.globalConfirm.mock.calls[0][0]).toMatchObject({ title: 'Drop this change?', variant: 'danger' });
    expect(mocks.dropLabChange).not.toHaveBeenCalled();

    mocks.globalConfirm.mockResolvedValueOnce(true);
    fireEvent.click(screen.getByRole('button', { name: 'Drop' }));
    await waitFor(() => expect(mocks.dropLabChange).toHaveBeenCalledWith(SESSION));
    await waitFor(() => expect(screen.getByText('No active change. Describe one in the chat to start.')).toBeTruthy());
  });

  it('opens the pull requests, links them, says which checks passed and reads the state again', async () => {
    mocks.openLabPullRequests.mockResolvedValue({
      pullRequests: [
        { repo: 'frontend', number: 301, url: 'https://github.com/o/editor/pull/301', branch: 'lab/jordi/note-element', base: 'develop' },
        { repo: 'besser', number: 820, url: 'https://github.com/o/besser/pull/820', branch: 'lab/jordi/note-element', base: 'development' },
      ],
      checksNote: 'The checks of the touched areas passed; the full suites run in CI.',
    });
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Open pull request' }));
    const link = await screen.findByRole('link', { name: /Web editor #301/ });
    expect(link.getAttribute('href')).toBe('https://github.com/o/editor/pull/301');
    expect(screen.getByRole('link', { name: /BESSER #820/ })).toBeTruthy();
    expect(screen.getByText('The checks of the touched areas passed; the full suites run in CI.')).toBeTruthy();
    // The panel's button acts on the change it shows.
    expect(mocks.openLabPullRequests).toHaveBeenCalledWith(SESSION, 'c1');
    expect(mocks.getLabState).toHaveBeenCalledTimes(2);
  });

  it('opens nothing and says so when the change is no longer the active one', async () => {
    mocks.openLabPullRequests.mockResolvedValue(null);
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Open pull request' }));
    await waitFor(() => expect(mocks.reportError).toHaveBeenCalledTimes(1));
    expect(mocks.reportError.mock.calls[0][0]).toMatch(/is not the active one/);
    expect(screen.queryByRole('link', { name: /#\d+/ })).toBeNull();
  });

  it('offers to stop a lab run in progress that this tab is not following, then reads the state again', async () => {
    const RUN_ID = 'a'.repeat(32);
    mocks.getLabState.mockResolvedValueOnce({ ...LAB_STATE, run: { runId: RUN_ID, startedAt: 1763500000 } });
    mocks.cancelSpecDrivenRun.mockResolvedValue(true);
    await renderPage();
    expect(screen.getByRole('status').textContent).toMatch(/A lab run is in progress/);

    fireEvent.click(screen.getByRole('button', { name: 'Stop the run' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Stop the run' })).toBeNull());
    expect(mocks.cancelSpecDrivenRun).toHaveBeenCalledWith(RUN_ID);
    expect(mocks.getLabState).toHaveBeenCalledTimes(2);
  });

  it('says so when the server does not accept the stop', async () => {
    mocks.getLabState.mockResolvedValue({ ...LAB_STATE, run: { runId: 'a'.repeat(32), startedAt: 1763500000 } });
    mocks.cancelSpecDrivenRun.mockResolvedValue(false);
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Stop the run' }));
    await waitFor(() => expect(mocks.reportError).toHaveBeenCalledTimes(1));
    expect(mocks.reportError.mock.calls[0][0]).toBe('Stop the run failed: the server did not accept the request.');
  });

  it('shows why the state could not be read and reads it again on Try again', async () => {
    mocks.getLabState.mockRejectedValueOnce(new Error('BESSER Lab is not configured on this server.'));
    render(page());
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('The lab state could not be read: BESSER Lab is not configured on this server.');
    expect(screen.queryByText('Reading the working copy…')).toBeNull();

    fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.getByText('Note element')).toBeTruthy());
    expect(screen.queryByRole('alert')).toBeNull();
    expect(mocks.getLabState).toHaveBeenCalledTimes(2);
  });

  it('tells an unreachable server from an instance that is not a lab, and asks again', async () => {
    mocks.labEnabled = false;
    mocks.configKnown = false;
    await renderPage();
    expect(screen.queryByText('BESSER Lab is not enabled on this instance.')).toBeNull();
    expect(screen.getByText(/server could not be reached/)).toBeTruthy();

    mocks.labEnabled = true;
    mocks.configKnown = true;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.getByText('Note element')).toBeTruthy());
  });

  it('hides "Open pull request" while the change has no files', async () => {
    mocks.getLabState.mockResolvedValue({
      ...LAB_STATE,
      change: { ...LAB_STATE.change, repoChanges: [{ repo: 'besser', branch: 'lab/jordi/x', base: 'development', files: [] }] },
    });
    await renderPage();
    expect(screen.getByText('No files changed yet.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Open pull request' })).toBeNull();
  });

  it('resets the editor to development when no change is active', async () => {
    mocks.getLabState.mockResolvedValue(NO_CHANGE);
    mocks.resetLabPreview.mockResolvedValue(NO_CHANGE);
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Reset the editor to development' }));
    await waitFor(() => expect(mocks.resetLabPreview).toHaveBeenCalledWith(SESSION));
  });

  it('reports a failed action with its name and the server detail', async () => {
    mocks.parkLabChange.mockRejectedValue(new Error('working copy is busy'));
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Park' }));
    await waitFor(() => expect(mocks.reportError).toHaveBeenCalledTimes(1));
    const [message, options] = mocks.reportError.mock.calls[0];
    expect(message).toContain('Park failed');
    expect(message).toContain('working copy is busy');
    expect(options.error).toBeInstanceOf(Error);
    // The page keeps the last state it had.
    expect(screen.getByText('Note element')).toBeTruthy();
  });

  it('shows the chat, sends through the assistant hook and reads the state again after a run', async () => {
    mocks.chat.messages = [{ id: 'm1', role: 'user', content: 'Add a note element' }];
    const { rerender } = await renderPage();
    expect(screen.getByText('Add a note element')).toBeTruthy();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'x' } });
    fireEvent.submit(screen.getByRole('textbox').closest('form')!);
    expect(mocks.handleSubmit).toHaveBeenCalled();
    expect(mocks.getLabState).toHaveBeenCalledTimes(1);

    // A run starts: the actions wait for it.
    mocks.chat.isGenerating = true;
    rerender(page());
    expect((screen.getByRole('button', { name: 'Park' }) as HTMLButtonElement).disabled).toBe(true);

    // It ends: the working copy may have changed.
    mocks.chat.isGenerating = false;
    await act(async () => {
      rerender(page());
    });
    await waitFor(() => expect(mocks.getLabState).toHaveBeenCalledTimes(2));
    expect((screen.getByRole('button', { name: 'Park' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('waits for a run whose card is streaming, though the chat is no longer generating', async () => {
    const { rerender } = await renderPage();
    expect(mocks.getLabState).toHaveBeenCalledTimes(1);

    // The run card is live: the hook already cleared isGenerating.
    mocks.store.specDriven = { runStatus: 'running', runs: { r1: {} } };
    rerender(page());
    expect((screen.getByRole('button', { name: 'Park' }) as HTMLButtonElement).disabled).toBe(true);
    expect(mocks.getLabState).toHaveBeenCalledTimes(1);

    // The card is final: the state is read again.
    mocks.store.specDriven = { runStatus: 'idle', runs: {} };
    await act(async () => {
      rerender(page());
    });
    await waitFor(() => expect(mocks.getLabState).toHaveBeenCalledTimes(2));
    expect((screen.getByRole('button', { name: 'Park' }) as HTMLButtonElement).disabled).toBe(false);
  });
});
