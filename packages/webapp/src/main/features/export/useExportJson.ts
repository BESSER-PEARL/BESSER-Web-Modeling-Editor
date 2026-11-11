import { useCallback } from 'react';
import { BesserEditor } from '@besser/wme';
import { useFileDownload } from '../../shared/services/file-download/useFileDownload';
import { isV3UMLModel, ProjectDiagram } from '../../shared/types/project';
import { prepareAgentModelForBackend, versionMetadata } from '../../shared/utils/projectExportUtils';
import { loadBesserVersion } from '../../shared/services/besserVersion';

export const useExportJSON = () => {
  const downloadFile = useFileDownload();

  const exportJSON = useCallback(
    async (editor: BesserEditor, diagram: ProjectDiagram) => {
      const fileName = `${diagram.title}.json`;
      await loadBesserVersion();
      const diagramData = {
        ...diagram,
        // The editor cannot load an unmigrated v3 model, so its canvas is empty:
        // export the stored model. An agent canvas snapshot carries no off-canvas
        // components; re-attach them.
        model: isV3UMLModel(diagram.model)
          ? diagram.model
          : prepareAgentModelForBackend(editor.model, diagram),
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
