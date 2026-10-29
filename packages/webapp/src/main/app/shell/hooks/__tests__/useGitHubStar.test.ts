import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'react-toastify';

import { useGitHubStar } from '../useGitHubStar';
import { promptForGitHubStarOnce } from '../../../../shared/services/githubStarPrompt';

vi.mock('react-toastify', () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

const jsonResponse = (body: unknown) => ({ ok: true, json: vi.fn().mockResolvedValue(body) });

describe('useGitHubStar and the post-generation star prompt', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('never prompts a user whose star the status check reports', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ starred: true })));

    const { result } = renderHook(() => useGitHubStar({ isAuthenticated: true, githubSession: 'session' }));
    await waitFor(() => expect(result.current.hasStarred).toBe(true));

    promptForGitHubStarOnce();
    expect(toast.info).not.toHaveBeenCalled();
  });

  it('never prompts a user who starred from the top bar', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ starred: false }))
        .mockResolvedValueOnce(jsonResponse({})),
    );

    const { result } = renderHook(() => useGitHubStar({ isAuthenticated: true, githubSession: 'session' }));
    await act(async () => {
      await result.current.handleToggleStar();
    });
    expect(result.current.hasStarred).toBe(true);

    promptForGitHubStarOnce();
    expect(toast.info).not.toHaveBeenCalled();
  });

  it('sends the session as a header, never in the URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ starred: false }));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useGitHubStar({ isAuthenticated: true, githubSession: 'session' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await act(async () => {
      await result.current.handleToggleStar();
    });

    for (const [url, init] of fetchMock.mock.calls) {
      expect(url).not.toContain('session');
      expect(init.headers).toEqual({ 'X-GitHub-Session': 'session' });
    }
  });
});
