/**
 * Bring a linked repo's head into a local project. Shared by the GitHub menu
 * (Get latest, link, merge after a save) and opening a repo from GitHub.
 */
import { importRepoAsRun, type ImportedRun } from '../../api/github';
import { storeRepoModelAsProject } from '../project-import/projectImport';
import { writeProjectLastRun } from '../storage/specDrivenRunRecords';
import {
  legacyModelPath,
  markProjectGitHubSynced,
  setProjectGitHubLink,
  type ProjectGitHubLink,
} from '../storage/projectGitHubLink';

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
  writeProjectLastRun(projectId, imported.run_id, Date.now());
  const { legacyFilePath: _previous, ...rest } = target;
  const legacyFilePath = legacyModelPath(imported.model_path);
  const link = { ...rest, branch: imported.branch, ...(legacyFilePath ? { legacyFilePath } : {}) };
  if (imported.has_model && imported.project) {
    const project = storeRepoModelAsProject(imported.project, projectId);
    markProjectGitHubSynced(link, project, imported.commit_sha, { loadedFromRepo: true });
  } else {
    setProjectGitHubLink(projectId, { ...link, baseCommitSha: imported.commit_sha });
  }
  return imported;
}
