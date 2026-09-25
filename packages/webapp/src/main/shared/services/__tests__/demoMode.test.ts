/**
 * `?demo=<token>` puts one tab on the server-paid tier (the operator's key).
 *
 * Two things matter here and nothing else does: a stray or malformed value
 * must NOT switch the tab onto the paid key, and the token must not outlive
 * the tab it was opened in.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { getDemoToken, initDemoModeFromUrl } from '../demoMode';

const STORAGE_KEY = 'besser-demo-token';
const VALID = 'demo-token-abc123';

function openWith(search: string): void {
  window.history.replaceState({}, '', search ? `/?${search}` : '/');
  initDemoModeFromUrl();
}

beforeEach(() => {
  window.sessionStorage.clear();
  window.history.replaceState({}, '', '/');
});

describe('reading the demo link', () => {
  it('stores a valid token for the tab', () => {
    openWith(`demo=${VALID}`);
    expect(getDemoToken()).toBe(VALID);
    expect(getDemoToken()).not.toBeNull();
  });

  it('is off without the parameter', () => {
    openWith('');
    expect(getDemoToken()).toBeNull();
    expect(getDemoToken()).toBeNull();
  });

  it('keeps other query parameters out of it', () => {
    openWith('pilot=P3');
    expect(getDemoToken()).toBeNull();
  });

  it.each([
    ['empty', 'demo='],
    ['too short to be a secret', 'demo=1'],
    ['a path separator', 'demo=abc%2F..%2Fetc'],
    ['spaces', 'demo=not%20a%20token'],
    ['over-long', `demo=${'a'.repeat(129)}`],
  ])('ignores a %s value', (_label, search) => {
    openWith(search);
    expect(getDemoToken()).toBeNull();
  });

  it('is idempotent', () => {
    openWith(`demo=${VALID}`);
    initDemoModeFromUrl();
    initDemoModeFromUrl();
    expect(getDemoToken()).toBe(VALID);
  });
});

describe('storing the token', () => {
  it('uses sessionStorage, so it dies with the tab', () => {
    openWith(`demo=${VALID}`);
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBe(VALID);
  });

  it('refuses a corrupted stored value on read', () => {
    window.sessionStorage.setItem(STORAGE_KEY, 'no spaces allowed');
    expect(getDemoToken()).toBeNull();
  });
});
