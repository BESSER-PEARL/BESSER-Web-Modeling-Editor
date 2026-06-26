/**
 * Smart Generator artifact download helper.
 *
 * Shared between `features/smart-generation/hooks/useSmartGenTrigger`
 * (first download right after the `done` SSE event) and the SmartGenCard
 * "Download again" button in `components/chatbot-kit/ui/chat-message.tsx`.
 * Lives in `main/shared/` because features must not import from other
 * features and the chat card is a shared component.
 *
 * The backend keeps the artifact for ~30 minutes and allows repeated
 * downloads of the same runId, so calling this again after a failure
 * (or after a successful save) is safe.
 */

import { smartGenDownloadUrl } from '../constants/constant';
import { downloadFile } from './download';

export type SmartGenDownloadResult =
  | { ok: true; sizeBytes: number }
  | { ok: false };

/**
 * Fetch the generated output as a blob and trigger a browser save via
 * the existing `downloadFile` util. Prefers the response's
 * `Content-Type`, falls back to `application/zip` when the backend
 * explicitly marked the result as a zip, and finally to
 * `application/octet-stream`.
 *
 * Returns `{ ok: true, sizeBytes }` on success (so callers can render a
 * friendlier completion message with the payload size) or `{ ok: false }`
 * on any failure.
 */
export async function fetchAndSaveSmartGenArtifact(
  runId: string,
  fileName: string,
  isZip: boolean,
): Promise<SmartGenDownloadResult> {
  const fullUrl = smartGenDownloadUrl(runId);
  let response: Response;
  try {
    response = await fetch(fullUrl);
  } catch (err) {
    console.error('[smartGenDownload] download fetch failed', err);
    return { ok: false };
  }
  if (!response.ok) {
    console.error('[smartGenDownload] download status', response.status);
    return { ok: false };
  }
  let blob: Blob;
  try {
    blob = await response.blob();
  } catch (err) {
    console.error('[smartGenDownload] download blob decode failed', err);
    return { ok: false };
  }
  // For explicit zip results, trust the backend's flag over the
  // response header — some proxies drop or rewrite Content-Type.
  const mime = isZip
    ? 'application/zip'
    : response.headers.get('Content-Type') || blob.type || 'application/octet-stream';
  try {
    downloadFile(blob, fileName, mime);
  } catch (err) {
    console.error('[smartGenDownload] downloadFile failed', err);
    return { ok: false };
  }
  return { ok: true, sizeBytes: blob.size };
}
