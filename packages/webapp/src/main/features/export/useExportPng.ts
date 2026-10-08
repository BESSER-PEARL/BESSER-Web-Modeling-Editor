import { useCallback } from 'react';
import { BesserEditor, SVG } from '@besser/wme';
import { useFileDownload } from '../../shared/services/file-download/useFileDownload';

export const useExportPNG = () => {
  const downloadFile = useFileDownload();

  const exportPNG = useCallback(
    async (editor: BesserEditor, diagramTitle: string, setWhiteBackground: boolean) => {
      const besserSVG: SVG = await editor.exportAsSVG();
      const pngBlob: Blob = await convertRenderedSVGToPNG(besserSVG, setWhiteBackground);
      // Distinct names, so the white and the transparent export of one diagram don't overwrite each other.
      const fileName = setWhiteBackground ? `${diagramTitle}.png` : `${diagramTitle}_transparent.png`;

      const fileToDownload = new File([pngBlob], fileName, { type: 'image/png' });

      downloadFile({ file: fileToDownload, filename: fileName });
    },
    [downloadFile],
  );

  return exportPNG;
};

// Helper function to convert SVG to PNG. Every failure rejects -- including a
// throw inside onload (e.g. a tainted canvas) -- so the caller's spinner clears.
export function convertRenderedSVGToPNG(renderedSVG: SVG, whiteBackground: boolean): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const { width, height } = renderedSVG.clip;

    const blob = new Blob([renderedSVG.svg], { type: 'image/svg+xml' });
    const blobUrl = URL.createObjectURL(blob);
    const fail = (error: unknown) => {
      URL.revokeObjectURL(blobUrl);
      const message = (error as { message?: unknown } | null)?.message;
      reject(
        error instanceof Error
          ? error
          : new Error(typeof message === 'string' && message ? message : 'Failed to render the diagram as PNG'),
      );
    };

    const image = new Image();
    image.width = width;
    image.height = height;

    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const scale = 1.5;
        canvas.width = width * scale;
        canvas.height = height * scale;

        const context = canvas.getContext('2d');
        if (!context) {
          fail(new Error('Failed to create canvas 2D context'));
          return;
        }

        if (whiteBackground) {
          context.fillStyle = 'white';
          context.fillRect(0, 0, canvas.width, canvas.height);
        }

        context.scale(scale, scale);
        context.drawImage(image, 0, 0);

        canvas.toBlob((blob) => {
          if (!blob) {
            fail(new Error('Failed to create PNG blob from canvas'));
            return;
          }
          URL.revokeObjectURL(blobUrl);
          resolve(blob);
        });
      } catch (error) {
        fail(error);
      }
    };

    image.onerror = (error) => fail(error);
    image.src = blobUrl;
  });
}
