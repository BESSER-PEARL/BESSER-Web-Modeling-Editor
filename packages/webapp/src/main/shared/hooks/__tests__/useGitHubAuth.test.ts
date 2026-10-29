import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useGitHubAuth } from '../useGitHubAuth';
import { apiClient } from '../../api/api-client';
import { resetGitHubAuthForTests } from '../../services/github/githubAuth';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

const SESSION = 'session_token_1234567890';

const storeSession = () => {
  sessionStorage.setItem('github_session', SESSION);
  sessionStorage.setItem('github_session_timestamp', String(Date.now()));
  localStorage.setItem('github_username', 'octocat');
};

const statusResponse = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

describe('useGitHubAuth', () => {
  beforeEach(() => {
    resetGitHubAuthForTests();
    sessionStorage.clear();
    localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('signs in from the URL fragment the OAuth callback sets, and clears it', async () => {
    window.history.replaceState({}, '', `/#github_session=${SESSION}&username=octocat`);

    const { result } = renderHook(() => useGitHubAuth());

    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    expect(result.current.githubSession).toBe(SESSION);
    expect(sessionStorage.getItem('github_session')).toBe(SESSION);
    expect(window.location.hash).toBe('');
  });

  it('verifies a stored session with a header, never in the URL', async () => {
    storeSession();
    const fetchMock = vi.fn().mockResolvedValue(statusResponse({ success: true, username: 'octocat' }));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useGitHubAuth());

    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).not.toContain(SESSION);
    expect(init.headers).toEqual({ 'X-GitHub-Session': SESSION });
  });

  it('says it is checking while a stored session is verified, so nobody starts a new sign-in', async () => {
    storeSession();
    let answer: (value: unknown) => void = () => undefined;
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise((resolve) => (answer = resolve))));

    const { result } = renderHook(() => useGitHubAuth());

    expect(result.current.isChecking).toBe(true);
    expect(result.current.isAuthenticated).toBe(false);
    await act(async () => answer(statusResponse({ success: true, username: 'octocat' })));
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('keeps the session when the backend cannot answer, e.g. during a restart', async () => {
    storeSession();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    const { result } = renderHook(() => useGitHubAuth());

    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    expect(sessionStorage.getItem('github_session')).toBe(SESSION);
  });

  it('signs out every component at once, and tells the backend', async () => {
    storeSession();
    const fetchMock = vi.fn().mockResolvedValue(statusResponse({ success: true, username: 'octocat' }));
    vi.stubGlobal('fetch', fetchMock);
    const menu = renderHook(() => useGitHubAuth());
    const pushDialog = renderHook(() => useGitHubAuth());
    await waitFor(() => expect(pushDialog.result.current.isAuthenticated).toBe(true));

    await act(() => menu.result.current.logout());

    expect(pushDialog.result.current.isAuthenticated).toBe(false);
    expect(pushDialog.result.current.githubSession).toBeNull();
    expect(sessionStorage.getItem('github_session')).toBeNull();
    const logout = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/github/auth/logout'));
    expect(JSON.parse(logout![1].body)).toEqual({ session_id: SESSION });
  });

  it('marks the session expired everywhere when a GitHub request gets a 401', async () => {
    storeSession();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(statusResponse({ success: true, username: 'octocat' })));
    const { result } = renderHook(() => useGitHubAuth());
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 401, statusText: 'Unauthorized', json: async () => ({ detail: 'GitHub session expired' }),
    }));
    await act(async () => {
      await apiClient.get('/github/repos', { headers: { 'X-GitHub-Session': SESSION } }).catch(() => undefined);
    });

    expect(result.current.isExpired).toBe(true);
    expect(result.current.githubSession).toBeNull();
    expect(result.current.username).toBe('octocat');
  });

  it('treats a session the backend no longer knows as expired', async () => {
    storeSession();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(statusResponse({ success: false })));

    const { result } = renderHook(() => useGitHubAuth());

    await waitFor(() => expect(result.current.isExpired).toBe(true));
    expect(sessionStorage.getItem('github_session')).toBeNull();
  });
});
