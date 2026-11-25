import { UMLDiagramType } from '@besser/wme';
import type { UMLModel } from '@besser/wme';
import type { BesserProject } from '../../../shared/types/project';
import { getActiveDiagram, isUMLModel } from '../../../shared/types/project';
import { LocalStorageRepository } from '../../../shared/services/storage/local-storage-repository';
import { aggregateProfilePersonalization } from '../../../shared/utils/personalization-aggregation';
import {
  splitUserDiagramIntoProfiles,
  uniquifyNames,
  mergeSingletonBoxes,
  reinjectHiddenContainers,
} from '../../../shared/utils/user-profile-graph';

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

  // Build a map from profileName → stored personalized variant model, mirroring
  // useGeneratorExecution. The Personalize button saves these into
  // diagram.config.personalizedVariants. Using them means each profile ships its
  // already-personalized model (no LLM add_user_context calls needed at runtime).
  const rawStoredVariants = (agentDiagram?.config as Record<string, unknown> | undefined)?.personalizedVariants;
  const variantModelByProfileName = new Map<string, UMLModel>();
  if (Array.isArray(rawStoredVariants)) {
    for (const v of rawStoredVariants) {
      if (
        v && typeof v === 'object' &&
        typeof (v as Record<string, unknown>).profileName === 'string' &&
        isUMLModel((v as Record<string, unknown>).model) &&
        ((v as Record<string, unknown>).model as UMLModel).type === UMLDiagramType.AgentDiagram
      ) {
        variantModelByProfileName.set(
          (v as Record<string, unknown>).profileName as string,
          (v as Record<string, unknown>).model as UMLModel,
        );
      }
    }
  }

  // Collect every UserDiagram model (stored profile snapshots + project tabs),
  // then split each into its constituent profiles (a UserDiagram tab may now
  // hold several `User` elements). Each profile becomes one mapping entry.
  const localProfiles = LocalStorageRepository.getUserProfiles();
  const userModels: UMLModel[] = [];
  for (const profile of localProfiles) {
    if (profile.model && isUMLModel(profile.model) && profile.model.type === UMLDiagramType.UserDiagram) {
      userModels.push(profile.model as UMLModel);
    }
  }
  for (const diagram of project.diagrams?.UserDiagram ?? []) {
    if (isUMLModel(diagram.model) && diagram.model.type === UMLDiagramType.UserDiagram) {
      userModels.push(diagram.model as UMLModel);
    }
  }

  const entries = userModels.flatMap((model) =>
    splitUserDiagramIntoProfiles(model).map((profile) => {
      // Fuse the `single`-cardinality granular chips (age+nationality → one
      // Personal_Information) so the shipped user_profile matches the metamodel.
      // Then re-insert hidden grouping containers (Competence, Accessibility) so
      // the backend receives the expected nesting depth.
      const merged = reinjectHiddenContainers(mergeSingletonBoxes(profile.model));
      // Use the stored personalized variant if the Personalize button was run for
      // this profile; fall back to the base model. Mirrors useGeneratorExecution.
      const variantModel = variantModelByProfileName.get(profile.name) ?? baseAgentModel;
      return {
        name: profile.name,
        configuration: aggregateProfilePersonalization(merged).configuration as Record<string, unknown>,
        user_profile: structuredClone(merged) as unknown as Record<string, unknown>,
        agent_model: structuredClone(variantModel) as unknown as Record<string, unknown>,
      };
    }),
  );

  return uniquifyNames(entries);
};
