import React from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../shared/api/api-client';
import {
  createLabChange,
  getLabHome,
  listLabChanges,
  type LabChangeDetail,
  type LabChangeSummary,
  type LabHomeResponse,
} from '../../../shared/api/lab';
import { resetGitHubAuthForTests, signInToGitHubForTests } from '../../../shared/services/github/githubAuth';
import { LabAuthGate } from '../LabAuthGate';
import { HOME_REFRESH_MS, LabHome } from '../LabHome';

vi.mock('../../../shared/services/labConfig', () => ({ resolveLabEnabled: vi.fn(async () => true) }));
vi.mock('../../../shared/api/lab', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../shared/api/lab')>()),
  getLabHome: vi.fn(),
  listLabChanges: vi.fn(),
  createLabChange: vi.fn(),
}));

const SESSION = 'gh-session-0123456789';
const NOW = Date.now() / 1000;

const HOME: LabHomeResponse = {
  user: { login: 'ana', isAdmin: false },
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
};

function change(overrides: Partial<LabChangeSummary>): LabChangeSummary {
  return {
    changeId: '0123456789ab',
    title: 'Note element',
    kind: 'editor_element',
    status: 'open',
    outcome: null,
    owner: 'ana',
    phase: 'built',
    repos: ['frontend'],
    behind: {},
    run: null,
    pullRequests: [],
    cost: { usd: 3.4, turns: 12, elapsedSeconds: 300, runs: 2 },
    requestedBy: ['ana'],
    createdAt: NOW - 7200,
    updatedAt: NOW - 7200,
    closedAt: null,
    ...overrides,
  };
}

const OPEN_MINE = change({});
const OPEN_THEIRS = change({
  changeId: 'aaaaaaaaaaaa',
  title: 'Glossary generator',
  kind: 'generator',
  owner: 'jordi',
  phase: 'running',
  repos: ['besser', 'frontend'],
  behind: { besser: 14 },
  run: { runId: 'r1', changeId: 'aaaaaaaaaaaa', login: 'jordi', step: 'build', startedAt: NOW - 180 },
  pullRequests: [{ repo: 'besser', number: 812, url: 'https://github.com/BESSER-PEARL/BESSER/pull/812', branch: 'lab/x', base: 'development' }],
});
const MERGED = change({
  changeId: 'bbbbbbbbbbbb',
  title: 'Fix enum export',
  status: 'closed',
  outcome: 'merged',
  phase: 'merged',
  owner: 'jordi',
  requestedBy: ['jordi', 'ana'],
  closedAt: NOW - 3 * 86400,
  pullRequests: [{ repo: 'besser', number: 799, url: 'https://github.com/BESSER-PEARL/BESSER/pull/799', branch: 'lab/y', base: 'development' }],
});
const CLOSED_UNMERGED = change({ changeId: 'cccccccccccc', title: 'Abandoned idea', status: 'closed', outcome: 'closed', phase: 'closed', closedAt: NOW - 86400 });

/** What the change route received: its id and the router state. */
const ChangeProbe: React.FC = () => {
  const location = useLocation();
  return <pre data-testid="change-probe">{JSON.stringify({ path: location.pathname, state: location.state })}</pre>;
};

async function renderHome(home: LabHomeResponse = HOME) {
  vi.mocked(getLabHome).mockResolvedValue(home);
  render(
    <MemoryRouter initialEntries={['/']}>
      <LabAuthGate>
        <Routes>
          <Route path="/" element={<LabHome />} />
          <Route path="/c/:changeId" element={<ChangeProbe />} />
        </Routes>
      </LabAuthGate>
    </MemoryRouter>,
  );
  await screen.findByRole('button', { name: /Start change/ });
}

const startButton = () => screen.getByRole('button', { name: /Start change/ });
const composer = () => screen.getByLabelText('Describe the change');

