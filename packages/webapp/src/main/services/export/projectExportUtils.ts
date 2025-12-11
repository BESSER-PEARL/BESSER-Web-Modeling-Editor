import { BesserProject, ProjectDiagram, SupportedDiagramType } from '../../types/project';

export type ExportableProjectPayload = Omit<BesserProject, 'diagrams'> & {
  diagrams: Record<string, ProjectDiagram>;
};

export const buildExportableProjectPayload = (
  project: BesserProject,
  selectedDiagramTypes?: SupportedDiagramType[]
): ExportableProjectPayload => {
  const projectClone = JSON.parse(JSON.stringify(project)) as ExportableProjectPayload;

  if (!selectedDiagramTypes || selectedDiagramTypes.length === 0) {
    return projectClone;
  }

  const filteredDiagrams: Record<string, ProjectDiagram> = {};

  selectedDiagramTypes.forEach((diagramType) => {
    const diagram = projectClone.diagrams[diagramType];
    if (diagram) {
      filteredDiagrams[diagramType] = diagram;
    }
  });

  projectClone.diagrams = filteredDiagrams;

  return projectClone;
};
