/**
 * useSpecDrivenGithubPush
 *
 * Drives the "Push to GitHub" action on a finished Spec-Driven Agent run
 * card. Owns:
 *   - the connect-first flow (sign in to GitHub before the dialog opens),
 *   - the project's linked repo (``projectGitHubLink``, shared with the
 *     GitHub sidebar) so a re-push updates the same repo instead of asking,
 *   - the actual push request to ``POST /spec-driven/push-to-github``, sent
 *     with the commit the project last synced so newer commits are merged,
 *   - what follows a push: the link's new base commit, the merged model and
 *     modify base after a merge, and the pull request on a conflict.
 *
 * The dialog is APP-LEVEL and Redux-driven (mirroring ``SpecDrivenKeyDialogHost``):
 * whether it's open comes from ``specDriven.pushDialogRunId`` in the store,
 * NOT from local state inside the assistant drawer/widget, so dismissing it
 * (Escape / backdrop) never tears the drawer down. The card's button
 * dispatches ``openPushDialog(runId)``; this hook (mounted once, at
 * app level via ``SpecDrivenPushDialogHost``) reacts to that:
 *   - not signed in → stash the intent and start GitHub OAuth,
 *   - signed in     → load the linked repo and let the dialog render.
 *
 * The dialog UI lives in ``../dialogs/PushToGitHubDialog``; this hook exposes a
 * ``dialog`` bag to spread into that component.
 *
 * Reuses ``useGitHubAuth`` for the OAuth session (same instance pattern as
 * ``useDeployment``) and the shared ``buildProjectExportEnvelope``.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';

import { apiClient, ApiError } from '../../../shared/api/api-client';
import { buildProjectExportEnvelope } from '../../../shared/utils/projectExportUtils';
import {
  getProjectGitHubLink,
  markProjectGitHubSynced,
  setProjectGitHubLink,
  type ProjectGitHubLink,
} from '../../../shared/services/storage/projectGitHubLink';
import { storeRepoModelAsProject } from '../../../shared/services/project-import/projectImport';
import { sessionStorageSpecDrivenPushIntent } from '../../../shared/constants/constant';
import { emitDeliveryEvent } from '../../../shared/services/telemetry/pilotTelemetry';
import type { BesserProject } from '../../../shared/types/project';
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks';
import { useProject } from '../../../app/hooks/useProject';
import {
  closePushDialog,
  openPushDialog,
  setLastRunForProject,
} from '../../spec-driven/state/specDrivenSlice';
import { writeProjectLastRun } from '../../spec-driven/storage';
import { createPullRequest, loadModel, type PushStatus } from '../services/githubApi';
import { useGitHubAuth } from './useGitHubAuth';

const DEFAULT_BRANCH = 'main';

export interface SpecDrivenPushConfig {
  /** True to push into an already-existing repo, false to create a new one. */
  useExisting: boolean;
  repoName: string;
  description?: string;
  isPrivate: boolean;
  branch?: string;
  commitMessage?: string;
  /** Commit straight to the branch, or open a pull request into it. */
  pushMode?: 'commit' | 'pull_request';
}

export interface SpecDrivenPushResult {
  success: boolean;
  repo_url: string;
  owner: string;
  repo_name: string;
  is_first_push: boolean;
  files_uploaded: number;
  branch: string;
  commit_sha: string;
  status: PushStatus;
  conflict_branch: string | null;
  pull_request_url: string | null;
  base_run_id: string | null;
  /** E.g. the app's previous deploy settings were kept; shown on the result view. */
  warnings?: string[];
  /** The model the push wrote when the run changed it (e.g. added classes); null when it is the editor's own. */
  project_export?: unknown;
}

/** Friendly discriminated outcome so the dialog can react per error class. */
export type SpecDrivenPushErrorCode =
  | 'expired'
  | 'repo_missing'
  | 'auth'
  | 'forbidden'
  | 'conflict'
  | 'branch_moved'
  | 'other';
export type SpecDrivenPushOutcome =
  | { ok: true; result: SpecDrivenPushResult }
  | { ok: false; code: SpecDrivenPushErrorCode; message: string };

