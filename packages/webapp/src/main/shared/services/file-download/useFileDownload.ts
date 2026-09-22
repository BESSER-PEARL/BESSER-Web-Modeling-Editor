import { useCallback } from 'react';
import { downloadFile } from '../../utils/download';

interface FileDownloadPayload {
  file: File | Blob;
  filename?: string;
}

export const useFileDownload = () => {
  const download = useCallback(({ file, filename }: FileDownloadPayload) => {
    const resolvedFilename = filename ?? (file instanceof File ? file.name : 'file');
    downloadFile(file, resolvedFilename);
  }, []);

  return download;
};
