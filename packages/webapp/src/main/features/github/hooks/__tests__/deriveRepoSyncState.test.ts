import { describe, expect, it } from 'vitest';

import { deriveRepoSyncState } from '../useRepoSync';

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
});
