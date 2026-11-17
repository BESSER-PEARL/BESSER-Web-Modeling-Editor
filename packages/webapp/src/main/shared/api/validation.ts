/** Diagram validation (BESSER `routers/validation_router.py`). */
import { apiClient } from './api-client';
import { GENERATE_OBJECT_DIAGRAM_ENDPOINT, SEMANTIC_CHECK_ENDPOINT } from '../constants/constant';
import type { components } from './generated/besser-openapi';
import type { DiagramInput } from './generation';
import { streamSse } from './sseClient';

export type ValidationResponse = components['schemas']['ValidationResponse'];

/** Validation converts the model to B-UML and runs its OCL constraints. */
const VALIDATION_TIMEOUT_MS = 120_000;

/** `POST /validate-diagram`. A failure rejects with an `ApiError`, a timeout with a `TimeoutError`. */
export const postValidateDiagram = (body: Pick<DiagramInput, 'title' | 'model'>) =>
  apiClient.post<ValidationResponse>('/validate-diagram', body, { timeout: VALIDATION_TIMEOUT_MS });

/**
 * An event of the semantic check streams (BESSER `SemanticCheckEvent`, `models/responses.py`); the last one has
 * `done: true`. The events travel inside the stream, so the OpenAPI schema does not describe them.
 */
export interface SemanticSearchEvent {
  /** Whether this is the last event of the stream. */
  done: boolean;
  /** Whether an instance was found (last event only). */
  isValid?: boolean;
  /** What the backend is doing or found, e.g. "No instance within 5 objects per class, …". */
  message: string;
  errors?: string[];
  warnings?: string[];
  /** The instance found, as an object diagram (`/generate-object-diagram` only). */
  object_model?: unknown;
}

/**
 * Liveness bound for the semantic check streams. While the Alloy Analyzer runs, the backend
 * sends a heartbeat comment every 15 s (`HEARTBEAT_SECONDS` in `semantic_consistency.py`),
 * so 60 s of total silence means the transport died, not that the search is slow. The search
 * itself is bounded by the backend, so the streams have no overall deadline.
 */
export const SEMANTIC_CHECK_STALL_TIMEOUT_MS = 60_000;

/** Handshake deadline: the backend answers with the stream's headers before any work. */
export const SEMANTIC_CHECK_RESPONSE_TIMEOUT_MS = 45_000;

const semanticSearch = (endpoint: string, body: { title: string; model: unknown }, signal?: AbortSignal) =>
  streamSse<SemanticSearchEvent>(endpoint, body, {
    stallTimeoutMs: SEMANTIC_CHECK_STALL_TIMEOUT_MS,
    responseTimeoutMs: SEMANTIC_CHECK_RESPONSE_TIMEOUT_MS,
    signal,
  });

/**
 * `POST /semantic-consistency-check`: searches for an instance of a class diagram, streaming its
 * progress. Aborting `signal` closes the stream, which stops the search on the server.
 */
export const streamSemanticConsistencyCheck = (body: { title: string; model: unknown }, signal?: AbortSignal) =>
  semanticSearch(SEMANTIC_CHECK_ENDPOINT, body, signal);

/** `POST /generate-object-diagram`: the same search; the instance found comes as an object diagram. */
export const streamObjectDiagramGeneration = (body: { title: string; model: unknown }, signal?: AbortSignal) =>
  semanticSearch(GENERATE_OBJECT_DIAGRAM_ENDPOINT, body, signal);
