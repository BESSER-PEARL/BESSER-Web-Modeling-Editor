import { beforeEach, describe, expect, it, vi } from 'vitest';

import { freeRepoName, repoSlug, saveProjectOnGithub } from '../saveProjectOnGithub';
import { createDefaultProject } from '../../../shared/types/project';
import { getProjectGitHubLink, modelFingerprint } from '../../../shared/services/storage/projectGitHubLink';
import { createRepoForProject, listRepos } from '../../github/services/githubApi';

vi.mock('../../github/services/githubApi', () => ({
  listRepos: vi.fn(),
  createRepoForProject: vi.fn(),
}));

const repo = (name: string) => ({
  id: 1, name, full_name: `octocat/${name}`, description: null, html_url: '', private: true,
  updated_at: '', default_branch: 'main', topics: [],
});

beforeEach(() => {
  localStorage.clear();
  vi.mocked(listRepos).mockReset();
  vi.mocked(createRepoForProject).mockReset();
});

describe('repoSlug', () => {
  it('turns a project name into a GitHub repository name', () => {
    expect(repoSlug('New_Project')).toBe('new_project');
    expect(repoSlug('  Hotel Booking App! ')).toBe('hotel-booking-app');
    expect(repoSlug('_Shop_')).toBe('shop');
    expect(repoSlug('Café')).toBe('caf');
  });

  it('falls back to a fixed name when nothing usable is left', () => {
    expect(repoSlug('***')).toBe('besser-project');
  });

  it('keeps to GitHub\'s 100-character limit', () => {
    expect(repoSlug('a'.repeat(150))).toHaveLength(100);
  });
});

describe('freeRepoName', () => {
  it('keeps the slug when it is free', () => {
    expect(freeRepoName('shop', ['other'])).toBe('shop');
  });

  it('adds the first free numeric suffix, ignoring case', () => {
    expect(freeRepoName('shop', ['Shop', 'shop-2'])).toBe('shop-3');
  });

  it('stays within 100 characters with a suffix', () => {
    const slug = 'a'.repeat(100);
    const name = freeRepoName(slug, [slug]);
    expect(name).toHaveLength(100);
    expect(name.endsWith('-2')).toBe(true);
  });
});

describe('saveProjectOnGithub', () => {
  it('creates a private repo under a free name and links the project as in sync', async () => {
    const project = createDefaultProject('Shop', 'A shop', 'me');
    vi.mocked(listRepos).mockResolvedValue([repo('shop'), repo('notes')]);
    vi.mocked(createRepoForProject).mockResolvedValue({
      owner: 'octocat', repo_url: 'https://github.com/octocat/shop-2', commit_sha: 'abc123', branch: 'main',
    });

    const link = await saveProjectOnGithub('session', project);

    expect(createRepoForProject).toHaveBeenCalledWith('session', expect.objectContaining({
      repo_name: 'shop-2',
      description: 'A shop',
      is_private: true,
      project_data: project,
    }));
    expect(link).toEqual({ owner: 'octocat', repo: 'shop-2', branch: 'main' });
    const stored = getProjectGitHubLink(project.id);
    expect(stored).toMatchObject({ owner: 'octocat', repo: 'shop-2', branch: 'main', baseCommitSha: 'abc123' });
    expect(stored?.syncedModel).toBe(modelFingerprint(project));
  });

  it('tries the plain slug when the repository list cannot be read', async () => {
    const project = createDefaultProject('Shop', '', 'me');
    vi.mocked(listRepos).mockRejectedValue(new Error('offline'));
    vi.mocked(createRepoForProject).mockResolvedValue({
      owner: 'octocat', repo_url: 'https://github.com/octocat/shop', commit_sha: 'abc', branch: 'main',
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await saveProjectOnGithub('session', project);

    expect(createRepoForProject).toHaveBeenCalledWith('session', expect.objectContaining({ repo_name: 'shop' }));
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('leaves the project unlinked when the repository cannot be created', async () => {
    const project = createDefaultProject('Shop', '', 'me');
    vi.mocked(listRepos).mockResolvedValue([]);
    vi.mocked(createRepoForProject).mockRejectedValue(new Error('An internal error occurred'));

    await expect(saveProjectOnGithub('session', project)).rejects.toThrow('An internal error occurred');
    expect(getProjectGitHubLink(project.id)).toBeNull();
  });
});
