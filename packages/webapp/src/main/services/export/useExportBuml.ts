import { useCallback } from 'react';
import { ApollonEditor, diagramBridge, UMLDiagramType } from '@besser/wme';
import { useFileDownload } from '../file-download/useFileDownload';
import { toast } from 'react-toastify';
import { validateDiagram } from '../validation/validateDiagram';
import { BACKEND_URL } from '../../constant';
import { LocalStorageRepository } from '../local-storage/local-storage-repository';


export const useExportBUML = () => {
  const downloadFile = useFileDownload();

  const exportBUML = useCallback(
    async (editor: ApollonEditor, diagramTitle: string) => {

      // Add validation before export
      const validationResult = await validateDiagram(editor, diagramTitle);
      if (!validationResult.isValid) {
        toast.error(validationResult.message || 'Validation failed');
        return;
      }

      if (!editor || !editor.model) {
        console.error('No editor or model available'); // Debug log
        toast.error('No diagram to export');
        return;
      }
      try {        // Prepare the model data 
        let modelData = editor.model;

        const response = await fetch(`${BACKEND_URL}/export-buml`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/plain, application/zip, */*',
          },
          body: JSON.stringify({
            elements: modelData,
            generator: 'buml',
            diagramTitle: diagramTitle
          }),
        }).catch(error => {
          console.error('Fetch error:', error); // Debug log
          throw error;
        });

        if (!response.ok) {
          const errorData = await response.json().catch(e => ({ detail: 'Could not parse error response' }));
          console.error('Response not OK:', response.status, errorData); // Debug log

          if (response.status === 400 && errorData.detail) {
            toast.error(`${errorData.detail}`);
            return;
          }
          

          if (response.status === 500 && errorData.detail) {
            toast.error(`${errorData.detail}`);
            return;
          }

          throw new Error(`HTTP error! status: ${response.status}`);
        }        const blob = await response.blob();
        
        // Get the filename from the response headers
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = 'exported_buml.py'; // Default filename
        
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
              filename = match[1];
              break;
            }
          }
        } else {
          // Default filename based on diagram type
          if (editor.model.type === 'ObjectDiagram') {
            filename = `${diagramTitle.toLowerCase().replace(/\s+/g, '_')}_object.py`;
          } else {
            filename = `${diagramTitle.toLowerCase().replace(/\s+/g, '_')}.py`;
          }
        }

        downloadFile({ file: blob, filename });
        toast.success('BUML export completed successfully');
      } catch (error) {

        let errorMessage = 'Unknown error occurred';
        if (error instanceof Error) {
          errorMessage = error.message;
        }
      
        toast.error(`${errorMessage}`);
      }
    },
    [downloadFile],
  );

  return exportBUML;
};