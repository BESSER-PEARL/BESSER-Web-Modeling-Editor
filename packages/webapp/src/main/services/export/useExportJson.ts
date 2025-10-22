import { useCallback } from 'react';
import { ApollonEditor, diagramBridge, UMLDiagramType } from '@besser/wme';
import { useFileDownload } from '../file-download/useFileDownload';
import { Diagram } from '../diagram/diagramSlice';
import { LocalStorageRepository } from '../local-storage/local-storage-repository';

export const useExportJSON = () => {
  const downloadFile = useFileDownload();
  const exportJSON = useCallback(
    (editor: ApollonEditor, diagram: Diagram) => {
      const fileName = `${diagram.title}.json`;
      const diagramData: Diagram = { ...diagram, model: editor.model };
      
      const jsonContent = JSON.stringify(diagramData, null, 2);

      const fileToDownload = new File([jsonContent], fileName, { type: 'application/json' });

      downloadFile({ file: fileToDownload, filename: fileName });
    },
    [downloadFile],
  );

  return exportJSON;
};
