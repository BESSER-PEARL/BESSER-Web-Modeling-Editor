import { afterEach, describe, expect, it, vi } from 'vitest';

const importRepoAsRun = vi.fn();
vi.mock('../../../github/services/githubApi', () => ({
  importRepoAsRun: (...args: unknown[]) => importRepoAsRun(...args),
}));
vi.mock('../../../../shared/services/project-import/projectImport', () => ({
  importProjectFromJson: vi.fn(async () => ({ id: 'p-new', name: 'Library', diagrams: {} })),
}));

import { continueFromGithubRepo } from '../continueFromGithub';
import { getProjectGitHubLink } from '../../../../shared/services/storage/projectGitHubLink';
import { readProjectLastRun } from '../../storage';

const HEAD = 'b'.repeat(40);
const RUN = 'f'.repeat(32);

afterEach(() => {
  localStorage.clear();
  importRepoAsRun.mockReset();
});

describe('continueFromGithubRepo', () => {
  it('links the new project to the repo at the imported commit', async () => {
    importRepoAsRun.mockResolvedValue({
      run_id: RUN, project: { project: {} }, has_model: true,
      owner: 'me', repo: 'app', branch: 'main', commit_sha: HEAD,
    });

    const result = await continueFromGithubRepo({ owner: 'me', repo: 'app', githubSession: 's' });

    expect(result).toMatchObject({ ok: true, projectId: 'p-new', runId: RUN });
    // The base commit is what makes the next push merge newer commits instead of reverting them.
    expect(getProjectGitHubLink('p-new')).toMatchObject({ owner: 'me', repo: 'app', branch: 'main', baseCommitSha: HEAD });
    expect(readProjectLastRun('p-new')?.runId).toBe(RUN);
  });

  it('reports a repo without a BESSER model instead of opening an empty project', async () => {
    importRepoAsRun.mockResolvedValue({
      run_id: RUN, project: null, has_model: false,
      owner: 'me', repo: 'notes', branch: 'main', commit_sha: HEAD,
    });

    const result = await continueFromGithubRepo({ owner: 'me', repo: 'notes', githubSession: 's' });

    expect(result).toMatchObject({ ok: false, needsEditorFirst: true });
    expect(getProjectGitHubLink('p-new')).toBeNull();
  });
});
