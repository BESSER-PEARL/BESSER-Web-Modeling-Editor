/**
 * Spec-Driven Agent artifact download helper.
 *
 * Shared between `features/spec-driven/hooks/useSpecDrivenTrigger`
 * (first download right after the `done` SSE event) and the SpecDrivenCard
 * "Download again" button in `components/chatbot-kit/ui/chat-message.tsx`.
 * Lives in `main/shared/` because features must not import from other
 * features and the chat card is a shared component.
 *
 * The backend keeps the artifact for ~30 minutes and allows repeated
 * downloads of the same runId, so calling this again after a failure
 * (or after a successful save) is safe.
 */

import { downloadSpecDrivenOutput } from '../api/specDriven';
import { emitDeliveryEvent } from '../services/telemetry/pilotTelemetry';
import { downloadFile } from './download';

export type SpecDrivenDownloadResult =
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
export async function fetchAndSaveSpecDrivenArtifact(
  runId: string,
  fileName: string,
  isZip: boolean,
): Promise<SpecDrivenDownloadResult> {
  // Research telemetry: the user took the generated output with them.
  // Fire-and-forget, no-op unless telemetry is active.
  emitDeliveryEvent('download', runId);
  let blob: Blob;
  let headers: Headers;
  try {
    ({ blob, headers } = await downloadSpecDrivenOutput(runId));
  } catch (err) {
    console.error('[specDrivenDownload] download failed', err);
    return { ok: false };
  }
  // For explicit zip results, trust the backend's flag over the
  // response header — some proxies drop or rewrite Content-Type.
  const mime = isZip
    ? 'application/zip'
    : headers.get('Content-Type') || blob.type || 'application/octet-stream';
  try {
    downloadFile(blob, fileName, mime);
  } catch (err) {
    console.error('[specDrivenDownload] downloadFile failed', err);
    return { ok: false };
  }
  return { ok: true, sizeBytes: blob.size };
}

/**
 * Fetch the artifact for in-editor viewing ("View files"): no browser save
 * and no download telemetry, since the user did not take the output with them.
 * `null` on any failure, including the artifact having expired on the server.
 */
export async function fetchSpecDrivenArtifactBlob(runId: string): Promise<Blob | null> {
  try {
    return (await downloadSpecDrivenOutput(runId)).blob;
  } catch (err) {
    console.error('[specDrivenDownload] view fetch failed', err);
    return null;
  }
}
