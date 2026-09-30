import { useCallback } from 'react';
import { BesserEditor } from '@besser/wme';
import { useFileDownload } from '../../shared/services/file-download/useFileDownload';
import { ProjectDiagram } from '../../shared/types/project';
import { prepareAgentModelForBackend } from '../../shared/utils/projectExportUtils';

export const useExportJSON = () => {
  const downloadFile = useFileDownload();

  const exportJSON = useCallback(
    (editor: BesserEditor, diagram: ProjectDiagram) => {
      const fileName = `${diagram.title}.json`;
      // An agent canvas snapshot carries no off-canvas components; re-attach them.
      const diagramData: ProjectDiagram = { ...diagram, model: prepareAgentModelForBackend(editor.model, diagram) };

      const jsonContent = JSON.stringify(diagramData, null, 2);
      const fileToDownload = new File([jsonContent], fileName, { type: 'application/json' });

      downloadFile({ file: fileToDownload, filename: fileName });
    },
    [downloadFile],
  );

  return exportJSON;
};
