/**
 * The current project's GitHub repository: its link, how it relates to the
 * repo (in sync, behind, local changes), and the actions that move it.
 *
 * Shared by the GitHub menu in the top bar and the chat's repo header, so both
 * always show the same state: the sync checks run in one store
 * (shared/services/github/repoSyncStatus.ts), once however many are mounted.
 */
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useAppDispatch } from '../../../app/store/hooks';
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
  type ProjectGitHubLink,
} from '../../../shared/services/storage/projectGitHubLink';
import { storeRepoModelAsProject } from '../../../shared/services/project-import/projectImport';
import { buildProjectExportEnvelope } from '../../../shared/utils/projectExportUtils';
import type { BesserProject } from '../../../shared/types/project';
import { pullRepoIntoProject } from '../../../shared/services/github/pullRepoIntoProject';
import {
  getRepoSyncSnapshot,
  refreshRepoSync,
  repoSyncKey,
  subscribeRepoSync,
  type SyncCheckError,
} from '../../../shared/services/github/repoSyncStatus';
import { setLastRunForProject } from '../../spec-driven';
import { useGitHubAuth } from '../../../shared/hooks/useGitHubAuth';
import {
  createPullRequest,
  loadModelAtCommit,
  saveModel,
  type SaveModelResult,
  type SyncStatus,
} from '../../../shared/api/github';

export {
  followPendingChange,
  syncCheckError,
  type SyncCheckError,
} from '../../../shared/services/github/repoSyncStatus';

export type RepoSyncState =
  | 'signed-out'
  | 'not-in-tab'
  | 'unlinked'
  | 'checking'
  | 'in-sync'
  | 'local-changes'
  | 'behind'
  | 'diverged'
  | 'reconnect'
  | 'missing'
  | 'unknown';

// Quiet time after a pull before the loaded model counts as the synced one.
const BASELINE_SETTLE_MS = 1_500;

/** How a project relates to its repo, from the link, the last sync check and the local model. */
export function deriveRepoSyncState(input: {
  isAuthenticated: boolean;
  /** The GitHub session was rejected (see shared/services/github/githubAuth.ts). */
  isExpired?: boolean;
  /** Signed in before, but not in this tab: nothing failed. */
  isNotInTab?: boolean;
  link: ProjectGitHubLink | null;
  status: SyncStatus | null;
  isChecking: boolean;
  hasLocalChanges: boolean;
  checkError?: SyncCheckError | null;
}): RepoSyncState {
  const { isAuthenticated, isExpired, isNotInTab, link, status, isChecking, hasLocalChanges, checkError } = input;
  if (isExpired && link) return 'reconnect';
  if (isNotInTab && link) return 'not-in-tab';
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

/** Forget the legacy model file once a save removed it from the repo. */
const forgetLegacyFile = (projectId: string) => {
  const current = getProjectGitHubLink(projectId);
  if (!current?.legacyFilePath) return;
  const { legacyFilePath: _removed, ...rest } = current;
  setProjectGitHubLink(projectId, rest);
};

/**
 * `checkRemote: false` skips the sync-status checks, for callers that only
 * need the link and the session; the GitHub menu runs them.
 */
export function useRepoSync({ checkRemote = true }: { checkRemote?: boolean } = {}) {
  const dispatch = useAppDispatch();
  const { currentProject, loadProject } = useProject();
  const { isAuthenticated, isExpired, isNotInTab, githubSession } = useGitHubAuth();
  const projectId = currentProject?.id ?? null;

  const [link, setLink] = useState<ProjectGitHubLink | null>(() =>
    projectId ? getProjectGitHubLink(projectId) : null,
  );

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

  // One shared check per project link, however many components subscribe.
  const syncKey = checkRemote && link && projectId && githubSession ? repoSyncKey(projectId, githubSession, link) : null;
  const subscribe = useCallback(
    (listener: () => void) =>
      syncKey && projectId && githubSession ? subscribeRepoSync(syncKey, projectId, githubSession, listener) : () => undefined,
    [syncKey, projectId, githubSession],
  );
  const { status, isChecking, checkError } = useSyncExternalStore(subscribe, () => getRepoSyncSnapshot(syncKey));

  const refresh = useCallback(async () => {
    if (projectId && githubSession) await refreshRepoSync(projectId, githubSession);
  }, [projectId, githubSession]);

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
    () => deriveRepoSyncState({ isAuthenticated, isExpired, isNotInTab, link, status, isChecking, hasLocalChanges, checkError }),
    [isAuthenticated, isExpired, isNotInTab, link, status, isChecking, hasLocalChanges, checkError],
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
        // The old sidebar's model file: this save commit deletes it.
        ...(link.legacyFilePath ? { legacy_file_path: link.legacyFilePath } : {}),
      });
      if (result.status === 'merged') {
        // The branch now holds both sides: load it so the editor shows the merge.
        await pullInto(link, projectId);
        forgetLegacyFile(projectId);
      } else if (result.status === 'pushed') {
        markSynced(link, project, result.commit_sha);
        forgetLegacyFile(projectId);
      } else if (result.status === 'conflict' && result.conflict_branch) {
        setPendingGitHubChange(projectId, {
          kind: 'conflict', branch: result.conflict_branch, title: commitMessage, createdAt: new Date().toISOString(),
        });
      }
      await refresh();
      return result;
    },
    [link, projectId, githubSession, pullInto, markSynced, refresh],
  );

  /** Open (or find) the pull request of the pending change; returns its URL. `title` when the change has none. */
  const openPullRequest = useCallback(
    async (title: string): Promise<string> => {
      const pending = link?.pendingChange;
      if (!link || !pending || !projectId || !githubSession) throw new Error('Nothing waits for a pull request.');
      const pr = await createPullRequest(githubSession, {
        owner: link.owner, repo: link.repo, head: pending.branch, base: link.branch, title: pending.title || title,
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
