import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';
import { BACKEND_URL } from '../../../shared/constants/constant';
import { normalizeProjectName } from '../../../shared/utils/projectName';

export type DeploymentTarget = 'webapp' | 'agent';
type BackendDeploymentTarget = 'webapp' | 'chatbot';

const toBackendDeploymentTarget = (target: DeploymentTarget): BackendDeploymentTarget => (
  target === 'agent' ? 'chatbot' : 'webapp'
);

const fromBackendDeploymentTarget = (target: unknown): DeploymentTarget | undefined => {
  if (target === 'chatbot') return 'agent';
  if (target === 'webapp') return 'webapp';
  return undefined;
};

export interface GitHubDeploymentUrls {
  github: string;
  render: string;
  // Populated on redeploys when the backend reuses an existing render.yaml
  // suffix. Absent on a first deploy (no stable Render hostname yet).
  live_frontend?: string;
  live_backend?: string;
  live_chatbot?: string;
  render_dashboard?: string;
}

export interface GitHubRepoResult {
  success: boolean;
  repo_url: string;
  repo_name: string;
  owner: string;
  files_uploaded: number;
  message: string;
  deployment_urls: GitHubDeploymentUrls;
  // True on the very first deploy to a repo, false on subsequent redeploys.
  is_first_deploy: boolean;
  // Deployment flavor returned by backend.
  deployment_type?: DeploymentTarget;
}

export interface CreateRepoOptions {
  repoName: string;
  description: string;
  isPrivate: boolean;
  githubSession: string;
  deploymentTarget?: DeploymentTarget;
}

/**
 * Hook for creating and pushing projects to GitHub repositories.
 * This can be used independently for any GitHub repo operations.
 */
export const useGitHubRepo = () => {
  const [isCreating, setIsCreating] = useState(false);
  const [repoResult, setRepoResult] = useState<GitHubRepoResult | null>(null);

  /**
   * Creates a new GitHub repository and pushes project files to it.
   * @param projectData - The project data to push to the repository
   * @param options - Repository creation options (name, description, private, session)
   * @returns The result of the repository creation, or null if failed
   */
  const createRepo = useCallback(
    async (
      projectData: any,
      options: CreateRepoOptions
    ): Promise<GitHubRepoResult | null> => {
      console.log('Creating GitHub repository...');
      setIsCreating(true);
      setRepoResult(null);

      try {
        const requestBody = {
          ...projectData,
          name: normalizeProjectName(projectData?.name || 'project'),
          deploy_config: {
            repo_name: options.repoName,
            description: options.description,
            is_private: options.isPrivate,
            target: toBackendDeploymentTarget(options.deploymentTarget ?? 'webapp'),
          },
        };

        const response = await fetch(`${BACKEND_URL}/github/deploy-webapp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-GitHub-Session': options.githubSession,
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ detail: 'Repository creation failed' }));
          throw new Error(errorData.detail || `HTTP error: ${response.status}`);
        }

        const result = await response.json();

        const repoResult: GitHubRepoResult = {
          success: result.success,
          repo_url: result.repo_url,
          repo_name: result.repo_name,
          owner: result.owner,
          files_uploaded: result.files_uploaded,
          message: result.message,
          deployment_urls: result.deployment_urls ?? {
            github: result.repo_url,
            render: `https://render.com/deploy?repo=${encodeURIComponent(result.repo_url)}`,
          },
          is_first_deploy: result.is_first_deploy ?? true,
          deployment_type: fromBackendDeploymentTarget(result.deployment_type) ?? options.deploymentTarget ?? 'webapp',
        };
        
        setRepoResult(repoResult);

        if (repoResult.success) {
          toast.success(`Repository created: ${repoResult.repo_name}`);
        } else {
          toast.error('Repository creation failed');
        }

        return repoResult;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Repository creation failed';
        toast.error(errorMessage);
        console.error('GitHub repository creation error:', error);
        return null;
      } finally {
        setIsCreating(false);
      }
    },
    []
  );

  return {
    createRepo,
    isCreating,
    repoResult,
  };
};
