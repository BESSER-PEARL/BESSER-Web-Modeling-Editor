/**
 * "Save it on GitHub" at project creation: a private repository for the new
 * project, holding its model, linked so the editor reads it as in sync.
 */
import { createRepoForProject, listRepos } from '../github/services/githubApi';
import { markProjectGitHubSynced, type ProjectGitHubLink } from '../../shared/services/storage/projectGitHubLink';
import { getGitHubAuthState } from '../../shared/services/github/githubAuth';
import { sanitizeRepoName } from '../../shared/utils/validation';
import { buildProjectExportEnvelope } from '../../shared/utils/projectExportUtils';
import type { BesserProject } from '../../shared/types/project';

// GitHub's limit on a repository name.
const MAX_REPO_NAME_LENGTH = 100;
const FALLBACK_REPO_NAME = 'besser-project';

/** The repository name a project gets: lowercase, `[a-z0-9-_]`, no leading or trailing separator. */
export const repoSlug = (projectName: string): string => sanitizeRepoName(projectName) || FALLBACK_REPO_NAME;

/** `slug`, or `slug-2`, `slug-3`... when the name is taken (GitHub names are case-insensitive). */
export const freeRepoName = (slug: string, takenNames: string[]): string => {
  const taken = new Set(takenNames.map((name) => name.toLowerCase()));
  if (!taken.has(slug)) return slug;
  for (let n = 2; ; n += 1) {
    const suffix = `-${n}`;
    const candidate = `${slug.slice(0, MAX_REPO_NAME_LENGTH - suffix.length)}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
};

/**
 * Create a private repository for `project`, commit its model and link it.
 *
 * The free name is picked against the repositories the user owns (the repo
 * is created in their account); when the listing fails the plain slug is
 * tried and a collision surfaces as the create error.
 */
export async function saveProjectOnGithub(githubSession: string, project: BesserProject): Promise<ProjectGitHubLink> {
  const slug = repoSlug(project.name);
  let takenNames: string[] = [];
  try {
    const me = getGitHubAuthState().username?.toLowerCase();
    takenNames = (await listRepos(githubSession)).repositories
      .filter((repo) => !me || repo.full_name.split('/')[0].toLowerCase() === me)
      .map((repo) => repo.name);
  } catch (error) {
    console.warn('Could not list GitHub repositories; trying the plain repository name.', error);
  }
  const repoName = freeRepoName(slug, takenNames);

  const result = await createRepoForProject(githubSession, {
    repo_name: repoName,
    description: project.description,
    is_private: true,
    project_data: project,
    project_export: buildProjectExportEnvelope(project, undefined, { includePersonalization: false }),
  });
  const link: ProjectGitHubLink = {
    owner: result.owner,
    repo: result.repo_url.split('/').pop() || repoName,
    branch: result.branch,
  };
  markProjectGitHubSynced(link, project, result.commit_sha);
  return link;
}
