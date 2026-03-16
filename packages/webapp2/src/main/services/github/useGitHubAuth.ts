import { useCallback, useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { BACKEND_URL } from '../../constant';

export interface GitHubAuthStatus {
  success: boolean;
  username?: string;
  access_token?: string;
  error?: string;
}

const isValidSessionToken = (token: string): boolean => {
  return /^[a-zA-Z0-9_-]{10,200}$/.test(token);
};

const isValidGitHubUsername = (username: string): boolean => {
  return /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(username);
};

const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

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
      // Validate session token before storing
      if (!isValidSessionToken(sessionFromUrl)) {
        console.warn('Invalid GitHub session token rejected');
        window.history.replaceState({}, document.title, window.location.pathname);
        return () => controller.abort();
      }
      // Validate username before storing
      if (!isValidGitHubUsername(usernameFromUrl)) {
        console.warn('Invalid GitHub username rejected');
        window.history.replaceState({}, document.title, window.location.pathname);
        return () => controller.abort();
      }

      // Store session token in sessionStorage (sensitive, tab-scoped)
      sessionStorage.setItem('github_session', sessionFromUrl);
      sessionStorage.setItem('github_session_timestamp', String(Date.now()));
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
        // Check if session has expired
        const timestamp = parseInt(sessionStorage.getItem('github_session_timestamp') || '0');
        if (Date.now() - timestamp > SESSION_MAX_AGE_MS) {
          // Session expired, clear it
          sessionStorage.removeItem('github_session');
          sessionStorage.removeItem('github_session_timestamp');
          localStorage.removeItem('github_username');
          return () => controller.abort();
        }

        // Verify session is still valid
        verifySession(storedSession, controller.signal);
      }
    }

    return () => controller.abort();
  }, []);

  const verifySession = async (session: string, signal?: AbortSignal) => {
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), 30000);

    // Combine the external signal (component unmount) with the timeout signal
    const combinedSignal = signal
      ? (() => {
          const combined = new AbortController();
          signal.addEventListener('abort', () => combined.abort());
          timeoutController.signal.addEventListener('abort', () => combined.abort());
          return combined.signal;
        })()
      : timeoutController.signal;

    try {
      const response = await fetch(`${BACKEND_URL}/github/auth/status?session_id=${session}`, { signal: combinedSignal });
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
    } finally {
      clearTimeout(timeoutId);
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
    sessionStorage.removeItem('github_session_timestamp');
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
