import { exportProjectAsBuml } from '../../shared/api/conversion';
import { ApiError } from '../../shared/api/api-client';
import { toast } from 'react-toastify';
import { reportError } from '../../shared/services/errors/reportError';
import i18n from '../../shared/i18n';
import { BesserProject, SupportedDiagramType } from '../../shared/types/project';
import { buildProjectPayloadForBackend } from '../../shared/utils/projectExportUtils';
import { ProjectStorageRepository } from '../../shared/services/storage/ProjectStorageRepository';
import { downloadFile } from '../../shared/utils/download';

export async function exportProjectAsSingleBUMLFile(
  project: BesserProject,
  diagramTypes?: SupportedDiagramType[]
): Promise<void> {
  if (!project) {
    reportError(i18n.t('export.toasts.noProjectData'));
    return;
  }

  // IMPORTANT: Always get fresh data from localStorage to ensure we have the latest changes
  const freshProject = ProjectStorageRepository.loadProject(project.id);
  const projectToUse = freshProject || project;

  console.log('[BUML Export] Using project data:', projectToUse.id);

  const projectToExport = buildProjectPayloadForBackend(projectToUse, diagramTypes);

  try {
    const { blob, headers } = await exportProjectAsBuml(projectToExport);

    // Get the filename from the response headers
    const contentDisposition = headers.get('Content-Disposition');
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

    toast.success(i18n.t('export.toasts.projectExportedAs', { filename }));
  } catch (error) {
    console.error('Error exporting project as BUML file:', error);
    const message =
      error instanceof ApiError
        ? `HTTP error! status: ${error.status} - ${error.message}`
        : error instanceof Error
          ? error.message
          : i18n.t('export.toasts.unknownError');
    reportError(i18n.t('export.toasts.projectExportFailed', { error: message }), { error });
  }
}