type PushResponse = SpecDrivenPushResult;

/**
 * What a failed push means, from the status and the backend's ``detail``:
 * ``POST /spec-driven/push-to-github`` answers 404 ``run_expired`` or
 * ``repo_missing``, and 409 for both a taken repo name and a branch that
 * moved during the push (GitHub's 422s).
 */
export function describePushError(error: unknown): { code: SpecDrivenPushErrorCode; message: string } {
  if (!(error instanceof ApiError)) {
    return { code: 'other', message: error instanceof Error ? error.message : 'Save to GitHub failed.' };
  }
  const detail = error.message;
  switch (error.status) {
    case 401:
      return { code: 'auth', message: 'Your GitHub session expired. Reconnect and try again.' };
    case 403:
      return { code: 'forbidden', message: `GitHub refused the push: your account cannot write to this repository. (${detail})` };
    case 404:
      return detail === 'repo_missing'
        ? { code: 'repo_missing', message: 'This repository no longer exists, or your GitHub account cannot see it. Pick another repository or create a new one.' }
        : { code: 'expired', message: 'This generation expired — re-generate to push.' };
    case 409:
      return /already exists/i.test(detail)
        ? { code: 'conflict', message: 'A repository with that name already exists — push to it as an existing repo.' }
        : { code: 'branch_moved', message: `The branch changed on GitHub during the push. Try again. (${detail})` };
    default:
      return { code: 'other', message: detail || 'Save to GitHub failed.' };
  }
}

export interface UseSpecDrivenGithubPushOptions {
  currentProject: BesserProject | null | undefined;
}

export interface SpecDrivenPushDialogState {
  open: boolean;
  runId: string | null;
  projectName: string;
  linkedRepo: ProjectGitHubLink | null;
  githubSession: string | null;
  isPushing: boolean;
  result: SpecDrivenPushResult | null;
  onOpenChange: (open: boolean) => void;
  onChangeRepo: () => void;
  push: (config: SpecDrivenPushConfig) => Promise<SpecDrivenPushOutcome>;
  /** Open a pull request for a push GitHub could not merge; returns its URL. */
  openConflictPullRequest: () => Promise<string | null>;
}

export interface UseSpecDrivenGithubPushReturn {
  dialog: SpecDrivenPushDialogState;
}

