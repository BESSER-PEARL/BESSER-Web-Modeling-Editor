/**
 * A failed push to the pull requests stays on the build card (E2E A-6): run bbecb66a's failure was a toast
 * that closed after a few seconds. The card shows the server's sentence until the next attempt, and
 * "Sign in again" when the GitHub session or token was refused.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/main/shared/api/api-client';
import { extractLabRun } from '@/main/features/spec-driven/state/specDrivenSlice';
import type { SpecDrivenLabView } from '@/main/features/spec-driven/types';

const signIn = vi.hoisted(() => vi.fn());
vi.mock('@/main/shared/services/github/githubAuth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/main/shared/services/github/githubAuth')>()),
  signInWithGitHub: signIn,
}));

const { LabRunResult } = await import('../lab-run-result');
type Details = NonNullable<React.ComponentProps<typeof LabRunResult>['details']>;

const LAB = extractLabRun({
  step: 'build',
  changeId: 'c1',
  title: 'Add glossary metamodel package',
  kind: 'metamodel',
  repoChanges: [
    { repo: 'besser', branch: 'lab/armensl/glossary', base: 'development', files: [{ path: 'besser/x.py', status: 'added' }] },
  ],
  checks: [],
  checklist: [],
  summary: '',
  stopReason: 'completed',
}) as SpecDrivenLabView;

/** The change has pull requests, so the card pushes to them through the surface's handler. */
const DETAILS: Details = {
  report: null,
  cost: { usd: 0.4, turns: 3, elapsedSeconds: 20, runs: 1 },
  pullRequests: [{ repo: 'besser', number: 7, url: 'https://github.com/o/besser/pull/7', branch: 'lab/armensl/glossary', base: 'development' }],
  noteProposals: [],
  planVersion: null,
};

const PUSH_REFUSED = 'GitHub did not accept the push to BESSER. Check that your account can push to the repository.';
const SESSION_REFUSED = 'Your GitHub sign-in has expired or was revoked. Sign in again and retry.';

const clickOpen = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Push to the pull requests/ }));
  });
};

afterEach(() => {
  cleanup();
  signIn.mockReset();
});

describe('a failed "Push to the pull requests" on the build card', () => {
  it("shows the server's sentence on the card and keeps it until the next attempt", async () => {
    let settle: () => void = () => undefined;
    const open = vi
      .fn<(changeId: string) => Promise<void>>()
      .mockRejectedValueOnce(new ApiError(409, PUSH_REFUSED, PUSH_REFUSED))
      .mockImplementationOnce(() => new Promise<void>((resolve) => { settle = resolve; }));
    render(<LabRunResult lab={LAB} details={DETAILS} onOpenPullRequest={open} />);

    await clickOpen();
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('The pull request was not opened.');
    expect(alert.textContent).toContain(PUSH_REFUSED);
    // Not a session problem: signing in again would not help.
    expect(screen.queryByRole('button', { name: /Sign in again/ })).toBeNull();

    // The next attempt clears it; a success leaves nothing behind.
    await clickOpen();
    expect(screen.queryByRole('alert')).toBeNull();
    await act(async () => settle());
    expect(screen.queryByRole('alert')).toBeNull();
    expect(open).toHaveBeenCalledTimes(2);
  });

  it('offers "Sign in again" when the GitHub session or token was refused (401)', async () => {
    const open = vi.fn().mockRejectedValue(new ApiError(401, SESSION_REFUSED, SESSION_REFUSED));
    render(<LabRunResult lab={LAB} details={DETAILS} onOpenPullRequest={open} />);
    await clickOpen();
    expect(screen.getByRole('alert').textContent).toContain(SESSION_REFUSED);
    fireEvent.click(screen.getByRole('button', { name: /Sign in again/ }));
    expect(signIn).toHaveBeenCalledTimes(1);
  });

  it('says the server could not be reached in plain words, not as a fetch error', async () => {
    const open = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    render(<LabRunResult lab={LAB} details={DETAILS} onOpenPullRequest={open} />);
    await clickOpen();
    expect(screen.getByRole('alert').textContent).toMatch(/reach the server/);
    expect(screen.getByRole('alert').textContent).not.toContain('Failed to fetch');
  });

  it('shows nothing when the surface handles the outcome itself and resolves', async () => {
    render(<LabRunResult lab={LAB} details={DETAILS} onOpenPullRequest={vi.fn().mockResolvedValue(undefined)} />);
    await clickOpen();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
