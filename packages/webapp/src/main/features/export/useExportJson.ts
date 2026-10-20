import { useCallback } from 'react';
import { BesserEditor } from '@besser/wme';
import { useFileDownload } from '../../shared/services/file-download/useFileDownload';
import { ProjectDiagram } from '../../shared/types/project';
import { prepareAgentModelForBackend, versionMetadata } from '../../shared/utils/projectExportUtils';
import { loadBesserVersion } from '../../shared/services/besserVersion';

export const useExportJSON = () => {
  const downloadFile = useFileDownload();

  const exportJSON = useCallback(
    async (editor: BesserEditor, diagram: ProjectDiagram) => {
      const fileName = `${diagram.title}.json`;
      await loadBesserVersion();
      // An agent canvas snapshot carries no off-canvas components; re-attach them.
      const diagramData = {
        ...diagram,
        model: prepareAgentModelForBackend(editor.model, diagram),
        ...versionMetadata(),
      };

      const jsonContent = JSON.stringify(diagramData, null, 2);
      const fileToDownload = new File([jsonContent], fileName, { type: 'application/json' });

      downloadFile({ file: fileToDownload, filename: fileName });
    },
    [downloadFile],
  );

  return exportJSON;
};
