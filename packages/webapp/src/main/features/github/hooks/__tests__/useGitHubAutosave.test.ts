import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SyncStatus } from '../../../../shared/api/github';
import {
  modelFingerprint,
  setProjectGitHubLink,
  type ProjectGitHubLink,
} from '../../../../shared/services/storage/projectGitHubLink';
import { AUTOSAVE_DEBOUNCE_MS, AUTOSAVE_MIN_INTERVAL_MS } from '../../autosave/GitHubAutosaveController';
import { getAutosaveStatus } from '../../autosave/autosaveStatus';
import { autosavePause, useGitHubAutosave } from '../useGitHubAutosave';
import type { RepoSync } from '../useRepoSync';

const project = { id: 'p1', name: 'Library', diagrams: { ClassDiagram: [{ model: { v: 2 } }] } };
const stable = vi.hoisted(() => ({ project: { currentProject: null as unknown } }));
vi.mock('../../../../app/hooks/useProject', () => ({ useProject: () => stable.project }));
vi.mock('../../../../shared/services/storage/ProjectStorageRepository', () => ({
  ProjectStorageRepository: { loadProject: () => project },
}));

const repo = vi.hoisted(() => ({
  snapshot: { status: null as SyncStatus | null, isChecking: false, checkError: null as string | null },
  refreshRepoSync: vi.fn(async () => undefined),
}));
vi.mock('../../../../shared/services/github/repoSyncStatus', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../shared/services/github/repoSyncStatus')>()),
  refreshRepoSync: repo.refreshRepoSync,
  getRepoSyncSnapshot: () => repo.snapshot,
}));

const status = (commitsSince = 0): SyncStatus => ({
  head_sha: 'f'.repeat(40),
  commits_since: Array.from({ length: commitsSince }, (_, i) => ({
    sha: String(i).repeat(40), message: 'theirs', author: 'ben', author_login: 'ben', is_merge: false, date: '', html_url: '', origin: null,
  })),
  in_sync: commitsSince === 0,
  pending: null,
});

const LINK: ProjectGitHubLink = { owner: 'ana', repo: 'shop', branch: 'main', baseCommitSha: 'a'.repeat(40), syncedModel: 'old' };

const makeSync = (overrides: Partial<RepoSync> = {}): RepoSync => ({
  link: { ...LINK, autoSave: true },
  state: 'local-changes',
  hasLocalChanges: true,
  githubSession: 'session',
  save: vi.fn(async () => ({ status: 'pushed', commit_sha: 'b'.repeat(40) })),
  ...overrides,
}) as unknown as RepoSync;

const storeLink = (link: ProjectGitHubLink) => setProjectGitHubLink('p1', link);

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  stable.project.currentProject = { ...project };
  repo.snapshot = { status: status(0), isChecking: false, checkError: null };
  repo.refreshRepoSync.mockClear();
});
afterEach(() => vi.useRealTimers());

describe('autosavePause', () => {
  it('waits for new commits, an unmerged save, the session and a missing repo', () => {
    expect(autosavePause('local-changes', LINK)).toBeNull();
    expect(autosavePause('in-sync', LINK)).toBeNull();
    expect(autosavePause('behind', LINK)).toBe('remote');
    expect(autosavePause('diverged', LINK)).toBe('remote');
    expect(autosavePause('reconnect', LINK)).toBe('auth');
    expect(autosavePause('missing', LINK)).toBe('missing');
    expect(autosavePause('local-changes', {
      ...LINK, pendingChange: { kind: 'conflict', branch: 'besser/conflict', createdAt: '' },
    })).toBe('conflict');
    // A spec-driven pull request leaves the linked branch alone.
    expect(autosavePause('local-changes', {
      ...LINK, pendingChange: { kind: 'pull_request', branch: 'besser/run', createdAt: '' },
    })).toBeNull();
  });
});

describe('useGitHubAutosave', () => {
  it('stays off when the link has not turned it on (the default)', async () => {
    storeLink(LINK);
    const sync = makeSync({ link: LINK });
    renderHook(() => useGitHubAutosave({ sync, flushEditor: () => undefined }));
    await vi.advanceTimersByTimeAsync(5 * AUTOSAVE_MIN_INTERVAL_MS);
    expect(sync.save).not.toHaveBeenCalled();
    expect(getAutosaveStatus('p1')).toEqual({ phase: 'off' });
  });

  it('commits through the shared save after the quiet time, with the autosave message', async () => {
    storeLink({ ...LINK, autoSave: true });
    const flushEditor = vi.fn();
    const sync = makeSync();
    renderHook(() => useGitHubAutosave({ sync, flushEditor }));
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS - 1);
    expect(sync.save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(flushEditor).toHaveBeenCalled();
    expect(repo.refreshRepoSync).toHaveBeenCalledWith('p1', 'session');
    expect(sync.save).toHaveBeenCalledWith('Autosave the model from the BESSER editor', expect.any(Function));
    // The save flushes the editor again before it decides whether to load a merge.
    flushEditor.mockClear();
    vi.mocked(sync.save).mock.calls[0][1]?.();
    expect(flushEditor).toHaveBeenCalledTimes(1);
    expect(getAutosaveStatus('p1')).toMatchObject({ phase: 'idle', lastSavedAt: Date.now() });
  });

  it('does not commit when the stored model matches the synced one', async () => {
    storeLink({ ...LINK, autoSave: true, syncedModel: modelFingerprint(project as never) });
    const sync = makeSync();
    renderHook(() => useGitHubAutosave({ sync, flushEditor: () => undefined }));
    await vi.advanceTimersByTimeAsync(AUTOSAVE_MIN_INTERVAL_MS);
    expect(repo.refreshRepoSync).not.toHaveBeenCalled();
    expect(sync.save).not.toHaveBeenCalled();
  });

  it('does not push when the fresh check finds new commits, and resumes once they are taken in', async () => {
    storeLink({ ...LINK, autoSave: true });
    repo.snapshot = { status: status(2), isChecking: false, checkError: null };
    let sync = makeSync();
    const { rerender } = renderHook(() => useGitHubAutosave({ sync, flushEditor: () => undefined }));
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);
    expect(sync.save).not.toHaveBeenCalled();
    expect(getAutosaveStatus('p1')).toMatchObject({ phase: 'paused', pause: 'remote' });

    // The store's answer reaches the menu: the teammate card shows; the pause holds.
    sync = makeSync({ state: 'diverged', save: sync.save });
    rerender();
    await vi.advanceTimersByTimeAsync(5 * AUTOSAVE_MIN_INTERVAL_MS);
    expect(sync.save).not.toHaveBeenCalled();

    // Save and merge / Get latest brought the branch in.
    repo.snapshot = { status: status(0), isChecking: false, checkError: null };
    sync = makeSync({ state: 'local-changes', save: sync.save });
    rerender();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);
    expect(sync.save).toHaveBeenCalledTimes(1);
  });

  it('backs off with one error state when GitHub cannot be reached', async () => {
    storeLink({ ...LINK, autoSave: true });
    repo.snapshot = { status: null, isChecking: false, checkError: 'unreachable' };
    const sync = makeSync();
    renderHook(() => useGitHubAutosave({ sync, flushEditor: () => undefined }));
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);
    expect(getAutosaveStatus('p1').phase).toBe('error');
    expect(repo.refreshRepoSync).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(AUTOSAVE_MIN_INTERVAL_MS - AUTOSAVE_DEBOUNCE_MS - 1);
    expect(repo.refreshRepoSync).toHaveBeenCalledTimes(1);
    expect(sync.save).not.toHaveBeenCalled();
  });
});
