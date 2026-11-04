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
 *
 * `pendingChange` is a save or push that did not land on the branch: GitHub
 * could not merge it, or it went to a pull request. It is kept until its
 * pull request is merged or closed, or the user dismisses it.
 *
 * `newFromRepo` holds the elements pulls brought in, shown as new until the user
 * clears them. It lives here, in this browser, so it never reaches the model.
 *
 * `legacyFilePath` is the model file the old GitHub sidebar saved (e.g.
 * `models/shop.json`); the next save sends it so the commit that writes
 * `buml/diagrams.json` deletes it, and then forgets it.
 */
import { localStorageGitHubLinkPrefix, localStorageLegacyGitHubLinkedRepos } from '../../constants/constant';
import { LocalStorageRepository } from './local-storage-repository';
import type { RepoRecap } from '../../api/github';
import type { BesserProject } from '../../types/project';

/** What BESSER read in the code of a repo it did not create (backend CodeAnalysis). */
export interface RepoCodeAnalysis {
  stack: string[];
  model_source: string | null;
  source_files: string[];
  entities: string[];
  /** True when an AI model proposed the classes because no data classes were readable directly. */
  ai?: boolean;
  /** Relationships read from the code that the proposed model could not take, as "Source -> Target". */
  skipped_relationships?: string[];
}

/** The model BESSER proposed from a repo's code, waiting for the user's Accept. */
export interface ModelProposal extends RepoCodeAnalysis {
  /** The class diagram that holds the proposal; Discard empties only this one. */
  diagramId?: string;
}

/** A save or push kept on its own branch instead of the linked one. */
export interface PendingGitHubChange {
  /** `conflict`: GitHub could not merge it. `pull_request`: it was sent for review. */
  kind: 'conflict' | 'pull_request';
  branch: string;
  /** What the user said the change does; the pull request's title. */
  title?: string;
  pullRequestUrl?: string;
  pullRequestNumber?: number;
  createdAt: string;
}

export interface ProjectGitHubLink {
  owner: string;
  repo: string;
  branch: string;
  baseCommitSha?: string;
  syncedModel?: string;
  baselinePending?: boolean;
  lastSyncedAt?: string;
  /** Where the app runs once it went live from this repo. */
  liveUrl?: string;
  /** Set while the model BESSER read from the repo's code awaits the user's Accept. */
  modelProposal?: ModelProposal;
  pendingChange?: PendingGitHubChange;
  legacyFilePath?: string;
  /** The repo holds an app a run can continue from, not only a saved model. Unknown until an import or a push. */
  hasCode?: boolean;
  /** Where the repo's app stood at the last import or push; the chat answers from it. */
  recap?: RepoRecap;
  /** Ids of the classes and members pulls brought in that the user has not cleared. */
  newFromRepo?: string[];
}

/** Fired on `window` whenever a project's link changes; `detail` is `{ projectId }`. */
export const GITHUB_LINK_CHANGED_EVENT = 'besser:github-link-changed';

// Links written before the unified store: the agent push target and the sidebar's map.
const LEGACY_PUSH_TARGET = 'github';

const linkKey = (projectId: string): string => `${localStorageGitHubLinkPrefix}${projectId}`;

// Where saves write the model now; never a legacy file to delete.
const CURRENT_MODEL_FILES = new Set(['buml/diagrams.json', '.besser/project.json']);

/** A relative `.json` path inside the repo, other than the files a save writes now. */
const isLegacyModelPath = (value: unknown): value is string =>
  typeof value === 'string' && value.endsWith('.json') && !value.startsWith('/') && !value.includes('\\')
  && !value.split('/').includes('..') && !CURRENT_MODEL_FILES.has(value);

/** `path` when it is a model file an older editor saved (the next save replaces it), else undefined. */
export const legacyModelPath = (path: string | null | undefined): string | undefined =>
  isLegacyModelPath(path) ? path : undefined;

const isPendingChange = (value: unknown): value is PendingGitHubChange => {
  const pending = value as Partial<PendingGitHubChange> | null;
  return !!pending && (pending.kind === 'conflict' || pending.kind === 'pull_request')
    && typeof pending.branch === 'string' && typeof pending.createdAt === 'string';
};

