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
  project: { loadProject: vi.fn(async () => {}) },
  dispatch: () => {},
}));
const post = vi.hoisted(() => vi.fn());
vi.mock('../../../../shared/api/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../shared/api/api-client')>();
  return { ...actual, apiClient: { post } };
});
const storeRepoModelAsProject = vi.hoisted(() =>
  vi.fn((data: { name: string }, id: string) => ({ id, name: data.name, diagrams: { ClassDiagram: [{ model: { v: 2 } }] } })),
);
vi.mock('../../../../shared/services/project-import/projectImport', () => ({ storeRepoModelAsProject }));
vi.mock('../../../../shared/utils/projectExportUtils', () => ({ buildProjectExportEnvelope: () => ({}) }));
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

describe('useSpecDrivenGithubPush — a run that changed the model', () => {
  const project = { id: 'p1', name: 'Library', diagrams: { ClassDiagram: [{ model: { v: 1 } }] } } as never;
  const response = (projectExport: unknown) => ({
    success: true, repo_url: '', owner: 'me', repo_name: 'library', is_first_push: false, files_uploaded: 3,
    branch: 'main', commit_sha: 'c'.repeat(40), status: 'pushed', conflict_branch: null, pull_request_url: null,
    base_run_id: null, warnings: [], project_export: projectExport,
  });
  const push = async () => {
    const { result } = renderHook(() => useSpecDrivenGithubPush({ currentProject: project }));
    await act(async () => {
      await result.current.dialog.push({ useExisting: true, repoName: 'library', isPrivate: true });
    });
  };

  beforeEach(() => {
    localStorage.clear();
    setProjectGitHubLink('p1', { owner: 'me', repo: 'library', branch: 'main', baseCommitSha: 'a'.repeat(40) });
    post.mockReset();
    storeRepoModelAsProject.mockClear();
    stable.project.loadProject.mockClear();
  });

  it('loads the model the push wrote, so the editor matches the repo', async () => {
    post.mockResolvedValue(response({ name: 'Library with User' }));

    await push();

    expect(storeRepoModelAsProject).toHaveBeenCalledWith({ name: 'Library with User' }, 'p1');
    expect(stable.project.loadProject).toHaveBeenCalledWith('p1');
    // Synced at the pushed commit, its fingerprint taken once the editor settles on the new model.
    expect(getProjectGitHubLink('p1')).toMatchObject({ baseCommitSha: 'c'.repeat(40), baselinePending: true });
  });

  it('keeps the editor model when the push wrote the model the editor sent', async () => {
    post.mockResolvedValue(response(null));

    await push();

    expect(storeRepoModelAsProject).not.toHaveBeenCalled();
    expect(getProjectGitHubLink('p1')?.baseCommitSha).toBe('c'.repeat(40));
    expect(getProjectGitHubLink('p1')?.syncedModel).toBeTruthy();
  });
});
