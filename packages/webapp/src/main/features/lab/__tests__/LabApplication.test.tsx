import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../shared/api/api-client';
import { getLabHome, listLabChanges, type LabHomeResponse } from '../../../shared/api/lab';
import { resolveLabEnabled } from '../../../shared/services/labConfig';
import { resetGitHubAuthForTests, signInToGitHubForTests } from '../../../shared/services/github/githubAuth';
import { LabApplication } from '../LabApplication';

vi.mock('../../../shared/services/labConfig', () => ({ resolveLabEnabled: vi.fn() }));
vi.mock('../../../shared/api/lab', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../shared/api/lab')>()),
  getLabHome: vi.fn(),
  listLabChanges: vi.fn(),
}));

const HOME: LabHomeResponse = {
  user: { login: 'ana', isAdmin: false },
  bases: [],
  runs: { inProgress: [], cap: 2 },
  meters: {
    month: '2026-11',
    user: { spentUsd: 1, reservedUsd: 0, capUsd: 75 },
    instance: { spentUsd: 1, reservedUsd: 0, capUsd: 300 },
  },
  previewSlots: 1,
  linkMode: 'reflink',
  memory: { enabled: true, reason: '', count: 0, max: 60 },
};

/** A promise and the function that settles it. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeEach(() => {
  resetGitHubAuthForTests();
  vi.mocked(resolveLabEnabled).mockReset();
  vi.mocked(getLabHome).mockReset();
  vi.mocked(listLabChanges).mockReset().mockResolvedValue({ changes: [] });
  window.history.replaceState(null, '', '/');
});
afterEach(cleanup);

describe('LabAuthGate', () => {
  it('says the lab is opening until the server config is known', async () => {
    const config = deferred<boolean | null>();
    vi.mocked(resolveLabEnabled).mockReturnValue(config.promise);
    render(<LabApplication />);
    expect(screen.getByText('Opening BESSER Lab…')).toBeInTheDocument();
    await act(async () => config.resolve(false));
    expect(screen.queryByText('Opening BESSER Lab…')).not.toBeInTheDocument();
  });

  it('says the server could not be reached, and tries again on request', async () => {
    vi.mocked(resolveLabEnabled).mockResolvedValueOnce(null).mockResolvedValueOnce(false);
    render(<LabApplication />);
    expect(await screen.findByText('The lab server could not be reached.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('This server does not run BESSER Lab.')).toBeInTheDocument();
    expect(resolveLabEnabled).toHaveBeenCalledTimes(2);
  });

  it('says when this server does not run the lab, without asking for a sign-in', async () => {
    vi.mocked(resolveLabEnabled).mockResolvedValue(false);
    render(<LabApplication />);
    expect(await screen.findByText('This server does not run BESSER Lab.')).toBeInTheDocument();
    expect(screen.queryByText('Sign in with GitHub')).not.toBeInTheDocument();
  });

  it("names the server's reason when the working copies are not ready (503)", async () => {
    vi.mocked(resolveLabEnabled).mockResolvedValue(true);
    vi.mocked(getLabHome).mockRejectedValue(
      new ApiError(503, 'x', 'BESSER Lab has no working copy configured (BESSER_LAB_WORKSPACE_ROOT)'),
    );
    signInToGitHubForTests('gh-session-0123456789', 'ana');
    render(<LabApplication />);
    expect(
      await screen.findByText(
        "The lab's working copies are not ready: BESSER Lab has no working copy configured (BESSER_LAB_WORKSPACE_ROOT). An administrator needs to run the lab setup.",
      ),
    ).toBeInTheDocument();
  });

  it('asks for a sign-in when the tab has no GitHub session', async () => {
    vi.mocked(resolveLabEnabled).mockResolvedValue(true);
    render(<LabApplication />);
    expect(await screen.findByRole('button', { name: 'Sign in with GitHub' })).toBeInTheDocument();
    expect(getLabHome).not.toHaveBeenCalled();
  });

  it('refuses a signed-in login the lab does not allow (403)', async () => {
    vi.mocked(resolveLabEnabled).mockResolvedValue(true);
    vi.mocked(getLabHome).mockRejectedValue(new ApiError(403, 'Not allowed', 'Not allowed'));
    signInToGitHubForTests('gh-session-0123456789', 'mallory');
    render(<LabApplication />);
    expect(await screen.findByText(/@mallory is not on this lab's list/)).toBeInTheDocument();
  });

  it('opens the home under the lab header once the home is read', async () => {
    vi.mocked(resolveLabEnabled).mockResolvedValue(true);
    vi.mocked(getLabHome).mockResolvedValue(HOME);
    signInToGitHubForTests('gh-session-0123456789', 'ana');
    render(<LabApplication />);
    await screen.findByTestId('lab-open-changes');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('What do you want to change in BESSER?');
    expect(screen.getByText('BESSER Lab')).toBeInTheDocument();
    expect(getLabHome).toHaveBeenCalledWith('gh-session-0123456789');
  });

  it('shows the not-found page for an unknown path', async () => {
    window.history.replaceState(null, '', '/nowhere');
    vi.mocked(resolveLabEnabled).mockResolvedValue(true);
    vi.mocked(getLabHome).mockResolvedValue(HOME);
    signInToGitHubForTests('gh-session-0123456789', 'ana');
    render(<LabApplication />);
    expect(await screen.findByText('404')).toBeInTheDocument();
  });
});
