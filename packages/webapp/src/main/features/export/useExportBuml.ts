import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ApollonEditor, UMLModel } from '@besser/wme';
import { useFileDownload } from '../../shared/services/file-download/useFileDownload';
import { toast } from 'react-toastify';
import { validateDiagram } from '../../shared/services/validation/validateDiagram';
import { BACKEND_URL } from '../../shared/constants/constant';

export const useExportBUML = () => {
  const downloadFile = useFileDownload();
  const { t } = useTranslation();

  const exportBUML = useCallback(
    async (editor: ApollonEditor, diagramTitle: string, referenceDiagramData?: UMLModel) => {
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
            model: editor.model,
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

        const contentDisposition = response.headers.get('Content-Disposition');
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
        const errorMessage = error instanceof Error ? error.message : t('export.toasts.unknownError');
        toast.error(errorMessage);
      }
    },
    [downloadFile, t],
  );

  return exportBUML;
};
