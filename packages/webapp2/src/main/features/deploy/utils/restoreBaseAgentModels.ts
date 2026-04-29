import { UMLDiagramType } from '@besser/wme';
import type { BesserProject } from '../../../shared/types/project';
import { isUMLModel } from '../../../shared/types/project';
import {
  LocalStorageRepository,
  DEFAULT_AGENT_RUNTIME_CONFIG,
  type AgentRuntimeConfig,
} from '../../../shared/services/storage/local-storage-repository';

/**
 * Return a clone of `project` with each AgentDiagram's `model` swapped back to
 * its stored base (pre-personalization) snapshot when one exists in
 * localStorage. `LocalStorageRepository.saveAgentBaseModel` records that
 * snapshot the first time "Save & Apply" runs in the Agent Configuration
 * panel, before the diagram model gets overwritten with the personalized
 * variant. Used by GUI+Agent (webapp) deploys so the generated web app always
 * embeds the base agent model regardless of any personalization applied in
 * the editor.
 */
export const restoreBaseAgentModels = (project: BesserProject): BesserProject => {
  const agentDiagrams = project.diagrams?.AgentDiagram;
  if (!Array.isArray(agentDiagrams) || agentDiagrams.length === 0) {
    return project;
  }

  let swapped = false;
  const nextAgentDiagrams = agentDiagrams.map((diagram) => {
    if (!diagram?.id) return diagram;
    const base = LocalStorageRepository.getAgentBaseModel(diagram.id);
    if (!base || !isUMLModel(base) || base.type !== UMLDiagramType.AgentDiagram) {
      return diagram;
    }
    swapped = true;
    return { ...diagram, model: base };
  });

  if (!swapped) return project;

  return {
    ...project,
    diagrams: {
      ...project.diagrams,
      AgentDiagram: nextAgentDiagrams,
    },
  };
};

const buildSystemOnlyAgentConfig = (system: AgentRuntimeConfig): Record<string, unknown> => {
  const config: Record<string, unknown> = {
    agentPlatform: system.agentPlatform,
    intentRecognitionTechnology: system.intentRecognitionTechnology,
  };
  if (system.agentLlmProvider) {
    const resolvedModel = system.agentLlmModel === 'other'
      ? system.agentCustomLlmModel.trim()
      : system.agentLlmModel;
    config.llm = {
      provider: system.agentLlmProvider,
      ...(resolvedModel ? { model: resolvedModel } : {}),
    };
  }
  return config;
};

/**
 * Replace each AgentDiagram's `config` with a system-only config derived from
 * the hardcoded `DEFAULT_AGENT_RUNTIME_CONFIG` defaults. Used before
 * generating / deploying so the backend does not see stale personalization
 * fields (style, language complexity, modalities, saved variants, ...) that
 * would trigger the personalization codegen branch. Mirrors the payload the
 * standalone agent generator sends when "None" is selected in the generation
 * dialog.
 */
export const stripAgentConfigToSystem = (project: BesserProject): BesserProject => {
  const agentDiagrams = project.diagrams?.AgentDiagram;
  if (!Array.isArray(agentDiagrams) || agentDiagrams.length === 0) {
    return project;
  }

  const systemConfig = buildSystemOnlyAgentConfig({ ...DEFAULT_AGENT_RUNTIME_CONFIG });
  const nextAgentDiagrams = agentDiagrams.map((diagram) => ({ ...diagram, config: { ...systemConfig } }));

  return {
    ...project,
    diagrams: {
      ...project.diagrams,
      AgentDiagram: nextAgentDiagrams,
    },
  };
};
