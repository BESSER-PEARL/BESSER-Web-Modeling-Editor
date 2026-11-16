import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { reportError } from '../../../shared/services/errors/reportError';
import { CloudDownload, Link2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useProject } from '../../../app/hooks/useProject';
import type { RepoSync } from '../hooks/useRepoSync';
import { RepoBrowser, type RepoChoice } from '../../../shared/components/github/RepoBrowser';
import { legacyModelPath } from '../../../shared/services/storage/projectGitHubLink';
import { trackGitHubAction, type GitHubActionDetails } from '../githubAnalytics';

interface LinkRepositoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sync: RepoSync;
}

/**
 * Pick one of the user's repositories and link the current project to it. A
 * repository that already holds a model asks which model to keep; only its two
 * explicit choices link, and closing or Cancel links nothing.
 */
export const LinkRepositoryDialog: React.FC<LinkRepositoryDialogProps> = ({ open, onOpenChange, sync }) => {
  const { t } = useTranslation();
  const { currentProject } = useProject();
  const [isLinking, setIsLinking] = useState(false);
  // A repository with a model, waiting for the user to choose which model to keep.
  const [choice, setChoice] = useState<RepoChoice | null>(null);
  // The repository's model file; the user picks it when the repository holds several.
  const [modelPath, setModelPath] = useState<string | null>(null);
  const modelPaths = choice?.summary.model_paths ?? [];

  useEffect(() => {
    if (!open) setChoice(null);
  }, [open]);

  useEffect(() => {
    setModelPath(choice?.summary.model_path ?? null);
  }, [choice]);

  const run = async (action: () => Promise<void> | void, details: GitHubActionDetails) => {
    setIsLinking(true);
    try {
      await trackGitHubAction('link', action, () => details);
    } catch (error) {
      reportError(error instanceof Error ? error.message : String(error), { error });
    } finally {
      setIsLinking(false);
    }
  };

  // Keep the local model; the next save commits it on top of the repo's head.
  const keepModelAndLink = ({ owner, repo, branch, summary }: RepoChoice, path = summary.model_path) =>
    run(() => {
      sync.linkTo(owner, repo, branch, summary.head_sha || undefined, path);
      onOpenChange(false);
      toast.success(t('github.panel.linked', { defaultValue: 'Linked to {{repo}}. Save to put your model in it.', repo: `${owner}/${repo}` }));
    }, { has_model: summary.has_model, kind: 'kept_model' });

  const loadRepoModel = ({ owner, repo, branch }: RepoChoice, path: string | null) =>
    run(async () => {
      if (!currentProject) return;
      const legacyFilePath = legacyModelPath(path);
      await sync.pullInto({ owner, repo, branch, ...(legacyFilePath ? { legacyFilePath } : {}) }, currentProject.id);
      onOpenChange(false);
      toast.success(t('github.toasts.projectLoadedFromRepo'));
    }, { has_model: true, kind: 'loaded_model' });

  const handlePick = (picked: RepoChoice) => {
    if (!currentProject) return;
    if (picked.summary.has_model) setChoice(picked);
    else void keepModelAndLink(picked);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {choice
              ? t('github.panel.repoHasModelTitle', { defaultValue: 'This repository already holds a model' })
              : t('github.menu.linkTitle', { defaultValue: 'Link a repository' })}
          </DialogTitle>
          <DialogDescription>
            {choice
              ? t('github.panel.repoHasModelChoice', {
                  defaultValue:
                    '{{repo}} holds "{{name}}". Load it into this project, replacing the model you have open, or keep your model and link: your next save then replaces the repository\'s model.',
                  repo: `${choice.owner}/${choice.repo}`,
                  name: choice.summary.project_name || choice.repo,
                })
              : t('github.panel.notLinkedHint', {
                  defaultValue: 'A linked repository keeps your model, its history and your app code in one place, for you and your team.',
                })}
          </DialogDescription>
        </DialogHeader>
        {choice && modelPaths.length > 1 && (
          <div className="flex flex-col gap-2">
            <p id="link-model-file-label" className="text-sm font-medium">
              {t('github.panel.pickModelFile', {
                defaultValue: 'This repository holds {{number}} models. Pick the one to use:',
                number: modelPaths.length,
              })}
            </p>
            <RadioGroup
              aria-labelledby="link-model-file-label"
              value={modelPath ?? undefined}
              onValueChange={setModelPath}
              className="flex w-full flex-col divide-y divide-border/60"
            >
              {modelPaths.map((path) => (
                <RadioGroupItem key={path} value={path} className="w-full py-2 text-left font-mono text-xs">
                  {path}
                </RadioGroupItem>
              ))}
            </RadioGroup>
          </div>
        )}
        {choice ? (
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
            <Button variant="ghost" onClick={() => setChoice(null)} disabled={isLinking}>
              {t('common.cancel')}
            </Button>
            <Button variant="outline" className="gap-1.5" onClick={() => void keepModelAndLink(choice, modelPath)} disabled={isLinking}>
              <Link2 className="size-4" aria-hidden="true" />
              {t('github.panel.keepModelAndLink', { defaultValue: 'Keep my model and link' })}
            </Button>
            <Button className="gap-1.5" onClick={() => void loadRepoModel(choice, modelPath)} disabled={isLinking}>
              {isLinking ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <CloudDownload className="size-4" aria-hidden="true" />}
              {t('github.panel.loadRepoModel', { defaultValue: 'Load the repository model' })}
            </Button>
          </div>
        ) : (
          open && sync.githubSession && (
            <RepoBrowser
              githubSession={sync.githubSession}
              actionLabel={t('github.panel.linkAction', { defaultValue: 'Link to this project' })}
              onAction={handlePick}
              busy={isLinking}
              allowWithoutModel
              requiresWrite
            />
          )
        )}
      </DialogContent>
    </Dialog>
  );
};
