/**
 * Coming back to a linked project days later used to rebuild the app from the
 * model: the last run had expired after 30 minutes (live setting on production,
 * 2026-11-04) and nothing looked at the GitHub link.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../shared/api/api-client';

const importRepoAsRun = vi.fn();
vi.mock('../../../shared/api/github', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../shared/api/github')>()),
  importRepoAsRun: (...args: unknown[]) => importRepoAsRun(...args),
}));
const globalConfirm = vi.fn();
vi.mock('../../../shared/services/confirm/globalConfirm', () => ({
  globalConfirm: (...args: unknown[]) => globalConfirm(...args),
}));
const getGitHubSession = vi.fn();
vi.mock('../../../shared/services/github/githubAuth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../shared/services/github/githubAuth')>()),
  getGitHubSession: () => getGitHubSession(),
}));
const storeRepoModelAsProject = vi.fn((_project: unknown, id: string) => ({ id, name: 'Library', diagrams: {} }));
vi.mock('../../../shared/services/project-import/projectImport', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../shared/services/project-import/projectImport')>()),
  storeRepoModelAsProject: (project: unknown, id: string) => storeRepoModelAsProject(project, id),
}));

import { resolveLinkedRepoBase } from '../linkedRepoBase';
import { ProjectStorageRepository } from '../../../shared/services/storage/ProjectStorageRepository';
import {
  getProjectGitHubLink,
  markProjectGitHubSynced,
  setProjectGitHubLink,
} from '../../../shared/services/storage/projectGitHubLink';
import { readProjectLastRun } from '../../../shared/services/storage/specDrivenRunRecords';
import type { BesserProject } from '../../../shared/types/project';

const NOW = 1_000_000_000_000;
const TTL = 1800;
const OLD_RUN = { runId: 'a'.repeat(32), at: NOW - 3 * 24 * 60 * 60 * 1000 };
const NEW_RUN = 'b'.repeat(32);
const SYNCED = 'c'.repeat(40);
const HEAD = 'd'.repeat(40);
const LINK = { owner: 'ana', repo: 'library', branch: 'main' };
const RECAP = {
  runs: [{ request: 'add a search bar', date: '2026-11-01', mode: 'modify' as const, file_count: 2 }],
  open_items: [],
  open_item_count: 0,
  commits_since_run: [],
};

const project = (name = 'Library') =>
  ({ id: 'p1', name, diagrams: { ClassDiagram: [{ id: 'c1', title: name, model: { name } }] } }) as unknown as BesserProject;

const imported = (overrides: Record<string, unknown> = {}) => ({
  run_id: NEW_RUN, owner: 'ana', repo: 'library', branch: 'main', commit_sha: SYNCED,
  has_model: true, has_code: true, project: { project: {} }, recap: RECAP, ...overrides,
});

const params = (overrides: Record<string, unknown> = {}) => ({
  project: project(), lastRun: OLD_RUN, nowMs: NOW, ttlSeconds: TTL, signal: new AbortController().signal, ...overrides,
});

const linkAt = (sha: string) => markProjectGitHubSynced(LINK, project(), sha);

beforeEach(() => {
  localStorage.clear();
  getGitHubSession.mockReturnValue('session-token');
  globalConfirm.mockResolvedValue(false);
});

afterEach(() => {
  importRepoAsRun.mockReset();
  globalConfirm.mockReset();
  storeRepoModelAsProject.mockClear();
});

describe('resolveLinkedRepoBase', () => {
  it('continues from the repo when the last run has expired', async () => {
    linkAt(SYNCED);
    importRepoAsRun.mockResolvedValue(imported());
    const result = await resolveLinkedRepoBase(params());
    expect(result).toMatchObject({ outcome: 'continue', pulled: false, lastRun: { runId: NEW_RUN } });
    expect(readProjectLastRun('p1')?.runId).toBe(NEW_RUN);
    expect(importRepoAsRun.mock.calls[0].slice(0, 4)).toEqual(['session-token', 'ana', 'library', 'main']);
  });

  it('keeps local model changes when the repo has not moved', async () => {
    linkAt(SYNCED);
    importRepoAsRun.mockResolvedValue(imported());
    const result = await resolveLinkedRepoBase(params({ project: project('Edited') }));
    expect(result.outcome).toBe('continue');
    expect(storeRepoModelAsProject).not.toHaveBeenCalled();
  });

  it('remembers what the repo holds for the chat', async () => {
    linkAt(SYNCED);
    importRepoAsRun.mockResolvedValue(imported());
    await resolveLinkedRepoBase(params());
    expect(getProjectGitHubLink('p1')).toMatchObject({ hasCode: true, recap: RECAP });
  });

  it('says where it continues from, with the recap', async () => {
    linkAt(SYNCED);
    importRepoAsRun.mockResolvedValue(imported());
    const result = await resolveLinkedRepoBase(params());
    expect(result.outcome === 'continue' && result.message).toContain('add a search bar');
    expect(result.outcome === 'continue' && result.message).toContain('library');
  });

  it('takes the newer model when the repo moved and nothing local would be lost', async () => {
    linkAt(SYNCED);
    importRepoAsRun.mockResolvedValue(imported({ commit_sha: HEAD }));
    const result = await resolveLinkedRepoBase(params());
    expect(result).toMatchObject({ outcome: 'continue', pulled: true });
    expect(storeRepoModelAsProject).toHaveBeenCalledTimes(1);
    expect(getProjectGitHubLink('p1')?.baseCommitSha).toBe(HEAD);
    expect(readProjectLastRun('p1')?.runId).toBe(NEW_RUN);
  });

  it('stops and explains when the repo moved and the model has unsaved changes', async () => {
    // Running anyway would push the old model over a teammate's newer one.
    linkAt(SYNCED);
    importRepoAsRun.mockResolvedValue(imported({ commit_sha: HEAD }));
    const result = await resolveLinkedRepoBase(params({ project: project('Edited') }));
    expect(result.outcome).toBe('stopped');
    expect(result.outcome === 'stopped' && result.message).toContain('Save to GitHub');
    expect(storeRepoModelAsProject).not.toHaveBeenCalled();
    expect(getProjectGitHubLink('p1')?.baseCommitSha).toBe(SYNCED);
  });

  it('uses the stored model for the check: the canvas stayed editable during the import', async () => {
    linkAt(SYNCED);
    const loadProject = vi.spyOn(ProjectStorageRepository, 'loadProject').mockReturnValue(project('Edited meanwhile'));
    importRepoAsRun.mockResolvedValue(imported({ commit_sha: HEAD }));
    const result = await resolveLinkedRepoBase(params());
    loadProject.mockRestore();
    expect(result.outcome).toBe('stopped');
    expect(storeRepoModelAsProject).not.toHaveBeenCalled();
  });

  it('a repo without a model has nothing to overwrite when it moved', async () => {
    setProjectGitHubLink('p1', { ...LINK, baseCommitSha: SYNCED });
    importRepoAsRun.mockResolvedValue(imported({ commit_sha: HEAD, has_model: false, project: null }));
    const result = await resolveLinkedRepoBase(params());
    // Nothing replaced the project, so nothing reloads it: a reload clears the canvas's undo.
    expect(result).toMatchObject({ outcome: 'continue', pulled: false });
    expect(storeRepoModelAsProject).not.toHaveBeenCalled();
    expect(getProjectGitHubLink('p1')?.baseCommitSha).toBe(HEAD);
  });

  it('builds from the model when the repo holds only a saved model', async () => {
    linkAt(SYNCED);
    importRepoAsRun.mockResolvedValue(imported({ has_code: false }));
    expect(await resolveLinkedRepoBase(params())).toEqual({ outcome: 'none' });
    expect(globalConfirm).not.toHaveBeenCalled();
    expect(readProjectLastRun('p1')).toBeNull();
    expect(getProjectGitHubLink('p1')?.hasCode).toBe(false);
  });

  it('does nothing while the last run is still alive', async () => {
    linkAt(SYNCED);
    const result = await resolveLinkedRepoBase(params({ lastRun: { runId: OLD_RUN.runId, at: NOW - 60_000 } }));
    expect(result).toEqual({ outcome: 'none' });
    expect(importRepoAsRun).not.toHaveBeenCalled();
  });

  it('does nothing without a linked repo', async () => {
    expect(await resolveLinkedRepoBase(params())).toEqual({ outcome: 'none' });
    expect(importRepoAsRun).not.toHaveBeenCalled();
  });

  it('asks before rebuilding when this tab is not connected to GitHub', async () => {
    linkAt(SYNCED);
    getGitHubSession.mockReturnValue(null);
    expect(await resolveLinkedRepoBase(params())).toEqual({ outcome: 'stopped' });
    expect(globalConfirm).toHaveBeenCalledTimes(1);
    expect(globalConfirm.mock.calls[0][0].description).toContain('ana/library');
    globalConfirm.mockResolvedValue(true);
    expect(await resolveLinkedRepoBase(params())).toEqual({ outcome: 'none' });
    expect(importRepoAsRun).not.toHaveBeenCalled();
  });

  it('does not ask on a first build in a repo known to hold only the model', async () => {
    setProjectGitHubLink('p1', { ...LINK, baseCommitSha: SYNCED, hasCode: false });
    getGitHubSession.mockReturnValue(null);
    expect(await resolveLinkedRepoBase(params({ lastRun: null }))).toEqual({ outcome: 'none' });
    expect(globalConfirm).not.toHaveBeenCalled();
  });

  it('asks in a new tab about a linked repo it knows nothing of, rather than rebuilding silently', async () => {
    setProjectGitHubLink('p1', { ...LINK, baseCommitSha: SYNCED });
    getGitHubSession.mockReturnValue(null);
    expect(await resolveLinkedRepoBase(params({ lastRun: null }))).toEqual({ outcome: 'stopped' });
    expect(globalConfirm).toHaveBeenCalledTimes(1);
  });

  it('a busy server is not reported as a GitHub problem, and offers no rebuild', async () => {
    linkAt(SYNCED);
    importRepoAsRun.mockRejectedValue(new ApiError(429, 'busy'));
    const result = await resolveLinkedRepoBase(params());
    expect(result.outcome === 'stopped' && result.message).toContain('busy');
    expect(globalConfirm).not.toHaveBeenCalled();
  });

  it('a repo model that cannot be stored stops the run and leaves no base behind', async () => {
    linkAt(SYNCED);
    importRepoAsRun.mockResolvedValue(imported({ commit_sha: HEAD }));
    storeRepoModelAsProject.mockImplementationOnce(() => {
      throw new Error('no diagrams');
    });
    expect(await resolveLinkedRepoBase(params())).toEqual({ outcome: 'stopped' });
    expect(readProjectLastRun('p1')).toBeNull();
  });

  it('hands Stop to the import, so it ends at once', async () => {
    linkAt(SYNCED);
    importRepoAsRun.mockResolvedValue(imported());
    const signal = new AbortController().signal;
    await resolveLinkedRepoBase(params({ signal }));
    expect(importRepoAsRun.mock.calls[0][4].signal).toBe(signal);
  });

  it.each([
    [new ApiError(404, 'gone'), 'not found'],
    [new ApiError(401, 'expired'), 'not connected'],
    [new Error('network'), 'could not be reached'],
  ])('asks before rebuilding when the repo cannot be read: %s', async (error, reason) => {
    linkAt(SYNCED);
    importRepoAsRun.mockRejectedValue(error);
    expect(await resolveLinkedRepoBase(params())).toEqual({ outcome: 'stopped' });
    expect(globalConfirm.mock.calls[0][0].description).toContain(reason);
  });

  it('starts nothing when Stop was pressed during the import', async () => {
    linkAt(SYNCED);
    const stop = new AbortController();
    importRepoAsRun.mockImplementation(async () => {
      stop.abort();
      return imported();
    });
    expect(await resolveLinkedRepoBase(params({ signal: stop.signal }))).toEqual({ outcome: 'stopped' });
    expect(readProjectLastRun('p1')).toBeNull();
  });
});
