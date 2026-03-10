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
 * Flatten project diagram arrays to single diagrams (active one per type).
 * Used at the API boundary when the backend expects single diagrams per type.
 *
 * @param selectedDiagramTypes  Optional filter – only include these diagram types.
 */
export const flattenProjectForBackend = (
  project: BesserProject,
  selectedDiagramTypes?: SupportedDiagramType[],
): any => {
  const flat = JSON.parse(JSON.stringify(project));
  flat.name = normalizeProjectName(flat.name || 'project');

  for (const type of Object.keys(flat.diagrams)) {
    const diagrams = flat.diagrams[type];
    if (Array.isArray(diagrams)) {
      const index = flat.currentDiagramIndices?.[type] ?? 0;
      flat.diagrams[type] = diagrams[index] ?? diagrams[0];
    }
  }

  // Optionally filter to only the requested diagram types
  if (selectedDiagramTypes && selectedDiagramTypes.length > 0) {
    const filtered: Record<string, any> = {};
    for (const type of selectedDiagramTypes) {
      if (flat.diagrams[type]) {
        filtered[type] = flat.diagrams[type];
      }
    }
    flat.diagrams = filtered;
  }

  return flat;
};
