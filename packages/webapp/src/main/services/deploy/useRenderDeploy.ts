import { useCallback, useState } from 'react';
import { useGitHubRepo, GitHubRepoResult, CreateRepoOptions } from '../github/useGitHubRepo';

export interface RenderDeploymentUrls {
  github: string;
  render: string;
}

export interface DeployToRenderResult {
  success: boolean;
  repo_url: string;
  repo_name: string;
  owner: string;
  deployment_urls: RenderDeploymentUrls;
  files_uploaded: number;
  message: string;
}

/**
 * Hook for deploying projects to Render via GitHub.
 * This combines GitHub repo creation with Render deployment URL generation.
 */
export const useRenderDeploy = () => {
  const { createRepo, isCreating } = useGitHubRepo();
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentResult, setDeploymentResult] = useState<DeployToRenderResult | null>(null);

  /**
   * Generates the Render deployment URL for a GitHub repository.
   * @param repoUrl - The GitHub repository URL
   * @returns The Render one-click deploy URL
   */
  const getRenderDeployUrl = (repoUrl: string): string => {
    // Render's one-click deploy URL format
    return `https://render.com/deploy?repo=${encodeURIComponent(repoUrl)}`;
  };

  /**
   * Deploys a project to Render by first creating a GitHub repository
   * and then providing the Render deployment URL.
   * @param projectData - The project data to deploy
   * @param options - Repository creation options
   * @returns The deployment result with both GitHub and Render URLs
   */
  const deployToRender = useCallback(
    async (
      projectData: any,
      options: CreateRepoOptions
    ): Promise<DeployToRenderResult | null> => {
      console.log('Starting Render deployment via GitHub...');
      setIsDeploying(true);
      setDeploymentResult(null);

      try {
        // First, create the GitHub repository
        const repoResult = await createRepo(projectData, options);

        if (!repoResult || !repoResult.success) {
          return null;
        }

        // Generate deployment URLs
        const deploymentUrls: RenderDeploymentUrls = {
          github: repoResult.repo_url,
          render: getRenderDeployUrl(repoResult.repo_url),
        };

        const result: DeployToRenderResult = {
          success: repoResult.success,
          repo_url: repoResult.repo_url,
          repo_name: repoResult.repo_name,
          owner: repoResult.owner,
          deployment_urls: deploymentUrls,
          files_uploaded: repoResult.files_uploaded,
          message: repoResult.message,
        };

        setDeploymentResult(result);
        return result;
      } catch (error) {
        console.error('Render deployment error:', error);
        return null;
      } finally {
        setIsDeploying(false);
      }
    },
    [createRepo]
  );

  return {
    deployToRender,
    isDeploying: isDeploying || isCreating,
    deploymentResult,
    getRenderDeployUrl,
  };
};
