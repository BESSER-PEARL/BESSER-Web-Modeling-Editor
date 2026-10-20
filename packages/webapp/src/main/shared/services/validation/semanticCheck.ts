/**
 * Semantic check of class diagrams: the editor's client of the backend's
 * `/semantic-consistency-check` and `/generate-object-diagram` streams.
 *
 * The backend searches, with the Alloy Analyzer, for an instance of a class
 * diagram and its OCL constraints within increasingly larger bounds, and
 * streams its progress as SSE events; the last one has `done: true`. The
 * search is bounded by the backend itself, so the client sets no deadline
 * for it: it only checks that the stream is alive (see
 * `SEMANTIC_CHECK_STALL_TIMEOUT_MS`).
 */

import { toast } from 'react-toastify';
import { GENERATE_OBJECT_DIAGRAM_ENDPOINT, SEMANTIC_CHECK_ENDPOINT } from '../../constants/constant';
import i18n from '../../i18n';
import { describeNetworkError, isNetworkError } from '../../utils/describeNetworkError';
import { SseResponseTimeoutError, SseStallError, streamSse } from '../sse/sseClient';

/** An event of the semantic check stream. */
export interface SemanticSearchEvent {
  /** `true` when an instance was found, `false` when the bounds hold none, `null` otherwise. */
  sat: boolean | null;
  /** Whether this is the last event of the stream. */
  done: boolean;
  isValid?: boolean;
  /** What the backend is doing or found, e.g. "No instance within 5 objects per class, …". */
  message: string;
  errors?: string[];
  warnings?: string[];
  /** Objects per class of the bounds searched. */
  scope?: number;
  /** Why no instance was found: the bounds hold none, or the Alloy Analyzer timed out. */
  reason?: 'unsat' | 'timeout';
  /** The instance found, as an object diagram (`/generate-object-diagram` only). */
  object_model?: unknown;
}

/**
 * Liveness bound for the stream. While the Alloy Analyzer runs, the backend
 * sends a heartbeat comment every 15 s (`HEARTBEAT_SECONDS` in
 * `semantic_consistency.py`), so 60 s of total silence means the transport
 * died, not that the search is slow.
 */
export const SEMANTIC_CHECK_STALL_TIMEOUT_MS = 60_000;

/** Handshake deadline: the backend answers with the stream's headers before any work. */
export const SEMANTIC_CHECK_RESPONSE_TIMEOUT_MS = 45_000;

/** Thrown when the stream ends without its last (`done`) event. */
export class SemanticSearchIncompleteError extends Error {
  constructor() {
    super('The semantic check ended without a result');
    this.name = 'SemanticSearchIncompleteError';
  }
}

/**
 * Streams the semantic search of `endpoint` for `body`; passes each progress
 * event to `onProgress` and resolves with the last (`done`) event.
 */
export async function streamSemanticSearch(
  endpoint: string,
  body: { title: string; model: unknown },
  onProgress: (event: SemanticSearchEvent) => void,
): Promise<SemanticSearchEvent> {
  const events = streamSse<SemanticSearchEvent>(endpoint, body, {
    stallTimeoutMs: SEMANTIC_CHECK_STALL_TIMEOUT_MS,
    responseTimeoutMs: SEMANTIC_CHECK_RESPONSE_TIMEOUT_MS,
  });
  for await (const event of events) {
    if (event.done) return event;
    onProgress(event);
  }
  throw new SemanticSearchIncompleteError();
}

/** Searches for an instance of the class diagram `model`. */
export function checkSemanticConsistency(
  title: string,
  model: unknown,
  onProgress: (event: SemanticSearchEvent) => void,
): Promise<SemanticSearchEvent> {
  return streamSemanticSearch(SEMANTIC_CHECK_ENDPOINT, { title, model }, onProgress);
}

/** Searches for an instance of the class diagram `model`; a found one comes as an object diagram. */
export function generateObjectDiagram(
  title: string,
  model: unknown,
  onProgress: (event: SemanticSearchEvent) => void,
): Promise<SemanticSearchEvent> {
  return streamSemanticSearch(GENERATE_OBJECT_DIAGRAM_ENDPOINT, { title, model }, onProgress);
}

/** Long, multi-line toasts for lists of errors and warnings. */
const LIST_TOAST_CLASS = 'max-h-[600px] overflow-auto whitespace-pre-line break-words';

/** Shows the result of a semantic search, its `message` with its errors and warnings. */
export function showSemanticSearchResult(event: SemanticSearchEvent): void {
  if (event.sat === true) {
    toast.success(event.message);
  } else if (event.reason) {
    toast.warning(event.message);
  } else {
    toast.error(event.message);
  }
  if (event.errors?.length) {
    toast.error(`${i18n.t('validation.semantic.errorsLabel')}\n\n${event.errors.join('\n\n')}`, {
      autoClose: false,
      className: LIST_TOAST_CLASS,
    });
  }
  if (event.warnings?.length) {
    toast.warning(`${i18n.t('validation.semantic.warningsLabel')}\n\n${event.warnings.join('\n\n')}`, {
      autoClose: false,
      className: LIST_TOAST_CLASS,
    });
  }
}

/** The user-facing text of an error thrown by a semantic search. */
export function semanticSearchErrorMessage(error: unknown): string {
  if (error instanceof SseStallError) return i18n.t('validation.semantic.connectionLost');
  if (error instanceof SemanticSearchIncompleteError) return i18n.t('validation.semantic.noResult');
  if (error instanceof SseResponseTimeoutError || isNetworkError(error)) return describeNetworkError(error);
  return i18n.t('validation.semantic.failed', { error: error instanceof Error ? error.message : String(error) });
}
