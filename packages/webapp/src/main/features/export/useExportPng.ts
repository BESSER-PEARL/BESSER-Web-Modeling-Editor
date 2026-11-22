import { useCallback } from 'react';
import { ApollonEditor, SVG } from '@besser/wme';
import { useFileDownload } from '../../shared/services/file-download/useFileDownload';

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
      // Anything thrown in here (e.g. `toBlob` on a tainted canvas) escapes the Promise executor, which would
      // leave the export pending forever, so it is turned into a rejection.
      try {
        const canvas = document.createElement('canvas');
        const scale = 1.5;
        canvas.width = width * scale;
        canvas.height = height * scale;

        const context = canvas.getContext('2d');
        if (!context) {
          URL.revokeObjectURL(blobUrl);
          reject(new Error('Failed to create canvas 2D context'));
          return;
        }

        if (whiteBackground) {
          context.fillStyle = 'white';
          context.fillRect(0, 0, canvas.width, canvas.height);
        }

        context.scale(scale, scale);
        context.drawImage(image, 0, 0);

        canvas.toBlob((blob) => {
          URL.revokeObjectURL(blobUrl);
          if (!blob) {
            reject(new Error('Failed to create PNG blob from canvas'));
            return;
          }
          resolve(blob);
        });
      } catch (error) {
        URL.revokeObjectURL(blobUrl);
        // A DOMException is not an `Error` in every environment, so keep its message rather than the object.
        const message = (error as { message?: unknown } | null)?.message;
        reject(
          error instanceof Error
            ? error
            : new Error(typeof message === 'string' && message ? message : 'Failed to convert the diagram to PNG'),
        );
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(blobUrl);
      reject(new Error('Failed to load the diagram SVG as an image'));
    };
  });
}
