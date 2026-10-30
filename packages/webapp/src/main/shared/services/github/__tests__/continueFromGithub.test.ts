import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../api/api-client';

const importRepoAsRun = vi.fn();
vi.mock('../../../api/github', () => ({
  importRepoAsRun: (...args: unknown[]) => importRepoAsRun(...args),
}));
const importProjectFromJson = vi.fn(async (_file: File) => ({ id: 'p-new', name: 'Library', diagrams: {} }));
const storeRepoModelAsProject = vi.fn((_project: unknown, id: string) => ({ id, name: 'Library', diagrams: {} }));
vi.mock('../../../services/project-import/projectImport', () => ({
  importProjectFromJson: (file: File) => importProjectFromJson(file),
  storeRepoModelAsProject: (project: unknown, id: string) => storeRepoModelAsProject(project, id),
}));
const localProjects: { id: string; name: string; diagrams: Record<string, unknown> }[] = [];
vi.mock('../../../services/storage/ProjectStorageRepository', () => ({
  ProjectStorageRepository: { getAllProjects: () => localProjects },
}));
const globalConfirm = vi.fn(async () => true);
vi.mock('../../../services/confirm/globalConfirm', () => ({
  globalConfirm: (...args: unknown[]) => globalConfirm(...(args as [])),
}));

import { continueFromGithubRepo, describeOpenedRepo } from '../continueFromGithub';
import {
  getProjectGitHubLink,
  markProjectGitHubSynced,
  setProjectGitHubLink,
} from '../../../services/storage/projectGitHubLink';
import { readProjectLastRun } from '../../storage/specDrivenRunRecords';

const HEAD = 'b'.repeat(40);
const RUN = 'f'.repeat(32);

afterEach(() => {
  localStorage.clear();
  localProjects.length = 0;
  globalConfirm.mockClear();
  storeRepoModelAsProject.mockClear();
  importRepoAsRun.mockReset();
  importProjectFromJson.mockClear();
});

const ANALYSIS = {
  stack: ['FastAPI', 'SQLAlchemy'],
  model_source: 'SQLAlchemy models',
  source_files: ['app/models.py'],
  entities: ['Book', 'Author'],
};

/** The export envelope handed to the importer (jsdom's File has no text()). */
function importedEnvelope(): Promise<any> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(JSON.parse(reader.result as string));
    reader.readAsText(importProjectFromJson.mock.calls[0][0]);
  });
}

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

  it('opens a repo without a BESSER model with the model BESSER read from its code, as a proposal', async () => {
    // As the backend sends it: v4, every class at the origin.
    const classNode = (id: string, name: string) => ({
      id, type: 'class', position: { x: 0, y: 0 }, width: 160, height: 100,
      data: { name, attributes: [], methods: [] },
    });
    const model = {
      version: '4.0.0', type: 'ClassDiagram',
      nodes: [classNode('a', 'Book'), classNode('b', 'Author')],
      edges: [], assessments: {},
    };
    importRepoAsRun.mockResolvedValue({
      run_id: RUN, project: null, has_model: false,
      owner: 'me', repo: 'shop', branch: 'main', commit_sha: HEAD,
      analysis: ANALYSIS, proposed_diagram: { title: 'shop model', model, diagramType: 'ClassDiagram' },
    });

    const result = await continueFromGithubRepo({ owner: 'me', repo: 'shop', githubSession: 's' });

    expect(result).toMatchObject({ ok: true, projectId: 'p-new', runId: RUN, proposedModel: true, analysis: ANALYSIS });
    const envelope = await importedEnvelope();
    // The proposal has no layout of its own, so it is laid out before it opens.
    const proposed = envelope.project.diagrams.ClassDiagram[0].model;
    expect(proposed.nodes.map((n: { data: { name: string } }) => n.data.name)).toEqual(['Book', 'Author']);
    expect(proposed.nodes[0].position).not.toEqual(proposed.nodes[1].position);
    // Linked at the imported commit, with the proposal waiting for review on the canvas.
    expect(getProjectGitHubLink('p-new')).toMatchObject({ repo: 'shop', baseCommitSha: HEAD, modelProposal: ANALYSIS });
    // The proposal names its diagram, so Discard empties that one and no other.
    expect(getProjectGitHubLink('p-new')?.modelProposal?.diagramId).toBe(envelope.project.diagrams.ClassDiagram[0].id);
    // Not marked synced: the repo holds no model, so the project's is unsaved.
    expect(getProjectGitHubLink('p-new')?.syncedModel).toBeUndefined();
    expect(readProjectLastRun('p-new')?.runId).toBe(RUN);
    expect(describeOpenedRepo(result)).toContain('**Accept model**');
  });

  it('says when the proposal is an AI reading, and keeps that on the link', async () => {
    const aiAnalysis = {
      stack: ['React'],
      model_source: 'AI reading of the code',
      source_files: ['prisma/schema.prisma', 'src/types/order.ts'],
      entities: ['Customer', 'Order'],
      ai: true,
    };
    const model = { elements: { a: { name: 'Order' } }, relationships: {}, type: 'ClassDiagram' };
    importRepoAsRun.mockResolvedValue({
      run_id: RUN, project: null, has_model: false,
      owner: 'me', repo: 'shop', branch: 'main', commit_sha: HEAD,
      analysis: aiAnalysis, proposed_diagram: { title: 'shop model', model, diagramType: 'ClassDiagram' },
    });

    const result = await continueFromGithubRepo({ owner: 'me', repo: 'shop', githubSession: 's' });

    expect(getProjectGitHubLink('p-new')?.modelProposal).toMatchObject({ ai: true });
    const text = describeOpenedRepo(result);
    expect(text).toContain('an AI model read its code');
    expect(text).toContain('`prisma/schema.prisma`');
    expect(text).toContain('2 classes: `Customer`, `Order`');
    expect(text).toContain('**Accept model**');
  });

  it('says the AI reading failed instead of claiming there was nothing to read', async () => {
    // Live on experimental: the AI reading of ArmenSl/MVC-Java-App timed out, and the chat
    // still said "I found no data classes I can read".
    importRepoAsRun.mockResolvedValue({
      run_id: RUN, project: null, has_model: false,
      owner: 'me', repo: 'cantine', branch: 'main', commit_sha: HEAD,
      analysis: { ...ANALYSIS, model_source: null, source_files: [], entities: [] }, proposed_diagram: null,
      message: 'This repo has no data classes BESSER can read directly, and the AI model '
        + 'could not read a model from its code; you can still work on its code.',
    });

    const text = describeOpenedRepo(await continueFromGithubRepo({ owner: 'me', repo: 'cantine', githubSession: 's' }));

    expect(text).toContain('the AI model could not read a model from its code.');
    expect(text).not.toContain('I found no data classes');
    expect(text).toContain('work on its code');
  });

  it('opens a repo with no readable data classes as an empty project the agent can still change', async () => {
    importRepoAsRun.mockResolvedValue({
      run_id: RUN, project: null, has_model: false,
      owner: 'me', repo: 'notes', branch: 'main', commit_sha: HEAD,
      analysis: { ...ANALYSIS, model_source: null, source_files: [], entities: [] }, proposed_diagram: null,
    });

    const result = await continueFromGithubRepo({ owner: 'me', repo: 'notes', githubSession: 's' });

    expect(result).toMatchObject({ ok: true, proposedModel: false });
    expect((await importedEnvelope()).project.diagrams).toEqual({});
    expect(getProjectGitHubLink('p-new')?.modelProposal).toBeUndefined();
    expect(readProjectLastRun('p-new')?.runId).toBe(RUN);
    expect(describeOpenedRepo(result)).toContain('work on its code');
  });
});

