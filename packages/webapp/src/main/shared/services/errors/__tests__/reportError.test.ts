/**
 * reportError replaced 213 direct toast.error calls and notifyError: the toast
 * must reach react-toastify with exactly the arguments the call sites used to
 * pass, and the caught error goes to Sentry only when Sentry has loaded.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const toastError = vi.fn((..._args: unknown[]) => 'toast-id');
vi.mock('react-toastify', () => ({ toast: { error: (...args: unknown[]) => toastError(...args) } }));

const captureException = vi.fn();
let sentryLoaded = true;
vi.mock('../../analytics/lazy-analytics', () => ({
  getSentry: () => (sentryLoaded ? { captureException } : null),
}));

import { notifyError, reportError } from '../reportError';

beforeEach(() => {
  toastError.mockClear();
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

  it('sends the caught error to Sentry', () => {
    const error = new Error('boom');
    reportError('Save failed', { error });
    expect(captureException).toHaveBeenCalledWith(error);
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
    expect(captureException).toHaveBeenCalledWith(error);
  });

  it('uses the network wording when the request never reached the server', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    notifyError('Loading latest project')(new TypeError('Failed to fetch'));
    expect(toastError.mock.calls[0][0]).toMatch(/^Loading latest project failed: Couldn.t reach the server/);
  });
});