export function useSpecDrivenGithubPush(
  { currentProject }: UseSpecDrivenGithubPushOptions,
): UseSpecDrivenGithubPushReturn {
  const { isAuthenticated, githubSession, login } = useGitHubAuth();
  const { loadProject } = useProject();
  const dispatch = useAppDispatch();

  // The open/target-run state is OWNED BY REDUX so the card's button (in the
  // drawer/widget) can drive this single app-level dialog by dispatching
  // ``openPushDialog(runId)`` — no drawer-coupled local state.
  const pushDialogRunId = useAppSelector((s) => s.specDriven.pushDialogRunId);

  // Read the live project from a ref so async handlers never close over a
  // stale project without forcing every callback to re-create on each edit.
  const projectRef = useRef(currentProject);
  projectRef.current = currentProject;

  const [linkedRepo, setLinkedRepo] = useState<ProjectGitHubLink | null>(null);
  const [isPushing, setIsPushing] = useState(false);
  const [result, setResult] = useState<SpecDrivenPushResult | null>(null);

  const runId = pushDialogRunId;

  // Connect-first + open handler. Reacts to ``pushDialogRunId`` being set
  // (dispatched by the card button or by the OAuth-return reopen effect):
  //   - no project  → toast + close (nothing to push into),
  //   - not signed in → stash the intent, close, and start GitHub OAuth so we
  //     can reopen for this run once the redirect returns,
  //   - signed in   → load the per-project linked repo and let the dialog show.
  // The dialog itself only renders once we're authenticated (see ``open``
  // below), so the unauthenticated branch never flashes the dialog open.
  useEffect(() => {
    if (pushDialogRunId === null) return;
    const project = projectRef.current;
    if (!project) {
      toast.error('Open a project before pushing to GitHub.');
      dispatch(closePushDialog());
      return;
    }
    if (!isAuthenticated) {
      // Connect-first: stash the intent so we can reopen the dialog for this
      // run once the OAuth redirect returns and the session is established.
      try {
        sessionStorage.setItem(
          sessionStorageSpecDrivenPushIntent,
          JSON.stringify({ runId: pushDialogRunId, projectId: project.id }),
        );
      } catch {
        /* sessionStorage may be unavailable — the login still proceeds. */
      }
      dispatch(closePushDialog());
      toast.info('Connect GitHub to push your generated app.');
      login();
      return;
    }
    // Signed in: (re)load the linked repo for this run and clear any prior
    // result so the form starts fresh for this open.
    setLinkedRepo(getProjectGitHubLink(project.id));
    setResult(null);
  }, [pushDialogRunId, isAuthenticated, dispatch, login]);

  // After an OAuth redirect, reopen the push dialog for the pending run once
  // we're authenticated AND the project it targeted is loaded. Consume-and-clear
  // so a re-render can't replay it. Dispatching ``openPushDialog`` re-enters the
  // effect above, which now finds us authenticated and loads the linked repo.
  useEffect(() => {
    if (!isAuthenticated) return;
    const project = projectRef.current;
    if (!project) return;
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(sessionStorageSpecDrivenPushIntent);
    } catch {
      raw = null;
    }
    if (!raw) return;
    let intent: { runId?: string; projectId?: string } | null = null;
    try {
      intent = JSON.parse(raw);
    } catch {
      intent = null;
    }
    if (!intent?.runId || intent.projectId !== project.id) return;
    try {
      sessionStorage.removeItem(sessionStorageSpecDrivenPushIntent);
    } catch {
      /* ignore */
    }
    dispatch(openPushDialog(intent.runId));
  }, [isAuthenticated, currentProject?.id, dispatch]);

  // Only the dialog forgets the repo: the project's link changes when a push
  // to another repo succeeds, so Cancel keeps the link and its base commit.
  const onChangeRepo = useCallback(() => {
    setLinkedRepo(null);
    setResult(null);
  }, []);

  const onOpenChange = useCallback(
    (next: boolean) => {
      // The Radix dialog only ever calls this with ``false`` (Escape, backdrop,
      // the close X, or the Cancel/Done buttons). Closing clears the Redux
      // run id — it never touches the assistant drawer.
      if (!next) dispatch(closePushDialog());
    },
    [dispatch],
  );

  const push = useCallback(
    async (config: SpecDrivenPushConfig): Promise<SpecDrivenPushOutcome> => {
      const project = projectRef.current;
      const id = runId;
      if (!project || !id) {
        toast.error('Nothing to push.');
        return { ok: false, code: 'other', message: 'Nothing to push.' };
      }
      if (!githubSession) {
        toast.error('GitHub session not found. Please reconnect.');
        return { ok: false, code: 'auth', message: 'GitHub session not found.' };
      }

      const pushesToLink =
        !!linkedRepo && config.useExisting && linkedRepo.repo === config.repoName;
      setIsPushing(true);
      setResult(null);
      try {
        // Personalization is user-local state — never publish it into a repo.
        const projectExport = buildProjectExportEnvelope(project, undefined, {
          includePersonalization: false,
        });

        const response = await apiClient.post<PushResponse>(
          '/spec-driven/push-to-github',
          {
            run_id: id,
            projectExport,
            deploy_config: {
              repo_name: config.repoName,
              ...(config.description ? { description: config.description } : {}),
              is_private: config.isPrivate,
              use_existing: config.useExisting,
              ...(config.branch ? { branch: config.branch } : {}),
              ...(config.commitMessage ? { commit_message: config.commitMessage } : {}),
              // Only the linked repo has a known base; any other repo is new to this project.
              ...(pushesToLink && linkedRepo?.baseCommitSha ? { base_commit_sha: linkedRepo.baseCommitSha } : {}),
              push_mode: config.pushMode ?? 'commit',
            },
          },
          {
            headers: { 'X-GitHub-Session': githubSession },
            // A push runs code generation + multiple GitHub API calls; mirror the
            // deploy path's 2-min budget so a slow-but-successful push isn't aborted.
            timeout: 120_000,
          },
        );

        const res: SpecDrivenPushResult = response;

        if (!res.success) {
          toast.error('Save to GitHub failed.');
          return { ok: false, code: 'other', message: 'Save to GitHub failed.' };
        }

        const link: ProjectGitHubLink = {
          ...(pushesToLink && linkedRepo ? linkedRepo : {}),
          owner: res.owner,
          repo: res.repo_name,
          branch: res.branch || config.branch || linkedRepo?.branch || DEFAULT_BRANCH,
        };
        if (res.status === 'pushed' && res.project_export) {
          // The run changed the model: load what the repo now holds, so the
          // editor shows it and a later save cannot revert it.
          const updated = storeRepoModelAsProject(res.project_export, project.id);
          markProjectGitHubSynced(link, updated, res.commit_sha, { loadedFromRepo: true });
          await loadProject(project.id);
        } else if (res.status === 'pushed') {
          markProjectGitHubSynced(link, project, res.commit_sha);
        } else if (res.status === 'merged' && githubSession) {
          // The branch now holds this run and the commits made since: load
          // that model, and start the next run from that code.
          const merged = await loadModel(githubSession, res.owner, res.repo_name, link.branch);
          const updated = storeRepoModelAsProject(merged.project, project.id);
          markProjectGitHubSynced(link, updated, res.commit_sha, { loadedFromRepo: true });
          if (res.base_run_id) {
            const at = Date.now();
            writeProjectLastRun(project.id, res.base_run_id, at);
            dispatch(setLastRunForProject({ projectId: project.id, runId: res.base_run_id, at }));
          }
          await loadProject(project.id);
        } else {
          // A pull request or a conflict leaves the branch as it was.
          setProjectGitHubLink(project.id, link);
        }
        setLinkedRepo(getProjectGitHubLink(project.id));
        setResult(res);
        // Opt-in research telemetry: a completed push is a delivery action.
        // Fire-and-forget; no-op unless the tab was opened with `?pilot=<label>`.
        emitDeliveryEvent('push_github', id);
        if (res.status === 'conflict') {
          toast.warn('GitHub could not merge this push automatically.');
        } else {
          toast.success(
            res.is_first_push
              ? `Pushed to ${res.owner}/${res.repo_name}`
              : res.status === 'pull_request'
                ? `Opened a pull request on ${res.owner}/${res.repo_name}`
                : `Updated ${res.owner}/${res.repo_name}`,
          );
        }
        if (res.status === 'pushed' && res.project_export) {
          toast.info('The model now includes the classes the agent added.');
        }
        return { ok: true, result: res };
      } catch (error) {
        const { code, message } = describePushError(error);
        toast.error(message);
        return { ok: false, code, message };
      } finally {
        setIsPushing(false);
      }
    },
    [runId, githubSession, linkedRepo, dispatch, loadProject],
  );

  const openConflictPullRequest = useCallback(async (): Promise<string | null> => {
    if (!result?.conflict_branch || !githubSession) return null;
    try {
      const pr = await createPullRequest(githubSession, {
        owner: result.owner,
        repo: result.repo_name,
        head: result.conflict_branch,
        base: result.branch,
        title: 'Update from the BESSER Spec-Driven Agent',
      });
      setResult({ ...result, status: 'pull_request', pull_request_url: pr.html_url });
      return pr.html_url;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not open the pull request.');
      return null;
    }
  }, [result, githubSession]);

  // The dialog only renders once a run is targeted AND we're authenticated —
  // the connect-first effect handles (and closes) the unauthenticated case.
  const open = pushDialogRunId !== null && isAuthenticated;

  return {
    dialog: {
      open,
      runId,
      projectName: currentProject?.name ?? '',
      linkedRepo,
      githubSession,
      isPushing,
      result,
      onOpenChange,
      onChangeRepo,
      push,
      openConflictPullRequest,
    },
  };
}
