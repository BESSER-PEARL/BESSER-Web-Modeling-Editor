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
 * Before an AI model reads any of its code, the user is asked
 * (`ai_reading_offered`): an excerpt of private code would leave BESSER.
 *
 * The caller owns store dispatch and loading the project; this module stays
 * hook-free so it can be unit-tested directly.
 */
import { ApiError } from '../../api/api-client';
import i18n from '../../i18n';
import { globalConfirm } from '../confirm/globalConfirm';
import { importProjectFromJson } from '../project-import/projectImport';
import { ProjectStorageRepository } from '../storage/ProjectStorageRepository';
import {
  getProjectGitHubLink,
  hasUnsyncedModelChanges,
  markProjectGitHubSynced,
  setProjectGitHubLink,
  type ProjectGitHubLink,
} from '../storage/projectGitHubLink';
import { layoutModel } from '@besser/wme';
import { isUMLModel, type BesserProject } from '../../types/project';
import { emitDeliveryEvent } from '../telemetry/pilotTelemetry';
import { PROJECT_EXPORT_VERSION } from '../../utils/projectExportUtils';
import { escapeMarkdownText, markdownCode } from '../../utils/markdownText';
import { importRepoAsRun, type ImportedRun, type RepoAnalysis } from '../../api/github';
import { pullRepoIntoProject } from './pullRepoIntoProject';
import { writeProjectLastRun } from '../storage/specDrivenRunRecords';

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
  /** The server's explanation when no model could be proposed (e.g. the AI reading failed). */
  message?: string;
  /** The repo opened in the local project already linked to it, not a new one. */
  reused?: boolean;
  /** That project had unsaved model changes and the user kept them instead of pulling. */
  keptLocalChanges?: boolean;
  error?: string;
}

/** The id of the class diagram that holds a proposed model in the new project. */
const proposalDiagramId = (response: ImportedRun): string => `class_${response.commit_sha.slice(0, 8)}`;

/** A V2 export envelope for a repo without a BESSER model: its proposed class diagram, or nothing. */
/** A proposed diagram has no layout of its own: arrange it before the project opens. */
async function withLaidOutProposal(response: ImportedRun): Promise<ImportedRun> {
  const proposal = response.proposed_diagram;
  if (!proposal || !isUMLModel(proposal.model)) return response;
  return { ...response, proposed_diagram: { ...proposal, model: await layoutModel(proposal.model) } };
}

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
        ? { ClassDiagram: [{ id: proposalDiagramId(response), title: diagram.title, model: diagram.model, lastUpdate: now }] }
        : {},
      settings: {},
    },
    exportedAt: now,
    version: PROJECT_EXPORT_VERSION,
  };
}

/** The local project already linked to `owner/repo` (GitHub names ignore case), or null. */
export function findProjectLinkedTo(owner: string, repo: string): BesserProject | null {
  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  for (const project of ProjectStorageRepository.getAllProjects()) {
    const link = getProjectGitHubLink(project.id);
    if (link && same(link.owner, owner) && same(link.repo, repo)) return project as BesserProject;
  }
  return null;
}

/** Ask before an AI model reads the repo's code: an excerpt of it goes to the server's model provider. */
export function confirmAiReading(owner: string, repo: string): Promise<boolean> {
  return globalConfirm({
    title: i18n.t('github.aiReading.title', { defaultValue: 'Read this repository with AI?' }),
    description: i18n.t('github.aiReading.description', {
      defaultValue:
        'BESSER could not read the data classes of {{repo}} directly. It can send a short excerpt of the code '
        + '(up to about 40,000 characters, with secret files and keys removed) to the AI model the BESSER server '
        + 'uses, which may be run by a third-party provider. Your code then leaves BESSER\'s server. '
        + 'Nothing is sent unless you agree.',
      repo: `${owner}/${repo}`,
    }),
    confirmLabel: i18n.t('github.aiReading.accept', { defaultValue: 'Read with AI' }),
    cancelLabel: i18n.t('github.aiReading.decline', { defaultValue: 'Not now' }),
  });
}

/** Import the repo; when only an AI reading could propose a model, import again with AI once the user agrees. */
async function importAskingForAiReading(
  githubSession: string,
  owner: string,
  repo: string,
  branch?: string,
): Promise<ImportedRun> {
  const response = await importRepoAsRun(githubSession, owner, repo, branch);
  if (!response.ai_reading_offered || !(await confirmAiReading(response.owner, response.repo))) return response;
  return importRepoAsRun(githubSession, owner, repo, response.branch, { allowAiReading: true });
}