const isRepoRecap = (value: unknown): value is Omit<RepoRecap, 'commit_count'> => {
  const recap = value as Partial<RepoRecap> | null | undefined;
  return Array.isArray(recap?.runs) && Array.isArray(recap?.open_items) && Array.isArray(recap?.commits_since_run);
};

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
        ...(typeof value.liveUrl === 'string' ? { liveUrl: value.liveUrl } : {}),
        ...(value.modelProposal && Array.isArray(value.modelProposal.entities)
          ? { modelProposal: value.modelProposal as ModelProposal }
          : {}),
        ...(typeof value.lastSyncedAt === 'string' ? { lastSyncedAt: value.lastSyncedAt } : {}),
        ...(isPendingChange(value.pendingChange) ? { pendingChange: value.pendingChange } : {}),
        ...(isLegacyModelPath(value.legacyFilePath) ? { legacyFilePath: value.legacyFilePath } : {}),
        ...(typeof value.hasCode === 'boolean' ? { hasCode: value.hasCode } : {}),
        ...(isRepoRecap(value.recap)
          // Stored before the total existed: what it lists is all it knows.
          ? { recap: { commit_count: value.recap.commits_since_run.length, ...value.recap } as RepoRecap }
          : {}),
        ...(Array.isArray(value.newFromRepo)
          ? { newFromRepo: value.newFromRepo.filter((id: unknown) => typeof id === 'string') as string[] }
          : {}),
      };
    }
  } catch {
    /* fall through */
  }
  return null;
};

const readLegacySidebarLinks = (): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(localStorage.getItem(localStorageLegacyGitHubLinkedRepos) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

/** Move a project's pre-unification link into the store; the agent push target wins. */
const adoptLegacyLink = (projectId: string): ProjectGitHubLink | null => {
  const sidebarLinks = readLegacySidebarLinks();
  const pushLink = LocalStorageRepository.getDeployLinkedRepo(projectId, LEGACY_PUSH_TARGET);
  const legacySidebar = sidebarLinks[projectId] as { lastCommitSha?: unknown; filePath?: unknown } | undefined;
  // The sidebar saved the model at its own `filePath`; keep it so the next save removes that file.
  const sidebarLink = parseLink(JSON.stringify(
    legacySidebar
      ? {
          ...legacySidebar,
          ...(typeof legacySidebar.lastCommitSha === 'string' ? { baseCommitSha: legacySidebar.lastCommitSha } : {}),
          legacyFilePath: legacySidebar.filePath,
        }
      : null,
  ));
  const sameRepo = (a: ProjectGitHubLink, b: { owner: string; repo: string }) =>
    a.owner.toLowerCase() === b.owner.toLowerCase() && a.repo.toLowerCase() === b.repo.toLowerCase();
  const adopted: ProjectGitHubLink | null = pushLink
    ? {
        owner: pushLink.owner,
        repo: pushLink.repo,
        branch: pushLink.branch || 'main',
        ...(sidebarLink?.legacyFilePath && sameRepo(sidebarLink, pushLink) ? { legacyFilePath: sidebarLink.legacyFilePath } : {}),
      }
    : sidebarLink;
  if (!adopted) return null;

  writeLink(projectId, adopted);
  LocalStorageRepository.clearDeployLinkedRepo(projectId, LEGACY_PUSH_TARGET);
  if (projectId in sidebarLinks) {
    delete sidebarLinks[projectId];
    localStorage.setItem(localStorageLegacyGitHubLinkedRepos, JSON.stringify(sidebarLinks));
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

/** Record (or, with null, forget) the change of a project's link that waits on its own branch. */
export function setPendingGitHubChange(projectId: string, pending: PendingGitHubChange | null): void {
  const link = getProjectGitHubLink(projectId);
  if (!link) return;
  const { pendingChange: _old, ...rest } = link;
  setProjectGitHubLink(projectId, pending ? { ...rest, pendingChange: pending } : rest);
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

/** Whether the project's model changed since the commit its link records. */
export function hasUnsyncedModelChanges(project: BesserProject, link: ProjectGitHubLink): boolean {
  if (link.baselinePending) return false;
  return !link.syncedModel || modelFingerprint(project) !== link.syncedModel;
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
