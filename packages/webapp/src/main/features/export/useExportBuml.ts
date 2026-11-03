import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ApollonEditor, UMLModel } from '@besser/wme';
import { useFileDownload } from '../../shared/services/file-download/useFileDownload';
import { toast } from 'react-toastify';
import { reportError } from '../../shared/services/errors/reportError';
import { validateDiagram } from '../../shared/services/validation/validateDiagram';
import { exportBuml } from '../../shared/api/conversion';
import { ApiError } from '../../shared/api/api-client';
import { prepareAgentModelForBackend } from '../../shared/utils/projectExportUtils';

export const useExportBUML = () => {
  const downloadFile = useFileDownload();
  const { t } = useTranslation();

  const exportBUML = useCallback(
    async (editor: ApollonEditor, diagramTitle: string, referenceDiagramData?: UMLModel) => {
      const validationResult = await validateDiagram(editor, diagramTitle);
      if (!validationResult.isValid) {
        reportError(validationResult.message || t('export.toasts.validationFailed'));
        return;
      }

      if (!editor || !editor.model) {
        reportError(t('export.toasts.noDiagramToExport'));
        return;
      }

      try {
        const { blob, headers } = await exportBuml({
          title: diagramTitle,
          model: prepareAgentModelForBackend(editor.model),
          generator: 'buml',
          ...(referenceDiagramData ? { referenceDiagramData } : {}),
        });

        const contentDisposition = headers.get('Content-Disposition');
        let filename = 'exported_buml.py';

        if (contentDisposition) {
          const patterns = [/filename="([^"]+)"/, /filename=([^;\s]+)/, /filename="?([^";\s]+)"?/];
          for (const pattern of patterns) {
            const match = contentDisposition.match(pattern);
            if (match) {
              filename = match[1];
              break;
            }
          }
        } else {
          if (editor.model.type === 'ObjectDiagram') {
            filename = `${diagramTitle.toLowerCase().replace(/\s+/g, '_')}_object.py`;
          } else {
            filename = `${diagramTitle.toLowerCase().replace(/\s+/g, '_')}.py`;
          }
        }

        downloadFile({ file: blob, filename });
        toast.success(t('export.toasts.bumlExportSuccess'));
      } catch (error) {
        if (error instanceof ApiError && error.detail && (error.status === 400 || error.status === 500)) {
          reportError(error.detail);
          return;
        }
        const errorMessage =
          error instanceof ApiError
            ? `HTTP error! status: ${error.status}`
            : error instanceof Error
              ? error.message
              : t('export.toasts.unknownError');
        reportError(errorMessage, { error });
      }
    },
    [downloadFile, t],
  );

  return exportBUML;
};
