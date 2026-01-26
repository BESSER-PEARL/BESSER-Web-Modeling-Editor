import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';
import { BACKEND_URL } from '../../constant';

// Re-export from github service for backward compatibility
export { useGitHubAuth, type GitHubAuthStatus } from '../github/useGitHubAuth';
export { useGitHubRepo, type GitHubRepoResult, type CreateRepoOptions } from '../github/useGitHubRepo';

// Re-export from render deploy service
export { useRenderDeploy, type DeployToRenderResult, type RenderDeploymentUrls } from './useRenderDeploy';

// Legacy interface - kept for backward compatibility
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

/**
 * @deprecated Use useGitHubRepo for GitHub-only operations, 
 * or useRenderDeploy for GitHub + Render deployment.
 * This hook is kept for backward compatibility.
 */
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
