import { toast, type Id, type ToastContent, type ToastOptions } from 'react-toastify';
import { getSentry } from '../analytics/lazy-analytics';
import { describeNetworkError } from '../../utils/describeNetworkError';

export interface ReportErrorOptions extends ToastOptions {
  /** The caught error. Sent to Sentry when Sentry is configured and loaded; never shown. */
  error?: unknown;
}

/**
 * The one way to tell the user an operation failed: an error toast, plus the
 * caught `error` to Sentry. Pass text already translated, like any other toast.
 * It does not log: developer diagnostics stay `console.*` at the call site.
 */
export function reportError(message: ToastContent, options: ReportErrorOptions = {}): Id {
  const { error, ...toastOptions } = options;
  if (error !== undefined) {
    getSentry()?.captureException(error);
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
