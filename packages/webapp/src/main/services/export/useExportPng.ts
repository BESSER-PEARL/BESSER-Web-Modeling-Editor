import { useCallback } from 'react';
import { ApollonEditor, SVG } from '@besser/wme';
import { useFileDownload } from '../file-download/useFileDownload';

export const useExportPNG = () => {
  const downloadFile = useFileDownload();

  const exportPNG = useCallback(
    async (editor: ApollonEditor, diagramTitle: string, setWhiteBackground: boolean) => {
      const apollonSVG: SVG = await editor.exportAsSVG();
      const pngBlob: Blob = await convertRenderedSVGToPNG(apollonSVG, setWhiteBackground);
      const fileName = `${diagramTitle}.png`;

      const fileToDownload = new File([pngBlob], fileName, { type: 'image/png' });

      downloadFile({ file: fileToDownload, filename: fileName });
    },
    [downloadFile],
  );

  return exportPNG;
};

// Helper function to convert SVG to PNG
function convertRenderedSVGToPNG(renderedSVG: SVG, whiteBackground: boolean): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const { width, height } = renderedSVG.clip;

    const blob = new Blob([renderedSVG.svg], { type: 'image/svg+xml' });
    const blobUrl = URL.createObjectURL(blob);

    const image = new Image();
    image.width = width;
    image.height = height;
    image.src = blobUrl;

    image.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = 1.5; // Adjust scale if necessary
      canvas.width = width * scale;
      canvas.height = height * scale;

      const context = canvas.getContext('2d')!;

      if (whiteBackground) {
        context.fillStyle = 'white';
        context.fillRect(0, 0, canvas.width, canvas.height);
      }

      context.scale(scale, scale);
      context.drawImage(image, 0, 0);

      canvas.toBlob((blob) => {
        URL.revokeObjectURL(blobUrl); // Cleanup the blob URL
        resolve(blob as Blob);
      });
    };

    image.onerror = (error) => {
      reject(error);
    };
  });
}
