import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getProjectGitHubLink,
  modelFingerprint,
  setProjectGitHubLink,
} from '../../../../shared/services/storage/projectGitHubLink';
import type { SyncStatus } from '../../services/githubApi';
import { useRepoSync } from '../useRepoSync';

const BASE = 'a'.repeat(40);
const SAVED = 'b'.repeat(40);
const project = { id: 'p1', name: 'Library', diagrams: { ClassDiagram: [{ model: { v: 1 } }] } };

// Stable references, as the real hooks return: the hook's effects depend on them.
const stable = vi.hoisted(() => ({
  auth: { isAuthenticated: true, isExpired: false, githubSession: 'session' as string | null },
  project: { currentProject: null as unknown, loadProject: vi.fn(async () => {}) },
  dispatch: vi.fn(),
}));
const api = vi.hoisted(() => ({
  getSyncStatus: vi.fn(),
  saveModel: vi.fn(),
  createPullRequest: vi.fn(),
  loadModelAtCommit: vi.fn(),
}));
vi.mock('../../services/githubApi', () => api);
vi.mock('../../../../shared/hooks/useGitHubAuth', () => ({ useGitHubAuth: () => stable.auth }));
vi.mock('../../../../app/hooks/useProject', () => ({ useProject: () => stable.project }));
vi.mock('../../../../app/store/hooks', () => ({ useAppDispatch: () => stable.dispatch }));
vi.mock('../../../../shared/services/storage/ProjectStorageRepository', () => ({
  ProjectStorageRepository: { loadProject: () => project },
}));
vi.mock('../../../../shared/utils/projectExportUtils', () => ({ buildProjectExportEnvelope: () => ({}) }));
vi.mock('../../../spec-driven/services/continueFromGithub', () => ({ pullRepoIntoProject: vi.fn() }));

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
  Object.assign(stable.auth, { isAuthenticated: true, isExpired: false, githubSession: 'session' });
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

  it('offers Reconnect on a linked project when the session expired', () => {
    Object.assign(stable.auth, { isAuthenticated: false, isExpired: true, githubSession: null });

    const { result } = renderHook(() => useRepoSync());

    expect(result.current.state).toBe('reconnect');
    expect(api.getSyncStatus).not.toHaveBeenCalled();
  });
});
