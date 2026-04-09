import { BesserProject, SupportedDiagramType } from '../../shared/types/project';
import { buildExportableProjectPayload } from './utils/projectExportUtils';
import { ProjectStorageRepository } from '../../shared/services/storage/ProjectStorageRepository';
import { downloadJson } from '../../shared/utils/download';

// Export project as a single JSON file
export function exportProjectAsJson(
  project: BesserProject,
  diagramTypes?: SupportedDiagramType[]
) {


  const freshProject = ProjectStorageRepository.loadProject(project.id);
  const projectToExport = freshProject || project;

  console.log('[Export] Using project data:', projectToExport.id);

  const projectPayload = buildExportableProjectPayload(projectToExport, diagramTypes);

  const exportData = {
    project: projectPayload,
    exportedAt: new Date().toISOString(),
    version: '2.0.0' // Updated version for V2 format
  };

  const filename = `${projectToExport.name.replace(/[^a-z0-9]/gi, '_') || 'project'}.json`;
  downloadJson(exportData, filename);
}

// Main export function - directly exports the current project as JSON
export function exportProjectById(
  project: BesserProject,
  diagramTypes?: SupportedDiagramType[]
) {
  exportProjectAsJson(project, diagramTypes);
}
