import { BACKEND_URL } from '../../shared/constants/constant';
import { toast } from 'react-toastify';
import i18n from '../../shared/i18n';
import { BesserProject, SupportedDiagramType } from '../../shared/types/project';
import { buildProjectPayloadForBackend } from '../../shared/utils/projectExportUtils';
import { ProjectStorageRepository } from '../../shared/services/storage/ProjectStorageRepository';
import { downloadFile } from '../../shared/utils/download';

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
): Promise<void> {
  if (!project) {
    toast.error(i18n.t('export.toasts.noProjectData'));
    return;
  }

  // IMPORTANT: Always get fresh data from localStorage to ensure we have the latest changes
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

    const filename = projectBumlFilename(projectToUse.name, response.headers.get('Content-Disposition'));

    downloadFile(blob, filename);

    toast.success(i18n.t('export.toasts.projectExportedAs', { filename }));
  } catch (error) {
    console.error('Error exporting project as BUML file:', error);
    toast.error(i18n.t('export.toasts.projectExportFailed', { error: error instanceof Error ? error.message : i18n.t('export.toasts.unknownError') }));
  }
}
