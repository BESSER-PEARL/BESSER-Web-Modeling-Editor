/**
 * The shared analytics surface: `errorProperties` never leaks a message, every
 * `reportError` failure is counted, and uncaught errors are reported.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const captureEvent = vi.hoisted(() => vi.fn());
vi.mock('../lazy-analytics', () => ({ captureEvent, getSentry: () => null }));
vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), update: vi.fn() } }));

import { ApiError } from '../../../api/api-client';
import { SseHttpError } from '../../../api/sseClient';
import { errorProperties, trackUncaughtErrors, trackFailure } from '../events';
import { reportError } from '../../errors/reportError';

beforeEach(() => captureEvent.mockClear());

describe('errorProperties', () => {
  it('keeps the class and HTTP status, never the message', () => {
    expect(errorProperties(new ApiError(502, 'project "Acme" failed', 'detail Acme'))).toEqual({
      error_type: 'ApiError',
      http_status: 502,
      network_error: false,
    });
    expect(errorProperties(new SseHttpError(429, 'Acme body'))).toEqual({
      error_type: 'SseHttpError',
      http_status: 429,
      network_error: false,
    });
  });

  it('flags failures that never reached the server', () => {
    expect(errorProperties(new TypeError('Failed to fetch'))).toEqual({ error_type: 'TypeError', network_error: true });
    expect(errorProperties(new DOMException('slow', 'TimeoutError'))).toEqual({
      error_type: 'TimeoutError',
      network_error: true,
    });
    expect(errorProperties(new ApiError(0, 'offline'))).toEqual({ error_type: 'ApiError', network_error: true });
  });

  it('does not send a name that is not a code identifier, or a thrown non-error', () => {
    const custom = new Error('x');
    custom.name = 'Model "Acme" invalid';
    expect(errorProperties(custom).error_type).toBe('unknown');
    expect(errorProperties('Acme string')).toEqual({ error_type: 'unknown', network_error: false });
    expect(errorProperties(undefined)).toEqual({ error_type: 'unknown', network_error: false });
  });
});

describe('trackFailure', () => {
  it('adds the error kind to the event properties', () => {
    trackFailure('local_deploy_failed', new ApiError(500, 'Acme'), { duration_ms: 12 });
    expect(captureEvent).toHaveBeenCalledWith('local_deploy_failed', {
      duration_ms: 12,
      error_type: 'ApiError',
      http_status: 500,
      network_error: false,
    });
  });
});

describe('error_shown', () => {
  it('is sent for every reported failure, with the error kind only', () => {
    reportError('Could not save "Acme"', { error: new ApiError(500, 'Acme') });
    reportError('Open a project first');
    expect(captureEvent.mock.calls).toEqual([
      ['error_shown', { error_type: 'ApiError', http_status: 500, network_error: false }],
      ['error_shown', { error_type: 'unknown', network_error: false }],
    ]);
    expect(JSON.stringify(captureEvent.mock.calls)).not.toMatch(/Acme/);
  });
});

describe('uncaught_error', () => {
  const listeners: [string, EventListener][] = [];
  const realAdd = window.addEventListener.bind(window);

  beforeEach(() => {
    vi.spyOn(window, 'addEventListener').mockImplementation((type: string, listener: any) => {
      listeners.push([type, listener]);
      realAdd(type, listener);
    });
  });

  afterEach(() => {
    for (const [type, listener] of listeners.splice(0)) window.removeEventListener(type, listener);
    vi.restoreAllMocks();
  });

  it('reports window errors and unhandled rejections', () => {
    trackUncaughtErrors();
    const handler = (type: string) => listeners.find(([t]) => t === type)![1];
    handler('error')(Object.assign(new Event('error'), { error: new RangeError('Acme') }));
    handler('unhandledrejection')(Object.assign(new Event('unhandledrejection'), { reason: new ApiError(503, 'Acme') }));
    expect(captureEvent.mock.calls).toEqual([
      ['uncaught_error', { kind: 'error', error_type: 'RangeError', network_error: false }],
      ['uncaught_error', { kind: 'rejection', error_type: 'ApiError', http_status: 503, network_error: false }],
    ]);
  });
});