beforeEach(() => {
  resetGitHubAuthForTests();
  signInToGitHubForTests(SESSION, 'ana');
  vi.mocked(getLabHome).mockReset();
  vi.mocked(listLabChanges).mockReset().mockResolvedValue({ changes: [OPEN_MINE, OPEN_THEIRS, MERGED, CLOSED_UNMERGED] });
  vi.mocked(createLabChange).mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('LabHome sections', () => {
  it('lists the open changes and the recently closed ones', async () => {
    await renderHome();
    const open = await screen.findByTestId('lab-open-changes');
    const rows = within(open).getAllByTestId('lab-change-row');
    expect(rows).toHaveLength(2);
    expect(within(open).getByRole('heading')).toHaveTextContent('Open changes 2');

    const running = rows[1];
    expect(within(running).getByRole('link', { name: 'Glossary generator' })).toHaveAttribute('href', '/c/aaaaaaaaaaaa');
    expect(running).toHaveAttribute('data-running', 'true');
    expect(within(running).getByText('Running 3 min')).toBeInTheDocument();
    expect(within(running).getByText('BESSER')).toBeInTheDocument();
    expect(within(running).getByText('Web editor')).toBeInTheDocument();
    expect(within(running).getByRole('link', { name: '#812 ↗' })).toHaveAttribute(
      'href',
      'https://github.com/BESSER-PEARL/BESSER/pull/812',
    );
    expect(within(running).getByRole('img', { name: 'Its base branch moved 14 commits' })).toBeInTheDocument();
    expect(within(rows[0]).getByText('$3.40')).toBeInTheDocument();
    expect(within(rows[0]).getByText('2 hours ago')).toBeInTheDocument();
    expect(within(rows[0]).queryByRole('img')).toBeNull();

    const closed = screen.getByTestId('lab-closed-changes');
    expect(within(closed).getByRole('heading')).toHaveTextContent('Recently merged');
    const [merged, unmerged] = within(closed).getAllByTestId('lab-closed-row');
    expect(merged).toHaveTextContent('merged 3 days ago');
    expect(merged).toHaveTextContent('with @ana');
    expect(within(merged).getByRole('link', { name: '#799 ↗' })).toBeInTheDocument();
    expect(within(unmerged).getByText('Closed')).toBeInTheDocument();
  });

  it("shows only the user's own changes under Mine", async () => {
    await renderHome();
    const open = await screen.findByTestId('lab-open-changes');
    fireEvent.click(within(open).getByRole('button', { name: 'Mine' }));
    expect(within(open).getAllByTestId('lab-change-row')).toHaveLength(1);
    expect(within(open).getByRole('link', { name: 'Note element' })).toBeInTheDocument();
  });

  it('moves between rows with the arrow keys', async () => {
    await renderHome();
    const open = await screen.findByTestId('lab-open-changes');
    const [first, second] = within(open).getAllByRole('link', { name: /Note element|Glossary generator/ });
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(second);
  });

  it('says there are no open changes and hides the closed section when there are none', async () => {
    vi.mocked(listLabChanges).mockResolvedValue({ changes: [] });
    await renderHome();
    expect(await screen.findByText('No open changes. Describe the first one above.')).toBeInTheDocument();
    expect(screen.queryByTestId('lab-closed-changes')).not.toBeInTheDocument();
  });

  it('shows skeleton rows while the changes load', async () => {
    vi.mocked(listLabChanges).mockReturnValue(new Promise(() => undefined));
    await renderHome();
    expect(screen.getByTestId('lab-open-skeleton')).toBeInTheDocument();
    expect(screen.getByTestId('lab-closed-skeleton')).toBeInTheDocument();
  });

  it('says why the changes could not be read, and reads them again on request', async () => {
    vi.mocked(listLabChanges).mockRejectedValueOnce(new ApiError(500, 'state.json is torn'));
    await renderHome();
    const alert = await screen.findByTestId('lab-changes-error');
    expect(alert).toHaveTextContent('The changes could not be read: state.json is torn');
    await act(async () => {
      fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }));
    });
    expect(screen.queryByTestId('lab-changes-error')).not.toBeInTheDocument();
    expect(screen.getByTestId('lab-open-changes')).toBeInTheDocument();
  });

  it('re-reads the changes and the meters every 15 s while the page is visible', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await renderHome();
    await screen.findByTestId('lab-open-changes');
    expect(listLabChanges).toHaveBeenCalledTimes(1);
    expect(getLabHome).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(HOME_REFRESH_MS);
    });
    expect(listLabChanges).toHaveBeenCalledTimes(2);
    expect(getLabHome).toHaveBeenCalledTimes(2);

    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    await act(async () => {
      vi.advanceTimersByTime(HOME_REFRESH_MS);
    });
    expect(listLabChanges).toHaveBeenCalledTimes(2);
    visibility.mockRestore();
  });
});

