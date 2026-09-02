/**
 * useSpecDrivenGithubPush
 *
 * Drives the "Push to GitHub" action on a finished Vibe/Smart-generation run
 * card. Owns:
 *   - the connect-first flow (sign in to GitHub before the dialog opens),
 *   - the per-project ``'github'`` linked-repo (load / set / clear) so a
 *     re-push updates the same repo instead of asking every time,
 *   - the actual push request to ``POST /spec-driven/push-to-github``.
 *
 * The dialog is APP-LEVEL and Redux-driven (mirroring ``SpecDrivenByokDialog``):
 * whether it's open comes from ``specDriven.pushDialogRunId`` in the store,
 * NOT from local state inside the assistant drawer/widget. This is the whole
 * point — the push dialog used to be mounted inside the drawer, so dismissing
 * it (Escape / backdrop) tore the drawer down and lost the chat. Now the card's
 * button just dispatches ``openPushDialog(runId)``; this hook (mounted once, at
 * app level via ``SpecDrivenPushDialogHost``) reacts to that:
 *   - not signed in → stash the intent and start GitHub OAuth,
 *   - signed in     → load the linked repo and let the dialog render.
 *
 * The dialog UI lives in ``../dialogs/PushToGitHubDialog``; this hook exposes a
 * ``dialog`` bag to spread into that component.
 *
 * Reuses ``useGitHubAuth`` for the OAuth session (same instance pattern as
 * ``useDeployment``) and the shared ``buildProjectExportEnvelope`` /
 * ``LocalStorageRepository`` deploy-link helpers so the smart-gen push stays in
 * sync with the Render deploy flow.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';

import { apiClient, ApiError } from '../../../shared/api/api-client';
import { buildProjectExportEnvelope } from '../../../shared/utils/projectExportUtils';
import {
  LocalStorageRepository,
  type DeployLinkedRepo,
} from '../../../shared/services/storage/local-storage-repository';
import { sessionStorageSpecDrivenPushIntent } from '../../../shared/constants/constant';
import type { BesserProject } from '../../../shared/types/project';
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks';
import {
  closePushDialog,
  openPushDialog,
} from '../../spec-driven/state/specDrivenSlice';
import { useGitHubAuth } from './useGitHubAuth';

/** Deploy-link target token for the smart-gen push (never collides with Render). */
const GITHUB_TARGET = 'github';
const DEFAULT_BRANCH = 'main';

export interface SpecDrivenPushConfig {
  /** True to push into an already-existing repo, false to create a new one. */
  useExisting: boolean;
  repoName: string;
  description?: string;
  isPrivate: boolean;
  branch?: string;
  commitMessage?: string;
}

export interface SpecDrivenPushResult {
  success: boolean;
  repo_url: string;
  owner: string;
  repo_name: string;
  is_first_push: boolean;
  files_uploaded: number;
}

/** Friendly discriminated outcome so the dialog can react per error class. */
export type SpecDrivenPushErrorCode = 'expired' | 'auth' | 'conflict' | 'other';
export type SpecDrivenPushOutcome =
  | { ok: true; result: SpecDrivenPushResult }
  | { ok: false; code: SpecDrivenPushErrorCode; message: string };

interface PushResponse {
  success: boolean;
  repo_url: string;
  owner: string;
  repo_name: string;
  is_first_push: boolean;
  files_uploaded: number;
}

export interface UseSpecDrivenGithubPushOptions {
  currentProject: BesserProject | null | undefined;
}

export interface SpecDrivenPushDialogState {
  open: boolean;
  runId: string | null;
  projectName: string;
  linkedRepo: DeployLinkedRepo | null;
  githubSession: string | null;
  isPushing: boolean;
  result: SpecDrivenPushResult | null;
  onOpenChange: (open: boolean) => void;
  onChangeRepo: () => void;
  push: (config: SpecDrivenPushConfig) => Promise<SpecDrivenPushOutcome>;
}

export interface UseSpecDrivenGithubPushReturn {
  dialog: SpecDrivenPushDialogState;
}

export function useSpecDrivenGithubPush(
  { currentProject }: UseSpecDrivenGithubPushOptions,
): UseSpecDrivenGithubPushReturn {
  const { isAuthenticated, githubSession, login } = useGitHubAuth();
  const dispatch = useAppDispatch();

  // The open/target-run state is OWNED BY REDUX so the card's button (in the
  // drawer/widget) can drive this single app-level dialog by dispatching
  // ``openPushDialog(runId)`` — no drawer-coupled local state.
  const pushDialogRunId = useAppSelector((s) => s.specDriven.pushDialogRunId);

  // Read the live project from a ref so async handlers never close over a
  // stale project without forcing every callback to re-create on each edit.
  const projectRef = useRef(currentProject);
  projectRef.current = currentProject;

  const [linkedRepo, setLinkedRepo] = useState<DeployLinkedRepo | null>(null);
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
    setLinkedRepo(LocalStorageRepository.getDeployLinkedRepo(project.id, GITHUB_TARGET));
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

  const onChangeRepo = useCallback(() => {
    const project = projectRef.current;
    if (project) {
      LocalStorageRepository.clearDeployLinkedRepo(project.id, GITHUB_TARGET);
    }
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
            },
          },
          {
            headers: { 'X-GitHub-Session': githubSession },
            // A push runs code generation + multiple GitHub API calls; mirror the
            // deploy path's 2-min budget so a slow-but-successful push isn't aborted.
            timeout: 120_000,
          },
        );

        const res: SpecDrivenPushResult = {
          success: response.success,
          repo_url: response.repo_url,
          owner: response.owner,
          repo_name: response.repo_name,
          is_first_push: response.is_first_push,
          files_uploaded: response.files_uploaded,
        };

        if (!res.success) {
          toast.error('Push to GitHub failed.');
          return { ok: false, code: 'other', message: 'Push to GitHub failed.' };
        }

        const branch = config.branch || linkedRepo?.branch || DEFAULT_BRANCH;
        LocalStorageRepository.setDeployLinkedRepo(project.id, GITHUB_TARGET, {
          owner: res.owner,
          repo: res.repo_name,
          branch,
        });
        setLinkedRepo({ owner: res.owner, repo: res.repo_name, branch });
        setResult(res);
        toast.success(
          res.is_first_push
            ? `Pushed to ${res.owner}/${res.repo_name}`
            : `Updated ${res.owner}/${res.repo_name}`,
        );
        return { ok: true, result: res };
      } catch (error) {
        if (error instanceof ApiError) {
          if (error.status === 401) {
            toast.error('GitHub session expired — please reconnect.');
            return { ok: false, code: 'auth', message: 'Your GitHub session expired. Reconnect and try again.' };
          }
          if (error.status === 404) {
            toast.error('This generation expired — re-generate to push.');
            return { ok: false, code: 'expired', message: 'This generation expired — re-generate to push.' };
          }
          if (error.status === 409) {
            toast.error('A repository with that name already exists.');
            return { ok: false, code: 'conflict', message: 'A repository with that name already exists — push to it as an existing repo.' };
          }
          toast.error(error.message || 'Push to GitHub failed.');
          return { ok: false, code: 'other', message: error.message || 'Push to GitHub failed.' };
        }
        const message = error instanceof Error ? error.message : 'Push to GitHub failed.';
        toast.error(message);
        return { ok: false, code: 'other', message };
      } finally {
        setIsPushing(false);
      }
    },
    [runId, githubSession, linkedRepo],
  );

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
    },
  };
}
