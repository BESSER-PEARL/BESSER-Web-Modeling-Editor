/**
 * Where a project's linked repo stands on GitHub (new commits, the pending
 * branch), one store for the whole app.
 *
 * The GitHub menu, the chat's repo header and anything else that shows the
 * repo's state subscribe here, so however many are mounted there is one check
 * per project link: on the first subscribe, on window focus and every minute
 * while the page is visible. They always agree.
 *
 * A check is keyed by everything it depends on (project, session, repo,
 * branch, base commit, pending branch). A save moves the base commit, so the
 * answer of a check started before it lands on the old key and is never shown
 * as "new commits".
 */
import { ApiError } from '../../api/api-client';
import { getSyncStatus, type PendingChangeStatus, type SyncStatus } from '../../api/github';
import {
  getProjectGitHubLink,
  setPendingGitHubChange,
  type PendingGitHubChange,
  type ProjectGitHubLink,
} from '../storage/projectGitHubLink';

/** Why the last sync check failed: the session expired, the branch or repo is gone, or GitHub could not be reached. */
export type SyncCheckError = 'auth' | 'missing' | 'unreachable';

export function syncCheckError(error: unknown): SyncCheckError {
  if (error instanceof ApiError && error.status === 401) return 'auth';
  if (error instanceof ApiError && error.status === 404) return 'missing';
  return 'unreachable';
}

/**
 * The pending change once GitHub says where it stands: null when its pull
 * request was merged or closed, or its branch is gone; else the change with
 * the pull request GitHub knows of.
 */
export function followPendingChange(
  pending: PendingGitHubChange,
  remote: PendingChangeStatus,
): PendingGitHubChange | null {
  if (remote.pull_request_state === 'merged' || remote.pull_request_state === 'closed') return null;
  if (!remote.branch_exists) return null;
  if (remote.pull_request_url && remote.pull_request_url !== pending.pullRequestUrl) {
    return { ...pending, pullRequestUrl: remote.pull_request_url, pullRequestNumber: remote.pull_request_number ?? undefined };
  }
  return pending;
}

export interface RepoSyncSnapshot {
  status: SyncStatus | null;
  isChecking: boolean;
  checkError: SyncCheckError | null;
}

// How often an open editor re-checks the linked repo for new commits.
const SYNC_POLL_MS = 60_000;
const IDLE: RepoSyncSnapshot = { status: null, isChecking: false, checkError: null };

/** What a sync check depends on; a pull request URL arriving does not start a new one. */
export const repoSyncKey = (projectId: string, githubSession: string, link: ProjectGitHubLink): string =>
  `${projectId}|${githubSession}|${link.owner}/${link.repo}@${link.branch}#${link.baseCommitSha ?? ''}|${link.pendingChange?.branch ?? ''}`;

interface Entry {
  projectId: string;
  githubSession: string;
  snapshot: RepoSyncSnapshot;
  listeners: Set<() => void>;
  inFlight: Promise<void> | null;
  stop: () => void;
}

const entries = new Map<string, Entry>();

const update = (entry: Entry, next: Partial<RepoSyncSnapshot>) => {
  entry.snapshot = { ...entry.snapshot, ...next };
  entry.listeners.forEach((listener) => listener());
};

function check(key: string): Promise<void> {
  const entry = entries.get(key);
  if (!entry) return Promise.resolve();
  if (entry.inFlight) return entry.inFlight;
  const link = getProjectGitHubLink(entry.projectId);
  // The link moved on (a save, another repo): the subscribers of its new key check it.
  if (!link || repoSyncKey(entry.projectId, entry.githubSession, link) !== key) return Promise.resolve();
  update(entry, { isChecking: true });
  entry.inFlight = (async () => {
    try {
      const next = await getSyncStatus(
        entry.githubSession, link.owner, link.repo, link.branch, link.baseCommitSha, link.pendingChange?.branch,
      );
      update(entry, { status: next, checkError: null });
      if (link.pendingChange && next.pending) {
        const followed = followPendingChange(link.pendingChange, next.pending);
        if (followed !== link.pendingChange) setPendingGitHubChange(entry.projectId, followed);
      }
    } catch (error) {
      update(entry, { checkError: syncCheckError(error) });
    } finally {
      entry.inFlight = null;
      update(entry, { isChecking: false });
    }
  })();
  return entry.inFlight;
}

/** Follow `key`'s sync status; the first subscriber starts the checks, the last one stops them. */
export function subscribeRepoSync(
  key: string,
  projectId: string,
  githubSession: string,
  listener: () => void,
): () => void {
  let entry = entries.get(key);
  if (!entry) {
    const created: Entry = { projectId, githubSession, snapshot: IDLE, listeners: new Set(), inFlight: null, stop: () => undefined };
    entries.set(key, created);
    const onFocus = () => void check(key);
    window.addEventListener('focus', onFocus);
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void check(key);
    }, SYNC_POLL_MS);
    created.stop = () => {
      window.removeEventListener('focus', onFocus);
      window.clearInterval(timer);
    };
    entry = created;
    void check(key);
  }
  const subscribed = entry;
  subscribed.listeners.add(listener);
  return () => {
    subscribed.listeners.delete(listener);
    if (subscribed.listeners.size === 0) {
      subscribed.stop();
      if (entries.get(key) === subscribed) entries.delete(key);
    }
  };
}

export const getRepoSyncSnapshot = (key: string | null): RepoSyncSnapshot =>
  (key ? entries.get(key)?.snapshot : undefined) ?? IDLE;

/** Check the project's repo now (e.g. after a save, or when the GitHub menu opens). */
export function refreshRepoSync(projectId: string, githubSession: string): Promise<void> {
  const link = getProjectGitHubLink(projectId);
  return link ? check(repoSyncKey(projectId, githubSession, link)) : Promise.resolve();
}
