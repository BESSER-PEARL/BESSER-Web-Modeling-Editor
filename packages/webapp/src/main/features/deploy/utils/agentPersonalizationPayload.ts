import { UMLDiagramType } from '@besser/wme';
import type { BesserProject, ProjectDiagram } from '../../../shared/types/project';
import { getActiveDiagram, isUMLModel } from '../../../shared/types/project';
import { LocalStorageRepository } from '../../../shared/services/storage/local-storage-repository';

export interface PersonalizationMappingEntry {
  name: string;
  configuration: Record<string, unknown>;
  user_profile: Record<string, unknown>;
  agent_model: Record<string, unknown>;
}

interface PersonalizedVariantSnapshot {
  id: string;
  profileName: string;
  configurationId: string;
  configurationName: string;
  createdAt: string;
  model: Record<string, unknown>;
}

const readVariantSnapshots = (diagram: ProjectDiagram | undefined): PersonalizedVariantSnapshot[] => {
  const raw = (diagram?.config as Record<string, unknown> | undefined)?.personalizedVariants;
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((entry): entry is PersonalizedVariantSnapshot => {
    if (!entry || typeof entry !== 'object') return false;
    const variant = entry as Partial<PersonalizedVariantSnapshot>;
    return (
      typeof variant.id === 'string' &&
      typeof variant.profileName === 'string' &&
      typeof variant.configurationId === 'string' &&
      typeof variant.configurationName === 'string' &&
      typeof variant.createdAt === 'string' &&
      isUMLModel(variant.model) &&
      variant.model.type === UMLDiagramType.AgentDiagram
    );
  });
};

export const hasPersonalizationVariants = (project: BesserProject | null | undefined): boolean => {
  if (!project) return false;
  const agentDiagram = getActiveDiagram(project, 'AgentDiagram');
  return readVariantSnapshots(agentDiagram).length > 0;
};

/**
 * Build the personalizationMapping payload the backend's agent generator and
 * deployment flow consume. Mirrors the builder used in the generation menu so
 * deploys emit the same profile→configuration→agent-model array.
 */
export const buildPersonalizationMapping = (
  project: BesserProject | null | undefined,
): PersonalizationMappingEntry[] => {
  if (!project) return [];

  const agentDiagram = getActiveDiagram(project, 'AgentDiagram');
  const variants = readVariantSnapshots(agentDiagram);
  if (variants.length === 0) return [];

  const localProfiles = LocalStorageRepository.getUserProfiles();
  const projectProfiles = (project.diagrams?.UserDiagram ?? [])
    .filter((diagram) => isUMLModel(diagram.model) && diagram.model.type === UMLDiagramType.UserDiagram)
    .map((diagram) => ({
      id: diagram.id,
      name: diagram.title,
      model: diagram.model as Record<string, unknown>,
    }));

  const profileByName = new Map<string, { id: string; name: string; model: Record<string, unknown> }>();
  for (const profile of localProfiles) {
    if (profile.model && isUMLModel(profile.model) && profile.model.type === UMLDiagramType.UserDiagram) {
      profileByName.set(profile.name, { id: profile.id, name: profile.name, model: profile.model });
    }
  }
  for (const profile of projectProfiles) {
    profileByName.set(profile.name, profile);
  }

  const configs = LocalStorageRepository.getAgentConfigurations();
  const configById = new Map(configs.map((entry) => [entry.id, entry]));
  const variantByConfigurationId = new Map(variants.map((variant) => [variant.configurationId, variant]));

  const mappings = LocalStorageRepository.getAgentProfileConfigurationMappings();

  return mappings
    .map((entry) => {
      const profile = profileByName.get(entry.userProfileName) || null;
      const config = configById.get(entry.agentConfigurationId) || null;
      const variantModel = variantByConfigurationId.get(entry.agentConfigurationId)?.model;
      const fallbackAgentModel = config?.personalizedAgentModel || config?.baseAgentModel || null;
      const agentModel = variantModel || fallbackAgentModel;

      if (!profile || !agentModel || !config) {
        return null;
      }

      return {
        name: profile.name,
        configuration: structuredClone(config.config) as unknown as Record<string, unknown>,
        user_profile: structuredClone(profile.model) as unknown as Record<string, unknown>,
        agent_model: structuredClone(agentModel) as unknown as Record<string, unknown>,
      };
    })
    .filter((entry): entry is PersonalizationMappingEntry => Boolean(entry));
};
