import { BesserProject, ProjectDiagram, SupportedDiagramType, getActiveDiagram, diagramHasContent } from '../../types/project';
import { normalizeProjectName } from '../../utils/projectName';

export type ExportableProjectPayload = Omit<BesserProject, 'diagrams'> & {
  diagrams: Record<string, ProjectDiagram[]>;
};

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
    const withContent = (diagrams as ProjectDiagram[]).filter(diagramHasContent);
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

  // Filter to only non-empty diagram types
  const diagrams: Record<string, ProjectDiagram[]> = {};
  for (const type of Object.keys(payload.diagrams)) {
    const arr = payload.diagrams[type];
    if (Array.isArray(arr) && arr.length > 0) {
      diagrams[type] = arr;
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

/** @deprecated Use buildProjectPayloadForBackend instead. */
export const flattenProjectForBackend = buildProjectPayloadForBackend;
