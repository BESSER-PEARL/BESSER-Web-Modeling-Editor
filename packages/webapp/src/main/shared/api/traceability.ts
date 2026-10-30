import { apiClient } from './api-client';
import type { TraceFile } from '../types/traceability';

/**
 * API layer for traceability (`/besser_api/traceability/...`).
 *
 * Mirrors the backend's `backend/models/traceability.py`; a change there is a
 * change here.
 */

/** Generators whose output carries trace links. Mirrors `TRACED_GENERATORS` in
 *  the backend's `constants.py`. */
export const TRACED_GENERATORS: ReadonlySet<string> = new Set(['sqlalchemy', 'backend']);

/** Same deadline as a plain `/generate-output` call. */
const GENERATION_TIMEOUT_MS = 300_000;

export interface TracedGenerationRequest {
  /** The diagram id: the trace refers to the model by it. */
  id: string;
  title: string;
  model: unknown;
  generator: string;
  config?: unknown;
  /** The project owner; blank is recorded as anonymous. */
  actorName: string;
}

export interface TracedGenerationResponse {
  fileName: string;
  mediaType: string;
  contentBase64: string;
  /** The trace fragment of the run (its `projectId` is null). */
  trace: TraceFile;
}

export const generateWithTrace = (body: TracedGenerationRequest): Promise<TracedGenerationResponse> =>
  apiClient.post<TracedGenerationResponse>('/traceability/generate-output', body, {
    timeout: GENERATION_TIMEOUT_MS,
  });

/** The generated file of a traced generation, as a download blob. */
export function tracedFileBlob(response: TracedGenerationResponse): Blob {
  const binary = atob(response.contentBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: response.mediaType });
}
