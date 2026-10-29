/**
 * The current project's GitHub repository: its link, how it relates to the
 * repo (in sync, behind, local changes), and the actions that move it.
 *
 * Shared by the GitHub menu in the top bar and the chat's repo header, so both
 * always show the same state.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppDispatch } from '../../../app/store/hooks';
import { ApiError } from '../../../shared/api/api-client';
import { useProject } from '../../../app/hooks/useProject';
import { ProjectStorageRepository } from '../../../shared/services/storage/ProjectStorageRepository';
import {
  GITHUB_LINK_CHANGED_EVENT,
  clearProjectGitHubLink,
  getProjectGitHubLink,
  hasUnsyncedModelChanges,
  markProjectGitHubSynced,
  modelFingerprint,
  setPendingGitHubChange,
  setProjectGitHubLink,
  type PendingGitHubChange,
  type ProjectGitHubLink,
} from '../../../shared/services/storage/projectGitHubLink';
import { storeRepoModelAsProject } from '../../../shared/services/project-import/projectImport';
import { buildProjectExportEnvelope } from '../../../shared/utils/projectExportUtils';
import type { BesserProject } from '../../../shared/types/project';
import { pullRepoIntoProject } from '../../spec-driven/services/continueFromGithub';
import { setLastRunForProject } from '../../spec-driven/state/specDrivenSlice';
import { useGitHubAuth } from '../../../shared/hooks/useGitHubAuth';
import {
  createPullRequest,
  getSyncStatus,
  loadModelAtCommit,
  saveModel,
  type PendingChangeStatus,
  type SaveModelResult,
  type SyncStatus,
} from '../services/githubApi';

export type RepoSyncState =
  | 'signed-out'
  | 'unlinked'
  | 'checking'
  | 'in-sync'
  | 'local-changes'
  | 'behind'
  | 'diverged'
  | 'reconnect'
  | 'missing'
  | 'unknown';

/** Why the last sync check failed: the session expired, the branch or repo is gone, or GitHub could not be reached. */
export type SyncCheckError = 'auth' | 'missing' | 'unreachable';

export function syncCheckError(error: unknown): SyncCheckError {
  if (error instanceof ApiError && error.status === 401) return 'auth';
  if (error instanceof ApiError && error.status === 404) return 'missing';
  return 'unreachable';
}

// How often an open editor re-checks the linked repo for new commits.
const SYNC_POLL_MS = 60_000;
// Quiet time after a pull before the loaded model counts as the synced one.
const BASELINE_SETTLE_MS = 1_500;

/** How a project relates to its repo, from the link, the last sync check and the local model. */
export function deriveRepoSyncState(input: {
  isAuthenticated: boolean;
  /** The GitHub session was rejected (see shared/services/github/githubAuth.ts). */
  isExpired?: boolean;
  link: ProjectGitHubLink | null;
  status: SyncStatus | null;
  isChecking: boolean;
  hasLocalChanges: boolean;
  checkError?: SyncCheckError | null;
}): RepoSyncState {
  const { isAuthenticated, isExpired, link, status, isChecking, hasLocalChanges, checkError } = input;
  if (isExpired && link) return 'reconnect';
  if (!isAuthenticated) return 'signed-out';
  if (!link) return 'unlinked';
  if (checkError === 'auth') return 'reconnect';
  if (checkError === 'missing') return 'missing';
  if (!status) return isChecking ? 'checking' : 'unknown';
  const behind = status.commits_since.length > 0;
  if (behind && hasLocalChanges) return 'diverged';
  if (behind) return 'behind';
  return hasLocalChanges ? 'local-changes' : 'in-sync';
}

const projectExport = (project: BesserProject) =>
  buildProjectExportEnvelope(project, undefined, { includePersonalization: false });

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

/**
 * `checkRemote: false` skips the sync-status checks, for callers that only
 * need the link and the session; the GitHub menu runs them.
 */
