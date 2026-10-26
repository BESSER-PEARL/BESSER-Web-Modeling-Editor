/**
 * The one GitHub repository a project is linked to.
 *
 * Read and written by every GitHub path: the GitHub sidebar, the Spec-Driven
 * Agent push, opening a repo from GitHub, and the repo status in the top bar.
 * Each used to keep its own link; `getProjectGitHubLink` adopts the older ones
 * the first time a project is read.
 *
 * `baseCommitSha` is the commit the editor last synced with (an import, a pull
 * or a push). Pushes send it so the backend merges commits made since instead
 * of reverting them. `syncedModel` fingerprints the project's diagrams at that
 * sync, so the editor can tell whether the model changed since. After a pull
 * the editor rewrites the loaded model into its current format, so the
 * fingerprint is taken once it has settled (`baselinePending`).
 */
import { localStorageGitHubLinkPrefix, localStoragePrefix } from '../../constants/constant';
import { LocalStorageRepository } from './local-storage-repository';
import type { BesserProject } from '../../types/project';

export interface ProjectGitHubLink {
  owner: string;
  repo: string;
  branch: string;
  baseCommitSha?: string;
  syncedModel?: string;
  baselinePending?: boolean;
  lastSyncedAt?: string;
}

/** Fired on `window` whenever a project's link changes; `detail` is `{ projectId }`. */
export const GITHUB_LINK_CHANGED_EVENT = 'besser:github-link-changed';

// Links written before the unified store: the agent push target and the sidebar's map.
const LEGACY_PUSH_TARGET = 'github';
const LEGACY_SIDEBAR_LINKS_KEY = `${localStoragePrefix}github_linked_repos`;

const linkKey = (projectId: string): string => `${localStorageGitHubLinkPrefix}${projectId}`;

const parseLink = (raw: string | null): ProjectGitHubLink | null => {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (value && typeof value.owner === 'string' && typeof value.repo === 'string') {
      return {
        owner: value.owner,
        repo: value.repo,
        branch: typeof value.branch === 'string' && value.branch ? value.branch : 'main',
        ...(typeof value.baseCommitSha === 'string' ? { baseCommitSha: value.baseCommitSha } : {}),
        ...(typeof value.syncedModel === 'string' ? { syncedModel: value.syncedModel } : {}),
        ...(value.baselinePending === true ? { baselinePending: true } : {}),
        ...(typeof value.lastSyncedAt === 'string' ? { lastSyncedAt: value.lastSyncedAt } : {}),
      };
    }
  } catch {
    /* fall through */
  }
  return null;
};

const readLegacySidebarLinks = (): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(localStorage.getItem(LEGACY_SIDEBAR_LINKS_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

/** Move a project's pre-unification link into the store; the agent push target wins. */
const adoptLegacyLink = (projectId: string): ProjectGitHubLink | null => {
  const sidebarLinks = readLegacySidebarLinks();
  const pushLink = LocalStorageRepository.getDeployLinkedRepo(projectId, LEGACY_PUSH_TARGET);
  const legacySidebar = sidebarLinks[projectId] as { lastCommitSha?: unknown } | undefined;
  const sidebarLink = parseLink(JSON.stringify(
    legacySidebar && typeof legacySidebar.lastCommitSha === 'string'
      ? { ...legacySidebar, baseCommitSha: legacySidebar.lastCommitSha }
      : legacySidebar ?? null,
  ));
  const adopted = pushLink
    ? { owner: pushLink.owner, repo: pushLink.repo, branch: pushLink.branch || 'main' }
    : sidebarLink;
  if (!adopted) return null;

  writeLink(projectId, adopted);
  LocalStorageRepository.clearDeployLinkedRepo(projectId, LEGACY_PUSH_TARGET);
  if (projectId in sidebarLinks) {
    delete sidebarLinks[projectId];
    localStorage.setItem(LEGACY_SIDEBAR_LINKS_KEY, JSON.stringify(sidebarLinks));
  }
  return adopted;
};

const writeLink = (projectId: string, link: ProjectGitHubLink): void => {
  localStorage.setItem(linkKey(projectId), JSON.stringify(link));
};

const notify = (projectId: string): void => {
  window.dispatchEvent(new CustomEvent(GITHUB_LINK_CHANGED_EVENT, { detail: { projectId } }));
};

export function getProjectGitHubLink(projectId: string): ProjectGitHubLink | null {
  try {
    return parseLink(localStorage.getItem(linkKey(projectId))) ?? adoptLegacyLink(projectId);
  } catch {
    return null;
  }
}

export function setProjectGitHubLink(projectId: string, link: ProjectGitHubLink): void {
  writeLink(projectId, link);
  notify(projectId);
}

export function clearProjectGitHubLink(projectId: string): void {
  localStorage.removeItem(linkKey(projectId));
  notify(projectId);
}

/** A fingerprint of a project's diagram content, ignoring metadata that migrations touch. */
export function modelFingerprint(project: BesserProject): string {
  const models: Record<string, unknown[]> = {};
  for (const [type, diagrams] of Object.entries(project.diagrams ?? {})) {
    const list = Array.isArray(diagrams) ? diagrams : [diagrams];
    models[type] = list.map((d) => (d as { model?: unknown } | undefined)?.model ?? null);
  }
  const text = JSON.stringify(models);
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  return `${text.length}:${(hash >>> 0).toString(16)}`;
}

/**
 * Record that `project` now matches commit `sha` of its linked repo.
 *
 * `loadedFromRepo`: the project was just replaced by the repo's model, which
 * the editor rewrites into its current format on load; the fingerprint is then
 * taken once the open editor settles (see useRepoSync).
 */
export function markProjectGitHubSynced(
  link: ProjectGitHubLink,
  project: BesserProject,
  sha: string,
  { loadedFromRepo = false }: { loadedFromRepo?: boolean } = {},
): void {
  const { syncedModel: _old, baselinePending: _pending, ...rest } = link;
  setProjectGitHubLink(project.id, {
    ...rest,
    baseCommitSha: sha,
    ...(loadedFromRepo ? { baselinePending: true } : { syncedModel: modelFingerprint(project) }),
    lastSyncedAt: new Date().toISOString(),
  });
}
