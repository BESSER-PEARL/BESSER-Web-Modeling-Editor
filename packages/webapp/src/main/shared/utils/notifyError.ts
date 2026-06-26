import { toast } from 'react-toastify';

/**
 * Handles an unhandled promise rejection by logging the error and
 * showing a user-facing toast notification.
 *
 * Intended as a drop-in replacement for `.catch(console.error)` so
 * that failures are surfaced in the UI instead of being silently
 * swallowed.
 *
 * @param context  A short label describing the operation that failed
 *                 (e.g. "GitHub push", "editor setup"). Shown in the
 *                 toast so users know *what* went wrong.
 */
export function notifyError(context: string) {
  return (error: unknown): void => {
    console.error(`[${context}]`, error);
    const detail = error instanceof Error ? error.message : String(error);
    toast.error(`${context} failed: ${detail}`);
  };
}
