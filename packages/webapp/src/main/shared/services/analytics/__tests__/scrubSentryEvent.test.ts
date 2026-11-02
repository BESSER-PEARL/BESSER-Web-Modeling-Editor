/**
 * The privacy policy promises no model content and no project names: a Sentry
 * event keeps only the error type, HTTP status, stack, page path and breadcrumb
 * categories. Free text (messages, backend `detail`, logged lines, URLs' query)
 * must never leave the browser.
 */
import { describe, expect, it } from 'vitest';
import type { ErrorEvent } from '@sentry/react';
import { REDACTED, scrubSentryEvent } from '../scrubSentryEvent';
import { ApiError } from '../../../api/api-client';
import { SseHttpError } from '../../../api/sseClient';

const DETAIL = 'Class "PatientRecord" in project "Hospital-Acme" has no attribute "ssn"';
const stacktrace = { frames: [{ filename: 'https://editor.example/assets/index-abc.js', function: 'generate', lineno: 1, colno: 9 }] };

const event = (): ErrorEvent => ({
  type: undefined,
  message: DETAIL,
  logentry: { message: DETAIL, params: [] },
  extra: { message: `Generation failed: ${DETAIL}`, __serialized__: { detail: DETAIL } },
  tags: { package: 'webapp', handled: 'reportError' },
  exception: {
    values: [
      { type: 'ApiError', value: DETAIL, stacktrace, mechanism: { type: 'generic', handled: true } },
      { type: 'Error', value: `caused by ${DETAIL}` },
    ],
  },
  breadcrumbs: [
    { type: 'default', category: 'console', level: 'error', timestamp: 1, message: `[generate] ${DETAIL}` },
    { type: 'http', category: 'fetch', level: 'info', timestamp: 2, data: { url: '/github/repos/acme/hospital-secret', status_code: 404 } },
    { category: 'ui.click', timestamp: 3, message: 'button[title="Hospital-Acme"]' },
  ],
  request: {
    url: 'https://editor.example/agent-config?demo=SECRET-TOKEN&study=p7#hash',
    headers: { Referer: 'https://editor.example/?demo=SECRET-TOKEN', 'User-Agent': 'Mozilla/5.0' },
  },
});

describe('scrubSentryEvent', () => {
  it('redacts every exception value but keeps type, stack and mechanism', () => {
    const scrubbed = scrubSentryEvent(event());
    expect(scrubbed.exception?.values).toEqual([
      { type: 'ApiError', value: REDACTED, stacktrace, mechanism: { type: 'generic', handled: true } },
      { type: 'Error', value: REDACTED },
    ]);
  });

  it('drops the message, logentry and extra data', () => {
    const scrubbed = scrubSentryEvent(event());
    expect(scrubbed.message).toBeUndefined();
    expect(scrubbed.logentry).toBeUndefined();
    expect(scrubbed.extra).toBeUndefined();
  });

  it('keeps only the category, type, level and time of each breadcrumb', () => {
    expect(scrubSentryEvent(event()).breadcrumbs).toEqual([
      { type: 'default', category: 'console', level: 'error', timestamp: 1 },
      { type: 'http', category: 'fetch', level: 'info', timestamp: 2 },
      { type: undefined, category: 'ui.click', level: undefined, timestamp: 3 },
    ]);
  });

  it('keeps the page path and user agent, not the query, fragment or referrer', () => {
    expect(scrubSentryEvent(event()).request).toEqual({
      url: 'https://editor.example/agent-config',
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
  });

  it('nothing of the backend detail or the URL secrets survives anywhere in the event', () => {
    const json = JSON.stringify(scrubSentryEvent(event(), { originalException: new ApiError(422, DETAIL) }));
    for (const leak of ['PatientRecord', 'Hospital-Acme', 'hospital-secret', 'SECRET-TOKEN', 'study=']) {
      expect(json).not.toContain(leak);
    }
  });

  it('tags the HTTP status of an ApiError or SseHttpError and keeps the other tags', () => {
    expect(scrubSentryEvent(event(), { originalException: new ApiError(503, DETAIL) }).tags).toEqual({
      package: 'webapp',
      handled: 'reportError',
      status: 503,
    });
    expect(scrubSentryEvent(event(), { originalException: new SseHttpError(500, DETAIL) }).tags?.status).toBe(500);
    expect(scrubSentryEvent(event(), { originalException: new Error(DETAIL) }).tags).toEqual({
      package: 'webapp',
      handled: 'reportError',
    });
  });
});
