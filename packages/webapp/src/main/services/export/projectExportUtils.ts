import { UMLModel } from '@besser/wme';
import { BesserProject, ProjectDiagram, SupportedDiagramType } from '../../types/project';

export type ExportedUserDiagramEntry = {
  id: string;
  savedAt: string;
  model: UMLModel;
};

export type ProjectUserDiagramMap = Record<string, ExportedUserDiagramEntry>;

export type ExportableProjectPayload = Omit<BesserProject, 'diagrams'> & {
  diagrams: Record<string, ProjectDiagram>;
  UserDiagrams?: ProjectUserDiagramMap;
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
