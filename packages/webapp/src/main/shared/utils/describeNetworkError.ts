import i18n from '../i18n';
import { ApiError } from '../api/api-client';

type Translate = (key: string, options?: { defaultValue?: string }) => string;

// Browser-specific wording for a fetch that never reached the server (Chrome, Firefox, Safari, RN).
const NETWORK_MESSAGE = /failed to fetch|networkerror when attempting to fetch resource|load failed|network request failed/i;

/** True when the error means the request never got a response (offline, DNS, CORS, abort/timeout). */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof ApiError) return error.status === 0;
  if (!(error instanceof Error) && !(error instanceof DOMException)) return false;
  if (error.name === 'AbortError' || error.name === 'TimeoutError') return true;
  return error instanceof TypeError && NETWORK_MESSAGE.test(error.message);
}

/** User-facing text for an error: plain copy for network failures, otherwise the error's own message. */
export function describeNetworkError(error: unknown, t: Translate = i18n.t.bind(i18n) as Translate): string {
  if (isNetworkError(error)) {
    return t('errors.network.unreachable', {
      defaultValue: "Couldn’t reach the server. Check your connection and try again.",
    });
  }
  if (error instanceof Error) return error.message;
  return String(error);
}
