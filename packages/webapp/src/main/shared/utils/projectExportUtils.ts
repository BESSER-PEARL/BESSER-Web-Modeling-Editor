import { BesserProject, ProjectDiagram, SupportedDiagramType, getActiveDiagram, diagramHasContent } from '../types/project';
import { normalizeProjectName } from './projectName';

export const PROJECT_EXPORT_VERSION = '2.0.0';

export type ExportableProjectPayload = Omit<BesserProject, 'diagrams'> & {
  diagrams: Record<string, ProjectDiagram[]>;
};

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

  // Filter out empty diagrams from each type, then remove types with no content
  const filtered: Record<string, ProjectDiagram[]> = {};
  for (const [type, diagrams] of Object.entries(projectClone.diagrams)) {
    if (selectedDiagramTypes && selectedDiagramTypes.length > 0 && !selectedDiagramTypes.includes(type as SupportedDiagramType)) {
      continue;
    }
    const arr = Array.isArray(diagrams) ? diagrams : [];
    const withContent = (arr as ProjectDiagram[]).filter(diagramHasContent);
    if (withContent.length > 0) {
      filtered[type] = withContent;
    }
  }

  projectClone.diagrams = filtered;

  return projectClone;
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
  const payload = structuredClone(project);
  payload.name = normalizeProjectName(payload.name || 'project');

  // Filter out empty diagrams, then remove types with no content
  const diagrams: Record<string, ProjectDiagram[]> = {};
  for (const type of Object.keys(payload.diagrams)) {
    const arr = payload.diagrams[type];
    if (Array.isArray(arr)) {
      const withContent = arr.filter(diagramHasContent);
      if (withContent.length > 0) {
        diagrams[type] = withContent;
      }
    }
  }

  // Optionally filter to only the requested diagram types
  if (selectedDiagramTypes && selectedDiagramTypes.length > 0) {
    const filtered: Record<string, ProjectDiagram[]> = {};
    for (const type of selectedDiagramTypes) {
      if (diagrams[type]) {
        filtered[type] = diagrams[type];
      }
    }
    payload.diagrams = filtered;
  } else {
    payload.diagrams = diagrams;
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
}

/** Build a V2 project-export envelope (project + exportedAt + version). */
export function buildProjectExportEnvelope(
  project: BesserProject,
  diagramTypes?: SupportedDiagramType[],
): ProjectExportEnvelope {
  return {
    project: buildExportableProjectPayload(project, diagramTypes),
    exportedAt: new Date().toISOString(),
    version: PROJECT_EXPORT_VERSION,
  };
}
