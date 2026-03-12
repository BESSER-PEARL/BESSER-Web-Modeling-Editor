import { BACKEND_URL } from '../../constant';
import { toast } from 'react-toastify';
import { BesserProject, SupportedDiagramType } from '../../types/project';
import { buildProjectPayloadForBackend } from './projectExportUtils';
import { ProjectStorageRepository } from '../storage/ProjectStorageRepository';
import { downloadFile } from '../../utils/download';

export async function exportProjectAsSingleBUMLFile(
  project: BesserProject,
  diagramTypes?: SupportedDiagramType[]
): Promise<void> {
  if (!project) {
    toast.error('No project data available to export');
    return;
  }

  // IMPORTANT: Always get fresh data from localStorage to ensure we have the latest changes
  //   const projectPayload = buildExportableProjectPayload(project, diagramTypes);
  const freshProject = ProjectStorageRepository.loadProject(project.id);
  const projectToUse = freshProject || project;

  console.log('[BUML Export] Using project data:', projectToUse.id);

  const projectToExport = buildProjectPayloadForBackend(projectToUse, diagramTypes);

  try {
    const response = await fetch(`${BACKEND_URL}/export-project-as-buml`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(projectToExport),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend error:', errorText);
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }

    const blob = await response.blob();

    // Get the filename from the response headers
    const contentDisposition = response.headers.get('Content-Disposition');
    const normalizedProjectName = projectToUse.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    let filename = `${normalizedProjectName}_besser.py`; // Default filename

    if (contentDisposition) {
      // Try multiple patterns to extract filename
      const patterns = [
        /filename="([^"]+)"/,
        /filename=([^;\s]+)/,
        /filename="?([^";\s]+)"?/
      ];
      for (const pattern of patterns) {
        const match = contentDisposition.match(pattern);
        if (match) {
          filename = `${normalizedProjectName}_${match[1]}`;
          break;
        }
      }
    }

    downloadFile(blob, filename);

    toast.success(`Project exported as ${filename}`);
  } catch (error) {
    console.error('Error exporting project as BUML file:', error);
    toast.error(`Failed to export project: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
