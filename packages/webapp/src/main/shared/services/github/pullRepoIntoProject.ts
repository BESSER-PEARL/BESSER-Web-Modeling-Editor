/**
 * Bring a linked repo's head into a local project. Shared by the GitHub menu
 * (Get latest, link, merge after a save) and opening a repo from GitHub.
 */
import { importRepoAsRun, type ImportedRun } from '../../api/github';
import { storeRepoModelAsProject } from '../project-import/projectImport';
import { writeProjectLastRun } from '../storage/specDrivenRunRecords';
import {
  markProjectGitHubSynced,
  setProjectGitHubLink,
  type ProjectGitHubLink,
} from '../storage/projectGitHubLink';

/**
 * Make project `projectId` match the head of `target`: the repo's model when it
 * has one (a repo without one keeps the project's model), and its code as the
 * next Spec-Driven modify run's base. The caller loads the project.
 */
export async function pullRepoIntoProject(
  githubSession: string,
  target: ProjectGitHubLink,
  projectId: string,
): Promise<ImportedRun> {
  const imported = await importRepoAsRun(githubSession, target.owner, target.repo, target.branch);
  writeProjectLastRun(projectId, imported.run_id, Date.now());
  const link = { ...target, branch: imported.branch };
  if (imported.has_model && imported.project) {
    const project = storeRepoModelAsProject(imported.project, projectId);
    markProjectGitHubSynced(link, project, imported.commit_sha, { loadedFromRepo: true });
  } else {
    setProjectGitHubLink(projectId, { ...link, baseCommitSha: imported.commit_sha });
  }
  return imported;
}
