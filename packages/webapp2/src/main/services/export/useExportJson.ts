import { useCallback } from 'react';
import { ApollonEditor } from '@besser/wme';
import { useFileDownload } from '../file-download/useFileDownload';
import { ProjectDiagram } from '../../types/project';

export const useExportJSON = () => {
  const downloadFile = useFileDownload();

  const exportJSON = useCallback(
    (editor: ApollonEditor, diagram: ProjectDiagram) => {
      const fileName = `${diagram.title}.json`;
      const diagramData: ProjectDiagram = { ...diagram, model: editor.model };

      const jsonContent = JSON.stringify(diagramData, null, 2);
      const fileToDownload = new File([jsonContent], fileName, { type: 'application/json' });

      downloadFile({ file: fileToDownload, filename: fileName });
    },
    [downloadFile],
  );

  return exportJSON;
};
