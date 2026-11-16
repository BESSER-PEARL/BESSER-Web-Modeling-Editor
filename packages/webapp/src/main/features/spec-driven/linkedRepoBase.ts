/**
 * Where a Spec-Driven run starts on a project linked to GitHub once its last run has expired.
 *
 * The backend keeps a finished run only for `download_ttl_seconds`. A request
 * made later would rebuild the app from the model, ignoring the code on GitHub,
 * so the repo's head becomes the base instead. Nothing rebuilds silently: when
 * the code cannot be read, the user decides.
 */
import { ApiError } from '../../shared/api/api-client';
import { importRepoAsRun, type ImportedRun } from '../../shared/api/github';
import i18n from '../../shared/i18n';
import { globalConfirm } from '../../shared/services/confirm/globalConfirm';
import { describeContinuedRepo } from '../../shared/services/github/continueFromGithub';
import { reportError } from '../../shared/services/errors/reportError';
import type { SpecRunStopReason } from '../../shared/services/analytics/events';
import { getGitHubSession } from '../../shared/services/github/githubAuth';
import { applyImportedRepo, pullInterruption, pullStart } from '../../shared/services/github/pullRepoIntoProject';
import {
  getProjectGitHubLink,
  hasUnsyncedModelChanges,
  setProjectGitHubLink,
  type ProjectGitHubLink,
} from '../../shared/services/storage/projectGitHubLink';
import { ProjectStorageRepository } from '../../shared/services/storage/ProjectStorageRepository';
import { writeProjectLastRun, type LastRunRecord } from '../../shared/services/storage/specDrivenRunRecords';
import { markdownCode, escapeMarkdownText } from '../../shared/utils/markdownText';
import type { BesserProject } from '../../shared/types/project';
import { isWithinTtl } from './runModeDecision';

export type LinkedRepoBase =
  /**
   * No repo code to continue from, or the user chose to rebuild: the usual decision applies.
   * `pulled`: the repo holds only a model, a newer one, now in the project; reload it.
   */
  | { outcome: 'none'; pulled?: true; message?: string }
  /** Start from the repo's head. `pulled`: the project now holds the repo's newer model; reload it. */
  | { outcome: 'continue'; lastRun: LastRunRecord; pulled: boolean; message: string }
  /** No run; `reason` and `message` say why, when the user did not just cancel. */
  | { outcome: 'stopped'; reason?: SpecRunStopReason; message?: string };

export interface LinkedRepoBaseParams {
  project: BesserProject;
  lastRun: LastRunRecord | null | undefined;
  nowMs: number;
  ttlSeconds: number;
  signal: AbortSignal;
  /** Whether `project` is still the open one: the import takes a while and other projects can be opened meanwhile. */
  isStillOpen: () => boolean;
}

const fullName = (link: ProjectGitHubLink): string => `${link.owner}/${link.repo}`;

const notConnected = (): string =>
  i18n.t('github.linkedRun.notConnected', { defaultValue: 'GitHub is not connected in this tab' });

/** Why the repo's code could not be read, for the question below. */
function unreadableReason(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) return notConnected();
  if (error instanceof ApiError && error.status === 404) {
    return i18n.t('github.linkedRun.notFound', { defaultValue: 'the repository was not found, or your account has no access to it' });
  }
  // The server's own words for a request it refused: too large, no permission.
  if (error instanceof ApiError && error.status < 500 && error.message) return error.message;
  return i18n.t('github.linkedRun.failed', { defaultValue: 'GitHub could not be reached' });
}

/** The server's run slots are full: rebuilding would not help, and nothing is wrong with the repo. */
const busyMessage = (): string =>
  i18n.t('github.linkedRun.busy', { defaultValue: 'BESSER is busy with other runs right now. Please ask again in a moment.' });

async function askToRebuild(link: ProjectGitHubLink, reason: string, signal: AbortSignal): Promise<LinkedRepoBase> {
  const rebuild = await globalConfirm({
    title: i18n.t('github.linkedRun.title', { defaultValue: 'Rebuild the app from your model?' }),
    description: i18n.t('github.linkedRun.description', {
      defaultValue:
        'This project is linked to {{repo}}, but BESSER cannot read its code: {{reason}}. '
        + 'Fix that and ask again to continue from that code. '
        + 'Rebuilding starts from your model and ignores what is on GitHub.',
      repo: fullName(link),
      reason,
    }),
    confirmLabel: i18n.t('github.linkedRun.rebuild', { defaultValue: 'Rebuild from the model' }),
    cancelLabel: i18n.t('github.linkedRun.cancel', { defaultValue: 'Cancel' }),
    variant: 'danger',
    signal,
  });
  return rebuild && !signal.aborted ? { outcome: 'none' } : { outcome: 'stopped' };
}

