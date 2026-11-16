import { exportProjectAsBuml } from '../../shared/api/conversion';
import { ApiError } from '../../shared/api/api-client';
import { toast } from 'react-toastify';
import { reportError } from '../../shared/services/errors/reportError';
import i18n from '../../shared/i18n';
import { BesserProject, SupportedDiagramType } from '../../shared/types/project';
import { buildProjectPayloadForBackend } from '../../shared/utils/projectExportUtils';
import { ProjectStorageRepository } from '../../shared/services/storage/ProjectStorageRepository';
import { downloadFile } from '../../shared/utils/download';
import { loadProjectTrace } from '../../shared/traceability/traceStore';
import { downgradeTraceFile } from '../../shared/traceability/traceMigration';
import type { TraceFile } from '../../shared/types/traceability';
import type { ExportOutcome } from './exportOutcome';

/** The banner of the B-UML file's trace section (`TRACE_SECTION_KEYWORD` in the backend's `trace_model_builder.py`). */
const TRACE_SECTION_KEYWORD = 'TRACEABILITY';

/** The backend's refusal of a trace whose version it does not read (`trace_processor.py`). */
const UNSUPPORTED_TRACE_VERSION = /Unsupported trace schemaVersion/i;

/**
 * Export the project; when the backend refuses the trace's version (a backend one version behind the editor),
 * export again with the trace written in the version before, which the contract has every backend read.
 */
async function exportWithTrace(payload: Record<string, unknown>): Promise<{ blob: Blob; headers: Headers }> {
  try {
    return await exportProjectAsBuml(payload);
  } catch (error) {
    const trace = payload.trace as TraceFile | undefined;
    const refused = error instanceof ApiError && UNSUPPORTED_TRACE_VERSION.test(`${error.detail ?? ''} ${error.message}`);
    const older = refused && trace ? downgradeTraceFile(trace, trace.schemaVersion - 1) : undefined;
    if (!older) throw error;
    console.warn(`The backend does not read trace version ${trace!.schemaVersion}; exporting it as version ${older.schemaVersion}.`);
    return exportProjectAsBuml({ ...payload, trace: older });
  }
}

export async function exportProjectAsSingleBUMLFile(
  project: BesserProject,
  diagramTypes?: SupportedDiagramType[],
  includeTrace = false,
): Promise<ExportOutcome> {
  if (!project) {
    reportError(i18n.t('export.toasts.noProjectData'));
    return { ok: false, reason: 'no_model' };
  }

  // IMPORTANT: Always get fresh data from localStorage to ensure we have the latest changes
  const freshProject = ProjectStorageRepository.loadProject(project.id);
  const projectToUse = freshProject || project;

  console.log('[BUML Export] Using project data:', projectToUse.id);

  if (includeTrace) await loadProjectTrace(projectToUse.id);
  const projectToExport = buildProjectPayloadForBackend(projectToUse, diagramTypes, { includeTrace });

  try {
    const { blob, headers } = await exportWithTrace(projectToExport);
    const sentTrace = projectToExport.trace as TraceFile | undefined;
    if (sentTrace && sentTrace.artifacts.length > 0 && typeof blob.text === 'function' && !(await blob.text()).includes(TRACE_SECTION_KEYWORD)) {
      // An older backend without traceability ignores the field: the file is exported, without the trace.
      console.warn('The backend exported the project without its trace section.');
      toast.warn(i18n.t('traceability.toasts.exportedTraceDroppedByBackend'));
    }

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
