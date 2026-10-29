/**
 * Go live: put the app that is in the project's GitHub repo online on Render.
 *
 * What goes live is exactly the code in the repo, so the app the Spec-Driven
 * Agent built is the app people use. BESSER commits Render's deploy file into
 * the repo once; after the user connects the repo on Render, every code save
 * updates the live app, and saves that only change the model do not.
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, ExternalLink, Globe, Loader2, Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ApiError } from '../../../shared/api/api-client';
import { setProjectGitHubLink, type ProjectGitHubLink } from '../../../shared/services/storage/projectGitHubLink';
import { goLive, type GoLiveResult } from '../../../shared/api/github';

interface GoLiveDialogProps {
  open: boolean;
  projectId: string;
  link: ProjectGitHubLink;
  githubSession: string;
  onOpenChange: (open: boolean) => void;
  /** Fall back to the classic deploy, which rebuilds the app from the diagrams. */
  onUseClassicDeploy: () => void;
}

type Stage =
  | { kind: 'intro' }
  | { kind: 'working' }
  | { kind: 'ready'; result: GoLiveResult }
  | { kind: 'refused'; reason: string }
  | { kind: 'error'; message: string };

export const GoLiveDialog: React.FC<GoLiveDialogProps> = ({
  open,
  projectId,
  link,
  githubSession,
  onOpenChange,
  onUseClassicDeploy,
}) => {
  const { t } = useTranslation();
  const [stage, setStage] = useState<Stage>({ kind: 'intro' });
  const repo = `${link.owner}/${link.repo}`;

  useEffect(() => {
    if (open) setStage({ kind: 'intro' });
  }, [open]);

  const prepare = async () => {
    setStage({ kind: 'working' });
    try {
      const result = await goLive(githubSession, link.owner, link.repo, link.branch);
      setProjectGitHubLink(projectId, { ...link, liveUrl: result.frontend_url ?? result.backend_url });
      setStage({ kind: 'ready', result });
    } catch (error) {
      if (error instanceof ApiError && (error.status === 422 || error.status === 409)) {
        setStage({ kind: 'refused', reason: error.message });
      } else {
        setStage({ kind: 'error', message: error instanceof Error ? error.message : String(error) });
      }
    }
  };

  const freeTierNote = t('github.goLive.freeTier', {
    defaultValue:
      "Render's free plan puts the app to sleep when nobody uses it (the first visit then takes about a minute), and its database resets on each redeploy.",
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="size-5" />
            {t('github.goLive.title', { defaultValue: 'Go live' })}
          </DialogTitle>
          <DialogDescription>
            {t('github.goLive.description', {
              defaultValue: 'Put the app in {{repo}} online. What goes live is exactly the code in the repository.',
              repo,
            })}
          </DialogDescription>
        </DialogHeader>

        {stage.kind === 'intro' || stage.kind === 'working' ? (
          <div className="flex flex-col gap-3 text-sm">
            <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-muted-foreground">
              <li>
                {t('github.goLive.step1', {
                  defaultValue: "BESSER adds Render's deploy file to {{repo}}, written for the app's folders.",
                  repo,
                })}
              </li>
              <li>{t('github.goLive.step2', { defaultValue: 'You open Render, sign in and click Apply, once.' })}</li>
              <li>
                {t('github.goLive.step3', {
                  defaultValue: 'From then on, every code save to GitHub updates the live app. Saving only the model does not.',
                })}
              </li>
            </ol>
            <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">{freeTierNote}</p>
          </div>
        ) : stage.kind === 'ready' ? (
          <div className="flex flex-col gap-3 text-sm">
            <div className="flex items-start gap-2 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-success">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              <span>
                {stage.result.changed
                  ? t('github.goLive.ready', { defaultValue: '{{repo}} is ready for Render.', repo })
                  : t('github.goLive.alreadyReady', { defaultValue: '{{repo}} was already ready for Render.', repo })}
              </span>
            </div>
            <p>
              {t('github.goLive.next', {
                defaultValue:
                  'Open Render, sign in with GitHub and click Apply. If the repository is private, Render asks for access to it first.',
              })}
            </p>
            <div className="flex flex-col gap-1 rounded-md border border-border/70 px-3 py-2 text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Globe className="size-3.5" />
                {t('github.goLive.addresses', { defaultValue: 'Your app will be at' })}
              </span>
              {stage.result.frontend_url && <code className="break-all">{stage.result.frontend_url}</code>}
              <code className="break-all text-muted-foreground">{stage.result.backend_url}</code>
            </div>
            {stage.result.warnings.map((warning) => (
              <p key={warning} className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                {warning}
              </p>
            ))}
          </div>
        ) : stage.kind === 'refused' ? (
          <div className="flex flex-col gap-3 text-sm">
            <p role="alert" className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-warning">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {stage.reason}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('github.goLive.classicHint', {
                defaultValue:
                  'The classic deploy still works: it rebuilds the app from your diagrams into a separate repository, without the changes the agent made.',
              })}
            </p>
          </div>
        ) : (
          <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {stage.message}
          </p>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {stage.kind === 'ready' ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t('github.push.done')}
              </Button>
              <Button asChild className="gap-1.5">
                <a href={stage.result.render_deploy_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-4" />
                  {t('github.goLive.openRender', { defaultValue: 'Open Render' })}
                </a>
              </Button>
            </>
          ) : stage.kind === 'refused' ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={onUseClassicDeploy}>
                {t('github.goLive.useClassic', { defaultValue: 'Use the classic deploy' })}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={stage.kind === 'working'}>
                {t('common.cancel')}
              </Button>
              <Button onClick={() => void prepare()} disabled={stage.kind === 'working'} className="gap-1.5">
                {stage.kind === 'working' ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
                {stage.kind === 'error'
                  ? t('common.retry')
                  : t('github.goLive.prepare', { defaultValue: 'Prepare {{repo}}', repo })}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
