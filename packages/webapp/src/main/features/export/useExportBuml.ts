import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { BesserEditor, UMLModel } from '@besser/wme';
import { useFileDownload } from '../../shared/services/file-download/useFileDownload';
import { toast } from 'react-toastify';
import { reportError } from '../../shared/services/errors/reportError';
import { validateDiagram } from '../../shared/services/validation/validateDiagram';
import { exportBuml } from '../../shared/api/conversion';
import { ApiError } from '../../shared/api/api-client';
import { prepareAgentModelForBackend } from '../../shared/utils/projectExportUtils';
import type { ExportOutcome } from './exportOutcome';

/**
 * Download name for a diagram's B-UML export: the diagram's title (the
 * backend's generic `domain_model.py` would make every export look alike),
 * keeping the backend's file extension when it sends one.
 */
export const bumlExportFilename = (
  diagramTitle: string,
  modelType: string | undefined,
  contentDisposition: string | null,
): string => {
  const backendName = contentDisposition?.match(/filename="?([^";]+)"?/)?.[1]?.trim();
  const extension = backendName?.match(/\.[a-z0-9]+$/i)?.[0] ?? '.py';
  const base = diagramTitle.trim().toLowerCase().replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_') || 'exported_buml';
  return `${base}${modelType === 'ObjectDiagram' ? '_object' : ''}${extension}`;
};

export const useExportBUML = () => {
  const downloadFile = useFileDownload();
  const { t } = useTranslation();

  const exportBUML = useCallback(
    async (editor: BesserEditor, diagramTitle: string, referenceDiagramData?: UMLModel): Promise<ExportOutcome> => {
      const validationResult = await validateDiagram(editor, diagramTitle);
      if (!validationResult.isValid) {
        reportError(validationResult.message || t('export.toasts.validationFailed'));
        // `failure` is set when the validation request itself failed, not the model.
        const reason = validationResult.failure !== undefined ? 'request' : 'validation';
        return { ok: false, reason, error: validationResult.failure };
      }

      if (!editor || !editor.model) {
        reportError(t('export.toasts.noDiagramToExport'));
        return { ok: false, reason: 'no_model' };
      }

      try {
        const { blob, headers } = await exportBuml({
          title: diagramTitle,
          model: prepareAgentModelForBackend(editor.model),
          generator: 'buml',
          ...(referenceDiagramData ? { referenceDiagramData } : {}),
        });

        const filename = bumlExportFilename(diagramTitle, editor.model.type, headers.get('Content-Disposition'));

        downloadFile({ file: blob, filename });
        toast.success(t('export.toasts.bumlExportSuccess'));
        return { ok: true };
      } catch (error) {
        if (error instanceof ApiError && error.detail && (error.status === 400 || error.status === 500)) {
          reportError(error.detail);
          return { ok: false, reason: 'request', error };
        }
        const errorMessage =
          error instanceof ApiError
            ? `HTTP error! status: ${error.status}`
            : error instanceof Error
              ? error.message
              : t('export.toasts.unknownError');
        reportError(errorMessage, { error });
        return { ok: false, reason: 'request', error };
      }
    },
    [downloadFile, t],
  );

  return exportBUML;
};
