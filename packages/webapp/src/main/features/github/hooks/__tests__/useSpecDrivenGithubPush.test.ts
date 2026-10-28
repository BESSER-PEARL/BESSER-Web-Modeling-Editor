import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../../../shared/api/api-client';
import {
  getProjectGitHubLink,
  setProjectGitHubLink,
} from '../../../../shared/services/storage/projectGitHubLink';
import { describePushError, useSpecDrivenGithubPush } from '../useSpecDrivenGithubPush';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn() } }));
// Stable references, as the real hooks return: the hook's effects depend on them.
const stable = vi.hoisted(() => ({
  auth: { isAuthenticated: true, githubSession: 'session', login: () => {} },
  project: { loadProject: async () => {} },
  dispatch: () => {},
}));
vi.mock('../useGitHubAuth', () => ({ useGitHubAuth: () => stable.auth }));
vi.mock('../../../../app/hooks/useProject', () => ({ useProject: () => stable.project }));
vi.mock('../../../../app/store/hooks', () => ({
  useAppDispatch: () => stable.dispatch,
  useAppSelector: (select: (state: unknown) => unknown) => select({ specDriven: { pushDialogRunId: 'run-1' } }),
}));

describe('describePushError', () => {
  it('tells a missing repository apart from an expired generation', () => {
    expect(describePushError(new ApiError(404, 'repo_missing')).code).toBe('repo_missing');
    expect(describePushError(new ApiError(404, 'run_expired')).code).toBe('expired');
  });

  it('tells a taken repository name apart from a branch that moved', () => {
    expect(describePushError(new ApiError(409, 'name already exists on this account')).code).toBe('conflict');
    const moved = describePushError(new ApiError(409, 'Update is not a fast forward'));
    expect(moved.code).toBe('branch_moved');
    expect(moved.message).toContain('Update is not a fast forward');
  });

  it('says when the account cannot write to the repository', () => {
    expect(describePushError(new ApiError(403, 'Resource not accessible')).code).toBe('forbidden');
  });
});

describe('useSpecDrivenGithubPush — Change repo', () => {
  const project = { id: 'p1', name: 'Library' } as never;
  const link = { owner: 'me', repo: 'library', branch: 'main', baseCommitSha: 'a'.repeat(40) };

  beforeEach(() => {
    localStorage.clear();
    setProjectGitHubLink('p1', link);
  });

  it('keeps the project link until a push to another repository succeeds', () => {
    const { result } = renderHook(() => useSpecDrivenGithubPush({ currentProject: project }));
    expect(result.current.dialog.linkedRepo?.repo).toBe('library');

    act(() => result.current.dialog.onChangeRepo());

    expect(result.current.dialog.linkedRepo).toBeNull();
    expect(getProjectGitHubLink('p1')).toMatchObject(link);
  });
});
