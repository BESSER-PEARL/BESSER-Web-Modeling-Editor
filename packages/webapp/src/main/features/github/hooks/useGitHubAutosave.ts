/**
 * "Autosave to GitHub": commits the model of a linked project on its own, through
 * the same save as "Save to GitHub" (useRepoSync's `save`), so newer commits are
 * merged and never reverted. GitHubAutosaveController decides when.
 *
 * Mounted once, by the GitHub menu in the top bar. Autosave waits while the
 * branch has commits the project lacks (the teammate-change card's Get latest
 * or Save and merge resolves that), while a save waits on its own branch, and
 * while the session or the repo is gone.
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useProject } from '../../../app/hooks/useProject';
import { ProjectStorageRepository } from '../../../shared/services/storage/ProjectStorageRepository';
import { getProjectGitHubLink, hasUnsyncedModelChanges } from '../../../shared/services/storage/projectGitHubLink';
import { getRepoSyncSnapshot, refreshRepoSync, repoSyncKey } from '../../../shared/services/github/repoSyncStatus';
import { AutosaveCheckError, GitHubAutosaveController, type AutosavePause } from '../autosave/GitHubAutosaveController';
import { setAutosaveStatus } from '../autosave/autosaveStatus';
import type { RepoSync, RepoSyncState } from './useRepoSync';

/** What autosave must wait for, from the repo's state; null when it may save. */
export function autosavePause(state: RepoSyncState, link: RepoSync['link']): AutosavePause | null {
  if (link?.pendingChange?.kind === 'conflict') return 'conflict';
  if (state === 'behind' || state === 'diverged') return 'remote';
  if (state === 'reconnect') return 'auth';
  if (state === 'missing') return 'missing';
  return null;
}

export function useGitHubAutosave({ sync, flushEditor }: { sync: RepoSync; flushEditor: () => void }) {
  const { t } = useTranslation();
  const { currentProject } = useProject();
  const projectId = currentProject?.id ?? null;
  const { link, state, hasLocalChanges, githubSession } = sync;
  const enabled = !!(link?.autoSave && githubSession && projectId);
  const pause = autosavePause(state, link);
  const target = link ? `${link.owner}/${link.repo}@${link.branch}` : '';

  const latest = useRef({ sync, flushEditor, projectId, commitMessage: '' });
  latest.current = {
    sync,
    flushEditor,
    projectId,
    commitMessage: t('github.autosave.commitMessage', { defaultValue: 'Autosave the model from the BESSER editor' }),
  };

  const [controller, setController] = useState<GitHubAutosaveController | null>(null);

  // One controller per project, so a save started for one never lands on another.
  useEffect(() => {
    if (!projectId) return undefined;
    const sameProject = () => latest.current.projectId === projectId;
    const created = new GitHubAutosaveController({
      hasChanges: () => {
        if (!sameProject()) return false;
        latest.current.flushEditor();
        const project = ProjectStorageRepository.loadProject(projectId);
        const current = getProjectGitHubLink(projectId);
        return !!project && !!current && hasUnsyncedModelChanges(project, current);
      },
      remoteMoved: async () => {
        const session = latest.current.sync.githubSession;
        if (!session || !sameProject()) throw new AutosaveCheckError('auth');
        await refreshRepoSync(projectId, session);
        const current = getProjectGitHubLink(projectId);
        if (!current) throw new AutosaveCheckError('missing');
        const { status, checkError } = getRepoSyncSnapshot(repoSyncKey(projectId, session, current));
        if (checkError) throw new AutosaveCheckError(checkError);
        if (!status) throw new AutosaveCheckError('unreachable');
        return status.commits_since.length > 0 || current.pendingChange?.kind === 'conflict';
      },
      save: async () => {
        if (!sameProject()) throw new AutosaveCheckError('unreachable');
        const result = await latest.current.sync.save(latest.current.commitMessage);
        return result.status === 'conflict' ? 'conflict' : 'saved';
      },
      onStatus: (status) => setAutosaveStatus(projectId, status),
    });
    setController(created);
    return () => {
      created.dispose();
      setAutosaveStatus(projectId, { phase: 'off' });
      setController(null);
    };
  }, [projectId]);

  useEffect(() => {
    controller?.setEnabled(enabled);
  }, [controller, enabled]);

  // A new session or another repo also lifts a pause the controller set on its own.
  useEffect(() => {
    controller?.setPaused(pause);
  }, [controller, pause, githubSession, target]);

  // Every edit that leaves the model unlike the synced one restarts the quiet time.
  useEffect(() => {
    if (enabled && hasLocalChanges) controller?.notifyChange();
  }, [controller, enabled, hasLocalChanges, currentProject]);

  useEffect(() => {
    if (!controller) return undefined;
    const onOnline = () => controller.retryNow();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [controller]);
}
