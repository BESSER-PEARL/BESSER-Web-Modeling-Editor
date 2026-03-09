import { useCallback } from 'react';
import { ApollonEditor } from '@besser/wme';
import { useFileDownload } from '../file-download/useFileDownload';
import { toast } from 'react-toastify';
import { validateDiagram } from '../validation/validateDiagram';
import { BACKEND_URL } from '../../constant';

export const useExportBUML = () => {
  const downloadFile = useFileDownload();

  const exportBUML = useCallback(
    async (editor: ApollonEditor, diagramTitle: string) => {
      const validationResult = await validateDiagram(editor, diagramTitle);
      if (!validationResult.isValid) {
        toast.error(validationResult.message || 'Validation failed');
        return;
      }

      if (!editor || !editor.model) {
        toast.error('No diagram to export');
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
            elements: editor.model,
            generator: 'buml',
            diagramTitle: diagramTitle,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ detail: 'Could not parse error response' }));

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
        toast.success('BUML export completed successfully');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        toast.error(errorMessage);
      }
    },
    [downloadFile],
  );

  return exportBUML;
};
