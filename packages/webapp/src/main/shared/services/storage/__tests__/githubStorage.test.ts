import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearContinueFromGithubIntent,
  clearGitHubSession,
  clearSpecDrivenPushIntent,
  expireGitHubSession,
  forgetGitHubSignIn,
  isGitHubSessionExpired,
  readContinueFromGithubIntent,
  readGitHubSession,
  readGitHubSessionTimestamp,
  readGitHubUsername,
  readSpecDrivenPushIntent,
  writeContinueFromGithubIntent,
  writeGitHubSession,
  writeGitHubUsername,
  writeSpecDrivenPushIntent,
} from '../githubStorage';
import {
  localStorageGitHubUsername,
  sessionStorageContinueFromGithubIntent,
  sessionStorageGitHubSession,
  sessionStorageGitHubSessionExpired,
  sessionStorageGitHubSessionTimestamp,
  sessionStorageSpecDrivenPushIntent,
} from '../../../constants/constant';

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('sign-in', () => {
  it('stores a session with its timestamp and clears an earlier expiry', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_700_000_000_000);
    sessionStorage.setItem(sessionStorageGitHubSessionExpired, '1');

    writeGitHubSession('session-abcdef');

    expect(sessionStorage.getItem(sessionStorageGitHubSession)).toBe('session-abcdef');
    expect(sessionStorage.getItem(sessionStorageGitHubSessionTimestamp)).toBe('1700000000000');
    expect(isGitHubSessionExpired()).toBe(false);
    expect(readGitHubSession()).toBe('session-abcdef');
    expect(readGitHubSessionTimestamp()).toBe(1_700_000_000_000);
  });

  it('reads a missing timestamp as 0', () => {
    expect(readGitHubSessionTimestamp()).toBe(0);
  });

  it('expires the session but keeps the username', () => {
    writeGitHubSession('session-abcdef');
    writeGitHubUsername('octocat');

    expireGitHubSession();

    expect(readGitHubSession()).toBeNull();
    expect(sessionStorage.getItem(sessionStorageGitHubSessionTimestamp)).toBeNull();
    expect(isGitHubSessionExpired()).toBe(true);
    expect(localStorage.getItem(localStorageGitHubUsername)).toBe('octocat');
    expect(readGitHubUsername()).toBe('octocat');
  });

  it('clearGitHubSession leaves the expiry mark alone', () => {
    expireGitHubSession();
    writeGitHubSession('session-abcdef');
    sessionStorage.setItem(sessionStorageGitHubSessionExpired, '1');
    clearGitHubSession();
    expect(readGitHubSession()).toBeNull();
    expect(isGitHubSessionExpired()).toBe(true);
  });

  it('forgets everything on sign-out', () => {
    writeGitHubSession('session-abcdef');
    writeGitHubUsername('octocat');
    sessionStorage.setItem(sessionStorageGitHubSessionExpired, '1');

    forgetGitHubSignIn();

    expect(readGitHubSession()).toBeNull();
    expect(isGitHubSessionExpired()).toBe(false);
    expect(readGitHubUsername()).toBeNull();
  });
});

describe('Continue from GitHub intent', () => {
  it('defaults to the repo-picker marker and round-trips a resume point', () => {
    expect(readContinueFromGithubIntent()).toBeNull();
    writeContinueFromGithubIntent();
    expect(sessionStorage.getItem(sessionStorageContinueFromGithubIntent)).toBe('1');
    writeContinueFromGithubIntent('{"step":"welcome"}');
    expect(readContinueFromGithubIntent()).toBe('{"step":"welcome"}');
    clearContinueFromGithubIntent();
    expect(readContinueFromGithubIntent()).toBeNull();
  });

  it('never throws when sessionStorage does', () => {
    vi.spyOn(sessionStorage, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(sessionStorage, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(sessionStorage, 'removeItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(readContinueFromGithubIntent()).toBeNull();
    expect(() => writeContinueFromGithubIntent()).not.toThrow();
    expect(() => clearContinueFromGithubIntent()).not.toThrow();
    expect(readSpecDrivenPushIntent()).toBeNull();
    expect(() => writeSpecDrivenPushIntent({ runId: 'r', projectId: 'p' })).not.toThrow();
    expect(() => clearSpecDrivenPushIntent()).not.toThrow();
  });
});

describe('Spec-Driven push intent', () => {
  it('round-trips the run and project as JSON', () => {
    writeSpecDrivenPushIntent({ runId: 'run-1', projectId: 'project-1' });
    expect(JSON.parse(sessionStorage.getItem(sessionStorageSpecDrivenPushIntent) ?? '')).toEqual({
      runId: 'run-1',
      projectId: 'project-1',
    });
    expect(readSpecDrivenPushIntent()).toEqual({ runId: 'run-1', projectId: 'project-1' });
    clearSpecDrivenPushIntent();
    expect(readSpecDrivenPushIntent()).toBeNull();
  });

  it('reads a corrupted value as no intent', () => {
    sessionStorage.setItem(sessionStorageSpecDrivenPushIntent, '{not json');
    expect(readSpecDrivenPushIntent()).toBeNull();
  });
});
