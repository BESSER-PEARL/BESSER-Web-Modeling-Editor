import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getProjectGitHubLink,
  modelFingerprint,
  setProjectGitHubLink,
} from '../../../../shared/services/storage/projectGitHubLink';
import type { SyncStatus } from '../../../../shared/api/github';
import { useRepoSync } from '../useRepoSync';

const BASE = 'a'.repeat(40);
const SAVED = 'b'.repeat(40);
const project = { id: 'p1', name: 'Library', diagrams: { ClassDiagram: [{ model: { v: 1 } }] } };

// Stable references, as the real hooks return: the hook's effects depend on them.
const stable = vi.hoisted(() => ({
  auth: { isAuthenticated: true, isExpired: false, isNotInTab: false, githubSession: 'session' as string | null },
  project: { currentProject: null as unknown, loadProject: vi.fn(async () => {}) },
  dispatch: vi.fn(),
}));
const api = vi.hoisted(() => ({
  getSyncStatus: vi.fn(),
  saveModel: vi.fn(),
  createPullRequest: vi.fn(),
  loadModelAtCommit: vi.fn(),
}));
vi.mock('../../../../shared/api/github', () => api);
vi.mock('../../../../shared/hooks/useGitHubAuth', () => ({ useGitHubAuth: () => stable.auth }));
vi.mock('../../../../app/hooks/useProject', () => ({ useProject: () => stable.project }));
vi.mock('../../../../app/store/hooks', () => ({ useAppDispatch: () => stable.dispatch }));
vi.mock('../../../../shared/services/storage/ProjectStorageRepository', () => ({
  ProjectStorageRepository: { loadProject: () => project },
}));
vi.mock('../../../../shared/utils/projectExportUtils', () => ({ buildProjectExportEnvelope: () => ({}) }));
const pullRepoIntoProject = vi.hoisted(() => vi.fn());
vi.mock('../../../../shared/services/github/pullRepoIntoProject', () => ({ pullRepoIntoProject }));

const status = (commitsSince = 0, pending: SyncStatus['pending'] = null): SyncStatus => ({
  head_sha: 'f'.repeat(40),
  commits_since: Array.from({ length: commitsSince }, (_, i) => ({
    sha: String(i).repeat(40), message: 'theirs', author: 'ben', date: '', html_url: '', origin: null,
  })),
  in_sync: commitsSince === 0,
  pending,
});

beforeEach(() => {
  localStorage.clear();
  stable.project.currentProject = project;
  Object.assign(stable.auth, { isAuthenticated: true, isExpired: false, isNotInTab: false, githubSession: 'session' });
  pullRepoIntoProject.mockReset();
  Object.values(api).forEach((fn) => fn.mockReset());
  setProjectGitHubLink('p1', {
    owner: 'me', repo: 'library', branch: 'main', baseCommitSha: BASE, syncedModel: modelFingerprint(project as never),
  });
});