describe('continueFromGithubRepo — a repo a local project already links to', () => {
  const OLD = 'a'.repeat(40);
  const local = { id: 'p-local', name: 'Library', diagrams: { ClassDiagram: [{ model: { v: 1 } }] } };
  const imported = {
    run_id: RUN, project: { project: {} }, has_model: true,
    owner: 'Me', repo: 'App', branch: 'main', commit_sha: HEAD,
  };

  const linkLocal = (changedSinceSync: boolean) => {
    localProjects.push(local);
    markProjectGitHubSynced({ owner: 'me', repo: 'app', branch: 'main' }, local as never, OLD);
    if (changedSinceSync) local.diagrams = { ClassDiagram: [{ model: { v: 2 } }] };
  };

  afterEach(() => {
    local.diagrams = { ClassDiagram: [{ model: { v: 1 } }] };
  });

  it('opens in that project instead of creating a second copy', async () => {
    linkLocal(false);
    importRepoAsRun.mockResolvedValue(imported);

    const result = await continueFromGithubRepo({ owner: 'Me', repo: 'App', githubSession: 's' });

    expect(result).toMatchObject({ ok: true, projectId: 'p-local', runId: RUN, reused: true });
    expect(importProjectFromJson).not.toHaveBeenCalled();
    expect(globalConfirm).not.toHaveBeenCalled();
    expect(getProjectGitHubLink('p-local')?.baseCommitSha).toBe(HEAD);
  });

  it('asks before replacing unsaved changes, and keeps them when the user says no', async () => {
    linkLocal(true);
    globalConfirm.mockResolvedValueOnce(false);

    const result = await continueFromGithubRepo({ owner: 'me', repo: 'app', githubSession: 's' });

    expect(globalConfirm).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ ok: true, projectId: 'p-local', reused: true, keptLocalChanges: true });
    expect(importRepoAsRun).not.toHaveBeenCalled();
    expect(getProjectGitHubLink('p-local')?.baseCommitSha).toBe(OLD);
    expect(describeOpenedRepo(result)).toContain('with your unsaved changes');
  });

  it('pulls into the project when the user agrees to replace the changes', async () => {
    linkLocal(true);
    importRepoAsRun.mockResolvedValue(imported);

    const result = await continueFromGithubRepo({ owner: 'me', repo: 'app', githubSession: 's' });

    expect(result).toMatchObject({ ok: true, projectId: 'p-local', runId: RUN });
    expect(storeRepoModelAsProject).toHaveBeenCalledWith(imported.project, 'p-local');
    expect(readProjectLastRun('p-local')?.runId).toBe(RUN);
  });

  it('keeps an unrelated repo as a new project', async () => {
    localProjects.push(local);
    setProjectGitHubLink('p-local', { owner: 'me', repo: 'other', branch: 'main' });
    importRepoAsRun.mockResolvedValue({ ...imported, owner: 'me', repo: 'app' });

    const result = await continueFromGithubRepo({ owner: 'me', repo: 'app', githubSession: 's' });

    expect(result.projectId).toBe('p-new');
  });
});

