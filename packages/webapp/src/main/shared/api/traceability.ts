import { apiClient } from './api-client';
import type { DiagramInput } from './generation';
import type { TraceFile } from '../types/traceability';
import type { components } from './generated/besser-openapi';

/**
 * API layer for traceability (`/besser_api/traceability/...`).
 *
 * Mirrors the backend's `backend/models/traceability.py`; a change there is a
 * change here. Every generator the plain endpoints accept is accepted by the
 * traced ones (no allowlist): a project that records traces sends every
 * generation through them.
 */

/** Same deadline as a plain `/generate-output` call. */
export const GENERATION_TIMEOUT_MS = 300_000;

/** A `/generate-output` request plus what the trace needs: the diagram id (the trace refers to the model by it)
 *  and the project owner (blank is recorded as anonymous). */
export type TracedGenerationRequest = DiagramInput & {
  id: string;
  actorName: string;
};

/** The backend's `TracedGenerationResponse`, its free `trace` dict narrowed to the trace fragment of the run (its
 *  `projectId` is null; it may read several models). It is still checked and migrated before it is merged. */
export type TracedGenerationResponse = Omit<components['schemas']['TracedGenerationResponse'], 'trace'> & {
  trace: TraceFile;
};

/** `POST /traceability/generate-output`: one diagram in, the generated file (the bytes `/generate-output`
 *  delivers) and the trace of the run out. */
export const generateWithTrace = (body: TracedGenerationRequest, timeout: number = GENERATION_TIMEOUT_MS): Promise<TracedGenerationResponse> =>
  apiClient.post<TracedGenerationResponse>('/traceability/generate-output', body, { timeout });

/**
 * `POST /traceability/generate-output-from-project`: the `/generate-output-from-project` payload (a plain
 * record, see `buildProjectPayloadForBackend`) plus `actorName`, for the generators that read several diagrams
 * (web app, docker compose, quantum, neural networks, ...). Same response as {@link generateWithTrace}.
 */
export const generateFromProjectWithTrace = (
  project: Record<string, unknown>, actorName: string, timeout: number = GENERATION_TIMEOUT_MS,
): Promise<TracedGenerationResponse> =>
  apiClient.post<TracedGenerationResponse>('/traceability/generate-output-from-project', { ...project, actorName }, { timeout });

/** The generated file of a traced generation, as a download blob. */
export function tracedFileBlob(response: TracedGenerationResponse): Blob {
  const binary = atob(response.contentBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: response.mediaType });
}
