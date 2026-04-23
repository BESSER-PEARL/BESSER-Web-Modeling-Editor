import { UMLDiagramType } from '@besser/wme';
import type { BesserProject } from '../../../shared/types/project';
import { isUMLModel } from '../../../shared/types/project';
import { LocalStorageRepository } from '../../../shared/services/storage/local-storage-repository';

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