describe('continueFromGithubRepo — reading the code with AI', () => {
  const offered = {
    run_id: RUN, project: null, has_model: false, owner: 'me', repo: 'shop', branch: 'dev', commit_sha: HEAD,
    analysis: { ...ANALYSIS, model_source: null, source_files: [], entities: [] }, proposed_diagram: null,
    message: 'This repo has no data classes BESSER can read directly', ai_reading_offered: true,
  };
  const aiRead = {
    ...offered, run_id: 'e'.repeat(32), ai_reading_offered: false, message: undefined,
    analysis: { ...ANALYSIS, ai: true },
    proposed_diagram: { title: 'shop model', model: { elements: {}, relationships: {}, type: 'ClassDiagram' }, diagramType: 'ClassDiagram' },
  };

  it('asks before any code goes to the AI model, and reads it with AI once the user agrees', async () => {
    importRepoAsRun.mockResolvedValueOnce(offered).mockResolvedValueOnce(aiRead);

    const result = await continueFromGithubRepo({ owner: 'me', repo: 'shop', githubSession: 's' });

    // The first import never allows AI reading; the second one does, on the same branch.
    expect(importRepoAsRun.mock.calls[0]).toEqual(['s', 'me', 'shop', undefined]);
    expect(globalConfirm).toHaveBeenCalledTimes(1);
    const notice = (globalConfirm.mock.calls[0] as unknown[])[0] as { description: string; confirmLabel: string };
    expect(notice.description).toContain('40,000 characters');
    expect(notice.description).toContain('third-party provider');
    expect(notice.confirmLabel).toBe('Read with AI');
    expect(importRepoAsRun.mock.calls[1]).toEqual(['s', 'me', 'shop', 'dev', { allowAiReading: true }]);
    expect(result).toMatchObject({ ok: true, runId: 'e'.repeat(32), proposedModel: true });
    expect(getProjectGitHubLink('p-new')?.modelProposal).toMatchObject({ ai: true });
  });

  it('keeps the first import when the user declines: nothing is read with AI', async () => {
    importRepoAsRun.mockResolvedValueOnce(offered);
    globalConfirm.mockResolvedValueOnce(false);

    const result = await continueFromGithubRepo({ owner: 'me', repo: 'shop', githubSession: 's' });

    expect(importRepoAsRun).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ ok: true, runId: RUN, proposedModel: false });
    expect(getProjectGitHubLink('p-new')?.modelProposal).toBeUndefined();
  });

  it('does not ask when the server offers no AI reading', async () => {
    importRepoAsRun.mockResolvedValueOnce({ ...offered, ai_reading_offered: false });

    await continueFromGithubRepo({ owner: 'me', repo: 'shop', githubSession: 's' });

    expect(globalConfirm).not.toHaveBeenCalled();
    expect(importRepoAsRun).toHaveBeenCalledTimes(1);
  });
});

describe('continueFromGithubRepo — errors', () => {
  it('says a session expired in the UI language, without an em dash', async () => {
    importRepoAsRun.mockRejectedValueOnce(new ApiError(401, 'Unauthorized'));
    const result = await continueFromGithubRepo({ owner: 'me', repo: 'shop', githubSession: 's' });
    expect(result).toEqual({ ok: false, error: 'Your GitHub session expired. Reconnect and try again.' });
  });

  it('names a repository it cannot find, without an em dash', async () => {
    importRepoAsRun.mockRejectedValueOnce(new ApiError(404, 'Not Found'));
    const result = await continueFromGithubRepo({ owner: 'me', repo: 'shop', githubSession: 's' });
    expect(result.error).toBe('me/shop was not found, or your GitHub account has no access to it.');
  });

  it('reads the error messages from the translations', async () => {
    const i18n = (await import('../../../i18n')).default;
    await i18n.changeLanguage('de');
    try {
      importRepoAsRun.mockRejectedValueOnce(new ApiError(401, 'Unauthorized'));
      const result = await continueFromGithubRepo({ owner: 'me', repo: 'shop', githubSession: 's' });
      expect(result.error).toBe(i18n.t('project.hub.github.errors.sessionExpired'));
      expect(result.error).not.toMatch(/session expired/);
    } finally {
      await i18n.changeLanguage('en');
    }
  });
});
