/**
 * Open a GitHub repo as a new project and keep working on it.
 *
 * The one path behind the Project Hub's "Continue from GitHub", the chat's
 * `trigger_github_import` action and the agentic "Start from a GitHub repo":
 * import the repo as a modify seed, load its model into a fresh project, link
 * that project to the repo at the imported commit, and prime the modify base
 * so the next Spec-Driven request edits that repo's code.
 *
 * A repo BESSER did not create has no model. BESSER reads its code instead
 * and proposes one (`analysis` + `proposed_diagram`); the project then opens
 * with that model marked as a proposal the user accepts on the canvas. With no
 * readable data classes the project opens empty and the agent works on code.
 *
 * The caller owns store dispatch and loading the project; this module stays
 * hook-free so it can be unit-tested directly.
 */
import { ApiError } from '../../../shared/api/api-client';
import { importProjectFromJson } from '../../../shared/services/project-import/projectImport';
import {
  markProjectGitHubSynced,
  setProjectGitHubLink,
} from '../../../shared/services/storage/projectGitHubLink';
import { emitDeliveryEvent } from '../../../shared/services/telemetry/pilotTelemetry';
import { PROJECT_EXPORT_VERSION } from '../../../shared/utils/projectExportUtils';
import { importRepoAsRun, type ImportedRun, type RepoAnalysis } from '../../github/services/githubApi';
import { writeProjectLastRun } from '../storage';

export interface ContinueFromGithubResult {
  ok: boolean;
  projectId?: string;
  runId?: string;
  owner?: string;
  repo?: string;
  branch?: string;
  /** Set for a repo without a BESSER model: what BESSER read in its code. */
  analysis?: RepoAnalysis;
  /** True when the project opened with a model BESSER proposed from the code. */
  proposedModel?: boolean;
  error?: string;
}

export const getGithubSessionToken = (): string | null => {
  try {
    return sessionStorage.getItem('github_session');
  } catch {
    return null;
  }
};

/** A V2 export envelope for a repo without a BESSER model: its proposed class diagram, or nothing. */
function envelopeForCodeRepo(response: ImportedRun): unknown {
  const now = new Date().toISOString();
  const diagram = response.proposed_diagram;
  return {
    project: {
      id: `github_${response.owner}_${response.repo}`,
      type: 'Project',
      name: response.repo,
      description: `Opened from github.com/${response.owner}/${response.repo}`,
      owner: response.owner,
      createdAt: now,
      currentDiagramType: 'ClassDiagram',
      currentDiagramIndices: { ClassDiagram: 0 },
      diagrams: diagram
        ? { ClassDiagram: [{ id: `class_${response.commit_sha.slice(0, 8)}`, title: diagram.title, model: diagram.model, lastUpdate: now }] }
        : {},
      settings: {},
    },
    exportedAt: now,
    version: PROJECT_EXPORT_VERSION,
  };
}

export async function continueFromGithubRepo(args: {
  owner: string;
  repo: string;
  branch?: string;
  githubSession: string;
}): Promise<ContinueFromGithubResult> {
  try {
    const response = await importRepoAsRun(args.githubSession, args.owner, args.repo, args.branch);
    const isBesserRepo = response.has_model && !!response.project;

    // The repo's own model, or (any other repo) a project built from what
    // BESSER read in its code — routed through the V2-aware importer either way.
    const envelope = isBesserRepo ? response.project : envelopeForCodeRepo(response);
    const file = new File([JSON.stringify(envelope)], 'diagrams.json', { type: 'application/json' });
    const imported = await importProjectFromJson(file);

    const link = { owner: response.owner, repo: response.repo, branch: response.branch };
    if (isBesserRepo) {
      // Linked at the imported commit, so a later push updates the SAME repo
      // and merges any commits made after this one.
      markProjectGitHubSynced(link, imported, response.commit_sha, { loadedFromRepo: true });
    } else {
      // The repo holds no model yet: the project counts as unsaved until the
      // user saves its model, and a proposed one waits on the canvas for review.
      setProjectGitHubLink(imported.id, {
        ...link,
        baseCommitSha: response.commit_sha,
        ...(response.proposed_diagram && response.analysis ? { modelProposal: response.analysis } : {}),
      });
    }

    // Prime the modify base: the next Spec-Driven request edits the repo's code.
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
      ...(isBesserRepo ? {} : { analysis: response.analysis ?? undefined, proposedModel: !!response.proposed_diagram }),
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

/** What the assistant says after a repo opened, in the chat's markdown. */
export function describeOpenedRepo(result: ContinueFromGithubResult): string {
  const repo = `**${result.owner}/${result.repo}**`;
  if (!result.analysis) {
    return (
      `Opened ${repo}. Its model is on the canvas, and I will work on top of its code. ` +
      'Ask for any change, for example *"add a search bar"*, and save it back to GitHub when you are happy.'
    );
  }
  const { stack, model_source: source, source_files: files, entities } = result.analysis;
  const stackText = stack.length ? ` (${stack.join(' + ')})` : '';
  if (!result.proposedModel) {
    return (
      `Opened ${repo}${stackText}. It has no BESSER model, and I found no data classes I can read ` +
      'into one, so the canvas is empty. I can still work on its code: tell me what to change.'
    );
  }
  const where = files.length ? ` in \`${files.slice(0, 3).join('`, `')}\`${files.length > 3 ? ' and more' : ''}` : '';
  const classes = `${entities.length} class${entities.length === 1 ? '' : 'es'}: ${entities.join(', ')}`;
  if (result.analysis.ai) {
    return (
      `Opened ${repo}${stackText}. It has no data classes I can read exactly, so an AI model read its code${where} ` +
      `and proposed ${classes}. This is a reading, not a transcription: check names, types and links on the ` +
      'canvas, edit what is off, then click **Accept model**. Then ask for changes to the model or the code.'
    );
  }
  return (
    `Opened ${repo}${stackText}. It has no BESSER model yet, so I read its ${source}${where} ` +
    `and drew ${classes}. ` +
    'Check them on the canvas and click **Accept model**, or edit them first. ' +
    'Then ask for changes to the model or the code.'
  );
}
