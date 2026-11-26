import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { toast } from 'react-toastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../shared/api/api-client';
import {
  getLabAudit,
  getLabMemory,
  getLabSettings,
  refreshLabBases,
  type LabAuditEntry,
  type LabAuditResponse,
  type LabSettingsResponse,
} from '../../../shared/api/lab';
import LabSettingsPageDefault, { LabSettingsPage } from '../LabSettingsPage';

const SESSION = 'gh-session-0123456789';
const NOW = Date.now() / 1000;
const reloadHome = vi.fn(async () => undefined);

vi.mock('react-toastify', () => ({ toast: { success: vi.fn(), error: vi.fn(), update: vi.fn() } }));
// Whether the lab has a key of its own: its monthly caps and meters are shown only then.
const shell = vi.hoisted(() => ({ labKey: true }));
vi.mock('../LabAuthGate', () => ({
  useLabShell: () => ({ session: SESSION, reloadHome, user: { login: 'ana', isAdmin: false }, home: { labKey: shell.labKey } }),
}));
vi.mock('../../../shared/api/lab', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../shared/api/lab')>()),
  getLabSettings: vi.fn(),
  refreshLabBases: vi.fn(),
  getLabAudit: vi.fn(),
  getLabMemory: vi.fn(),
}));

const SETTINGS: LabSettingsResponse = {
  bases: [
    {
      repo: 'besser',
      upstream: 'BESSER-PEARL/BESSER',
      branch: 'development',
      sha: 'a1fe9e6b0c1d2e3f',
      fetchedAt: NOW - 12 * 60,
      fork: false,
    },
    {
      repo: 'frontend',
      upstream: 'armen/BESSER-Web-Modeling-Editor',
      branch: 'develop',
      sha: '9f8e7d6c5b4a3921',
      fetchedAt: 0,
      fork: true,
    },
  ],
  limits: {
    perRunUsd: 5,
    userMonthlyUsd: 75,
    instanceMonthlyUsd: 300,
    maxConcurrentRuns: 2,
    previewSlots: 2,
    baseRefreshMinutes: 60,
  },
  admins: ['jordi'],
  meters: {
    month: '2026-11',
    user: { spentUsd: 12.4, reservedUsd: 0.8, capUsd: 75 },
    instance: { spentUsd: 42.5, reservedUsd: 1.6, capUsd: 300 },
  },
  linkMode: 'reflink',
};

function entry(overrides: Partial<LabAuditEntry>): LabAuditEntry {
  return {
    at: NOW - 3600,
    login: 'ana',
    action: 'run',
    changeId: '0123456789ab',
    runId: 'r1',
    step: 'build',
    costUsd: 1.82,
    stopReason: 'completed',
    detail: '',
    ...overrides,
  };
}

const AUDIT: LabAuditResponse = {
  month: '2026-11',
  entries: [
    entry({
      at: NOW - 7200,
      login: 'jordi',
      action: 'change_created',
      runId: null,
      step: null,
      costUsd: null,
      stopReason: null,
    }),
    entry({ at: NOW - 600, stopReason: 'cost_cap' }),
  ],
  totalsByLogin: { ana: 12.4, jordi: 30 },
};

async function renderPage(settings: LabSettingsResponse = SETTINGS) {
  vi.mocked(getLabSettings).mockResolvedValue(settings);
  render(
    <MemoryRouter>
      <LabSettingsPage />
    </MemoryRouter>,
  );
  await screen.findByTestId('lab-settings-repositories');
}

beforeEach(() => {
  shell.labKey = true;
  reloadHome.mockClear();
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
  vi.mocked(getLabSettings).mockReset();
  vi.mocked(refreshLabBases).mockReset();
  vi.mocked(getLabAudit).mockReset().mockResolvedValue(AUDIT);
  vi.mocked(getLabMemory).mockReset().mockResolvedValue({ enabled: true, reason: '', notes: [] });
});
afterEach(cleanup);

