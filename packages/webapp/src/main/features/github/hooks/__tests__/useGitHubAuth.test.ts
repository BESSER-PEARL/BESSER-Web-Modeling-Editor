import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useGitHubAuth } from '../useGitHubAuth';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const SESSION = 'session_token_1234567890';

describe('useGitHubAuth', () => {
  beforeEach(() => {
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
    sessionStorage.setItem('github_session', SESSION);
    sessionStorage.setItem('github_session_timestamp', String(Date.now()));
    localStorage.setItem('github_username', 'octocat');
    const fetchMock = vi.fn().mockResolvedValue({ json: async () => ({ success: true, username: 'octocat' }) });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useGitHubAuth());

    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).not.toContain(SESSION);
    expect(init.headers).toEqual({ 'X-GitHub-Session': SESSION });
  });

  it('keeps the session when the backend cannot answer, e.g. during a restart', async () => {
    sessionStorage.setItem('github_session', SESSION);
    sessionStorage.setItem('github_session_timestamp', String(Date.now()));
    localStorage.setItem('github_username', 'octocat');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    const { result } = renderHook(() => useGitHubAuth());

    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    expect(sessionStorage.getItem('github_session')).toBe(SESSION);
  });
});
