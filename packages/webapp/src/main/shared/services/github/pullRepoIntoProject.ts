/**
 * Bring a linked repo's head into a local project. Shared by the GitHub menu
 * (Get latest, link, merge after a save) and opening a repo from GitHub.
 */
import { importRepoAsRun, type ImportedRun } from '../../api/github';
import i18n from '../../i18n';
import type { SpecRunStopReason } from '../analytics/events';
import { storeRepoModelAsProject } from '../project-import/projectImport';
import { ProjectStorageRepository } from '../storage/ProjectStorageRepository';
import { writeProjectLastRun } from '../storage/specDrivenRunRecords';
import {
  getProjectGitHubLink,
  legacyModelPath,
  markProjectGitHubSynced,
  setProjectGitHubLink,
  type ProjectGitHubLink,
} from '../storage/projectGitHubLink';
import { classModelIds, newElementIds } from './modelAttribution';
import type { BesserProject } from '../../types/project';

/** What a pull must find unchanged once its import returns: it can take minutes, and the app stays live. */
export interface PullStart {
  projectId: string;
  openProjectId: string | null;
  link: ProjectGitHubLink | null;
}

export const pullStart = (projectId: string): PullStart => ({
  projectId,
  openProjectId: ProjectStorageRepository.getLatestProjectId(),
  link: getProjectGitHubLink(projectId),
});

/** Why the pull begun at `start` must not write anything, or null when it still may. */
export function pullInterruption(start: PullStart): Extract<SpecRunStopReason, 'project_switched' | 'repo_changed'> | null {
  if (ProjectStorageRepository.getLatestProjectId() !== start.openProjectId) return 'project_switched';
  const now = getProjectGitHubLink(start.projectId);
  const before = start.link;
  const same = before
    ? !!now && now.owner === before.owner && now.repo === before.repo && now.branch === before.branch
      && now.baseCommitSha === before.baseCommitSha
    : !now;
  return same ? null : 'repo_changed';
}

/**
 * Make project `projectId` match the head of `target`: the repo's model when it
 * has one (a repo without one keeps the project's model), and its code as the
 * next Spec-Driven modify run's base. The caller loads the project.
 *
 * `target.legacyFilePath` is the model file to read (an older editor's save,
 * maybe picked by the user); the link keeps it while the model is still there.
 *
 * Throws, having written nothing, when the project or its link changed during the import.
 */
export async function pullRepoIntoProject(
  githubSession: string,
  target: ProjectGitHubLink,
  projectId: string,
): Promise<ImportedRun> {
  const start = pullStart(projectId);
  const imported = await importRepoAsRun(githubSession, target.owner, target.repo, target.branch, {
    modelPath: target.legacyFilePath,
  });
  if (pullInterruption(start)) {
    throw new Error(i18n.t('github.linkedRun.pullInterrupted', {
      defaultValue: 'The GitHub version was not loaded: the project or its GitHub link changed meanwhile. Please try again.',
    }));
  }
  const current = getProjectGitHubLink(projectId);
  applyImportedRepo(imported, current ? { ...target, pendingChange: current.pendingChange } : target, projectId);
  return imported;
}

/**
 * The elements to show as new after a pull: those still marked, plus what the
 * pull added. Only a project already in sync with the repo can compare; to one
 * opened or just linked, everything would look new.
 */
function marksAfterPull(target: ProjectGitHubLink, before: BesserProject | null, pulled: BesserProject): string[] {
  const inSync = !!(target.syncedModel || target.baselinePending);
  const added = before && inSync ? newElementIds(pulled, before, target.syncedElements) : [];
  const present = new Set(classModelIds(pulled));
  return [...new Set([...(target.newFromRepo ?? []).filter((id) => present.has(id)), ...added])];
}

/** The second half of a pull, for a caller that already imported the repo. */
export function applyImportedRepo(imported: ImportedRun, target: ProjectGitHubLink, projectId: string): void {
  const { legacyFilePath: _previous, newFromRepo: _marks, ...rest } = target;
  const legacyFilePath = legacyModelPath(imported.model_path);
  const link = {
    ...rest,
    branch: imported.branch,
    hasCode: imported.has_code,
    recap: imported.recap ?? undefined,
    ...(legacyFilePath ? { legacyFilePath } : {}),
  };
  if (imported.has_model && imported.project) {
    const before = ProjectStorageRepository.loadProject(projectId);
    const project = storeRepoModelAsProject(imported.project, projectId);
    const newFromRepo = marksAfterPull(target, before, project);
    markProjectGitHubSynced(
      { ...link, ...(newFromRepo.length ? { newFromRepo } : {}) },
      project,
      imported.commit_sha,
      { loadedFromRepo: true },
    );
  } else {
    setProjectGitHubLink(projectId, {
      ...link,
      baseCommitSha: imported.commit_sha,
      ...(target.newFromRepo ? { newFromRepo: target.newFromRepo } : {}),
    });
  }
  // Last: a model that was refused above leaves the next modify run on the code it matches.
  // A repo with no code is nothing a modify run could edit.
  if (imported.has_code !== false) writeProjectLastRun(projectId, imported.run_id, Date.now());
}
