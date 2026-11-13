import { useCallback } from 'react';
import { BesserEditor, SVG } from '@besser/wme';
import { useFileDownload } from '../../shared/services/file-download/useFileDownload';

export const useExportSVG = () => {
  const downloadFile = useFileDownload();

  const exportSVG = useCallback(
    async (editor: BesserEditor, diagramTitle: string) => {
      const besserSVG: SVG = await editor.exportAsSVG();
      const fileName = `${diagramTitle}.svg`;

      const fileToDownload = new File([besserSVG.svg], fileName, { type: 'image/svg+xml' });

      downloadFile({ file: fileToDownload, filename: fileName });
    },
    [downloadFile],
  );

  return exportSVG;
};
