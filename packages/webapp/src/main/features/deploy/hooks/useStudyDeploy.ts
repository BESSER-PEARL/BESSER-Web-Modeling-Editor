import { useState, useCallback } from 'react';
import { UMLDiagramType } from '@besser/wme';
import { apiClient } from '../../../shared/api/api-client';
import { getActiveDiagram, isUMLModel } from '../../../shared/types/project';
import { ProjectStorageRepository } from '../../../shared/services/storage/ProjectStorageRepository';
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

  const deploy = useCallback(async (project: BesserProject): Promise<StudyDeployResult | null> => {
    setIsDeploying(true);
    setResult(null);
    setError(null);

    try {
      const freshProject = ProjectStorageRepository.loadProject(project.id) ?? project;
      const agentDiagram = getActiveDiagram(freshProject, 'AgentDiagram');

      if (!agentDiagram || !isUMLModel(agentDiagram.model) || agentDiagram.model.type !== UMLDiagramType.AgentDiagram) {
        throw new Error('No agent diagram found in the current project.');
      }

      const personalizationMapping = hasPersonalizationVariants(freshProject)
        ? buildPersonalizationMapping(freshProject)
        : null;

      const payload = {
        agent_model: agentDiagram.model,
        agent_config: agentDiagram.config ?? null,
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
