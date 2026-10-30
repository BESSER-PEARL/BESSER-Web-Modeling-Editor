import { useState, useCallback } from 'react';
import { UMLDiagramType } from '@besser/wme';
import { apiClient } from '../../../shared/api/api-client';
import { getActiveDiagram, isUMLModel } from '../../../shared/types/project';
import { ProjectStorageRepository } from '../../../shared/services/storage/ProjectStorageRepository';
import {
  normalizeAgentRuntimeConfig,
} from '../../../shared/services/storage/local-storage-repository';
import type { AgentRuntimeConfig } from '../../../shared/services/storage/local-storage-repository';
import type { BesserProject } from '../../../shared/types/project';
import type { GrapesJSProjectData } from '../../../shared/types/project';
import { buildProjectPayloadForBackend } from '../../../shared/utils/projectExportUtils';
import { buildAllWebAppVersions, buildVersionGuiModel, collectVariantProfiles } from '../../../shared/utils/buildWebAppVersions';
import { restoreBaseAgentModels, stripAgentConfigToSystem } from '../utils/restoreBaseAgentModels';
import {
  buildPersonalizationMapping,
  hasPersonalizationVariants,
} from '../utils/agentPersonalizationPayload';
import { buildConfigYaml } from '../../../shared/utils/agent-config-yaml';
import type { AgentConfigFormData } from '../../../shared/utils/agent-config-yaml';

export interface StudyDeployResult {
  success: boolean;
  url: string;
  websiteUrl: string;
  websiteVersions: string[];
  message: string;
}

/** Minimum time the loading state is shown after a successful deploy (ms). */
const MIN_DEPLOY_WAIT_MS = 60_000;

