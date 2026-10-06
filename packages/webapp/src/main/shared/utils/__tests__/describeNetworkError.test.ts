import { describe, it, expect } from 'vitest';
import { describeNetworkError, isNetworkError } from '../describeNetworkError';
import { ApiError } from '../../api/api-client';

const UNREACHABLE = "Couldn’t reach the server. Check your connection and try again.";

describe('describeNetworkError', () => {
  it.each([
    ['Chrome', new TypeError('Failed to fetch')],
    ['Firefox', new TypeError('NetworkError when attempting to fetch resource.')],
    ['Safari', new TypeError('Load failed')],
    ['abort', new DOMException('The user aborted a request.', 'AbortError')],
    ['timeout', new DOMException('Request timed out after 30000ms', 'TimeoutError')],
    ['ApiError status 0', new ApiError(0, 'Request failed')],
  ])('maps a %s network failure to plain copy', (_label, error) => {
    expect(isNetworkError(error)).toBe(true);
    expect(describeNetworkError(error)).toBe(UNREACHABLE);
  });

  it('keeps the message of a real server or app error', () => {
    expect(isNetworkError(new ApiError(500, 'Conversion failed'))).toBe(false);
    expect(describeNetworkError(new ApiError(500, 'Conversion failed'))).toBe('Conversion failed');
    expect(describeNetworkError(new TypeError("Cannot read properties of undefined (reading 'x')"))).toBe(
      "Cannot read properties of undefined (reading 'x')",
    );
    expect(describeNetworkError('plain string')).toBe('plain string');
  });

  it('uses the supplied translate function', () => {
    const t = (key: string) => `[${key}]`;
    expect(describeNetworkError(new TypeError('Failed to fetch'), t)).toBe('[errors.network.unreachable]');
  });
});
