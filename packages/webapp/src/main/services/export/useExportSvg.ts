import { useCallback } from 'react';
import { ApollonEditor, SVG } from '@besser/wme';
import { useFileDownload } from '../file-download/useFileDownload';

export const useExportSVG = () => {
  const downloadFile = useFileDownload();

  const exportSVG = useCallback(
    async (editor: ApollonEditor, diagramTitle: string) => {
      const apollonSVG: SVG = await editor.exportAsSVG();
      const fileName = `${diagramTitle}.svg`;

      const fileToDownload = new File([apollonSVG.svg], fileName, { type: 'image/svg+xml' });

      downloadFile({ file: fileToDownload, filename: fileName });
    },
    [downloadFile],
  );

  return exportSVG;
};
