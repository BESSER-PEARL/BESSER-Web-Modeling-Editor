import { UMLModel, UMLModelComponent, normalizeAgentComponents, normalizeAgentModel } from '@besser/wme';
import { BesserProject, ProjectDiagram, SupportedDiagramType, getActiveDiagram, diagramHasContent, isUMLModel } from '../types/project';
import { LocalStorageRepository } from '../services/storage/local-storage-repository';
import { ProjectStorageRepository } from '../services/storage/ProjectStorageRepository';
import {
  StoredAgentConfiguration,
  StoredAgentProfileConfigurationMapping,
  StoredUserProfile,
} from '../services/storage/local-storage-types';
import { normalizeProjectName } from './projectName';

export const PROJECT_EXPORT_VERSION = '2.0.0';

export type ExportableProjectPayload = Omit<BesserProject, 'diagrams'> & {
  diagrams: Record<string, ProjectDiagram[]>;
};

/** Filter a cloned payload without changing active or legacy referenced models. */
const filterProjectDiagrams = (
  payload: ExportableProjectPayload,
  selectedDiagramTypes?: SupportedDiagramType[],
): ExportableProjectPayload => {
  const originalDiagrams = payload.diagrams;
  const filtered: Record<string, ProjectDiagram[]> = {};
  const indices = { ...payload.currentDiagramIndices };

  for (const [type, diagrams] of Object.entries(originalDiagrams)) {
    const diagramType = type as SupportedDiagramType;
    const arr = Array.isArray(diagrams) ? diagrams : [];
    const active = arr[indices[diagramType] ?? 0] ?? arr[0];
    indices[diagramType] = 0;
    if (selectedDiagramTypes?.length && !selectedDiagramTypes.includes(diagramType)) continue;
    const withContent = arr.filter(diagramHasContent);
    if (!withContent.length) continue;
    filtered[type] = withContent;
    // Filtering [empty, A, B] must not turn active index 1 (A) into B.
    // If the active diagram itself was empty, select the first retained one.
    indices[diagramType] = Math.max(0, withContent.indexOf(active));
  }

  for (const diagrams of Object.values(filtered)) {
    for (const diagram of diagrams) {
      if (!diagram.references) continue;
      // Older imported projects can still contain numeric references despite
      // the current string-ID type. Resolve them against the ORIGINAL arrays.
      for (const [type, reference] of Object.entries(diagram.references)) {
        if (typeof reference !== 'number' || !Number.isInteger(reference) || reference < 0) continue;
        const referenced = originalDiagrams[type]?.[reference];
        if (referenced?.id) diagram.references[type as SupportedDiagramType] = referenced.id;
      }
    }
  }

  payload.diagrams = filtered;
  payload.currentDiagramIndices = indices;
  return payload;
};

/**
 * A ProjectDiagram saved by an early build of the agent components panel, which kept the
 * components on the diagram itself instead of in `model.components`.
 */
type LegacyAgentProjectDiagram = ProjectDiagram & { agentComponents?: { [id: string]: UMLModelComponent } };

/**
 * The single place where an AgentDiagram model is prepared to leave the editor — code
 * generation, local deploy, validation, project export and simulation all go through it.
 *
 * - When the outgoing model carries no `components` (e.g. a canvas snapshot), the stored
 *   diagram's `model.components` are attached, or its legacy diagram-level `agentComponents`.
 * - {@link normalizeAgentComponents} then folds every legacy location into `model.components`.
 * - {@link normalizeAgentModel} upgrades transitions to the canonical nested shape.
 *
 * @param diagram The stored diagram the model belongs to. Defaults to the active AgentDiagram
 *   of the current project in storage.
 */
export function prepareAgentModelForBackend(model: UMLModel, diagram?: ProjectDiagram | null): UMLModel {
  if (!model || model.type !== 'AgentDiagram') return model;
  return normalizeAgentModel(normalizeAgentComponents(withStoredAgentComponents(model, diagram)));
}

/**
 * Read the agent components of a stored AgentDiagram (normalized, keyed by id). Used by the
 * agent components panel and the diagram bridge so both see exactly what the backend receives.
 */
export function getAgentComponents(diagram: ProjectDiagram | null | undefined): { [id: string]: UMLModelComponent } {
  return normalizeStoredAgentModel(diagram)?.components ?? {};
}

/**
 * The stored model of an AgentDiagram with every legacy component location (canvas elements,
 * `model.agentComponents`, diagram-level `agentComponents`) folded into `model.components`.
 */
export function normalizeStoredAgentModel(diagram: ProjectDiagram | null | undefined): UMLModel | undefined {
  if (!diagram || !isUMLModel(diagram.model)) return undefined;
  return normalizeAgentComponents(withStoredAgentComponents(diagram.model, diagram));
}

function withStoredAgentComponents(model: UMLModel, diagram?: ProjectDiagram | null): UMLModel {
  if (model.components || model.agentComponents) return model;
  const source = diagram === undefined ? getCurrentAgentDiagram() : diagram;
  if (!source) return model;
  if (isUMLModel(source.model) && source.model.components) {
    return { ...model, components: source.model.components };
  }
  const legacy = (source as LegacyAgentProjectDiagram).agentComponents;
  return legacy ? { ...model, agentComponents: legacy } : model;
}

