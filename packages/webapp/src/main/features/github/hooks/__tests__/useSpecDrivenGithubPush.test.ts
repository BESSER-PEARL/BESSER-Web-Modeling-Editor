import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../../../shared/api/api-client';
import {
  getProjectGitHubLink,
  modelFingerprint,
  setProjectGitHubLink,
} from '../../../../shared/services/storage/projectGitHubLink';
import { recordRunSeedModel } from '../../../../shared/services/storage/specDrivenRunRecords';
import { describePushError, useSpecDrivenGithubPush } from '../useSpecDrivenGithubPush';

const RUN_ID = 'e'.repeat(32);
const confirm = vi.hoisted(() => ({ answer: false, fn: null as unknown as ReturnType<typeof vi.fn> }));
vi.mock('../../../../shared/services/confirm/globalConfirm', () => {
  confirm.fn = vi.fn(async () => confirm.answer);
  return { globalConfirm: confirm.fn };
});

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn() } }));
// Stable references, as the real hooks return: the hook's effects depend on them.
const stable = vi.hoisted(() => ({
  auth: { isAuthenticated: true, isChecking: false, githubSession: 'session' as string | null, login: vi.fn() },
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
vi.mock('../../../../shared/hooks/useGitHubAuth', () => ({ useGitHubAuth: () => stable.auth }));
vi.mock('../../../../app/hooks/useProject', () => ({ useProject: () => stable.project }));
vi.mock('../../../../app/store/hooks', () => ({
  useAppDispatch: () => stable.dispatch,
  useAppSelector: (select: (state: unknown) => unknown) => select({ specDriven: { pushDialogRunId: RUN_ID } }),
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
    // The run started from the model the project still holds.
    recordRunSeedModel(RUN_ID, modelFingerprint(project));
    post.mockReset();
    storeRepoModelAsProject.mockClear();
    stable.project.loadProject.mockClear();
    confirm.fn.mockClear();
    confirm.answer = false;
  });

  it('loads the model the push wrote, so the editor matches the repo', async () => {
    post.mockResolvedValue(response({ name: 'Library with User' }));

    await push();

    expect(confirm.fn).not.toHaveBeenCalled();
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

  it('keeps canvas edits made after the run started when the user keeps their model', async () => {
    // The class added on the canvas during the run must not vanish on Save to GitHub.
    recordRunSeedModel(RUN_ID, modelFingerprint({ id: 'p1', diagrams: { ClassDiagram: [{ model: { v: 0 } }] } } as never));
    post.mockResolvedValue(response({ name: 'Library with User' }));

    await push();

    expect(confirm.fn).toHaveBeenCalledTimes(1);
    expect(storeRepoModelAsProject).not.toHaveBeenCalled();
    expect(stable.project.loadProject).not.toHaveBeenCalled();
    // Linked at the pushed commit, with the user's model counted as not saved there yet.
    const link = getProjectGitHubLink('p1');
    expect(link?.baseCommitSha).toBe('c'.repeat(40));
    expect(link?.syncedModel).toBeUndefined();
    expect(link?.baselinePending).toBeUndefined();
  });

  it("takes the run's model over canvas edits only when the user says so", async () => {
    recordRunSeedModel(RUN_ID, modelFingerprint({ id: 'p1', diagrams: { ClassDiagram: [{ model: { v: 0 } }] } } as never));
    confirm.answer = true;
    post.mockResolvedValue(response({ name: 'Library with User' }));

    await push();

    expect(confirm.fn).toHaveBeenCalledTimes(1);
    expect(storeRepoModelAsProject).toHaveBeenCalledWith({ name: 'Library with User' }, 'p1');
  });

  it('asks when it cannot tell which model the run started from', async () => {
    localStorage.clear();
    setProjectGitHubLink('p1', { owner: 'me', repo: 'library', branch: 'main', baseCommitSha: 'a'.repeat(40) });
    post.mockResolvedValue(response({ name: 'Library with User' }));

    await push();

    expect(confirm.fn).toHaveBeenCalledTimes(1);
    expect(storeRepoModelAsProject).not.toHaveBeenCalled();
  });
});

describe('useSpecDrivenGithubPush — a push that did not land on the branch', () => {
  const project = { id: 'p1', name: 'Library', diagrams: { ClassDiagram: [{ model: { v: 1 } }] } } as never;
  const base = 'a'.repeat(40);
  const response = (extra: Record<string, unknown>) => ({
    success: true, repo_url: '', owner: 'acme', repo_name: 'library', is_first_push: false, files_uploaded: 3,
    branch: 'main', commit_sha: 'c'.repeat(40), conflict_branch: null, pull_request_url: null,
    pull_request_branch: null, base_run_id: null, warnings: [], project_export: null, ...extra,
  });
  const push = async (pushMode: 'commit' | 'pull_request' = 'commit') => {
    const { result } = renderHook(() => useSpecDrivenGithubPush({ currentProject: project }));
    await act(async () => {
      await result.current.dialog.push({ useExisting: true, owner: 'acme', repoName: 'library', isPrivate: true, pushMode });
    });
  };

  beforeEach(() => {
    localStorage.clear();
    setProjectGitHubLink('p1', { owner: 'acme', repo: 'library', branch: 'main', baseCommitSha: base });
    recordRunSeedModel(RUN_ID, modelFingerprint(project));
    confirm.fn.mockClear();
    confirm.answer = false;
    post.mockReset();
    storeRepoModelAsProject.mockClear();
    stable.project.loadProject.mockClear();
  });

  it('sends the owner of the linked repository, e.g. an organization', async () => {
    post.mockResolvedValue(response({ status: 'pushed' }));

    await push();

    expect(post.mock.calls[0][1].deploy_config).toMatchObject({ owner: 'acme', repo_name: 'library', base_commit_sha: base });
  });

  it('remembers a conflict branch on the project, so the GitHub menu can offer its pull request later', async () => {
    post.mockResolvedValue(response({ status: 'conflict', commit_sha: 'd'.repeat(40), conflict_branch: 'besser/sync-ddddddd' }));

    await push();

    const link = getProjectGitHubLink('p1');
    expect(link?.pendingChange).toMatchObject({ kind: 'conflict', branch: 'besser/sync-ddddddd' });
    expect(link?.baseCommitSha).toBe(base); // the branch did not move
  });

  it("shows the run's model after a pull-request push, unsaved against the branch until the PR is merged", async () => {
    post.mockResolvedValue(response({
      status: 'pull_request', pull_request_url: 'https://github.com/acme/library/pull/7',
      pull_request_branch: 'besser/update-1234abcd', project_export: { name: 'Library with Loan' },
    }));

    await push('pull_request');

    expect(storeRepoModelAsProject).toHaveBeenCalledWith({ name: 'Library with Loan' }, 'p1');
    expect(stable.project.loadProject).toHaveBeenCalledWith('p1');
    const link = getProjectGitHubLink('p1');
    expect(link?.baseCommitSha).toBe(base);
    expect(link?.syncedModel).toBeUndefined();
    expect(link?.pendingChange).toMatchObject({
      kind: 'pull_request', branch: 'besser/update-1234abcd', pullRequestUrl: 'https://github.com/acme/library/pull/7',
    });
  });

  it("keeps the user's newer canvas after a pull-request push when they keep their model", async () => {
    recordRunSeedModel(RUN_ID, 'another model');
    post.mockResolvedValue(response({
      status: 'pull_request', pull_request_url: 'https://github.com/acme/library/pull/7',
      pull_request_branch: 'besser/update-1234abcd', project_export: { name: 'Library with Loan' },
    }));

    await push('pull_request');

    expect(confirm.fn).toHaveBeenCalledTimes(1);
    expect(storeRepoModelAsProject).not.toHaveBeenCalled();
    expect(getProjectGitHubLink('p1')?.pendingChange).toMatchObject({ kind: 'pull_request' });
  });
});

describe('useSpecDrivenGithubPush — sign-in', () => {
  beforeEach(() => {
    stable.auth.login.mockClear();
    sessionStorage.clear();
  });

  it('waits while the stored session is being checked instead of starting a new sign-in', () => {
    Object.assign(stable.auth, { isAuthenticated: false, isChecking: true, githubSession: null });
    try {
      renderHook(() => useSpecDrivenGithubPush({ currentProject: { id: 'p1', name: 'Library' } as never }));
      expect(stable.auth.login).not.toHaveBeenCalled();
    } finally {
      Object.assign(stable.auth, { isAuthenticated: true, isChecking: false, githubSession: 'session' });
    }
  });
});
