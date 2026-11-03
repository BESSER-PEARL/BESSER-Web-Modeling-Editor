import { toast, type Id, type ToastContent, type ToastOptions } from 'react-toastify';
import { getSentry } from '../analytics/lazy-analytics';
import { errorProperties, track } from '../analytics/events';
import { ApiError } from '../../api/api-client';
import { SseHttpError } from '../../api/sseClient';
import { describeNetworkError, isNetworkError } from '../../utils/describeNetworkError';

export interface ReportErrorOptions extends ToastOptions {
  /** The caught error. Sent to Sentry when the user consented to analytics; never shown. */
  error?: unknown;
  /** A toast already showing (e.g. `toast.loading`) to turn into the error toast instead of opening one. */
  updateToast?: Id;
}

/** Offline/aborted/timed-out requests and 4xx answers are expected, not bugs: toast only. */
function isReportable(error: unknown): boolean {
  if (isNetworkError(error)) return false;
  if ((error instanceof ApiError || error instanceof SseHttpError) && error.status < 500) return false;
  return true;
}

/**
 * The one way to tell the user an operation failed: an error toast, plus the
 * caught `error` to Sentry (scrubbed, and only with analytics consent). Pass text
 * already translated, like any other toast. It does not log: developer
 * diagnostics stay `console.*` at the call site.
 */
export function reportError(message: ToastContent, options: ReportErrorOptions = {}): Id {
  const { error, updateToast, ...toastOptions } = options;
  track('error_shown', errorProperties(error));
  if (error !== undefined && isReportable(error)) {
    getSentry()?.captureException(error, { tags: { handled: 'reportError' } });
  }
  if (updateToast !== undefined) {
    toast.update(updateToast, { render: message, type: 'error', ...toastOptions });
    return updateToast;
  }
  return Object.keys(toastOptions).length > 0 ? toast.error(message, toastOptions) : toast.error(message);
}

/**
 * `.catch()` handler for a fire-and-forget promise: logs, then reports
 * "<context> failed: <detail>".
 */
export function notifyError(context: string) {
  return (error: unknown): void => {
    console.error(`[${context}]`, error);
    reportError(`${context} failed: ${describeNetworkError(error)}`, { error });
  };
}