export const useStudyDeploy = () => {
  const [isDeploying, setIsDeploying] = useState(false);
  const [result, setResult] = useState<StudyDeployResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const deploy = useCallback(async (project: BesserProject, personalized = false): Promise<StudyDeployResult | null> => {
    setIsDeploying(true);
    setResult(null);
    setError(null);

    const deployStart = Date.now();

    try {
      const freshProject = ProjectStorageRepository.loadProject(project.id) ?? project;
      const agentDiagram = getActiveDiagram(freshProject, 'AgentDiagram');
      const guiDiagram = getActiveDiagram(freshProject, 'GUINoCodeDiagram');
      const classDiagram = getActiveDiagram(freshProject, 'ClassDiagram');

      if (!agentDiagram || !isUMLModel(agentDiagram.model) || agentDiagram.model.type !== UMLDiagramType.AgentDiagram) {
        throw new Error('No agent diagram found in the current project.');
      }
      if (!guiDiagram?.model || !classDiagram?.model) {
        throw new Error('A GUI diagram and its class diagram are required to deploy the study website.');
      }

      const guiModel = guiDiagram.model as GrapesJSProjectData;
      if (!Array.isArray(guiModel.pages) || guiModel.pages.length === 0) {
        throw new Error('The study website needs at least one modeled GUI page.');
      }
      if (personalized) {
        // A personalized deployment needs BOTH products personalized, otherwise
        // one of the two would silently ship its default version.
        const storedVariants = (agentDiagram.config as Record<string, unknown> | undefined)?.personalizedVariants;
        const agentPersonalized = Array.isArray(storedVariants) && storedVariants.length > 0;
        const websitePersonalized = collectVariantProfiles(guiModel).length > 0;
        if (!agentPersonalized && !websitePersonalized) {
          throw new Error('Neither the agent nor the website has a personalized version yet. Complete the personalization process for both before deploying the personalized versions.');
        }
        if (!agentPersonalized) {
          throw new Error('The agent has no personalized version yet. Complete the personalization process for the agent (Personalize button in the agent editor) before deploying the personalized versions.');
        }
        if (!websitePersonalized) {
          throw new Error('The website has no personalized version yet. Complete the personalization process for the website (Personalize button in the GUI editor) before deploying the personalized versions.');
        }
      }
      const versions = personalized ? buildAllWebAppVersions(guiModel, 'all', null) : [];
      const webAppVersions = versions.length ? versions : [{ slug: 'base', name: 'Base', guiModel: buildVersionGuiModel(guiModel, null) }];
      const webAppProject = buildProjectPayloadForBackend(stripAgentConfigToSystem(restoreBaseAgentModels(freshProject)));

      const personalizationMapping =
        personalized && hasPersonalizationVariants(freshProject)
          ? buildPersonalizationMapping(freshProject)
          : null;

      // Build a normalized agent config with guaranteed runtime fields (mirrors
      // useGeneratorExecution handleAgentGenerate). agentDiagram.config may lack
      // intentRecognitionTechnology / agentPlatform when they were never changed
      // from the defaults — normalizeAgentRuntimeConfig fills those in.
      const diagramConfig = (agentDiagram.config ?? null) as Record<string, unknown> | null;
      const agentRuntimeConfig = normalizeAgentRuntimeConfig(diagramConfig as Partial<AgentRuntimeConfig>);
      const resolvedAgentPlatform =
        agentRuntimeConfig.agentPlatform === 'websocket' && agentRuntimeConfig.agentPlatformUseStreamlit
          ? 'streamlit'
          : agentRuntimeConfig.agentPlatform;
      const llmConfigBlock = agentRuntimeConfig.agentLlmName
        ? { llm: { name: agentRuntimeConfig.agentLlmName } }
        : agentRuntimeConfig.agentLlmProvider
        ? {
            llm: {
              provider: agentRuntimeConfig.agentLlmProvider,
              ...(agentRuntimeConfig.agentLlmModel ? { model: agentRuntimeConfig.agentLlmModel } : {}),
            },
          }
        : {};
      const normalizedAgentConfig = {
        ...(diagramConfig ?? {}),
        agentPlatform: resolvedAgentPlatform,
        intentRecognitionTechnology: agentRuntimeConfig.intentRecognitionTechnology,
        ...llmConfigBlock,
        // Study deploy always runs without streamlit DB (no persistent session store).
        streamlitDb: false,
      };

      // Regenerate configYaml from agentConfigForm when present so that the
      // stored configYaml (which may have placeholder values from template
      // setup) always reflects the current form data including real API keys.
      let configYaml: string | null = typeof agentDiagram.configYaml === 'string' ? agentDiagram.configYaml : null;
      if (agentDiagram.agentConfigForm) {
        const customYaml = typeof agentDiagram.agentConfigCustomYaml === 'string' ? agentDiagram.agentConfigCustomYaml : '';
        configYaml = buildConfigYaml(agentDiagram.agentConfigForm as unknown as AgentConfigFormData, customYaml);
      }

      const payload = {
        agent_model: agentDiagram.model,
        agent_config: normalizedAgentConfig,
        agent_config_yaml: configYaml,
        personalization_mapping: personalizationMapping,
        web_app_project: webAppProject,
        web_app_versions: webAppVersions,
      };

      const data = await apiClient.post<StudyDeployResult>(
        '/deploy_study_agent',
        payload,
        { timeout: 600_000 },
      );
      if (!data.success || !data.websiteUrl || !Array.isArray(data.websiteVersions) || !data.websiteVersions.includes('base')) {
        throw new Error('The study server did not return a deployed website. Update both study services and retry.');
      }

      // Keep the loading state visible for at least MIN_DEPLOY_WAIT_MS so users
      // understand the agent service needs time to start (502s are normal briefly).
      const elapsed = Date.now() - deployStart;
      const remaining = MIN_DEPLOY_WAIT_MS - elapsed;
      if (remaining > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, remaining));
      }

      setResult(data);
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Deployment failed.';
      setError(message);
      return null;
    } finally {
      setIsDeploying(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { isDeploying, result, error, deploy, reset };
};
