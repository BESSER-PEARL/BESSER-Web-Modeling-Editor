import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';
import { BACKEND_URL } from '../../../shared/constants/constant';
import { normalizeProjectName } from '../../../shared/utils/projectName';

// Re-export from github service for backward compatibility
export { useGitHubAuth, type GitHubAuthStatus } from './useGitHubAuth';
export { useGitHubRepo, type GitHubRepoResult, type CreateRepoOptions } from './useGitHubRepo';

// Re-export from render deploy service
export { useRenderDeploy, type DeployToRenderResult, type RenderDeploymentUrls } from '../../deploy/hooks/useRenderDeploy';

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
    live_chatbot?: string;
    render_dashboard?: string;
  };
  files_uploaded: number;
  message: string;
  // True on the very first deploy to a repo, false on subsequent redeploys.
  is_first_deploy?: boolean;
  // Deployment flavor returned by backend.
  deployment_type?: DeploymentTarget;
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
      commitMessage: string = '',
      deploymentTarget: DeploymentTarget = 'webapp',
      personalizationMapping: ReadonlyArray<Record<string, unknown>> | null = null,
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

        // The deploy backend reads the agent config from the AgentDiagram's own
        // ``config`` field (preferred over ``settings.config``), so to trigger
        // the personalization-aware codegen path we must inject the mapping
        // directly into that diagram's config in the payload.
        let projectForBackend: any = projectData;
        if (
          personalizationMapping
          && personalizationMapping.length > 0
          && Array.isArray(agentDiagrams)
          && activeAgentDiagram
        ) {
          const clonedDiagrams = [...agentDiagrams];
          clonedDiagrams[activeAgentIndex] = {
            ...activeAgentDiagram,
            config: {
              ...(activeAgentDiagram.config ?? {}),
              personalizationMapping,
            },
          };
          projectForBackend = {
            ...projectData,
            diagrams: {
              ...(projectData.diagrams ?? {}),
              AgentDiagram: clonedDiagrams,
            },
          };
          console.log(
            '[deploy] injecting personalizationMapping with',
            personalizationMapping.length,
            'entries into AgentDiagram config at index',
            activeAgentIndex,
          );
        } else if (personalizationMapping && personalizationMapping.length > 0) {
          console.warn(
            '[deploy] personalizationMapping provided but could not be injected — agentDiagrams:',
            Array.isArray(agentDiagrams),
            'activeAgentDiagram:',
            !!activeAgentDiagram,
          );
        }

        const requestBody = {
          ...projectForBackend,
          name: normalizeProjectName(projectData?.name || 'project'),
          settings: {
            ...(projectData.settings || {}),
            // ``settings.config`` is only a fallback when the diagram carries
            // no config of its own — the deploy backend prefers the diagram's
            // ``config`` field (see github_deploy_api.py).
            config: agentConfig ?? defaultAgentConfig,
          },
          deploy_config: {
            repo_name: repoName,
            description: description,
            is_private: isPrivate,
            use_existing: useExisting,
            target: toBackendDeploymentTarget(deploymentTarget),
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

        const rawResult = await response.json();
        const result: DeployToGitHubResult = {
          ...rawResult,
          deployment_type: fromBackendDeploymentTarget(rawResult.deployment_type) ?? deploymentTarget,
        };
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
