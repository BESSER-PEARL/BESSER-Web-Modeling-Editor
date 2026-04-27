import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';
import { apiClient, ApiError } from '../../../shared/api/api-client';
import { normalizeProjectName } from '../../../shared/utils/projectName';
import { buildProjectExportEnvelope } from '../../../shared/utils/projectExportUtils';
import type { BesserProject } from '../../../shared/types/project';

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
  useExisting?: boolean;
  commitMessage?: string;
}

type DeployWebappResponse = {
  success: boolean;
  repo_url: string;
  repo_name: string;
  owner: string;
  files_uploaded: number;
  message: string;
  deployment_urls?: GitHubDeploymentUrls;
  is_first_deploy?: boolean;
  deployment_type?: unknown;
};

const toGitHubRepoResult = (
  resp: DeployWebappResponse,
  fallbackTarget?: DeploymentTarget,
): GitHubRepoResult => ({
  success: resp.success,
  repo_url: resp.repo_url,
  repo_name: resp.repo_name,
  owner: resp.owner,
  files_uploaded: resp.files_uploaded,
  message: resp.message,
  deployment_urls: resp.deployment_urls ?? {
    github: resp.repo_url,
    render: `https://render.com/deploy?repo=${encodeURIComponent(resp.repo_url)}`,
  },
  is_first_deploy: resp.is_first_deploy ?? true,
  deployment_type: fromBackendDeploymentTarget(resp.deployment_type) ?? fallbackTarget ?? 'webapp',
});

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
      projectData: BesserProject,
      options: CreateRepoOptions
    ): Promise<GitHubRepoResult | null> => {
      if (!projectData) {
        toast.error('No project to deploy.');
        return null;
      }
      if (!options.githubSession) {
        toast.error('Not signed in to GitHub.');
        return null;
      }

      console.log('Creating GitHub repository...');
      setIsCreating(true);
      setRepoResult(null);

      try {
        // Build the V2 project-export shape the editor uses for "Export Project"
        // and ship it alongside the deploy payload, so the backend can drop it
        // into the repo as `diagrams.json` and the file stays re-importable via
        // the editor's "Import Project" action.
        const projectExport = buildProjectExportEnvelope(projectData);

        const useExisting = options.useExisting ?? false;
        const commitMessage = options.commitMessage ?? '';

        const requestBody = {
          ...projectData,
          name: normalizeProjectName(projectData?.name || 'project'),
          deploy_config: {
            repo_name: options.repoName,
            description: options.description,
            is_private: options.isPrivate,
            target: toBackendDeploymentTarget(options.deploymentTarget ?? 'webapp'),
            use_existing: useExisting,
            ...(commitMessage ? { commit_message: commitMessage } : {}),
          },
          // Read backend-side by:
          // besser/utilities/web_modeling_editor/backend/services/deployment/github_deploy_api.py
          // (look for the `body.get("projectExport")` lookup).
          projectExport,
        };

        const result = await apiClient.post<DeployWebappResponse>(
          '/github/deploy-webapp',
          requestBody,
          {
            headers: {
              'X-GitHub-Session': options.githubSession,
            },
          }
        );

        const repoResult = toGitHubRepoResult(result, options.deploymentTarget);

        setRepoResult(repoResult);

        if (repoResult.success) {
          toast.success(
            useExisting
              ? `Repository updated: ${repoResult.repo_name}`
              : `Repository created: ${repoResult.repo_name}`
          );
        } else {
          toast.error('Deployment failed');
        }

        return repoResult;
      } catch (error) {
        const errorMessage =
          error instanceof ApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : 'Repository creation failed';
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
