import { useCallback } from 'react';
import { ApollonEditor } from '@besser/wme';
import { useFileDownload } from '../file-download/useFileDownload';
import { DiagramRepository } from '../diagram/diagram-repository';

export const useExportPDF = () => {
  const downloadFile = useFileDownload();

  const exportPDF = useCallback(
    async (editor: ApollonEditor, diagramTitle: string) => {
      const apollonSVG = await editor.exportAsSVG();
      const { width, height } = apollonSVG.clip;

      const pdfBlob = await DiagramRepository.convertSvgToPdf(apollonSVG.svg, width, height);

      if (pdfBlob) {
        const filename = `${diagramTitle}.pdf`;
        const fileToDownload = new Blob([pdfBlob], { type: 'application/pdf' });

        downloadFile({ file: fileToDownload, filename });
      } else {
        console.error('Failed to convert SVG to PDF');
      }
    },
    [downloadFile],
  );

  return exportPDF;
};
