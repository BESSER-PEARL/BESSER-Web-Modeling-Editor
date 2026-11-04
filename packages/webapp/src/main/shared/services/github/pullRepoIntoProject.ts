/**
 * Bring a linked repo's head into a local project. Shared by the GitHub menu
 * (Get latest, link, merge after a save) and opening a repo from GitHub.
 */
import { importRepoAsRun, type ImportedRun } from '../../api/github';
import { storeRepoModelAsProject } from '../project-import/projectImport';
import { ProjectStorageRepository } from '../storage/ProjectStorageRepository';
import { writeProjectLastRun } from '../storage/specDrivenRunRecords';
import {
  legacyModelPath,
  markProjectGitHubSynced,
  setProjectGitHubLink,
  type ProjectGitHubLink,
} from '../storage/projectGitHubLink';
import { classModelElements, newElementIds } from './modelAttribution';
import type { BesserProject } from '../../types/project';

/**
 * Make project `projectId` match the head of `target`: the repo's model when it
 * has one (a repo without one keeps the project's model), and its code as the
 * next Spec-Driven modify run's base. The caller loads the project.
 *
 * `target.legacyFilePath` is the model file to read (an older editor's save,
 * maybe picked by the user); the link keeps it while the model is still there.
 */
export async function pullRepoIntoProject(
  githubSession: string,
  target: ProjectGitHubLink,
  projectId: string,
): Promise<ImportedRun> {
  const imported = await importRepoAsRun(githubSession, target.owner, target.repo, target.branch, {
    modelPath: target.legacyFilePath,
  });
  applyImportedRepo(imported, target, projectId);
  return imported;
}

/**
 * The elements to show as new after a pull: those still marked, plus what the
 * pull added. Only a project already in sync with the repo can compare; to one
 * opened or just linked, everything would look new.
 */
function marksAfterPull(target: ProjectGitHubLink, before: BesserProject | null, pulled: BesserProject): string[] {
  const inSync = !!(target.syncedModel || target.baselinePending);
  const added = before && inSync ? newElementIds(pulled, before, target.lastSyncedAt) : [];
  const present = classModelElements(pulled);
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
  writeProjectLastRun(projectId, imported.run_id, Date.now());
}