describe('useRepoSync', () => {
  it('remembers a save GitHub could not merge, and opens its pull request once asked', async () => {
    api.getSyncStatus.mockResolvedValue(status());
    api.saveModel.mockResolvedValue({
      success: false, commit_sha: SAVED, message: '', status: 'conflict', conflict_branch: 'besser/sync-bbbbbbb',
    });
    api.createPullRequest.mockResolvedValue({ number: 4, html_url: 'https://github.com/me/library/pull/4' });
    const { result } = renderHook(() => useRepoSync());

    await act(async () => {
      await result.current.save('Rename Author');
    });
    expect(getProjectGitHubLink('p1')?.pendingChange).toMatchObject({ kind: 'conflict', branch: 'besser/sync-bbbbbbb' });

    // Opened later from the GitHub menu, which knows no message: the save's own message titles it.
    let url = '';
    await act(async () => {
      url = await result.current.openPullRequest('Model changes from the BESSER editor');
    });

    expect(url).toBe('https://github.com/me/library/pull/4');
    expect(api.createPullRequest).toHaveBeenCalledWith('session', expect.objectContaining({
      head: 'besser/sync-bbbbbbb', base: 'main', title: 'Rename Author',
    }));
    expect(getProjectGitHubLink('p1')?.pendingChange).toMatchObject({ pullRequestNumber: 4 });
  });

  it('asks about the pending branch, and forgets it once its pull request is merged', async () => {
    setProjectGitHubLink('p1', {
      ...getProjectGitHubLink('p1')!,
      pendingChange: { kind: 'conflict', branch: 'besser/sync-bbbbbbb', createdAt: '2026-10-29T10:00:00Z' },
    });
    api.getSyncStatus.mockResolvedValue(status(1, {
      branch: 'besser/sync-bbbbbbb', branch_exists: true, pull_request_number: 4,
      pull_request_url: 'https://github.com/me/library/pull/4', pull_request_state: 'merged',
    }));

    const { result } = renderHook(() => useRepoSync());

    await waitFor(() => expect(getProjectGitHubLink('p1')?.pendingChange).toBeUndefined());
    expect(api.getSyncStatus.mock.calls[0][5]).toBe('besser/sync-bbbbbbb');
    await waitFor(() => expect(result.current.state).toBe('behind'));
  });

  it('ignores a sync check answered for the commit before a save', async () => {
    // The check started at mount answers late, for the old base: the saved
    // commit would show as one new commit on GitHub.
    let answerOld: (value: SyncStatus) => void = () => undefined;
    api.getSyncStatus
      .mockReturnValueOnce(new Promise<SyncStatus>((resolve) => (answerOld = resolve)))
      .mockResolvedValue(status());
    api.saveModel.mockResolvedValue({ success: true, commit_sha: SAVED, message: '', status: 'pushed', conflict_branch: null });
    const { result } = renderHook(() => useRepoSync());

    await act(async () => {
      await result.current.save('Add Loan');
    });
    await act(async () => answerOld(status(1)));

    expect(getProjectGitHubLink('p1')?.baseCommitSha).toBe(SAVED);
    expect(result.current.state).toBe('in-sync');
  });

  it('checks GitHub once for every component showing the repo, also on focus (review repro)', async () => {
    // The GitHub menu and the chat header each polled sync-status on their own, and could disagree.
    api.getSyncStatus.mockResolvedValue(status());
    const menu = renderHook(() => useRepoSync());
    const chatHeader = renderHook(() => useRepoSync());

    await waitFor(() => expect(menu.result.current.state).toBe('in-sync'));
    expect(chatHeader.result.current.state).toBe('in-sync');
    expect(api.getSyncStatus).toHaveBeenCalledTimes(1);

    api.getSyncStatus.mockClear();
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(api.getSyncStatus).toHaveBeenCalledTimes(1);

    // Both see the same answer.
    api.getSyncStatus.mockResolvedValue(status(2));
    await act(async () => {
      await menu.result.current.refresh();
    });
    expect(menu.result.current.state).toBe('behind');
    expect(chatHeader.result.current.state).toBe('behind');
  });

  it('stops checking once nothing shows the repo any more', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    try {
      api.getSyncStatus.mockResolvedValue(status());
      const { unmount } = renderHook(() => useRepoSync());
      await waitFor(() => expect(api.getSyncStatus).toHaveBeenCalledTimes(1));
      unmount();
      api.getSyncStatus.mockClear();
      await act(async () => {
        vi.advanceTimersByTime(120_000);
        window.dispatchEvent(new Event('focus'));
      });
      expect(api.getSyncStatus).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("sends the old sidebar's model file on the first save, and forgets it once saved", async () => {
    // Models the old sidebar saved at <dir>/<project>.json stayed in the repo, invisible to the new menu.
    setProjectGitHubLink('p1', { ...getProjectGitHubLink('p1')!, legacyFilePath: 'models/library.json' });
    api.getSyncStatus.mockResolvedValue(status());
    api.saveModel.mockResolvedValue({ success: true, commit_sha: SAVED, message: '', status: 'pushed', conflict_branch: null });
    const { result } = renderHook(() => useRepoSync());

    await act(async () => {
      await result.current.save('First save');
    });
    expect(api.saveModel.mock.calls[0][1]).toMatchObject({ legacy_file_path: 'models/library.json' });
    expect(getProjectGitHubLink('p1')?.legacyFilePath).toBeUndefined();

    await act(async () => {
      await result.current.save('Second save');
    });
    expect(api.saveModel.mock.calls[1][1]).not.toHaveProperty('legacy_file_path');
  });

  it("keeps the old sidebar's file to delete when the save did not reach the branch", async () => {
    setProjectGitHubLink('p1', { ...getProjectGitHubLink('p1')!, legacyFilePath: 'models/library.json' });
    api.getSyncStatus.mockResolvedValue(status());
    api.saveModel.mockResolvedValue({
      success: false, commit_sha: SAVED, message: '', status: 'conflict', conflict_branch: 'besser/sync-bbbbbbb',
    });
    const { result } = renderHook(() => useRepoSync());

    await act(async () => {
      await result.current.save('Rename Author');
    });
    expect(getProjectGitHubLink('p1')?.legacyFilePath).toBe('models/library.json');
  });

  it('says "not connected in this tab" on a linked project in a tab without a session', () => {
    Object.assign(stable.auth, { isAuthenticated: false, isNotInTab: true, githubSession: null });

    const { result } = renderHook(() => useRepoSync());

    expect(result.current.state).toBe('not-in-tab');
    expect(api.getSyncStatus).not.toHaveBeenCalled();
  });

  it('offers Reconnect on a linked project when the session expired', () => {
    Object.assign(stable.auth, { isAuthenticated: false, isExpired: true, githubSession: null });

    const { result } = renderHook(() => useRepoSync());

    expect(result.current.state).toBe('reconnect');
    expect(api.getSyncStatus).not.toHaveBeenCalled();
  });
});