/** Open the repo in the project already linked to it; unsaved model changes are replaced only on confirm. */
async function continueInLinkedProject(
  project: BesserProject,
  args: { branch?: string; githubSession: string },
): Promise<ContinueFromGithubResult> {
  const link = getProjectGitHubLink(project.id) as ProjectGitHubLink;
  const opened = { ok: true, projectId: project.id, owner: link.owner, repo: link.repo, reused: true };
  if (hasUnsyncedModelChanges(project, link)) {
    const replace = await globalConfirm({
      title: i18n.t('github.linked.pullConfirmTitle', { defaultValue: 'Replace your local changes?' }),
      description: i18n.t('github.linked.pullConfirmDescription', {
        defaultValue: 'Pulling loads the version on GitHub and discards the changes you have not pushed yet.',
      }),
      confirmLabel: i18n.t('github.linked.pullConfirmAction', { defaultValue: 'Pull and discard changes' }),
      cancelLabel: i18n.t('github.linked.keepLocalChanges', { defaultValue: 'Keep my changes' }),
      variant: 'danger',
    });
    if (!replace) return { ...opened, branch: link.branch, keptLocalChanges: true };
  }
  const imported = await pullRepoIntoProject(args.githubSession, { ...link, branch: args.branch ?? link.branch }, project.id);
  return { ...opened, runId: imported.run_id, branch: imported.branch };
}

export async function continueFromGithubRepo(args: {
  owner: string;
  repo: string;
  branch?: string;
  githubSession: string;
}): Promise<ContinueFromGithubResult> {
  try {
    // A repo a local project already links to opens in that project: a second
    // copy would diverge from it, each with its own base commit.
    const linked = findProjectLinkedTo(args.owner, args.repo);
    if (linked) return await continueInLinkedProject(linked, args);

    const response = await withLaidOutProposal(
      await importAskingForAiReading(args.githubSession, args.owner, args.repo, args.branch),
    );
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
        ...(response.proposed_diagram && response.analysis
          ? { modelProposal: { ...response.analysis, diagramId: proposalDiagramId(response) } }
          : {}),
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
      ...(isBesserRepo ? {} : {
        analysis: response.analysis ?? undefined,
        proposedModel: !!response.proposed_diagram,
        message: response.message || undefined,
      }),
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return {
        ok: false,
        error: i18n.t('project.hub.github.errors.sessionExpired', {
          defaultValue: 'Your GitHub session expired. Reconnect and try again.',
        }),
      };
    }
    if (error instanceof ApiError && error.status === 404) {
      return {
        ok: false,
        error: i18n.t('project.hub.github.errors.repoNotFound', {
          defaultValue: '{{repo}} was not found, or your GitHub account has no access to it.',
          repo: `${args.owner}/${args.repo}`,
        }),
      };
    }
    const message =
      error instanceof Error && error.message
        ? error.message
        : i18n.t('project.hub.github.errors.generic', { defaultValue: 'Could not continue from this repository.' });
    return { ok: false, error: message };
  }
}

/**
 * What the assistant says after a repo opened, in the chat's markdown. Every
 * value read from the repo (names, files, classes) or sent by the server is
 * escaped, so a crafted file name cannot render a link in the chat.
 */
export function describeOpenedRepo(result: ContinueFromGithubResult): string {
  const repo = `**${escapeMarkdownText(`${result.owner}/${result.repo}`)}**`;
  if (result.reused) {
    return result.keptLocalChanges
      ? `Opened your project linked to ${repo}, with your unsaved changes. ` +
          'Use **Get latest** in the GitHub menu when you want the version on GitHub.'
      : `Opened your project linked to ${repo}, updated to the latest commit on ${markdownCode(result.branch ?? '')}. ` +
          'Ask for any change and save it back to GitHub when you are happy.';
  }
  if (!result.analysis) {
    return (
      `Opened ${repo}. Its model is on the canvas, and I will work on top of its code. ` +
      'Ask for any change, for example *"add a search bar"*, and save it back to GitHub when you are happy.'
    );
  }
  const { stack, model_source: source, source_files: files, entities } = result.analysis;
  const stackText = stack.length ? ` (${stack.map(escapeMarkdownText).join(' + ')})` : '';
  if (!result.proposedModel) {
    // The server says why (no readable classes, AI reading unavailable, declined or failed).
    const why = result.message
      ? `${escapeMarkdownText(result.message.replace(/;\s*you can still work on its code\.?$/i, '').replace(/[.!?\s]+$/, ''))}.`
      : 'It has no BESSER model, and I found no data classes I can read into one.';
    return (
      `Opened ${repo}${stackText}. ${why} The canvas is empty, but I can still work on its code: ` +
      'tell me what to change.'
    );
  }
  const where = files.length
    ? ` in ${files.slice(0, 3).map(markdownCode).join(', ')}${files.length > 3 ? ' and more' : ''}`
    : '';
  const classes = `${entities.length} class${entities.length === 1 ? '' : 'es'}: ${entities.map(markdownCode).join(', ')}`;
  if (result.analysis.ai) {
    return (
      `Opened ${repo}${stackText}. It has no data classes I can read exactly, so an AI model read its code${where} ` +
      `and proposed ${classes}. This is a reading, not a transcription: check names, types and links on the ` +
      'canvas, edit what is off, then click **Accept model**. Then ask for changes to the model or the code.'
    );
  }
  return (
    `Opened ${repo}${stackText}. It has no BESSER model yet, so I read its ${escapeMarkdownText(source ?? 'code')}${where} ` +
    `and drew ${classes}. ` +
    'Check them on the canvas and click **Accept model**, or edit them first. ' +
    'Then ask for changes to the model or the code.'
  );
}
