import { ApiError } from '../../api/api-client';
import { SseHttpError } from '../../api/sseClient';
import { isNetworkError } from '../../utils/describeNetworkError';

/** What an analytics event may say about a failure: its kind, never its message (which can carry content). */
export interface ErrorProperties {
  /** The error's class name (`ApiError`, `TypeError`, `TimeoutError`, ...), or `unknown`. */
  error_type: string;
  /** The HTTP status, when the failure was an HTTP answer. */
  http_status?: number;
  /** True when the request never got an answer (offline, CORS, aborted, timed out). */
  network_error: boolean;
}

/** Class names are code identifiers; anything longer or with spaces is not one and is not sent. */
const ERROR_NAME = /^[A-Za-z_$][\w$]{0,63}$/;

export function errorProperties(error: unknown): ErrorProperties {
  const name = error instanceof Error || error instanceof DOMException ? error.name : undefined;
  const status = error instanceof ApiError || error instanceof SseHttpError ? error.status : undefined;
  return {
    error_type: name && ERROR_NAME.test(name) ? name : 'unknown',
    ...(status !== undefined && status > 0 ? { http_status: status } : {}),
    network_error: isNetworkError(error),
  };
}
