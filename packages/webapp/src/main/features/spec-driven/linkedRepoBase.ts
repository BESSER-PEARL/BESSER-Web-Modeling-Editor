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
import { getGitHubSession } from '../../shared/services/github/githubAuth';
import { applyImportedRepo } from '../../shared/services/github/pullRepoIntoProject';
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
  /** No repo code to continue from, or the user chose to rebuild: the usual decision applies. */
  | { outcome: 'none' }
  /** Start from the repo's head. `pulled`: the project now holds the repo's newer model; reload it. */
  | { outcome: 'continue'; lastRun: LastRunRecord; pulled: boolean; message: string }
  /** No run; `message` says why, when the user did not just cancel. */
  | { outcome: 'stopped'; message?: string };

export interface LinkedRepoBaseParams {
  project: BesserProject;
  lastRun: LastRunRecord | null | undefined;
  nowMs: number;
  ttlSeconds: number;
  signal: AbortSignal;
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

/** Make the imported head this project's next base; false when local model changes stand in the way. */
function adoptHead(imported: ImportedRun, link: ProjectGitHubLink, project: BesserProject): { pulled: boolean } | null {
  const moved = imported.commit_sha !== link.baseCommitSha;
  // The stored project, not the caller's copy: the canvas stayed editable during the import.
  const current = ProjectStorageRepository.loadProject(project.id) ?? project;
  if (moved && imported.has_model && hasUnsyncedModelChanges(current, link)) return null;
  if (moved) {
    applyImportedRepo(imported, link, project.id);
    return { pulled: imported.has_model };
  }
  // The same commit: the project's model stays, with any changes made to it since.
  writeProjectLastRun(project.id, imported.run_id, Date.now());
  setProjectGitHubLink(project.id, { ...link, hasCode: true, recap: imported.recap ?? undefined });
  return { pulled: false };
}

export async function resolveLinkedRepoBase({
  project,
  lastRun,
  nowMs,
  ttlSeconds,
  signal,
}: LinkedRepoBaseParams): Promise<LinkedRepoBase> {
  const link = getProjectGitHubLink(project.id);
  if (!link || isWithinTtl(lastRun, nowMs, ttlSeconds)) return { outcome: 'none' };

  const session = getGitHubSession();
  if (!session) {
    // A repo known to hold only the saved model has nothing to continue from.
    return link.hasCode === false ? { outcome: 'none' } : askToRebuild(link, notConnected(), signal);
  }

  let imported: ImportedRun;
  try {
    imported = await importRepoAsRun(session, link.owner, link.repo, link.branch, { modelPath: link.legacyFilePath, signal });
  } catch (error) {
    if (signal.aborted) return { outcome: 'stopped' };
    if (error instanceof ApiError && error.status === 429) return { outcome: 'stopped', message: busyMessage() };
    return askToRebuild(link, unreadableReason(error), signal);
  }
  if (signal.aborted) return { outcome: 'stopped' };
  if (!imported.has_code) {
    setProjectGitHubLink(project.id, { ...link, hasCode: false });
    return { outcome: 'none' };
  }

  let adopted: ReturnType<typeof adoptHead>;
  try {
    adopted = adoptHead(imported, link, project);
  } catch (error) {
    reportError(i18n.t('github.linkedRun.badModel', { defaultValue: 'The model in this repository could not be loaded.' }), { error });
    return { outcome: 'stopped' };
  }
  if (!adopted) {
    return {
      outcome: 'stopped',
      message:
        `**${escapeMarkdownText(fullName(link))}** has commits on ${markdownCode(imported.branch)} this project has not `
        + 'brought in, and your model has changes not saved there. Use **Save to GitHub** in the GitHub menu to merge '
        + 'them, then ask again.',
    };
  }
  return {
    outcome: 'continue',
    lastRun: { runId: imported.run_id, at: Date.now() },
    pulled: adopted.pulled,
    message: describeContinuedRepo(link, imported, adopted.pulled),
  };
}
