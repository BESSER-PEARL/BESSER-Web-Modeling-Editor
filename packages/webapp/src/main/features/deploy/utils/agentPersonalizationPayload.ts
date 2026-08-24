import { UMLDiagramType } from '@besser/wme';
import type { UMLModel } from '@besser/wme';
import type { BesserProject } from '../../../shared/types/project';
import { getActiveDiagram, isUMLModel } from '../../../shared/types/project';
import { LocalStorageRepository } from '../../../shared/services/storage/local-storage-repository';
import { aggregateProfilePersonalization } from '../../../shared/utils/personalization-aggregation';

export interface PersonalizationMappingEntry {
  name: string;
  configuration: Record<string, unknown>;
  user_profile: Record<string, unknown>;
  agent_model: Record<string, unknown>;
}

/**
 * True when the project has at least one UserDiagram profile — personalization
 * is now authored on the profiles themselves, so any profile means there is a
 * personalization mapping to ship (regardless of whether specs are filled in).
 */
export const hasPersonalizationVariants = (project: BesserProject | null | undefined): boolean => {
  if (!project) return false;
  return (project.diagrams?.UserDiagram ?? []).some(
    (diagram) => isUMLModel(diagram.model) && diagram.model.type === UMLDiagramType.UserDiagram,
  );
};

/**
 * Build the personalizationMapping payload the backend's agent generator and
 * deployment flow consume. Mirrors the builder in the generation menu
 * (`useGeneratorExecution`): personalization lives on each UserDiagram profile,
 * `aggregateProfilePersonalization` collapses its per-element specs into the
 * flat `configuration`, and every profile layers onto the same base agent model.
 */
export const buildPersonalizationMapping = (
  project: BesserProject | null | undefined,
): PersonalizationMappingEntry[] => {
  if (!project) return [];

  const agentDiagram = getActiveDiagram(project, 'AgentDiagram');
  const baseAgentModel =
    agentDiagram && isUMLModel(agentDiagram.model) && agentDiagram.model.type === UMLDiagramType.AgentDiagram
      ? (LocalStorageRepository.getAgentBaseModel(agentDiagram.id) as UMLModel | null) ??
        (agentDiagram.model as UMLModel)
      : null;
  if (!baseAgentModel) return [];

  const localProfiles = LocalStorageRepository.getUserProfiles();
  const projectProfiles = (project.diagrams?.UserDiagram ?? [])
    .filter((diagram) => isUMLModel(diagram.model) && diagram.model.type === UMLDiagramType.UserDiagram)
    .map((diagram) => ({
      id: diagram.id,
      name: diagram.title,
      model: diagram.model as UMLModel,
    }));

  const profileByName = new Map<string, { id: string; name: string; model: UMLModel }>();
  for (const profile of localProfiles) {
    if (profile.model && isUMLModel(profile.model) && profile.model.type === UMLDiagramType.UserDiagram) {
      profileByName.set(profile.name, { id: profile.id, name: profile.name, model: profile.model as UMLModel });
    }
  }
  for (const profile of projectProfiles) {
    profileByName.set(profile.name, profile);
  }

  return Array.from(profileByName.values()).map((profile) => ({
    name: profile.name,
    configuration: aggregateProfilePersonalization(profile.model).configuration as Record<string, unknown>,
    user_profile: structuredClone(profile.model) as unknown as Record<string, unknown>,
    agent_model: structuredClone(baseAgentModel) as unknown as Record<string, unknown>,
  }));
};
