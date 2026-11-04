/**
 * reportError replaced 213 direct toast.error calls and notifyError: the toast
 * must reach react-toastify with exactly the arguments the call sites used to
 * pass, and the caught error goes to Sentry only when Sentry has loaded (which
 * needs analytics consent, see lazy-analytics.test.ts) and only when it is a
 * bug: offline, aborted and 4xx failures are expected and stay toast-only.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const toastError = vi.fn((..._args: unknown[]) => 'toast-id');
const toastUpdate = vi.fn();
vi.mock('react-toastify', () => ({
  toast: { error: (...args: unknown[]) => toastError(...args), update: (...args: unknown[]) => toastUpdate(...args) },
}));

const captureException = vi.fn();
let sentryLoaded = true;
vi.mock('../../analytics/lazy-analytics', () => ({
  getSentry: () => (sentryLoaded ? { captureException } : null),
  captureEvent: vi.fn(),
}));

import { notifyError, reportError } from '../reportError';
import { ApiError } from '../../../api/api-client';
import { SseHttpError } from '../../../api/sseClient';

const HANDLED = { tags: { handled: 'reportError' } };

beforeEach(() => {
  toastError.mockClear();
  toastUpdate.mockClear();
  captureException.mockClear();
  sentryLoaded = true;
});

afterEach(() => vi.restoreAllMocks());

describe('reportError', () => {
  it('shows the message as an error toast, with no options argument when none are given', () => {
    expect(reportError('Generation failed')).toBe('toast-id');
    expect(toastError.mock.calls).toEqual([['Generation failed']]);
    expect(captureException).not.toHaveBeenCalled();
  });

  it('passes toast options through unchanged, without the error', () => {
    const error = new Error('boom');
    reportError('Backend unreachable', { toastId: 'assistant-backend-unreachable', autoClose: 5000, error });
    expect(toastError.mock.calls).toEqual([
      ['Backend unreachable', { toastId: 'assistant-backend-unreachable', autoClose: 5000 }],
    ]);
  });

  it('keeps the one-argument toast call when only the error is given', () => {
    reportError('Save failed', { error: new Error('disk') });
    expect(toastError.mock.calls).toEqual([['Save failed']]);
  });

  it('sends the caught error to Sentry, tagged as a handled reportError capture', () => {
    const error = new Error('boom');
    reportError('Save failed', { error });
    expect(captureException).toHaveBeenCalledWith(error, HANDLED);
  });

  it.each([
    ['an offline fetch', new TypeError('Failed to fetch')],
    ['an aborted request', new DOMException('The user aborted a request.', 'AbortError')],
    ['a timed-out request', new DOMException('signal timed out', 'TimeoutError')],
    ['a request that never got a response', new ApiError(0, 'Network Error')],
    ['a 4xx answer', new ApiError(422, 'Class "Invoice" has no attribute "total"')],
    ['a 4xx SSE answer', new SseHttpError(429, '{"detail":"rate limited"}')],
  ])('does not send %s to Sentry, but still shows the toast', (_label, error) => {
    reportError('Generation failed', { error });
    expect(captureException).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith('Generation failed');
  });

  it.each([
    ['a 5xx answer', new ApiError(500, 'Internal Server Error')],
    ['a 5xx SSE answer', new SseHttpError(502, 'Bad Gateway')],
  ])('sends %s to Sentry', (_label, error) => {
    reportError('Generation failed', { error });
    expect(captureException).toHaveBeenCalledWith(error, HANDLED);
  });

  it('still shows the toast when Sentry is not configured or not loaded yet', () => {
    sentryLoaded = false;
    reportError('Save failed', { error: new Error('boom') });
    expect(toastError).toHaveBeenCalledWith('Save failed');
  });
});

describe('notifyError', () => {
  it('logs, toasts "<context> failed: <detail>" and reports to Sentry', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('quota exceeded');
    notifyError('Editor setup')(error);
    expect(log).toHaveBeenCalledWith('[Editor setup]', error);
    expect(toastError.mock.calls).toEqual([['Editor setup failed: quota exceeded']]);
    expect(captureException).toHaveBeenCalledWith(error, HANDLED);
  });

  it('uses the network wording when the request never reached the server', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    notifyError('Loading latest project')(new TypeError('Failed to fetch'));
    expect(toastError.mock.calls[0][0]).toMatch(/^Loading latest project failed: Couldn.t reach the server/);
    expect(captureException).not.toHaveBeenCalled();
  });
});

describe('reportError on a loading toast', () => {
  it('turns that toast into the error toast, with the options given, and reports the error', () => {
    const error = new Error('boom');
    expect(reportError('Deploy failed', { updateToast: 'loading-id', isLoading: false, autoClose: 5000, error })).toBe('loading-id');
    expect(toastUpdate.mock.calls).toEqual([
      ['loading-id', { render: 'Deploy failed', type: 'error', isLoading: false, autoClose: 5000 }],
    ]);
    expect(toastError).not.toHaveBeenCalled();
    expect(captureException).toHaveBeenCalledWith(error, HANDLED);
  });

  it('keeps an expected failure out of Sentry', () => {
    reportError('Deploy failed', { updateToast: 'loading-id', error: new ApiError(404, 'Not Found') });
    expect(toastUpdate).toHaveBeenCalledWith('loading-id', { render: 'Deploy failed', type: 'error' });
    expect(captureException).not.toHaveBeenCalled();
  });
});