function getCurrentAgentDiagram(): ProjectDiagram | null {
  const project = ProjectStorageRepository.getCurrentProject();
  return project ? getActiveDiagram(project, 'AgentDiagram') ?? null : null;
}

/**
 * @internal
 * Build the inner project payload for the V2 export envelope. Prefer
 * {@link buildProjectExportEnvelope} at call sites — this helper is exported
 * only so the envelope builder and its unit tests can reach it.
 */
export const buildExportableProjectPayload = (
  project: BesserProject,
  selectedDiagramTypes?: SupportedDiagramType[]
): ExportableProjectPayload => {
  const projectClone = structuredClone(project) as ExportableProjectPayload;
  projectClone.name = normalizeProjectName(projectClone.name || 'project');

  return filterProjectDiagrams(projectClone, selectedDiagramTypes);
};

/**
 * Build a project payload for backend API endpoints.
 * Sends full diagram arrays (not flattened) so the backend has all diagrams.
 * The backend uses currentDiagramIndices to pick the active diagram per type.
 *
 * @param selectedDiagramTypes  Optional filter – only include these diagram types.
 */
export const buildProjectPayloadForBackend = (
  project: BesserProject,
  selectedDiagramTypes?: SupportedDiagramType[],
): Record<string, unknown> => {
  const payload = buildExportableProjectPayload(project, selectedDiagramTypes);

  const agentDiagrams = payload.diagrams.AgentDiagram;
  if (Array.isArray(agentDiagrams)) {
    payload.diagrams.AgentDiagram = agentDiagrams.map((diagram) =>
      isUMLModel(diagram.model) ? { ...diagram, model: prepareAgentModelForBackend(diagram.model, diagram) } : diagram,
    );
  }

  return payload;
};

/**
 * Canonical V2 project-export envelope. The shape is shared by:
 *   - "Export Project" JSON download (useExportProjectJSON)
 *   - "Project preview" dialog (useProjectPreview)
 *   - Assistant-driven exports (WorkspaceShell)
 *   - GitHub deploy payload (useGitHubRepo) — backend writes it as diagrams.json
 *
 * Anything that needs the V2 envelope MUST go through buildProjectExportEnvelope
 * so the four sites stay in sync.
 */
export interface ProjectExportEnvelope {
  project: ExportableProjectPayload;
  exportedAt: string;
  version: string;
  /**
   * Optional bundled personalization state. Lives in localStorage at runtime
   * (besser_agentConfigs, besser_userProfiles, besser_agentProfileMappings,
   * besser_agentBaseModels, besser_agentActiveConfig) — bundled here so an
   * imported project can restore the user's saved configurations and profile
   * mappings rather than landing with an empty Personalization tab.
   */
  agentConfigurations?: StoredAgentConfiguration[];
  userProfiles?: StoredUserProfile[];
  agentProfileMappings?: StoredAgentProfileConfigurationMapping[];
  activeAgentConfigurationId?: string | null;
  agentBaseModels?: Record<string, UMLModel>;
}

export interface BuildProjectExportEnvelopeOptions {
  /**
   * Bundle saved configurations / user profiles / mappings / base agent
   * models into the envelope. Default: ``true``. Set to ``false`` for paths
   * that publish the envelope to a third party (e.g. GitHub deploy) so user
   * profiles don't end up in a public repo.
   */
  includePersonalization?: boolean;
}

/** Build a V2 project-export envelope (project + exportedAt + version). */
export function buildProjectExportEnvelope(
  project: BesserProject,
  diagramTypes?: SupportedDiagramType[],
  options: BuildProjectExportEnvelopeOptions = {},
): ProjectExportEnvelope {
  const includePersonalization = options.includePersonalization !== false;

  const envelope: ProjectExportEnvelope = {
    project: buildExportableProjectPayload(project, diagramTypes),
    exportedAt: new Date().toISOString(),
    version: PROJECT_EXPORT_VERSION,
  };

  if (includePersonalization) {
    const agentConfigurations = LocalStorageRepository.getAgentConfigurations();
    const userProfiles = LocalStorageRepository.getUserProfiles();
    const agentProfileMappings = LocalStorageRepository.getAgentProfileConfigurationMappings();
    const activeAgentConfigurationId = LocalStorageRepository.getActiveAgentConfigurationId();
    const agentBaseModels = LocalStorageRepository.getAllAgentBaseModels();

    if (agentConfigurations.length > 0) envelope.agentConfigurations = agentConfigurations;
    if (userProfiles.length > 0) envelope.userProfiles = userProfiles;
    if (agentProfileMappings.length > 0) envelope.agentProfileMappings = agentProfileMappings;
    if (activeAgentConfigurationId) envelope.activeAgentConfigurationId = activeAgentConfigurationId;
    if (Object.keys(agentBaseModels).length > 0) envelope.agentBaseModels = agentBaseModels;
  }

  return envelope;
}
