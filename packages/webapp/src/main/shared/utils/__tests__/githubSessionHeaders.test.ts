import { afterEach, describe, expect, it, vi } from 'vitest';

import { githubSessionHeaders } from '../githubSessionHeaders';

function sessionStorageWith(value?: string) {
  return {
    getItem: vi.fn(() => value ?? null),
  } as unknown as Storage;
}

describe('githubSessionHeaders', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns no header for an anonymous browser session', () => {
    vi.stubGlobal('window', { sessionStorage: sessionStorageWith() });
    expect(githubSessionHeaders()).toEqual({});
  });

  it('reads the active session without copying it elsewhere', () => {
    vi.stubGlobal('window', {
      sessionStorage: sessionStorageWith(' session-token '),
    });
    expect(githubSessionHeaders()).toEqual({
      'X-GitHub-Session': 'session-token',
    });
  });
});
