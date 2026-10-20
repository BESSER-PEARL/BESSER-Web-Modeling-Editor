import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { BesserEditor, UMLModel } from '@besser/wme';
import { useFileDownload } from '../../shared/services/file-download/useFileDownload';
import { toast } from 'react-toastify';
import { validateDiagram } from '../../shared/services/validation/validateDiagram';
import { BACKEND_URL } from '../../shared/constants/constant';
import { prepareAgentModelForBackend } from '../../shared/utils/projectExportUtils';

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
    async (editor: BesserEditor, diagramTitle: string, referenceDiagramData?: UMLModel) => {
      const validationResult = await validateDiagram(editor, diagramTitle);
      if (!validationResult.isValid) {
        toast.error(validationResult.message || t('export.toasts.validationFailed'));
        return;
      }

      if (!editor || !editor.model) {
        toast.error(t('export.toasts.noDiagramToExport'));
        return;
      }

      try {
        const response = await fetch(`${BACKEND_URL}/export-buml`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/plain, application/zip, */*',
          },
          body: JSON.stringify({
            title: diagramTitle,
            model: prepareAgentModelForBackend(editor.model),
            generator: 'buml',
            ...(referenceDiagramData ? { referenceDiagramData } : {}),
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ detail: t('export.toasts.couldNotParseError') }));

          if ((response.status === 400 || response.status === 500) && errorData.detail) {
            toast.error(errorData.detail);
            return;
          }

          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const blob = await response.blob();

        const filename = bumlExportFilename(
          diagramTitle,
          editor.model.type,
          response.headers.get('Content-Disposition'),
        );

        downloadFile({ file: blob, filename });
        toast.success(t('export.toasts.bumlExportSuccess'));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : t('export.toasts.unknownError');
        toast.error(errorMessage);
      }
    },
    [downloadFile, t],
  );

  return exportBUML;
};
