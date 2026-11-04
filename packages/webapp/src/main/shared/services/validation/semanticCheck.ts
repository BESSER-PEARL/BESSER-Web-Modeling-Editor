/**
 * Semantic check of class diagrams: runs the backend's `/semantic-consistency-check` and
 * `/generate-object-diagram` searches (their streams are in `shared/api/validation`), one at a
 * time, and shows their results.
 *
 * The backend searches, with the Alloy Analyzer, for an instance of a class diagram and its OCL
 * constraints within increasingly larger bounds, and streams its progress as SSE events; the
 * last one has `done: true`.
 */

import { toast } from 'react-toastify';
import { formatErrorDetail } from '../../api/api-client';
import { SseHttpError, SseResponseTimeoutError, SseStallError } from '../../api/sseClient';
import {
  streamObjectDiagramGeneration,
  streamSemanticConsistencyCheck,
  type SemanticSearchEvent,
} from '../../api/validation';
import i18n from '../../i18n';
import { describeNetworkError, isNetworkError } from '../../utils/describeNetworkError';
import { reportError } from '../errors/reportError';

/** Thrown when the stream ends without its last (`done`) event. */
export class SemanticSearchIncompleteError extends Error {
  constructor() {
    super('The semantic check ended without a result');
    this.name = 'SemanticSearchIncompleteError';
  }
}

/** Each semantic search starts an Alloy Analyzer on the server, so the editor runs one at a time. */
let searchRunning = false;

/** Whether a semantic search, from any entry point, is running. */
export function isSemanticSearchRunning(): boolean {
  return searchRunning;
}

/**
 * Follows the `events` of a semantic search: passes each progress event to `onProgress` and
 * resolves with the last (`done`) event.
 */
async function followSemanticSearch(
  events: AsyncGenerator<SemanticSearchEvent, void, void>,
  onProgress: (event: SemanticSearchEvent) => void,
): Promise<SemanticSearchEvent> {
  searchRunning = true;
  try {
    for await (const event of events) {
      if (event.done) return event;
      onProgress(event);
    }
    throw new SemanticSearchIncompleteError();
  } finally {
    searchRunning = false;
  }
}

/** Searches for an instance of the class diagram `model`. Aborting `signal` stops the search on the server. */
export function checkSemanticConsistency(
  title: string,
  model: unknown,
  onProgress: (event: SemanticSearchEvent) => void,
  signal?: AbortSignal,
): Promise<SemanticSearchEvent> {
  return followSemanticSearch(streamSemanticConsistencyCheck({ title, model }, signal), onProgress);
}

/** Searches for an instance of the class diagram `model`; a found one comes as an object diagram. */
export function generateObjectDiagram(
  title: string,
  model: unknown,
  onProgress: (event: SemanticSearchEvent) => void,
  signal?: AbortSignal,
): Promise<SemanticSearchEvent> {
  return followSemanticSearch(streamObjectDiagramGeneration({ title, model }, signal), onProgress);
}

/** Long, multi-line toasts for lists of errors and warnings. */
const LIST_TOAST_CLASS = 'max-h-[600px] overflow-auto whitespace-pre-line break-words';

/** Shows the result of a semantic search, its `message` with its errors and warnings. */
export function showSemanticSearchResult(event: SemanticSearchEvent): void {
  if (event.isValid) {
    toast.success(event.message);
  } else {
    reportError(event.message);
  }
  if (event.errors?.length) {
    reportError(`${i18n.t('validation.semantic.errorsLabel')}\n\n${event.errors.join('\n\n')}`, {
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

/** The `detail` of a FastAPI error body, or `undefined` when `body` is not one (e.g. a proxy's error page). */
function errorBodyDetail(body: string): unknown {
  try {
    const parsed: unknown = JSON.parse(body);
    return parsed && typeof parsed === 'object' ? (parsed as { detail?: unknown }).detail : undefined;
  } catch {
    return undefined;
  }
}

/** The user-facing text of an error thrown by a semantic search. */
export function semanticSearchErrorMessage(error: unknown): string {
  if (error instanceof SseStallError) return i18n.t('validation.semantic.connectionLost');
  if (error instanceof SemanticSearchIncompleteError) return i18n.t('validation.semantic.noResult');
  if (error instanceof SseResponseTimeoutError || isNetworkError(error)) return describeNetworkError(error);
  const failed = i18n.t('validation.semantic.failed', { error: error instanceof Error ? error.message : String(error) });
  // The backend explains a refused search, e.g. the 503 sent when it already runs its maximum of checks
  if (error instanceof SseHttpError) return formatErrorDetail(errorBodyDetail(error.body), failed);
  return failed;
}
