import { afterEach, describe, expect, it, vi } from 'vitest';

const track = vi.hoisted(() => vi.fn());
vi.mock('../../analytics/events', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../analytics/events')>()),
  track,
}));
vi.mock('../../errors/reportError', () => ({ reportError: vi.fn() }));
vi.mock('react-toastify', () => ({ toast: { success: vi.fn() } }));

import {
  markGitHubSessionExpired,
  resetGitHubAuthForTests,
  signInToGitHubForTests,
  signOutOfGitHub,
  startGitHubAuth,
} from '../githubAuth';

const SESSION = 's'.repeat(20);

afterEach(() => {
  resetGitHubAuthForTests();
  window.history.replaceState({}, '', '/');
  sessionStorage.clear();
  localStorage.clear();
  track.mockClear();
});

describe('GitHub sign-in analytics', () => {
  it('reports a sign-in GitHub refused, without the error text it sent back', () => {
    window.history.replaceState({}, '', '/?error=access_denied');
    startGitHubAuth();
    expect(track).toHaveBeenCalledWith('github_sign_in_failed', { reason: 'oauth_error' });
    expect(JSON.stringify(track.mock.calls)).not.toContain('access_denied');
  });

  it('reports a forged callback as an invalid one', () => {
    window.history.replaceState({}, '', '/#github_session=bad!&username=octocat');
    startGitHubAuth();
    expect(track).toHaveBeenCalledWith('github_sign_in_failed', { reason: 'invalid_callback' });
  });

  it('reports a sign-in, never the username', () => {
    window.history.replaceState({}, '', `/#github_session=${SESSION}&username=octocat`);
    startGitHubAuth();
    expect(track).toHaveBeenCalledWith('github_signed_in', { verified: false });
    expect(JSON.stringify(track.mock.calls)).not.toContain('octocat');
  });

  it('reports a rejected session and a sign-out', async () => {
    signInToGitHubForTests(SESSION);
    markGitHubSessionExpired();
    expect(track).toHaveBeenCalledWith('github_session_expired', { reason: 'rejected' });

    signInToGitHubForTests(SESSION);
    await signOutOfGitHub().catch(() => undefined);
    expect(track).toHaveBeenCalledWith('github_signed_out', {});
  });
});
