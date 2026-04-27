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
  // Optional agent personalization payload. When present (and the project
  // contains an active AgentDiagram), it is injected into that diagram's
  // ``config.personalizationMapping`` before the request body is built so
  // the backend's personalization-aware codegen path runs.
  personalizationMapping?: ReadonlyArray<Record<string, unknown>> | null;
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
        const useExisting = options.useExisting ?? false;
        const commitMessage = options.commitMessage ?? '';
        const personalizationMapping = options.personalizationMapping ?? null;

        // Resolve the active AgentDiagram (if any) so we can both:
        //   (1) inject ``personalizationMapping`` into its ``config`` when
        //       provided — the deploy backend prefers the diagram's own
        //       ``config`` over ``settings.config`` and uses that to trigger
        //       the personalization-aware codegen path.
        //   (2) build a ``settings.config`` fallback from the diagram's
        //       config (or a sensible default) so the backend's
        //       ``agent_config = agent_diagram_data.get("config") or settings_config``
        //       lookup always finds something.
        const agentDiagrams = projectData?.diagrams?.AgentDiagram;
        const activeAgentIndex = projectData?.currentDiagramIndices?.AgentDiagram ?? 0;
        const activeAgentDiagram = Array.isArray(agentDiagrams)
          ? (agentDiagrams[activeAgentIndex] ?? agentDiagrams[0])
          : null;
        const agentConfig = activeAgentDiagram?.config ?? null;

        // Default agent config: websocket+streamlit, classical IC (no API key needed)
        const defaultAgentConfig = {
          agentPlatform: 'streamlit',
          intentRecognitionTechnology: 'classical',
        };

        // Inject the personalization mapping into the active AgentDiagram's
        // ``config`` field before envelope construction so both the deploy
        // payload AND the bundled ``projectExport`` carry it.
        let projectForBackend: BesserProject = projectData;
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
          } as BesserProject;
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

        // Build the V2 project-export shape the editor uses for "Export Project"
        // and ship it alongside the deploy payload, so the backend can drop it
        // into the repo as `diagrams.json` and the file stays re-importable via
        // the editor's "Import Project" action.
        const projectExport = buildProjectExportEnvelope(projectForBackend);

        const requestBody = {
          ...projectForBackend,
          name: normalizeProjectName(projectData?.name || 'project'),
          settings: {
            ...((projectData as { settings?: Record<string, unknown> }).settings ?? {}),
            // ``settings.config`` is only a fallback when the diagram carries
            // no config of its own — the deploy backend prefers the diagram's
            // ``config`` field (see github_deploy_api.py).
            config: agentConfig ?? defaultAgentConfig,
          },
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
            // Deployment performs multiple GitHub API calls + code generation;
            // observed durations up to ~37s in production. Use 2 min so the
            // 30s default timeout doesn't abort a successful in-flight request.
            timeout: 120_000,
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
