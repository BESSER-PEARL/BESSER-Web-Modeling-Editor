import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ importRepoAsRun: vi.fn() }));
vi.mock('../../../api/github', () => api);
const stored = vi.hoisted(() => ({ before: null as unknown, after: null as unknown }));
vi.mock('../../project-import/projectImport', () => ({
  storeRepoModelAsProject: (_data: unknown, id: string) => stored.after ?? { id, name: 'OCL_Gen', diagrams: {} },
}));
vi.mock('../../storage/ProjectStorageRepository', () => ({
  ProjectStorageRepository: { loadProject: () => stored.before },
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
  stored.before = null;
  stored.after = null;
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

describe('pullRepoIntoProject: what the pull brought in', () => {
  const BEN = { addedBy: 'ben', addedAt: '2026-11-04T12:00:00Z' };
  const project = (classes: string[], attribution?: Record<string, typeof BEN>) => ({
    id: 'p1',
    attribution,
    diagrams: {
      ClassDiagram: [{
        id: 'cd1',
        model: { elements: Object.fromEntries(classes.map((id) => [id, { id, type: 'Class', name: id, owner: null }])) },
      }],
    },
  });
  const LINK = { owner: 'ana', repo: 'shop', branch: 'main' };
  const IN_SYNC = { ...LINK, syncedModel: '1:abc', baseCommitSha: 'b'.repeat(40) };

  const pull = async (target: typeof LINK & { newFromRepo?: string[] }) => {
    api.importRepoAsRun.mockResolvedValue(imported('buml/diagrams.json'));
    await pullRepoIntoProject('s', target, 'p1');
    return getProjectGitHubLink('p1');
  };

  it('marks the class a teammate added', async () => {
    stored.before = project(['book']);
    stored.after = project(['book', 'loan'], { book: BEN, loan: BEN });

    expect((await pull(IN_SYNC))?.newFromRepo).toEqual(['loan']);
  });

  it('does not mark anything in a project opened from the repo for the first time', async () => {
    stored.before = null;
    stored.after = project(['book', 'loan'], { book: BEN, loan: BEN });

    expect((await pull(LINK))?.newFromRepo).toBeUndefined();
  });

  it('does not mark what an unrelated project lacks when it was only just linked', async () => {
    stored.before = project(['mine']);
    stored.after = project(['book'], { book: BEN });

    expect((await pull({ ...LINK, baseCommitSha: 'b'.repeat(40) } as typeof LINK))?.newFromRepo).toBeUndefined();
  });

  it('does not mark anything in a repo saved before attribution existed', async () => {
    stored.before = project(['book']);
    stored.after = project(['book', 'loan']);

    expect((await pull(IN_SYNC))?.newFromRepo).toBeUndefined();
  });

  it('does not mark an old class this project deleted and the pull brought back', async () => {
    stored.before = project(['book']);
    stored.after = project(['book', 'loan'], { loan: BEN });

    const link = await pull({ ...IN_SYNC, lastSyncedAt: '2026-11-05T00:00:00Z' } as typeof LINK);

    expect(link?.newFromRepo).toBeUndefined();
  });

  it('marks what was added after the last sync', async () => {
    stored.before = project(['book']);
    stored.after = project(['book', 'loan'], { loan: BEN });

    const link = await pull({ ...IN_SYNC, lastSyncedAt: '2026-11-01T00:00:00Z' } as typeof LINK);

    expect(link?.newFromRepo).toEqual(['loan']);
  });

  it('remembers what the repo holds, for the chat and the agent', async () => {
    const recap = { runs: [], open_items: [], open_item_count: 0, commits_since_run: [], commit_count: 0 };
    api.importRepoAsRun.mockResolvedValue({ ...imported('buml/diagrams.json'), has_code: true, recap });

    await pullRepoIntoProject('s', LINK, 'p1');

    expect(getProjectGitHubLink('p1')).toMatchObject({ hasCode: true, recap });
  });

  it('keeps earlier marks until cleared, and drops those of removed elements', async () => {
    stored.before = project(['book', 'loan', 'gone']);
    stored.after = project(['book', 'loan', 'member'], { loan: BEN, member: BEN });

    const link = await pull({ ...IN_SYNC, newFromRepo: ['loan', 'gone'] });

    expect(link?.newFromRepo).toEqual(['loan', 'member']);
  });
});
