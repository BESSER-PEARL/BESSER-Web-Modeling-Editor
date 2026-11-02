import type { Breadcrumb, ErrorEvent, EventHint } from '@sentry/react';
import { ApiError } from '../../api/api-client';
import { SseHttpError } from '../../api/sseClient';

export const REDACTED = '[redacted]';

/** Page URL without query or fragment: those can carry tokens (`?demo=`) or study labels. */
function pagePath(url: string): string {
  try {
    const { origin, pathname } = new URL(url);
    return `${origin}${pathname}`;
  } catch {
    return REDACTED;
  }
}

/**
 * Sentry `beforeSend`: keeps what the privacy policy allows (error type, HTTP status,
 * stack, page path, breadcrumb categories) and drops every free-text field, since
 * error messages, logged text and request URLs can carry model content, project or
 * repository names.
 */
export function scrubSentryEvent(event: ErrorEvent, hint?: EventHint): ErrorEvent {
  const scrubbed: ErrorEvent = { ...event };
  delete scrubbed.message;
  delete scrubbed.logentry;
  delete scrubbed.extra;

  if (event.exception?.values) {
    scrubbed.exception = {
      ...event.exception,
      values: event.exception.values.map((value) => ({ ...value, value: value.value === undefined ? undefined : REDACTED })),
    };
  }
  if (event.breadcrumbs) {
    scrubbed.breadcrumbs = event.breadcrumbs.map(
      ({ type, category, level, timestamp }): Breadcrumb => ({ type, category, level, timestamp }),
    );
  }
  if (event.request) {
    const userAgent = event.request.headers?.['User-Agent'];
    scrubbed.request = {
      ...(event.request.url ? { url: pagePath(event.request.url) } : {}),
      ...(userAgent ? { headers: { 'User-Agent': userAgent } } : {}),
    };
  }
  const original = hint?.originalException;
  if (original instanceof ApiError || original instanceof SseHttpError) {
    scrubbed.tags = { ...event.tags, status: original.status };
  }
  return scrubbed;
}
