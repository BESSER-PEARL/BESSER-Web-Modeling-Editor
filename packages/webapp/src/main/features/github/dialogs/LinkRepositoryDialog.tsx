import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useProject } from '../../../app/hooks/useProject';
import { globalConfirm } from '../../../shared/services/confirm/globalConfirm';
import type { RepoSync } from '../hooks/useRepoSync';
import { RepoBrowser, type RepoChoice } from '../components/RepoBrowser';

interface LinkRepositoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sync: RepoSync;
}

/** Pick one of the user's repositories and link the current project to it. */
export const LinkRepositoryDialog: React.FC<LinkRepositoryDialogProps> = ({ open, onOpenChange, sync }) => {
  const { t } = useTranslation();
  const { currentProject } = useProject();
  const [isLinking, setIsLinking] = useState(false);

  const handleLink = async ({ owner, repo, branch, summary }: RepoChoice) => {
    if (!currentProject) return;
    setIsLinking(true);
    try {
      if (summary.has_model) {
        const loadRepoModel = await globalConfirm({
          title: t('github.panel.repoHasModelTitle', { defaultValue: 'This repository already holds a model' }),
          description: t('github.panel.repoHasModelDescription', {
            defaultValue:
              '{{repo}} holds "{{name}}". Load it into this project, replacing the model you have open? Choose Cancel to keep your model; it replaces the repository\'s on your next save.',
            repo: `${owner}/${repo}`,
            name: summary.project_name || repo,
          }),
          confirmLabel: t('github.panel.loadRepoModel', { defaultValue: 'Load the repository model' }),
        });
        if (loadRepoModel) {
          await sync.pullInto({ owner, repo, branch }, currentProject.id);
          onOpenChange(false);
          toast.success(t('github.toasts.projectLoadedFromRepo'));
          return;
        }
      }
      // Keep the local model; the next save commits it on top of the repo's head.
      sync.linkTo(owner, repo, branch, summary.head_sha || undefined);
      onOpenChange(false);
      toast.success(t('github.panel.linked', { defaultValue: 'Linked to {{repo}}. Save to put your model in it.', repo: `${owner}/${repo}` }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLinking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('github.menu.linkTitle', { defaultValue: 'Link a repository' })}</DialogTitle>
          <DialogDescription>
            {t('github.panel.notLinkedHint', {
              defaultValue: 'A linked repository keeps your model, its history and your app code in one place, for you and your team.',
            })}
          </DialogDescription>
        </DialogHeader>
        {open && sync.githubSession && (
          <RepoBrowser
            githubSession={sync.githubSession}
            actionLabel={t('github.panel.linkAction', { defaultValue: 'Link to this project' })}
            onAction={handleLink}
            busy={isLinking}
            allowWithoutModel
            requiresWrite
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
