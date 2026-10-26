import { afterEach, describe, expect, it, vi } from 'vitest';

const importRepoAsRun = vi.fn();
vi.mock('../../../github/services/githubApi', () => ({
  importRepoAsRun: (...args: unknown[]) => importRepoAsRun(...args),
}));
const importProjectFromJson = vi.fn(async (_file: File) => ({ id: 'p-new', name: 'Library', diagrams: {} }));
vi.mock('../../../../shared/services/project-import/projectImport', () => ({
  importProjectFromJson: (file: File) => importProjectFromJson(file),
}));

import { continueFromGithubRepo, describeOpenedRepo } from '../continueFromGithub';
import { getProjectGitHubLink } from '../../../../shared/services/storage/projectGitHubLink';
import { readProjectLastRun } from '../../storage';

const HEAD = 'b'.repeat(40);
const RUN = 'f'.repeat(32);

afterEach(() => {
  localStorage.clear();
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
    const model = { elements: { a: { name: 'Book' } }, relationships: {}, type: 'ClassDiagram' };
    importRepoAsRun.mockResolvedValue({
      run_id: RUN, project: null, has_model: false,
      owner: 'me', repo: 'shop', branch: 'main', commit_sha: HEAD,
      analysis: ANALYSIS, proposed_diagram: { title: 'shop model', model, diagramType: 'ClassDiagram' },
    });

    const result = await continueFromGithubRepo({ owner: 'me', repo: 'shop', githubSession: 's' });

    expect(result).toMatchObject({ ok: true, projectId: 'p-new', runId: RUN, proposedModel: true, analysis: ANALYSIS });
    const envelope = await importedEnvelope();
    expect(envelope.project.diagrams.ClassDiagram[0].model).toEqual(model);
    // Linked at the imported commit, with the proposal waiting for review on the canvas.
    expect(getProjectGitHubLink('p-new')).toMatchObject({ repo: 'shop', baseCommitSha: HEAD, modelProposal: ANALYSIS });
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
    expect(text).toContain('2 classes: Customer, Order');
    expect(text).toContain('**Accept model**');
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
