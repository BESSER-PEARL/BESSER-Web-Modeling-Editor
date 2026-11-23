/**
 * "Save to GitHub" asked for outside the GitHub menu: "save to github" in the
 * assistant (`trigger_github_save`), and the code the Generate menu just made,
 * which otherwise only downloads (live 2026-11-20: a user generated a web app,
 * then looked through the GitHub settings and help for a way to push it).
 */
import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { Github, Loader2 } from 'lucide-react';
import i18n from '../../shared/i18n';
import { useAppDispatch } from '../../app/store/hooks';
import type { AppDispatch } from '../../app/store/store';
import { OPEN_GITHUB_PANEL_EVENT, OPEN_GITHUB_SAVE_EVENT } from '../../shared/api/github';
import { getGitHubAuthState, getGitHubSession } from '../../shared/services/github/githubAuth';
import { storeGeneratedCodeForPush } from '../../shared/services/github/saveGeneratedCode';
import { peekServerSpecDrivenConfig } from '../../shared/services/specDrivenConfig';
import { getProjectGitHubLink } from '../../shared/services/storage/projectGitHubLink';
import { readProjectLastRun } from '../../shared/services/storage/specDrivenRunRecords';
import { openPushDialog } from '../spec-driven';

/** The project's last Spec-Driven run while the server still holds its code (unknown lifetime: assume it does). */
function pushableLastRun(projectId: string): string | null {
  const lastRun = readProjectLastRun(projectId);
  if (!lastRun) return null;
  const ttlSeconds = peekServerSpecDrivenConfig()?.download_ttl_seconds;
  return ttlSeconds === undefined || lastRun.at + ttlSeconds * 1000 > Date.now() ? lastRun.runId : null;
}

/** The assistant's "save to github": the push dialog of the last generated app, else the model's Save to GitHub. */
export function openSaveToGitHub(dispatch: AppDispatch, projectId: string | null): void {
  const runId = projectId ? pushableLastRun(projectId) : null;
  if (runId) {
    dispatch(openPushDialog(runId));
    return;
  }
  // The menu's save dialog needs a session and a linked repo; the menu itself offers sign-in and linking.
  const canSave = getGitHubAuthState().status === 'signed-in' && !!projectId && !!getProjectGitHubLink(projectId);
  window.dispatchEvent(new CustomEvent(canSave ? OPEN_GITHUB_SAVE_EVENT : OPEN_GITHUB_PANEL_EVENT));
}

const SaveGeneratedCodeToast: React.FC<{ file: Blob; fileName: string; closeToast?: () => void }> = ({
  file, fileName, closeToast,
}) => {
  const dispatch = useAppDispatch();
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const runId = await storeGeneratedCodeForPush(file, fileName);
    setBusy(false);
    if (!runId) return;
    dispatch(openPushDialog(runId));
    closeToast?.();
  };
  return (
    <div className="flex items-center justify-between gap-3">
      <span>{i18n.t('github.generatedCode.offer', { defaultValue: 'Keep this code on GitHub too?' })}</span>
      <button
        type="button"
        onClick={() => void save()}
        disabled={busy}
        className="inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-sm font-medium text-brand-dark underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 dark:text-brand-light"
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Github className="size-3.5" aria-hidden="true" />}
        {i18n.t('github.generatedCode.save', { defaultValue: 'Save to GitHub' })}
      </button>
    </div>
  );
};

const GENERATED_CODE_OFFER = 'github-generated-code-offer';
let offers = 0;

/**
 * After the Generate menu downloaded `file`: offer to save it to GitHub when this tab is signed in. One offer at a
 * time: a new download replaces the shown one, so only the newest file is held, and none once it is dismissed.
 */
export function offerGeneratedCodeOnGitHub(file: Blob, fileName: string): void {
  if (!getGitHubSession()) return;
  offers += 1;
  const content = <SaveGeneratedCodeToast key={offers} file={file} fileName={fileName} />;
  if (toast.isActive(GENERATED_CODE_OFFER)) {
    toast.update(GENERATED_CODE_OFFER, { render: content, autoClose: 15_000 });
  } else {
    toast.info(content, { toastId: GENERATED_CODE_OFFER, autoClose: 15_000 });
  }
}