describe('LabSettingsPage', () => {
  it('keeps the default export the lazy route imports', () => {
    expect(LabSettingsPageDefault).toBe(LabSettingsPage);
  });

  it('shows no monthly cap or meter on a lab without a key of its own, where everyone pays with theirs', async () => {
    shell.labKey = false;
    await renderPage();
    const usage = screen.getByTestId('lab-settings-usage');
    expect(within(usage).queryByTestId('lab-settings-meter-user')).toBeNull();
    expect(within(usage).queryByTestId('lab-settings-meter-instance')).toBeNull();
    expect(usage).not.toHaveTextContent('Per person a month');
    expect(usage).not.toHaveTextContent('The lab a month');
    // What a run may cost at most still applies to a run on a user's own key.
    expect(usage).toHaveTextContent('Per run$5');
  });

  it('renders the repositories, usage, activity and team notes cards from the API answers', async () => {
    await renderPage();
    expect(getLabSettings).toHaveBeenCalledWith(SESSION);

    const repos = screen.getByTestId('lab-settings-repositories');
    const [besser, frontend] = within(repos).getAllByTestId('lab-settings-base');
    expect(besser).toHaveTextContent('BESSER-PEARL/BESSER');
    expect(besser).toHaveTextContent('development');
    expect(besser).toHaveTextContent('a1fe9e6');
    expect(besser).toHaveTextContent('12 minutes ago');
    expect(within(besser).queryByText('fork')).toBeNull();
    expect(within(frontend).getByText('fork')).toBeInTheDocument();
    expect(frontend).toHaveTextContent('never');
    expect(repos).toHaveTextContent('Set by BESSER_LAB_REPO_* on the server. Changes keep the base they started from.');

    const usage = screen.getByTestId('lab-settings-usage');
    expect(within(usage).getByTestId('lab-settings-meter-user')).toHaveTextContent('$12.40 spent');
    expect(within(usage).getByTestId('lab-settings-meter-user')).toHaveTextContent('$0.80 reserved');
    expect(within(usage).getByTestId('lab-settings-meter-user')).toHaveTextContent('of $75');
    expect(within(usage).getByTestId('lab-settings-meter-instance')).toHaveTextContent('$42.50 spent');
    const spenders = within(usage).getAllByTestId('lab-settings-spent-row');
    expect(spenders.map((row) => row.textContent)).toEqual(['@jordi$30', '@ana$12.40']);
    expect(usage).toHaveTextContent('Per run$5');
    expect(usage).toHaveTextContent('Runs at once2');
    expect(usage).toHaveTextContent('Base refreshEvery 60 min');
    expect(usage).toHaveTextContent('@jordi');

    const activity = screen.getByTestId('lab-settings-activity');
    expect(getLabAudit).toHaveBeenCalledWith(SESSION);
    const rows = within(activity).getAllByTestId('lab-settings-audit-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('@ana');
    expect(rows[0]).toHaveTextContent('Run');
    expect(rows[0]).toHaveTextContent('$1.82');
    expect(rows[0]).toHaveTextContent('Stopped at the cost cap');
    expect(within(rows[0]).getByRole('link', { name: '0123456789ab' })).toHaveAttribute('href', '/c/0123456789ab');
    expect(rows[1]).toHaveTextContent('Change created');

    expect(screen.getByTestId('lab-settings-notes')).toBeInTheDocument();
    expect(await screen.findByTestId('lab-memory-panel')).toBeInTheDocument();
  });

  it('refreshes the bases, shows the result in a toast and updates the header', async () => {
    vi.mocked(refreshLabBases).mockResolvedValue({
      ...SETTINGS,
      bases: [{ ...SETTINGS.bases[0], sha: 'ffffeee000111222', fetchedAt: NOW }, SETTINGS.bases[1]],
    });
    await renderPage();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Refresh now' }));
    });
    expect(refreshLabBases).toHaveBeenCalledWith(SESSION);
    expect(toast.success).toHaveBeenCalledWith('The base branches are up to date.');
    expect(screen.getAllByTestId('lab-settings-base')[0]).toHaveTextContent('ffffeee');
    expect(reloadHome).toHaveBeenCalled();
  });

  it('shows the error in a toast when a base cannot be fetched', async () => {
    const message = 'Fetching BESSER-PEARL/BESSER failed: could not resolve host';
    vi.mocked(refreshLabBases).mockRejectedValue(new ApiError(409, message, message, { code: 'state', message }));
    await renderPage();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Refresh now' }));
    });
    expect(toast.error).toHaveBeenCalledWith(`The base branches could not be refreshed: ${message}`);
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getAllByTestId('lab-settings-base')[0]).toHaveTextContent('a1fe9e6');
  });

  it.each([
    ['hardlink', true],
    ['reflink', false],
  ] as const)('shows the hard-link warning only in hardlink mode (%s)', async (linkMode, shown) => {
    await renderPage({ ...SETTINGS, linkMode });
    const warning = screen.queryByTestId('lab-settings-hardlink');
    if (shown) {
      expect(warning).toHaveTextContent('In-place writes into node_modules or a venv can reach other changes.');
    } else {
      expect(warning).toBeNull();
    }
  });

  it('requests the month chosen in the activity selector', async () => {
    await renderPage();
    const activity = screen.getByTestId('lab-settings-activity');
    await within(activity).findAllByTestId('lab-settings-audit-row');
    vi.mocked(getLabAudit).mockResolvedValue({ month: '2026-10', entries: [], totalsByLogin: {} });
    await act(async () => {
      fireEvent.change(within(activity).getByLabelText('Month'), { target: { value: '2026-10' } });
    });
    expect(getLabAudit).toHaveBeenLastCalledWith(SESSION, '2026-10');
    expect(within(activity).getByText('Nothing happened in this month.')).toBeInTheDocument();
    // The usage card keeps this month's spending.
    expect(within(screen.getByTestId('lab-settings-usage')).getAllByTestId('lab-settings-spent-row')).toHaveLength(2);
  });

  it('shows 50 entries per page, newest first', async () => {
    const entries = Array.from({ length: 120 }, (_, i) =>
      entry({ at: NOW - 100_000 + i, runId: `r${i}`, login: `user${i}` }),
    );
    vi.mocked(getLabAudit).mockResolvedValue({ ...AUDIT, entries });
    await renderPage();
    const activity = screen.getByTestId('lab-settings-activity');
    let rows = await within(activity).findAllByTestId('lab-settings-audit-row');
    expect(rows).toHaveLength(50);
    expect(rows[0]).toHaveTextContent('@user119');
    expect(activity).toHaveTextContent('1–50 of 120');

    fireEvent.click(within(activity).getByRole('button', { name: 'Older' }));
    fireEvent.click(within(activity).getByRole('button', { name: 'Older' }));
    rows = within(activity).getAllByTestId('lab-settings-audit-row');
    expect(rows).toHaveLength(20);
    expect(rows[19]).toHaveTextContent('@user0');
    expect(within(activity).getByRole('button', { name: 'Older' })).toBeDisabled();
  });

  it('says why the settings could not be read, and reads them again on request', async () => {
    vi.mocked(getLabSettings).mockRejectedValueOnce(new ApiError(500, 'settings are torn')).mockResolvedValue(SETTINGS);
    render(
      <MemoryRouter>
        <LabSettingsPage />
      </MemoryRouter>,
    );
    const alert = await screen.findByTestId('lab-settings-error');
    expect(alert).toHaveTextContent('The settings could not be read: settings are torn');
    await act(async () => {
      fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }));
    });
    expect(await screen.findByTestId('lab-settings-repositories')).toBeInTheDocument();
  });
});