describe('LabHome composer', () => {
  it.each([
    [
      'the user cap',
      { ...HOME, meters: { ...HOME.meters, user: { spentUsd: 75, reservedUsd: 0, capUsd: 75 } } },
      'You have used $75 of your $75 this month. Runs start again on December 1.',
    ],
    [
      'the instance cap',
      { ...HOME, meters: { ...HOME.meters, instance: { spentUsd: 290, reservedUsd: 10, capUsd: 300 } } },
      'The lab has used its $300 for this month.',
    ],
    [
      'every run slot taken',
      {
        ...HOME,
        runs: {
          cap: 2,
          inProgress: [
            { runId: 'r1', changeId: 'aaaaaaaaaaaa', login: 'jordi', step: 'build' as const, startedAt: NOW - 60 },
            { runId: 'r2', changeId: 'dddddddddddd', login: 'ben', step: 'plan' as const, startedAt: NOW - 30 },
          ],
        },
      },
      '2 of 2 runs are in progress. Start your change when one finishes.@jordi: Glossary generator@ben: dddddddddddd',
    ],
  ])('disables Start with the reason when %s is reached', async (_label, home, reason) => {
    await renderHome(home);
    fireEvent.change(composer(), { target: { value: 'Add a note element' } });
    expect(startButton()).toBeDisabled();
    expect(await screen.findByTestId('lab-start-blocked')).toHaveTextContent(reason);
  });

  it('creates a change and opens it with the message and the GitHub issue as router state', async () => {
    vi.mocked(createLabChange).mockResolvedValue({ changeId: 'feedfacecafe' } as LabChangeDetail);
    await renderHome();
    fireEvent.change(composer(), { target: { value: '  Work on the note element  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start from a GitHub issue' }));
    fireEvent.change(screen.getByLabelText('Repository'), { target: { value: 'frontend' } });
    fireEvent.change(screen.getByLabelText('Issue number'), { target: { value: '12' } });
    await act(async () => {
      fireEvent.click(startButton());
    });

    expect(createLabChange).toHaveBeenCalledWith(SESSION);
    expect(JSON.parse(screen.getByTestId('change-probe').textContent ?? '')).toEqual({
      path: '/c/feedfacecafe',
      state: { labStart: { message: 'Work on the note element', issue: { repo: 'frontend', number: 12 } } },
    });
  });

  it('starts with Ctrl+Enter, without an issue when the field is closed', async () => {
    vi.mocked(createLabChange).mockResolvedValue({ changeId: 'feedfacecafe' } as LabChangeDetail);
    await renderHome();
    fireEvent.change(composer(), { target: { value: 'Add a note element' } });
    await act(async () => {
      fireEvent.keyDown(composer(), { key: 'Enter', ctrlKey: true });
    });
    expect(JSON.parse(screen.getByTestId('change-probe').textContent ?? '').state).toEqual({
      labStart: { message: 'Add a note element' },
    });
  });

  it('keeps Start disabled for an issue number that is not a positive whole number', async () => {
    await renderHome();
    fireEvent.change(composer(), { target: { value: 'Add a note element' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start from a GitHub issue' }));
    fireEvent.change(screen.getByLabelText('Issue number'), { target: { value: '-3' } });
    expect(startButton()).toBeDisabled();
    expect(screen.getByLabelText('Issue number')).toHaveAttribute('aria-invalid', 'true');
  });

  it("shows the server's refusal when the change cannot be created", async () => {
    vi.mocked(createLabChange).mockRejectedValue(
      new ApiError(409, 'You have used your budget.', 'You have used your budget.', { code: 'user_cap', message: 'You have used your budget.' }),
    );
    await renderHome();
    fireEvent.change(composer(), { target: { value: 'Add a note element' } });
    await act(async () => {
      fireEvent.click(startButton());
    });
    expect(screen.getByRole('alert')).toHaveTextContent('You have used your budget.');
    expect(screen.queryByTestId('change-probe')).not.toBeInTheDocument();
  });
});
