import { useCallback, useState } from 'react';
import { useGitHubRepo, GitHubRepoResult, CreateRepoOptions, GitHubDeploymentUrls } from '../../github/hooks/useGitHubRepo';

// Re-exported under the old name so existing imports keep working.
export type RenderDeploymentUrls = GitHubDeploymentUrls;

export interface DeployToRenderResult {
  success: boolean;
  repo_url: string;
  repo_name: string;
  owner: string;
  deployment_urls: RenderDeploymentUrls;
  files_uploaded: number;
  message: string;
  is_first_deploy: boolean;
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

        // The backend already computed the correct ``deployment_urls`` (including
        // live_frontend/live_backend on redeploys and is_first_deploy). Pass
        // them through — do NOT rebuild them locally, or the "Create Blueprint"
        // URL will override the live-site link we want to use on redeploys.
        const result: DeployToRenderResult = {
          success: repoResult.success,
          repo_url: repoResult.repo_url,
          repo_name: repoResult.repo_name,
          owner: repoResult.owner,
          deployment_urls: repoResult.deployment_urls,
          files_uploaded: repoResult.files_uploaded,
          message: repoResult.message,
          is_first_deploy: repoResult.is_first_deploy,
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
