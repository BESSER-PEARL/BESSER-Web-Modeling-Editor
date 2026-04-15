import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';
import { BACKEND_URL } from '../../../shared/constants/constant';
import { normalizeProjectName } from '../../../shared/utils/projectName';

// Re-export from github service for backward compatibility
export { useGitHubAuth, type GitHubAuthStatus } from './useGitHubAuth';
export { useGitHubRepo, type GitHubRepoResult, type CreateRepoOptions } from './useGitHubRepo';

// Re-export from render deploy service
export { useRenderDeploy, type DeployToRenderResult, type RenderDeploymentUrls } from '../../deploy/hooks/useRenderDeploy';

// Legacy interface - kept for backward compatibility
export interface DeployToGitHubResult {
  success: boolean;
  repo_url: string;
  repo_name: string;
  owner: string;
  deployment_urls: {
    github: string;
    render: string;
    // Populated on redeploys (when the backend reused a prior render.yaml
    // suffix). First deploys only have ``github`` and ``render``.
    live_frontend?: string;
    live_backend?: string;
    render_dashboard?: string;
  };
  files_uploaded: number;
  message: string;
  // True on the very first deploy to a repo, false on subsequent redeploys.
  is_first_deploy?: boolean;
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
      githubSession: string,
      useExisting: boolean = false,
      commitMessage: string = ''
    ): Promise<DeployToGitHubResult | null> => {
      console.log('Starting GitHub deployment...');
      setIsDeploying(true);
      setDeploymentResult(null);

      try {
        // Read agent config from the project diagram data (single source of truth)
        const agentDiagrams = projectData?.diagrams?.AgentDiagram;
        const activeAgentIndex = projectData?.currentDiagramIndices?.AgentDiagram ?? 0;
        const activeAgentDiagram = Array.isArray(agentDiagrams) ? agentDiagrams[activeAgentIndex] ?? agentDiagrams[0] : null;
        const agentConfig = activeAgentDiagram?.config ?? null;

        // Default agent config: websocket+streamlit, classical IC (no API key needed)
        const defaultAgentConfig = {
          agentPlatform: 'streamlit',
          intentRecognitionTechnology: 'classical',
        };

        const requestBody = {
          ...projectData,
          name: normalizeProjectName(projectData?.name || 'project'),
          settings: {
            ...(projectData.settings || {}),
            config: agentConfig ?? defaultAgentConfig,
          },
          deploy_config: {
            repo_name: repoName,
            description: description,
            is_private: isPrivate,
            use_existing: useExisting,
            ...(commitMessage ? { commit_message: commitMessage } : {}),
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
          toast.success(useExisting ? `Repository updated: ${result.repo_name}` : `Repository created: ${result.repo_name}`);
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
