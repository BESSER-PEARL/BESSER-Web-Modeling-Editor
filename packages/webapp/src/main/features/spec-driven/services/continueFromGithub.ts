/**
 * Continue-from-GitHub via CHAT (`trigger_github_import` agent action).
 *
 * Mirrors ProjectHubDialog's `handleContinueGithubRepo` sequence without
 * touching that dialog (it is being reworked separately): import the
 * BESSER-created repo as a modify seed, load the returned project, link
 * the push target, and prime the modify base so the next Spec-Driven
 * request auto-selects mode=modify + base_run_id.
 *
 * The caller (useAssistantLogic) owns store dispatch and project loading —
 * this module stays hook-free so it can be unit-tested directly.
 */
import { apiClient, ApiError } from '../../../shared/api/api-client';
import { importProjectFromJson } from '../../../shared/services/project-import/projectImport';
import { LocalStorageRepository } from '../../../shared/services/storage/local-storage-repository';
import { emitDeliveryEvent } from '../../../shared/services/telemetry/pilotTelemetry';
import { writeProjectLastRun } from '../storage';

const GITHUB_TARGET = 'github';

interface ImportGitHubRunResponse {
  run_id: string;
  project: unknown | null;
  has_model: boolean;
  owner: string;
  repo: string;
  branch: string;
  message?: string;
}

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
    const response = await apiClient.post<ImportGitHubRunResponse>(
      '/spec-driven/import-github-run',
      { owner: args.owner, repo: args.repo, branch: args.branch || undefined },
      { headers: { 'X-GitHub-Session': args.githubSession } },
    );

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

    // Link the push target so a later Spec-Driven push updates the SAME repo.
    LocalStorageRepository.setDeployLinkedRepo(imported.id, GITHUB_TARGET, {
      owner: response.owner,
      repo: response.repo,
      branch: response.branch,
    });

    // Prime the modify base: the next Spec-Driven request auto-selects
    // mode=modify + base_run_id via decideRunMode.
    writeProjectLastRun(imported.id, response.run_id, Date.now());

    // Pilot telemetry: a completed continue-from-repo import is a delivery
    // action. Fire-and-forget, no-op outside pilot sessions.
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
