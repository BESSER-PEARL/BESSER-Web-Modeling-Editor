import type { Breadcrumb, ErrorEvent, EventHint, StackFrame, User } from '@sentry/react';
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
 * A stack frame's script URL without query or fragment: the same as `pagePath` for a URL,
 * while a non-URL name (`<anonymous>`, `[native code]`) is kept. An inline script's
 * frame (window.onerror) is the page URL itself, query included.
 */
const withoutQuery = (file: string): string => file.replace(/[?#][\s\S]*$/, '');

const scrubFrame = (frame: StackFrame): StackFrame => ({
  ...frame,
  ...(frame.filename ? { filename: withoutQuery(frame.filename) } : {}),
  ...(frame.abs_path ? { abs_path: withoutQuery(frame.abs_path) } : {}),
});

/**
 * `ip_address: null` stops Sentry inferring the client IP from the connection, which it
 * otherwise does for JavaScript events (`{{auto}}` is that platform's default). The v8
 * `User` type allows only a string, but null is the documented opt-out.
 */
const NO_USER = { ip_address: null } as unknown as User;

/**
 * Sentry `beforeSend`: keeps what the privacy policy allows (error type, HTTP status,
 * stack, page path, browser, breadcrumb categories) and drops every free-text field and
 * the user, since error messages, logged text and request URLs can carry model content,
 * project or repository names.
 */
export function scrubSentryEvent(event: ErrorEvent, hint?: EventHint): ErrorEvent {
  const scrubbed: ErrorEvent = { ...event, user: NO_USER };
  delete scrubbed.message;
  delete scrubbed.logentry;
  delete scrubbed.extra;

  if (event.exception?.values) {
    scrubbed.exception = {
      ...event.exception,
      values: event.exception.values.map(({ stacktrace, ...value }) => ({
        ...value,
        value: value.value === undefined ? undefined : REDACTED,
        ...(stacktrace ? { stacktrace: { ...stacktrace, frames: stacktrace.frames?.map(scrubFrame) } } : {}),
      })),
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
