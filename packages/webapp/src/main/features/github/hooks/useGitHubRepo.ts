import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { reportError } from '../../../shared/services/errors/reportError';
import { ApiError } from '../../../shared/api/api-client';
import { deployToGitHub } from '../../../shared/api/github';
import type { components } from '../../../shared/api/generated/besser-openapi';
import { normalizeProjectName } from '../../../shared/utils/projectName';
import { buildProjectExportEnvelope, buildProjectPayloadForBackend } from '../../../shared/utils/projectExportUtils';
import type { BesserProject } from '../../../shared/types/project';
import { isGrapesJSProjectData } from '../../../shared/types/project';
import { buildVersionGuiModel, collectVariantProfiles } from '../../../shared/utils/buildWebAppVersions';

export type DeploymentTarget = 'webapp' | 'agent';
type DeployWebappResponse = components['schemas']['DeployToGitHubResponse'];
type BackendDeploymentTarget = DeployWebappResponse['deployment_type'];

const toBackendDeploymentTarget = (target: DeploymentTarget): BackendDeploymentTarget => (
  target === 'agent' ? 'chatbot' : 'webapp'
);

const fromBackendDeploymentTarget = (target: BackendDeploymentTarget): DeploymentTarget => (
  target === 'chatbot' ? 'agent' : 'webapp'
);

/**
 * Deploy always ships the BASE web app — personalized page variants are a
 * design-time convenience and must never be what gets deployed. The stored GUI
 * model's page content reflects whichever variant was last *active* in the
 * editor, so we resolve the active GUINoCodeDiagram to its base version before
 * building the deploy payload. No-ops when the GUI has no variants.
 */
const forceBaseWebAppGuiModel = (project: BesserProject): BesserProject => {
  const guiDiagrams = project.diagrams?.GUINoCodeDiagram;
  if (!Array.isArray(guiDiagrams) || guiDiagrams.length === 0) return project;

  const idx = project.currentDiagramIndices?.GUINoCodeDiagram ?? 0;
  const target = guiDiagrams[idx];
  if (!target || !isGrapesJSProjectData(target.model)) return project;
  if (collectVariantProfiles(target.model).length === 0) return project;

  const nextGui = [...guiDiagrams];
  nextGui[idx] = { ...target, model: buildVersionGuiModel(target.model, null) };
  return {
    ...project,
    diagrams: { ...project.diagrams, GUINoCodeDiagram: nextGui },
  };
};

/** The live and dashboard links are set on a redeploy that reuses the repo's
 *  render.yaml suffix; a first deploy has no stable Render hostname yet. */
export type GitHubDeploymentUrls = components['schemas']['DeploymentUrls'];

/** Why `createRepo` produced no repository; `error` is the caught error, if any. */
export interface CreateRepoFailure {
  success: false;
  reason: 'no_project' | 'not_signed_in' | 'request';
  error?: unknown;
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
  // the backend's personalization-aware codegen path runs. Typed as
  // ``unknown[]`` so callers can pass concrete entry interfaces (e.g.
  // ``PersonalizationMappingEntry[]``) without an explicit cast.
  personalizationMapping?: ReadonlyArray<unknown> | null;
}

/** `POST /github/deploy-webapp`. */
const toGitHubRepoResult = (resp: DeployWebappResponse): GitHubRepoResult => ({
  success: resp.success,
  repo_url: resp.repo_url,
  repo_name: resp.repo_name,
  owner: resp.owner,
  files_uploaded: resp.files_uploaded,
  message: resp.message,
  deployment_urls: resp.deployment_urls,
  is_first_deploy: resp.is_first_deploy,
  deployment_type: fromBackendDeploymentTarget(resp.deployment_type),
});

/**
 * Hook for creating and pushing projects to GitHub repositories.
 * This can be used independently for any GitHub repo operations.
 */
export const useGitHubRepo = () => {
  const { t } = useTranslation();
  const [isCreating, setIsCreating] = useState(false);
  const [repoResult, setRepoResult] = useState<GitHubRepoResult | null>(null);

  /**
   * Creates a new GitHub repository and pushes project files to it.
   * @param projectData - The project data to push to the repository
   * @param options - Repository creation options (name, description, private, session)
   * @returns The result of the repository creation, or why it failed
   */
  const createRepo = useCallback(
    async (
      projectData: BesserProject,
      options: CreateRepoOptions
    ): Promise<GitHubRepoResult | CreateRepoFailure> => {
      if (!projectData) {
        reportError(t('github.toasts.noProjectToDeploy'));
        return { success: false, reason: 'no_project' };
      }
      if (!options.githubSession) {
        reportError(t('github.toasts.notSignedIn'));
        return { success: false, reason: 'not_signed_in' };
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
          if (import.meta.env.DEV) {
            console.log(
              '[deploy] injecting personalizationMapping with',
              personalizationMapping.length,
              'entries into AgentDiagram config at index',
              activeAgentIndex,
            );
          }
        } else if (personalizationMapping && personalizationMapping.length > 0) {
          if (import.meta.env.DEV) {
            console.warn(
              '[deploy] personalizationMapping provided but could not be injected — agentDiagrams:',
              Array.isArray(agentDiagrams),
              'activeAgentDiagram:',
              !!activeAgentDiagram,
            );
          }
        }

        // Build the V2 project-export shape the editor uses for "Export Project"
        // and ship it alongside the deploy payload, so the backend can drop it
        // into the repo as `diagrams.json` and the file stays re-importable via
        // the editor's "Import Project" action.
        // Skip bundled personalization here — saved configurations and user
        // profiles are local user state, not something we want pushed into a
        // (potentially public) GitHub repo on every deploy.
        const projectExport = buildProjectExportEnvelope(projectForBackend, undefined, {
          includePersonalization: false,
        });

        // For a web app deploy, generate from the BASE version only — never a
        // personalized page variant. The bundled ``projectExport`` above keeps
        // the original model (variants intact) so re-import restores them.
        const isWebappDeploy = (options.deploymentTarget ?? 'webapp') === 'webapp';
        const projectForGeneration = isWebappDeploy
          ? forceBaseWebAppGuiModel(projectForBackend)
          : projectForBackend;

        // The backend reads v4 only (a v3 model is a 400): generate from the
        // same payload as every other backend call, which leaves an
        // unmigrated diagram out. `projectExport` still carries it.
        const requestBody = {
          ...buildProjectPayloadForBackend(projectForGeneration),
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

        const result = await deployToGitHub(options.githubSession, requestBody);

        const repoResult = toGitHubRepoResult(result);

        setRepoResult(repoResult);

        if (repoResult.success) {
          toast.success(
            useExisting
              ? t('github.toasts.repoUpdated', { name: repoResult.repo_name })
              : t('github.toasts.repoCreated', { name: repoResult.repo_name })
          );
        } else {
          reportError(t('github.toasts.deploymentFailed'));
        }

        return repoResult;
      } catch (error) {
        const errorMessage =
          error instanceof ApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : t('github.toasts.repoCreationFailed');
        reportError(errorMessage, { error });
        console.error('GitHub repository creation error:', error);
        return { success: false, reason: 'request', error };
      } finally {
        setIsCreating(false);
      }
    },
    [t]
  );

  return {
    createRepo,
    isCreating,
    repoResult,
  };
};
