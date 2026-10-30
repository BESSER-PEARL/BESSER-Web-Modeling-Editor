/**
 * Start the agentic workspace from a GitHub repository, BESSER-made or not.
 *
 * A BESSER repo opens with its model. Any other repo opens with a model BESSER
 * read from its code (proposed on the canvas for the user to accept), or with
 * an empty model when there is none to read; either way the Spec-Driven Agent
 * then works on top of the repo's code.
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Github, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useAppDispatch } from '../../../app/store/hooks';
import { useProject } from '../../../app/hooks/useProject';
import { sessionStorageContinueFromGithubIntent } from '../../../shared/constants/constant';
import { useGitHubAuth } from '../../../shared/hooks/useGitHubAuth';
import { RepoBrowser, type RepoChoice } from '../../../shared/components/github/RepoBrowser';
import { continueFromGithubRepo, describeOpenedRepo } from '../../../shared/services/github/continueFromGithub';
import { setLastRunForProject } from '../../spec-driven/state/specDrivenSlice';

const GITHUB_URL_RE = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/tree\/([\w./-]+))?\/?$/i;

/** `owner/repo[@branch]` from a GitHub URL or an `owner/repo` shorthand. */
export function parseRepoReference(text: string): { owner: string; repo: string; branch?: string } | null {
  const value = text.trim();
  const url = GITHUB_URL_RE.exec(value);
  if (url) return { owner: url[1], repo: url[2], ...(url[3] ? { branch: url[3] } : {}) };
  const short = /^([\w.-]+)\/([\w.-]+)$/.exec(value);
  return short ? { owner: short[1], repo: short[2] } : null;
}

interface StartFromRepoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with a summary of the opened repository, for the assistant chat. */
  onRepoOpened?: (summary: string) => void;
}

export const StartFromRepoDialog: React.FC<StartFromRepoDialogProps> = ({ open, onOpenChange, onRepoOpened }) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { loadProject } = useProject();
  const { isAuthenticated, isChecking, githubSession, login } = useGitHubAuth();
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openRepo = async (owner: string, repo: string, branch?: string) => {
    if (!githubSession) return;
    setBusy(true);
    setError(null);
    try {
      const result = await continueFromGithubRepo({ owner, repo, branch, githubSession });
      if (!result.ok || !result.projectId) {
        setError(result.error ?? t('github.startFromRepo.failed', { defaultValue: 'Could not open this repository.' }));
        return;
      }
      await loadProject(result.projectId);
      if (result.runId) {
        dispatch(setLastRunForProject({ projectId: result.projectId, runId: result.runId, at: Date.now() }));
      }
      onRepoOpened?.(describeOpenedRepo(result));
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  const openLink = () => {
    const ref = parseRepoReference(link);
    if (!ref) {
      setError(t('github.startFromRepo.badLink', { defaultValue: 'Paste a link like github.com/owner/repo.' }));
      return;
    }
    void openRepo(ref.owner, ref.repo, ref.branch);
  };

  const connect = () => {
    try {
      // The Project Hub reopens on its GitHub step once the OAuth redirect returns.
      sessionStorage.setItem(sessionStorageContinueFromGithubIntent, '1');
    } catch {
      /* sessionStorage may be unavailable — login still proceeds. */
    }
    login();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Github className="size-5" />
            {t('github.startFromRepo.title', { defaultValue: 'Start from a GitHub repository' })}
          </DialogTitle>
          <DialogDescription>
            {t('github.startFromRepo.description', {
              defaultValue:
                'Pick a repository to keep building on. A BESSER repository opens with its model; for any other, BESSER reads the code and proposes a model you accept on the canvas. If BESSER cannot read its data classes directly, it sends a short excerpt of the code, with secret files and keys removed, to an AI model to propose one.',
            })}
          </DialogDescription>
        </DialogHeader>

        {isChecking ? (
          <div role="status" className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            {t('github.connect.checking', { defaultValue: 'Checking your GitHub connection…' })}
          </div>
        ) : !isAuthenticated || !githubSession ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              {t('github.startFromRepo.connect', {
                defaultValue: 'Connect GitHub to open one of your repositories.',
              })}
            </p>
            <Button onClick={connect} className="gap-2">
              <Github className="size-4" />
              {t('github.connect.button')}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                openLink();
              }}
            >
              <Input
                value={link}
                onChange={(event) => {
                  setLink(event.target.value);
                  setError(null);
                }}
                placeholder={t('github.startFromRepo.linkPlaceholder', { defaultValue: 'Paste a link: github.com/owner/repo' })}
                aria-label={t('github.startFromRepo.linkLabel', { defaultValue: 'Repository link' })}
                disabled={busy}
              />
              <Button type="submit" disabled={busy || !link.trim()} className="shrink-0 gap-1.5">
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                {t('github.startFromRepo.open', { defaultValue: 'Open' })}
              </Button>
            </form>
            <RepoBrowser
              githubSession={githubSession}
              actionLabel={t('github.startFromRepo.open', { defaultValue: 'Open' })}
              onAction={({ owner, repo, branch }: RepoChoice) => openRepo(owner, repo, branch)}
              busy={busy}
              error={error}
              allowWithoutModel
              noModelHint={t('github.repoBrowser.readsCode', {
                defaultValue: 'No BESSER model yet. BESSER reads its code and proposes one for you to accept.',
              })}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