export function useRepoSync({ checkRemote = true }: { checkRemote?: boolean } = {}) {
  const dispatch = useAppDispatch();
  const { currentProject, loadProject } = useProject();
  const { isAuthenticated, isExpired, githubSession } = useGitHubAuth();
  const projectId = currentProject?.id ?? null;

  const [link, setLink] = useState<ProjectGitHubLink | null>(() =>
    projectId ? getProjectGitHubLink(projectId) : null,
  );
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [checkError, setCheckError] = useState<SyncCheckError | null>(null);

  useEffect(() => {
    const read = () => setLink(projectId ? getProjectGitHubLink(projectId) : null);
    read();
    const onChange = (event: Event) => {
      const changed = (event as CustomEvent<{ projectId?: string }>).detail?.projectId;
      if (!changed || changed === projectId) read();
    };
    window.addEventListener(GITHUB_LINK_CHANGED_EVENT, onChange);
    window.addEventListener('storage', read);
    return () => {
      window.removeEventListener(GITHUB_LINK_CHANGED_EVENT, onChange);
      window.removeEventListener('storage', read);
    };
  }, [projectId]);

  // Only the newest check may set the status: a save moves the link's base,
  // and an answer for the old base would show the save as "new commits".
  const checkSeq = useRef(0);
  const refresh = useCallback(async () => {
    const current = projectId ? getProjectGitHubLink(projectId) : null;
    if (!current || !githubSession || !projectId) return;
    const seq = ++checkSeq.current;
    setIsChecking(true);
    try {
      const next = await getSyncStatus(
        githubSession, current.owner, current.repo, current.branch, current.baseCommitSha,
        current.pendingChange?.branch,
      );
      if (seq !== checkSeq.current) return;
      setStatus(next);
      setCheckError(null);
      if (current.pendingChange && next.pending) {
        const followed = followPendingChange(current.pendingChange, next.pending);
        if (followed !== current.pendingChange) setPendingGitHubChange(projectId, followed);
      }
    } catch (error) {
      if (seq === checkSeq.current) setCheckError(syncCheckError(error));
    } finally {
      if (seq === checkSeq.current) setIsChecking(false);
    }
  }, [projectId, githubSession]);

  // What a sync check depends on; a pull request URL arriving does not start a new one.
  const checkKey = link
    ? `${link.owner}/${link.repo}@${link.branch}#${link.baseCommitSha ?? ''}|${link.pendingChange?.branch ?? ''}`
    : null;
  useEffect(() => {
    setStatus(null);
    setCheckError(null);
    if (!checkRemote || !checkKey || !githubSession) return undefined;
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, SYNC_POLL_MS);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.clearInterval(timer);
    };
  }, [checkRemote, checkKey, githubSession, refresh]);

  // After a pull the editor rewrites the model into its current format: take
  // the sync fingerprint once the project has stopped changing.
  useEffect(() => {
    if (!link?.baselinePending || !currentProject || currentProject.id !== projectId) return undefined;
    const timer = window.setTimeout(() => {
      const { baselinePending: _pending, ...settled } = link;
      setProjectGitHubLink(currentProject.id, { ...settled, syncedModel: modelFingerprint(currentProject) });
    }, BASELINE_SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [link, currentProject, projectId]);

  const hasLocalChanges = useMemo(
    () => !!currentProject && !!link && hasUnsyncedModelChanges(currentProject, link),
    [currentProject, link],
  );

  const state = useMemo(
    () => deriveRepoSyncState({ isAuthenticated, isExpired, link, status, isChecking, hasLocalChanges, checkError }),
    [isAuthenticated, isExpired, link, status, isChecking, hasLocalChanges, checkError],
  );

  const markSynced = markProjectGitHubSynced;

  /**
   * Make the project match the repo's branch head: its model, and its code as
   * the next Spec-Driven modify run's starting point.
   */
  const pullInto = useCallback(
    async (target: ProjectGitHubLink, intoProjectId: string): Promise<BesserProject> => {
      if (!githubSession) throw new Error('Connect GitHub first.');
      const imported = await pullRepoIntoProject(githubSession, target, intoProjectId);
      dispatch(setLastRunForProject({ projectId: intoProjectId, runId: imported.run_id, at: Date.now() }));
      await loadProject(intoProjectId);
      return ProjectStorageRepository.loadProject(intoProjectId) as BesserProject;
    },
    [githubSession, dispatch, loadProject],
  );

  const pull = useCallback(async () => {
    if (!link || !projectId) return;
    await pullInto(link, projectId);
    setStatus(null);
    await refresh();
  }, [link, projectId, pullInto, refresh]);

  /** Commit the project's model to the linked repo; newer commits are merged, never reverted. */
  const save = useCallback(
    async (commitMessage: string): Promise<SaveModelResult> => {
      if (!link || !projectId || !githubSession) throw new Error('No linked repository.');
      const project = ProjectStorageRepository.loadProject(projectId);
      if (!project) throw new Error('Could not read the project.');
      const result = await saveModel(githubSession, {
        owner: link.owner,
        repo: link.repo,
        branch: link.branch,
        commit_message: commitMessage,
        project_data: project,
        project_export: projectExport(project),
        base_commit_sha: link.baseCommitSha,
      });
      if (result.status === 'merged') {
        // The branch now holds both sides: load it so the editor shows the merge.
        await pullInto(link, projectId);
      } else if (result.status === 'pushed') {
        markSynced(link, project, result.commit_sha);
      } else if (result.status === 'conflict' && result.conflict_branch) {
        setPendingGitHubChange(projectId, {
          kind: 'conflict', branch: result.conflict_branch, createdAt: new Date().toISOString(),
        });
      }
      await refresh();
      return result;
    },
    [link, projectId, githubSession, pullInto, markSynced, refresh],
  );

  /** Open (or find) the pull request of the pending change; returns its URL. */
  const openPullRequest = useCallback(
    async (title: string): Promise<string> => {
      const pending = link?.pendingChange;
      if (!link || !pending || !projectId || !githubSession) throw new Error('Nothing waits for a pull request.');
      const pr = await createPullRequest(githubSession, {
        owner: link.owner, repo: link.repo, head: pending.branch, base: link.branch, title,
      });
      setPendingGitHubChange(projectId, { ...pending, pullRequestUrl: pr.html_url, pullRequestNumber: pr.number });
      return pr.html_url;
    },
    [link, projectId, githubSession],
  );

  /** Stop tracking the pending change; its branch stays on GitHub. */
  const dismissPending = useCallback(() => {
    if (projectId) setPendingGitHubChange(projectId, null);
  }, [projectId]);

  /** Replace the project's model with the one at `commitSha`. The change is then unsaved. */
  const restore = useCallback(
    async (commitSha: string) => {
      if (!link || !projectId || !githubSession) return;
      const version = await loadModelAtCommit(githubSession, link.owner, link.repo, commitSha);
      storeRepoModelAsProject(version.project, projectId);
      await loadProject(projectId);
    },
    [link, projectId, githubSession, loadProject],
  );

  /**
   * Link the project to a repo without changing its model. `headSha` is the
   * branch head now, so the next save commits on top of it; the project counts
   * as unsaved until then.
   */
  const linkTo = useCallback(
    (owner: string, repo: string, branch: string, headSha?: string) => {
      if (!projectId) return;
      setProjectGitHubLink(projectId, { owner, repo, branch, ...(headSha ? { baseCommitSha: headSha } : {}) });
    },
    [projectId],
  );

  const unlink = useCallback(() => {
    if (projectId) clearProjectGitHubLink(projectId);
  }, [projectId]);

  return {
    link,
    status,
    state,
    hasLocalChanges,
    isChecking,
    checkError,
    githubSession,
    refresh,
    pull,
    pullInto,
    save,
    restore,
    linkTo,
    unlink,
    markSynced,
    openPullRequest,
    dismissPending,
  };
}

export type RepoSync = ReturnType<typeof useRepoSync>;
