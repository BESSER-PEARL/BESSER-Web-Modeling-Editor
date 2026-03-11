import { BesserProject, ProjectDiagram, SupportedDiagramType, getActiveDiagram } from '../../types/project';
import { normalizeProjectName } from '../../utils/projectName';

export type ExportableProjectPayload = Omit<BesserProject, 'diagrams'> & {
  diagrams: Record<string, ProjectDiagram[]>;
};

export const buildExportableProjectPayload = (
  project: BesserProject,
  selectedDiagramTypes?: SupportedDiagramType[]
): ExportableProjectPayload => {
  const projectClone = JSON.parse(JSON.stringify(project)) as ExportableProjectPayload;
  projectClone.name = normalizeProjectName(projectClone.name || 'project');

  if (!selectedDiagramTypes || selectedDiagramTypes.length === 0) {
    return projectClone;
  }

  const filteredDiagrams: Record<string, ProjectDiagram[]> = {};

  selectedDiagramTypes.forEach((diagramType) => {
    const diagrams = projectClone.diagrams[diagramType];
    if (diagrams) {
      filteredDiagrams[diagramType] = diagrams;
    }
  });

  projectClone.diagrams = filteredDiagrams;

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
  const payload = JSON.parse(JSON.stringify(project));
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
