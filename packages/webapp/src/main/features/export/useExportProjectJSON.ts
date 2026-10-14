import { BesserProject, SupportedDiagramType } from '../../shared/types/project';
import { buildProjectExportEnvelope } from '../../shared/utils/projectExportUtils';
import { ProjectStorageRepository } from '../../shared/services/storage/ProjectStorageRepository';
import { downloadJson } from '../../shared/utils/download';
import { loadBesserVersion } from '../../shared/services/besserVersion';

// Export project as a single JSON file
export async function exportProjectAsJson(
  project: BesserProject,
  diagramTypes?: SupportedDiagramType[]
) {
  await loadBesserVersion();


  const freshProject = ProjectStorageRepository.loadProject(project.id);
  const projectToExport = freshProject || project;

  console.log('[Export] Using project data:', projectToExport.id);

  const exportData = buildProjectExportEnvelope(projectToExport, diagramTypes);

  const filename = `${projectToExport.name.replace(/[^a-z0-9]/gi, '_') || 'project'}.json`;
  downloadJson(exportData, filename);
}

// Main export function - directly exports the current project as JSON
export async function exportProjectById(
  project: BesserProject,
  diagramTypes?: SupportedDiagramType[]
) {
  await exportProjectAsJson(project, diagramTypes);
}
