/**
 * Open a BESSER-created GitHub repo as a new project and keep working on it.
 *
 * The one path behind the Project Hub's "Continue from GitHub", the chat's
 * `trigger_github_import` action and the repo browser: import the repo as a
 * modify seed, load its model into a fresh project, link that project to the
 * repo at the imported commit, and prime the modify base so the next
 * Spec-Driven request auto-selects mode=modify + base_run_id.
 *
 * The caller owns store dispatch and loading the project; this module stays
 * hook-free so it can be unit-tested directly.
 */
import { ApiError } from '../../../shared/api/api-client';
import { importProjectFromJson } from '../../../shared/services/project-import/projectImport';
import { markProjectGitHubSynced } from '../../../shared/services/storage/projectGitHubLink';
import { emitDeliveryEvent } from '../../../shared/services/telemetry/pilotTelemetry';
import { importRepoAsRun } from '../../github/services/githubApi';
import { writeProjectLastRun } from '../storage';

export interface ContinueFromGithubResult {
  ok: boolean;
  projectId?: string;
  runId?: string;
  owner?: string;
  repo?: string;
  branch?: string;
  /** True when the repo exists but carries no BESSER model. */
  needsEditorFirst?: boolean;
  error?: string;
}

export const getGithubSessionToken = (): string | null => {
  try {
    return sessionStorage.getItem('github_session');
  } catch {
    return null;
  }
};

export async function continueFromGithubRepo(args: {
  owner: string;
  repo: string;
  branch?: string;
  githubSession: string;
}): Promise<ContinueFromGithubResult> {
  try {
    const response = await importRepoAsRun(args.githubSession, args.owner, args.repo, args.branch);

    if (!response.has_model || !response.project) {
      return {
        ok: false,
        needsEditorFirst: true,
        owner: response.owner,
        repo: response.repo,
        error:
          "This repo has no BESSER model inside (buml/diagrams.json) — it " +
          "wasn't created by BESSER, so open it in the editor first.",
      };
    }

    // The returned ``project`` is a V2 export envelope — route it through
    // the V2-aware importer by wrapping it as a ``diagrams.json`` file.
    const file = new File([JSON.stringify(response.project)], 'diagrams.json', {
      type: 'application/json',
    });
    const imported = await importProjectFromJson(file);

    // Link the project to the repo at the imported commit, so a later push
    // updates the SAME repo and merges any commits made after this one.
    markProjectGitHubSynced(
      { owner: response.owner, repo: response.repo, branch: response.branch },
      imported,
      response.commit_sha,
      { loadedFromRepo: true },
    );

    // Prime the modify base: the next Spec-Driven request auto-selects
    // mode=modify + base_run_id via decideRunMode.
    writeProjectLastRun(imported.id, response.run_id, Date.now());

    // Research telemetry: a completed continue-from-repo import is a delivery
    // action. Fire-and-forget, no-op unless telemetry is active.
    emitDeliveryEvent('continue_from_repo', response.run_id);

    return {
      ok: true,
      projectId: imported.id,
      runId: response.run_id,
      owner: response.owner,
      repo: response.repo,
      branch: response.branch,
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return {
        ok: false,
        error:
          'Your GitHub session expired — sign in with GitHub again, then retry.',
      };
    }
    if (error instanceof ApiError && error.status === 404) {
      return {
        ok: false,
        error:
          `Repo ${args.owner}/${args.repo} was not found (or your GitHub ` +
          'account has no access to it).',
      };
    }
    const message =
      error instanceof ApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Could not continue from this repository.';
    return { ok: false, error: message };
  }
}
