import { UMLDiagramType, type UMLModel } from '@besser/wme';
import type { ProjectDiagram } from '../../types/project';
import { isUMLModel } from '../../types/project';
import { LocalStorageRepository } from '../storage/local-storage-repository';
import { ProjectStorageRepository } from '../storage/ProjectStorageRepository';

/**
 * A snapshot of a personalized agent diagram, produced when a user saves an
 * agent configuration against a specific user profile. Variants are persisted
 * inline on the agent diagram (`diagram.config.personalizedVariants`) — not in
 * a global localStorage key — so they travel with the project.
 */
export interface AgentModelVariantSnapshot {
  id: string;
  profileId: string;
  profileName: string;
  configurationId: string;
  configurationName: string;
  createdAt: string;
  model: UMLModel;
}

const PERSONALIZED_VARIANTS_FIELD = 'personalizedVariants';
const ACTIVE_VARIANT_ID_FIELD = 'activePersonalizedVariantId';

const isAgentVariantSnapshot = (entry: unknown): entry is AgentModelVariantSnapshot => {
  if (!entry || typeof entry !== 'object') return false;
  const candidate = entry as Partial<AgentModelVariantSnapshot>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.profileId === 'string' &&
    typeof candidate.profileName === 'string' &&
    typeof candidate.configurationId === 'string' &&
    typeof candidate.configurationName === 'string' &&
    typeof candidate.createdAt === 'string' &&
    isUMLModel(candidate.model) &&
    candidate.model.type === UMLDiagramType.AgentDiagram
  );
};

/** Read the personalized agent variants stored on a diagram. */
export const readAgentVariants = (
  diagram: ProjectDiagram | null | undefined,
): AgentModelVariantSnapshot[] => {
  const raw = (diagram?.config as Record<string, unknown> | undefined)?.[PERSONALIZED_VARIANTS_FIELD];
  if (!Array.isArray(raw)) return [];
  return raw.filter(isAgentVariantSnapshot);
};

/** Currently selected variant id on the diagram (null when no variant is active). */
export const getActiveAgentVariantId = (
  diagram: ProjectDiagram | null | undefined,
): string | null => {
  const raw = (diagram?.config as Record<string, unknown> | undefined)?.[ACTIVE_VARIANT_ID_FIELD];
  return typeof raw === 'string' && raw ? raw : null;
};

/**
 * Replace any existing variant for the same user profile with the new one.
 * A user profile maps to exactly one agent variant — re-saving for the same
 * profile (even under a different configuration) supersedes the previous one.
 */
export const upsertVariantForProfile = (
  variants: AgentModelVariantSnapshot[],
  nextVariant: AgentModelVariantSnapshot,
): AgentModelVariantSnapshot[] => [
  ...variants.filter((variant) => variant.profileId !== nextVariant.profileId),
  nextVariant,
];

/** Pure transform: drop every variant tied to the given configuration id. */
export const pruneVariantsForConfiguration = (
  variants: AgentModelVariantSnapshot[],
  configurationId: string,
): AgentModelVariantSnapshot[] =>
  variants.filter((variant) => variant.configurationId !== configurationId);

/**
 * Strip every variant tied to a deleted configuration across all agent
 * diagrams in a project, persisting via {@link ProjectStorageRepository}.
 *
 * When the deleted configuration was the active variant on a diagram, the
 * active pointer is cleared and the diagram's base model is restored so the
 * editor doesn't keep rendering an orphaned personalized state.
 *
 * Returns true when at least one diagram was modified — callers typically
 * follow up with a Redux refresh + editor revision bump.
 */
export const removeConfigurationVariantsFromProject = (
  projectId: string,
  configurationId: string,
): boolean => {
  const project = ProjectStorageRepository.loadProject(projectId);
  if (!project) return false;

  const agentDiagrams = project.diagrams.AgentDiagram ?? [];
  let didTouchDiagram = false;

  agentDiagrams.forEach((agentDiagram, index) => {
    const variants = readAgentVariants(agentDiagram);
    const remainingVariants = pruneVariantsForConfiguration(variants, configurationId);
    if (remainingVariants.length === variants.length) return;

    const configRecord = (agentDiagram.config ?? {}) as Record<string, unknown>;
    const activeVariantId = getActiveAgentVariantId(agentDiagram);
    const activeVariantRemoved =
      !!activeVariantId && !remainingVariants.some((variant) => variant.id === activeVariantId);

    const nextConfig: Record<string, unknown> = {
      ...configRecord,
      [PERSONALIZED_VARIANTS_FIELD]: remainingVariants,
    };
    if (activeVariantRemoved) {
      nextConfig[ACTIVE_VARIANT_ID_FIELD] = null;
    }

    const baseModel = activeVariantRemoved
      ? LocalStorageRepository.getAgentBaseModel(agentDiagram.id)
      : null;

    const success = ProjectStorageRepository.updateDiagram(
      project.id,
      'AgentDiagram',
      {
        ...agentDiagram,
        ...(baseModel ? { model: structuredClone(baseModel) } : {}),
        config: nextConfig,
      },
      index,
    );
    if (success) didTouchDiagram = true;
  });

  return didTouchDiagram;
};
