import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  claimGitHubStarPrompt,
  markGitHubStarPrompted,
  readAnalyticsConsent,
  readPreferredInterface,
  writeAnalyticsConsent,
  writePreferredInterface,
} from '../preferencesStorage';
import {
  localStorageAnalyticsConsent,
  localStorageGitHubStarPrompted,
  localStoragePreferredInterface,
} from '../../../constants/constant';

const failLocalStorage = () => {
  for (const method of ['getItem', 'setItem', 'removeItem'] as const) {
    vi.spyOn(localStorage, method).mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
  }
};

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('preferred interface', () => {
  it('saves, reads and forgets the choice', () => {
    expect(readPreferredInterface()).toBeNull();
    writePreferredInterface('agent');
    expect(localStorage.getItem(localStoragePreferredInterface)).toBe('agent');
    expect(readPreferredInterface()).toBe('agent');
    writePreferredInterface(null);
    expect(localStorage.getItem(localStoragePreferredInterface)).toBeNull();
  });

  it('ignores an unknown stored value', () => {
    localStorage.setItem(localStoragePreferredInterface, 'canvas');
    expect(readPreferredInterface()).toBeNull();
  });
});

describe('GitHub star prompt', () => {
  it('is claimed once per browser', () => {
    expect(claimGitHubStarPrompt()).toBe(true);
    expect(localStorage.getItem(localStorageGitHubStarPrompted)).toBe('true');
    expect(claimGitHubStarPrompt()).toBe(false);
  });

  it('is not claimable after being marked done', () => {
    markGitHubStarPrompted();
    expect(claimGitHubStarPrompt()).toBe(false);
  });
});

describe('analytics consent', () => {
  it('round-trips the consent record as JSON', () => {
    const consent = { status: 'accepted' as const, timestamp: '2026-11-02T00:00:00.000Z', version: '1.2' };
    expect(writeAnalyticsConsent(consent)).toBe(true);
    expect(JSON.parse(localStorage.getItem(localStorageAnalyticsConsent) ?? '')).toEqual(consent);
    expect(readAnalyticsConsent()).toEqual(consent);
  });

  it('reads a corrupted record as none', () => {
    localStorage.setItem(localStorageAnalyticsConsent, '{oops');
    expect(readAnalyticsConsent()).toBeNull();
  });
});

it('never throws when localStorage does', () => {
  failLocalStorage();
  expect(readPreferredInterface()).toBeNull();
  expect(() => writePreferredInterface('model')).not.toThrow();
  expect(() => markGitHubStarPrompted()).not.toThrow();
  expect(claimGitHubStarPrompt()).toBe(false);
  expect(readAnalyticsConsent()).toBeNull();
  expect(writeAnalyticsConsent({ status: 'declined', timestamp: '', version: '1.2' })).toBe(false);
});
