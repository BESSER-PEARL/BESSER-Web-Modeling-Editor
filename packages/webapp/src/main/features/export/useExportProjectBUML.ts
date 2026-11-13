import { exportProjectAsBuml } from '../../shared/api/conversion';
import { ApiError } from '../../shared/api/api-client';
import { toast } from 'react-toastify';
import { reportError } from '../../shared/services/errors/reportError';
import i18n from '../../shared/i18n';
import { BesserProject, SupportedDiagramType } from '../../shared/types/project';
import { buildProjectPayloadForBackend } from '../../shared/utils/projectExportUtils';
import { ProjectStorageRepository } from '../../shared/services/storage/ProjectStorageRepository';
import { downloadFile } from '../../shared/utils/download';
import type { ExportOutcome } from './exportOutcome';

/**
 * Download name for the project B-UML export: the project's name with the
 * backend file's extension. The backend's own name is the generic
 * "project.py", so prefixing it produced "new_project_project.py".
 */
export function projectBumlFilename(projectName: string, contentDisposition: string | null): string {
  const backendName = contentDisposition?.match(/filename="?([^";]+)"?/)?.[1]?.trim();
  const extension = backendName?.match(/\.[a-z0-9]+$/i)?.[0] ?? '.py';
  const base = projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'project';
  return `${base}${extension}`;
}

export async function exportProjectAsSingleBUMLFile(
  project: BesserProject,
  diagramTypes?: SupportedDiagramType[]
): Promise<ExportOutcome> {
  if (!project) {
    reportError(i18n.t('export.toasts.noProjectData'));
    return { ok: false, reason: 'no_model' };
  }

  // IMPORTANT: Always get fresh data from localStorage to ensure we have the latest changes
  const freshProject = ProjectStorageRepository.loadProject(project.id);
  const projectToUse = freshProject || project;

  console.log('[BUML Export] Using project data:', projectToUse.id);

  const projectToExport = buildProjectPayloadForBackend(projectToUse, diagramTypes);

  try {
    const { blob, headers } = await exportProjectAsBuml(projectToExport);

    const filename = projectBumlFilename(projectToUse.name, headers.get('Content-Disposition'));

    downloadFile(blob, filename);

    toast.success(i18n.t('export.toasts.projectExportedAs', { filename }));
    return { ok: true };
  } catch (error) {
    console.error('Error exporting project as BUML file:', error);
    const message =
      error instanceof ApiError
        ? `HTTP error! status: ${error.status} - ${error.message}`
        : error instanceof Error
          ? error.message
          : i18n.t('export.toasts.unknownError');
    reportError(i18n.t('export.toasts.projectExportFailed', { error: message }), { error });
    return { ok: false, reason: 'request', error };
  }
}
