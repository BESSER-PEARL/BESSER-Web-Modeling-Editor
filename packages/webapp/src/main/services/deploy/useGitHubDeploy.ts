import { useCallback, useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { BACKEND_URL } from '../../constant';

export interface GitHubAuthStatus {
  success: boolean;
  username?: string;
  access_token?: string;
  error?: string;
}

export interface DeployToGitHubResult {
  success: boolean;
  repo_url: string;
  repo_name: string;
  owner: string;
  deployment_urls: {
    github: string;
    render: string;
  };
  files_uploaded: number;
  message: string;
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

    if (error) {
      toast.error(`GitHub authentication failed: ${error}`);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    if (sessionFromUrl && usernameFromUrl) {
      // Store session
      localStorage.setItem('github_session', sessionFromUrl);
      localStorage.setItem('github_username', usernameFromUrl);
      setGithubSession(sessionFromUrl);
      setUsername(usernameFromUrl);
      setIsAuthenticated(true);
      toast.success(`Signed in as ${usernameFromUrl}`);

      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else {
      // Check for existing session in localStorage
      const storedSession = localStorage.getItem('github_session');
      const storedUsername = localStorage.getItem('github_username');

      if (storedSession && storedUsername) {
        // Verify session is still valid
        verifySession(storedSession);
      }
    }
  }, []);

  const verifySession = async (session: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/github/auth/status?session_id=${session}`);
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

    // Clear local state
    localStorage.removeItem('github_session');
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

export const useDeployToGitHub = () => {
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentResult, setDeploymentResult] = useState<DeployToGitHubResult | null>(null);

  const deployToGitHub = useCallback(
    async (
      projectData: any,
      repoName: string,
      description: string,
      isPrivate: boolean,
      githubSession: string
    ): Promise<DeployToGitHubResult | null> => {
      console.log('Starting GitHub deployment...');
      setIsDeploying(true);
      setDeploymentResult(null);

      try {
        const requestBody = {
          ...projectData,
          deploy_config: {
            repo_name: repoName,
            description: description,
            is_private: isPrivate,
          },
        };

        const response = await fetch(`${BACKEND_URL}/github/deploy-webapp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-GitHub-Session': githubSession,
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ detail: 'Deployment failed' }));
          throw new Error(errorData.detail || `HTTP error: ${response.status}`);
        }

        const result: DeployToGitHubResult = await response.json();
        setDeploymentResult(result);

        if (result.success) {
          toast.success(`Repository created: ${result.repo_name}`);
        } else {
          toast.error('Deployment failed');
        }

        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Deployment failed';
        toast.error(errorMessage);
        console.error('GitHub deployment error:', error);
        return null;
      } finally {
        setIsDeploying(false);
      }
    },
    []
  );

  return {
    deployToGitHub,
    isDeploying,
    deploymentResult,
  };
};
