import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ importRepoAsRun: vi.fn() }));
vi.mock('../../../api/github', () => api);
vi.mock('../../project-import/projectImport', () => ({
  storeRepoModelAsProject: (_data: unknown, id: string) => ({ id, name: 'OCL_Gen', diagrams: {} }),
}));
vi.mock('../../storage/specDrivenRunRecords', () => ({ writeProjectLastRun: vi.fn() }));

import { pullRepoIntoProject } from '../pullRepoIntoProject';
import { getProjectGitHubLink } from '../../storage/projectGitHubLink';

const imported = (modelPath: string) => ({
  run_id: 'r1', project: { id: 'x', name: 'OCL_Gen', diagrams: {} }, has_model: true,
  owner: 'ana', repo: 'ocl_gen', branch: 'main', commit_sha: 'c'.repeat(40), model_path: modelPath,
});

beforeEach(() => {
  localStorage.clear();
  api.importRepoAsRun.mockReset();
});

describe('pullRepoIntoProject: a model an older editor saved', () => {
  it('reads the remembered file and keeps remembering it, so the next save replaces it', async () => {
    api.importRepoAsRun.mockResolvedValue(imported('ocl_gen.json'));

    await pullRepoIntoProject('s', { owner: 'ana', repo: 'ocl_gen', branch: 'main', legacyFilePath: 'ocl_gen.json' }, 'p1');

    expect(api.importRepoAsRun).toHaveBeenCalledWith('s', 'ana', 'ocl_gen', 'main', { modelPath: 'ocl_gen.json' });
    expect(getProjectGitHubLink('p1')?.legacyFilePath).toBe('ocl_gen.json');
  });

  it('records the file the backend found when the link knew none', async () => {
    api.importRepoAsRun.mockResolvedValue(imported('ocl_gen.json'));

    await pullRepoIntoProject('s', { owner: 'ana', repo: 'ocl_gen', branch: 'main' }, 'p1');

    expect(getProjectGitHubLink('p1')?.legacyFilePath).toBe('ocl_gen.json');
  });

  it('forgets the file once the model lives in buml/diagrams.json', async () => {
    api.importRepoAsRun.mockResolvedValue(imported('buml/diagrams.json'));

    await pullRepoIntoProject('s', { owner: 'ana', repo: 'ocl_gen', branch: 'main', legacyFilePath: 'ocl_gen.json' }, 'p1');

    expect(getProjectGitHubLink('p1')?.legacyFilePath).toBeUndefined();
  });
});