/** Make the imported head this project's next base; null when local model changes stand in the way. */
function adoptHead(imported: ImportedRun, link: ProjectGitHubLink, project: BesserProject): { pulled: boolean } | null {
  const moved = imported.commit_sha !== link.baseCommitSha;
  // The stored project, not the caller's copy: the canvas stayed editable during the import.
  const current = ProjectStorageRepository.loadProject(project.id) ?? project;
  if (moved && imported.has_model && hasUnsyncedModelChanges(current, link)) return null;
  if (moved && (imported.has_code || imported.has_model)) {
    applyImportedRepo(imported, link, project.id);
    return { pulled: imported.has_model };
  }
  // Nothing to bring in: the project's model stays, with any changes made to it since.
  if (imported.has_code) writeProjectLastRun(project.id, imported.run_id, Date.now());
  setProjectGitHubLink(project.id, { ...link, hasCode: imported.has_code, recap: imported.recap ?? undefined });
  return { pulled: false };
}

export async function resolveLinkedRepoBase({
  project,
  lastRun,
  nowMs,
  ttlSeconds,
  signal,
  isStillOpen,
}: LinkedRepoBaseParams): Promise<LinkedRepoBase> {
  const link = getProjectGitHubLink(project.id);
  if (!link || isWithinTtl(lastRun, nowMs, ttlSeconds)) return { outcome: 'none' };

  const session = getGitHubSession();
  if (!session) {
    // A repo known to hold only the saved model has nothing to continue from.
    return link.hasCode === false ? { outcome: 'none' } : askToRebuild(link, notConnected(), signal);
  }

  const start = pullStart(project.id);
  let imported: ImportedRun;
  try {
    imported = await importRepoAsRun(session, link.owner, link.repo, link.branch, { modelPath: link.legacyFilePath, signal });
  } catch (error) {
    if (signal.aborted) return { outcome: 'stopped' };
    if (!isStillOpen()) return { outcome: 'stopped', reason: 'project_switched' };
    if (error instanceof ApiError && error.status === 429) {
      return { outcome: 'stopped', reason: 'repo_busy', message: busyMessage() };
    }
    return askToRebuild(link, unreadableReason(error), signal);
  }
  if (signal.aborted) return { outcome: 'stopped' };
  // Everything below writes: to the project storage, which also makes it the latest one.
  const interruption = isStillOpen() ? pullInterruption(start) : 'project_switched';
  if (interruption === 'project_switched') return { outcome: 'stopped', reason: 'project_switched' };
  const current = getProjectGitHubLink(project.id);
  if (interruption || !current) {
    return {
      outcome: 'stopped',
      reason: 'repo_changed',
      message: i18n.t('github.linkedRun.repoChanged', {
        defaultValue: "This project's GitHub link changed while this was starting. Please ask again.",
      }),
    };
  }

  let adopted: ReturnType<typeof adoptHead>;
  try {
    adopted = adoptHead(imported, current, project);
  } catch (error) {
    reportError(i18n.t('github.linkedRun.badModel', { defaultValue: 'The model in this repository could not be loaded.' }), { error });
    return { outcome: 'stopped', reason: 'bad_model' };
  }
  const repo = `**${escapeMarkdownText(fullName(current))}**`;
  if (!adopted) {
    return {
      outcome: 'stopped',
      reason: 'unsaved_changes',
      message: i18n.t('github.linkedRun.unsaved', {
        defaultValue:
          '{{repo}} has commits on {{branch}} this project has not brought in, and your model has changes not saved '
          + 'there. Use **Save to GitHub** in the GitHub menu to merge them, then ask again.',
        repo,
        branch: markdownCode(imported.branch),
      }),
    };
  }
  if (!imported.has_code) {
    if (!adopted.pulled) return { outcome: 'none' };
    return {
      outcome: 'none',
      pulled: true,
      message: i18n.t('github.linkedRun.pulledModel', {
        defaultValue: '{{repo}} had a newer model, so I brought it into this project first.',
        repo,
      }),
    };
  }
  return {
    outcome: 'continue',
    lastRun: { runId: imported.run_id, at: Date.now() },
    pulled: adopted.pulled,
    message: describeContinuedRepo(current, imported, adopted.pulled),
  };
}
