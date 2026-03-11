import { useCallback, useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { BACKEND_URL } from '../../constant';

export interface GitHubAuthStatus {
  success: boolean;
  username?: string;
  access_token?: string;
  error?: string;
}

export const useGitHubAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [githubSession, setGithubSession] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Check for GitHub session in URL parameters (OAuth callback)
    const urlParams = new URLSearchParams(window.location.search);
    const sessionFromUrl = urlParams.get('github_session');
    const usernameFromUrl = urlParams.get('username');
    const error = urlParams.get('error');

    const controller = new AbortController();

    if (error) {
      toast.error(`GitHub authentication failed: ${error}`);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      return () => controller.abort();
    }

    if (sessionFromUrl && usernameFromUrl) {
      // Store session token in sessionStorage (sensitive, tab-scoped)
      sessionStorage.setItem('github_session', sessionFromUrl);
      // Username is non-sensitive; keep in localStorage for convenience
      localStorage.setItem('github_username', usernameFromUrl);
      setGithubSession(sessionFromUrl);
      setUsername(usernameFromUrl);
      setIsAuthenticated(true);
      toast.success(`Signed in as ${usernameFromUrl}`);

      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else {
      // Check for existing session in sessionStorage (tab-scoped)
      const storedSession = sessionStorage.getItem('github_session');
      const storedUsername = localStorage.getItem('github_username');

      if (storedSession && storedUsername) {
        // Verify session is still valid
        verifySession(storedSession, controller.signal);
      }
    }

    return () => controller.abort();
  }, []);

  const verifySession = async (session: string, signal?: AbortSignal) => {
    try {
      const response = await fetch(`${BACKEND_URL}/github/auth/status?session_id=${session}`, { signal });
      const data: GitHubAuthStatus = await response.json();

      if (data.success && data.username) {
        setGithubSession(session);
        setUsername(data.username);
        setIsAuthenticated(true);
      } else {
        // Session invalid, clear storage
        logout();
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      console.error('Failed to verify GitHub session:', error);
      logout();
    }
  };

  const login = useCallback(() => {
    setIsLoading(true);
    // Redirect to GitHub OAuth login
    window.location.href = `${BACKEND_URL}/github/auth/login`;
  }, []);

  const logout = useCallback(async () => {
    if (githubSession) {
      try {
        await fetch(`${BACKEND_URL}/github/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ session_id: githubSession }),
        });
      } catch (error) {
        console.error('Failed to logout from GitHub:', error);
      }
    }

    // Clear local state — session token lives in sessionStorage
    sessionStorage.removeItem('github_session');
    localStorage.removeItem('github_username');
    setGithubSession(null);
    setUsername(null);
    setIsAuthenticated(false);
    setIsLoading(false);
  }, [githubSession]);

  return {
    isAuthenticated,
    username,
    githubSession,
    isLoading,
    login,
    logout,
  };
};
