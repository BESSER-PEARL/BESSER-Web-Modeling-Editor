/**
 * The current project's GitHub repository: its link, how it relates to the
 * repo (in sync, behind, local changes), and the actions that move it.
 *
 * Shared by the GitHub menu in the top bar and the chat's repo header, so both
 * always show the same state.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppDispatch } from '../../../app/store/hooks';
import { useProject } from '../../../app/hooks/useProject';
import { ProjectStorageRepository } from '../../../shared/services/storage/ProjectStorageRepository';
import {
  GITHUB_LINK_CHANGED_EVENT,
  clearProjectGitHubLink,
  getProjectGitHubLink,
  markProjectGitHubSynced,
  modelFingerprint,
  setProjectGitHubLink,
  type ProjectGitHubLink,
} from '../../../shared/services/storage/projectGitHubLink';
import { storeRepoModelAsProject } from '../../../shared/services/project-import/projectImport';
import { buildProjectExportEnvelope } from '../../../shared/utils/projectExportUtils';
import type { BesserProject } from '../../../shared/types/project';
import { writeProjectLastRun } from '../../spec-driven/storage';
import { setLastRunForProject } from '../../spec-driven/state/specDrivenSlice';
import { useGitHubAuth } from './useGitHubAuth';
import {
  getSyncStatus,
  importRepoAsRun,
  loadModelAtCommit,
  saveModel,
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
  | 'unknown';

// How often an open editor re-checks the linked repo for new commits.
const SYNC_POLL_MS = 60_000;
// Quiet time after a pull before the loaded model counts as the synced one.
const BASELINE_SETTLE_MS = 1_500;

/** How a project relates to its repo, from the link, the last sync check and the local model. */
export function deriveRepoSyncState(input: {
  isAuthenticated: boolean;
  link: ProjectGitHubLink | null;
  status: SyncStatus | null;
  isChecking: boolean;
  hasLocalChanges: boolean;
}): RepoSyncState {
  const { isAuthenticated, link, status, isChecking, hasLocalChanges } = input;
  if (!isAuthenticated) return 'signed-out';
  if (!link) return 'unlinked';
  if (!status) return isChecking ? 'checking' : 'unknown';
  const behind = status.commits_since.length > 0;
  if (behind && hasLocalChanges) return 'diverged';
  if (behind) return 'behind';
  return hasLocalChanges ? 'local-changes' : 'in-sync';
}

const projectExport = (project: BesserProject) =>
  buildProjectExportEnvelope(project, undefined, { includePersonalization: false });

/**
 * `checkRemote: false` skips the sync-status checks, for callers that only
 * need the link and the session; the GitHub menu runs them.
 */
export function useRepoSync({ checkRemote = true }: { checkRemote?: boolean } = {}) {
  const dispatch = useAppDispatch();
  const { currentProject, loadProject } = useProject();
  const { isAuthenticated, githubSession } = useGitHubAuth();
  const projectId = currentProject?.id ?? null;

  const [link, setLink] = useState<ProjectGitHubLink | null>(() =>
    projectId ? getProjectGitHubLink(projectId) : null,
  );
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [checkFailed, setCheckFailed] = useState(false);

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

  const refresh = useCallback(async () => {
    if (!link || !githubSession) return;
    setIsChecking(true);
    try {
      setStatus(await getSyncStatus(githubSession, link.owner, link.repo, link.branch, link.baseCommitSha));
      setCheckFailed(false);
    } catch {
      setCheckFailed(true);
    } finally {
      setIsChecking(false);
    }
  }, [link, githubSession]);

  useEffect(() => {
    setStatus(null);
    if (!checkRemote || !link || !githubSession) return undefined;
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
  }, [checkRemote, link, githubSession, refresh]);

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

  const hasLocalChanges = useMemo(() => {
    if (!currentProject || !link || link.baselinePending) return false;
    return !link.syncedModel || modelFingerprint(currentProject) !== link.syncedModel;
  }, [currentProject, link]);

  const state = useMemo(
    () => deriveRepoSyncState({ isAuthenticated, link, status, isChecking, hasLocalChanges }),
    [isAuthenticated, link, status, isChecking, hasLocalChanges],
  );

  const markSynced = markProjectGitHubSynced;

  /**
   * Make the project match the repo's branch head: its model, and its code as
   * the next Spec-Driven modify run's starting point.
   */
  const pullInto = useCallback(
    async (target: ProjectGitHubLink, intoProjectId: string): Promise<BesserProject> => {
      if (!githubSession) throw new Error('Connect GitHub first.');
      const imported = await importRepoAsRun(githubSession, target.owner, target.repo, target.branch);
      const at = Date.now();
      writeProjectLastRun(intoProjectId, imported.run_id, at);
      dispatch(setLastRunForProject({ projectId: intoProjectId, runId: imported.run_id, at }));
      if (!imported.has_model || !imported.project) {
        // A repo without a BESSER model: its latest code becomes the agent's
        // base, and the project's own model stays as it is.
        setProjectGitHubLink(intoProjectId, { ...target, branch: imported.branch, baseCommitSha: imported.commit_sha });
        await loadProject(intoProjectId);
        return ProjectStorageRepository.loadProject(intoProjectId) as BesserProject;
      }
      const project = storeRepoModelAsProject(imported.project, intoProjectId);
      markSynced({ ...target, branch: imported.branch }, project, imported.commit_sha, { loadedFromRepo: true });
      await loadProject(intoProjectId);
      return project;
    },
    [githubSession, dispatch, markSynced, loadProject],
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
      }
      await refresh();
      return result;
    },
    [link, projectId, githubSession, pullInto, markSynced, refresh],
  );

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
    checkFailed,
    githubSession,
    refresh,
    pull,
    pullInto,
    save,
    restore,
    linkTo,
    unlink,
    markSynced,
  };
}

export type RepoSync = ReturnType<typeof useRepoSync>;
