import { describe, expect, it } from 'vitest';

import { ApiError } from '../../../../shared/api/api-client';
import { deriveRepoSyncState, syncCheckError } from '../useRepoSync';

const link = { owner: 'me', repo: 'app', branch: 'main', baseCommitSha: 'a'.repeat(40) };
const commit = { sha: 'b'.repeat(40), message: 'Fix', author: 'Ana', date: '', html_url: '', origin: null };
const status = (behind: number) => ({
  head_sha: 'b'.repeat(40),
  commits_since: Array.from({ length: behind }, () => commit),
  in_sync: behind === 0,
});

const state = (over: Partial<Parameters<typeof deriveRepoSyncState>[0]>) =>
  deriveRepoSyncState({ isAuthenticated: true, link, status: status(0), isChecking: false, hasLocalChanges: false, ...over });

describe('deriveRepoSyncState', () => {
  it('says "not connected in this tab", not "reconnect", for a tab without a session', () => {
    expect(state({ isAuthenticated: false, isNotInTab: true, status: null })).toBe('not-in-tab');
    expect(state({ isAuthenticated: false, isExpired: true, status: null })).toBe('reconnect');
  });

  it('is in sync when nothing changed on either side', () => {
    expect(state({})).toBe('in-sync');
  });

  it('is behind when someone committed on GitHub since the last sync', () => {
    expect(state({ status: status(2) })).toBe('behind');
  });

  it('has local changes when only the model here changed', () => {
    expect(state({ hasLocalChanges: true })).toBe('local-changes');
  });

  it('is diverged when both sides changed', () => {
    expect(state({ status: status(1), hasLocalChanges: true })).toBe('diverged');
  });

  it('never claims a state it could not check', () => {
    expect(state({ status: null, isChecking: true })).toBe('checking');
    expect(state({ status: null })).toBe('unknown');
    expect(state({ link: null })).toBe('unlinked');
    expect(state({ isAuthenticated: false })).toBe('signed-out');
  });

  it('names why a check failed instead of one "could not reach GitHub"', () => {
    expect(state({ checkError: 'auth' })).toBe('reconnect');
    expect(state({ checkError: 'missing', status: null })).toBe('missing');
    expect(state({ checkError: 'unreachable', status: null })).toBe('unknown');
    expect(syncCheckError(new ApiError(401, 'GitHub session expired'))).toBe('auth');
    expect(syncCheckError(new ApiError(404, 'branch_missing'))).toBe('missing');
    expect(syncCheckError(new TypeError('Failed to fetch'))).toBe('unreachable');
  });
});
