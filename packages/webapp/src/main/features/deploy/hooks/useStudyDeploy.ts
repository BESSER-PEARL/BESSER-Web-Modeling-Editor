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
import {
  buildPersonalizationMapping,
  hasPersonalizationVariants,
} from '../utils/agentPersonalizationPayload';

export interface StudyDeployResult {
  success: boolean;
  url: string;
  message: string;
}

export const useStudyDeploy = () => {
  const [isDeploying, setIsDeploying] = useState(false);
  const [result, setResult] = useState<StudyDeployResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const deploy = useCallback(async (project: BesserProject, personalized = false): Promise<StudyDeployResult | null> => {
    setIsDeploying(true);
    setResult(null);
    setError(null);

    try {
      const freshProject = ProjectStorageRepository.loadProject(project.id) ?? project;
      const agentDiagram = getActiveDiagram(freshProject, 'AgentDiagram');

      if (!agentDiagram || !isUMLModel(agentDiagram.model) || agentDiagram.model.type !== UMLDiagramType.AgentDiagram) {
        throw new Error('No agent diagram found in the current project.');
      }

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

      const payload = {
        agent_model: agentDiagram.model,
        agent_config: normalizedAgentConfig,
        agent_config_yaml: typeof agentDiagram.configYaml === 'string' ? agentDiagram.configYaml : null,
        personalization_mapping: personalizationMapping,
      };

      const data = await apiClient.post<StudyDeployResult>(
        '/deploy_study_agent',
        payload,
        { timeout: 120_000 },
      );
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
