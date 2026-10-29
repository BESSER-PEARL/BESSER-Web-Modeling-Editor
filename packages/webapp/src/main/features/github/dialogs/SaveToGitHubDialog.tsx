import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { CloudUpload, GitPullRequest, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { RepoSync } from '../hooks/useRepoSync';
import type { SaveModelResult } from '../../../shared/api/github';

interface SaveToGitHubDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sync: RepoSync;
  /** Writes the open diagram into the stored project before the save reads it. */
  flushEditor: () => void;
}

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Commit the model to the linked repository; newer commits on GitHub are merged, never reverted. */
export const SaveToGitHubDialog: React.FC<SaveToGitHubDialogProps> = ({ open, onOpenChange, sync, flushEditor }) => {
  const { t } = useTranslation();
  const { link, hasLocalChanges } = sync;
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [conflict, setConflict] = useState<SaveModelResult | null>(null);
  const [pullRequestUrl, setPullRequestUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setConflict(null);
    setPullRequestUrl(null);
  }, [open]);

  const defaultMessage = t('github.menu.defaultCommitMessage', { defaultValue: 'Update the model from the BESSER editor' });
  const commitMessage = message.trim() || defaultMessage;

  const handleSave = async () => {
    flushEditor();
    setIsSaving(true);
    setConflict(null);
    setPullRequestUrl(null);
    try {
      const result = await sync.save(commitMessage);
      if (result.status === 'conflict') {
        setConflict(result);
        toast.warn(t('github.panel.conflictToast', { defaultValue: 'GitHub could not merge your save automatically.' }));
        return;
      }
      setMessage('');
      onOpenChange(false);
      toast.success(
        result.status === 'merged'
          ? t('github.panel.savedMerged', { defaultValue: 'Saved, and merged with the newer changes on GitHub.' })
          : t('github.panel.saved', { defaultValue: 'Model saved to GitHub.' }),
      );
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenPullRequest = async () => {
    try {
      const url = await sync.openPullRequest(
        message.trim() || t('github.panel.prTitle', { defaultValue: 'Model changes from the BESSER editor' }),
      );
      setPullRequestUrl(url);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('github.panel.saveAction', { defaultValue: 'Save to GitHub' })}</DialogTitle>
          <DialogDescription>
            {link
              ? t('github.menu.saveDescription', {
                  defaultValue: 'Commits your model to {{repo}} on {{branch}}. Newer changes on GitHub are merged, never overwritten.',
                  repo: `${link.owner}/${link.repo}`,
                  branch: link.branch,
                })
              : null}
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!isSaving) void handleSave();
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="github-save-message">
              {t('github.menu.commitMessageOptional', { defaultValue: 'What changed? (optional)' })}
            </Label>
            <Textarea
              id="github-save-message"
              rows={2}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={defaultMessage}
            />
            {!hasLocalChanges && (
              <p className="text-xs text-muted-foreground">
                {t('github.panel.nothingToSave', { defaultValue: 'Your model matches the repository.' })}
              </p>
            )}
          </div>

          {conflict && (
            <div role="alert" className="flex flex-col gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-xs">
              <p>
                {t('github.panel.conflict', {
                  defaultValue:
                    'Your save and a newer change on GitHub touch the same part of the model, so GitHub could not merge them. Your save is on the branch {{branch}}; nothing was overwritten.',
                  branch: conflict.conflict_branch,
                })}
              </p>
              {pullRequestUrl ? (
                <a href={pullRequestUrl} target="_blank" rel="noopener noreferrer" className="font-medium underline">
                  {t('github.panel.prOpened', { defaultValue: 'Pull request opened' })}
                </a>
              ) : (
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  className="self-start"
                  onClick={() => void handleOpenPullRequest()}
                >
                  <GitPullRequest aria-hidden="true" />
                  {t('github.panel.openPr', { defaultValue: 'Open a pull request to merge it' })}
                </Button>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isSaving} className="gap-2">
              {isSaving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <CloudUpload className="size-4" aria-hidden="true" />}
              {t('github.menu.save', { defaultValue: 'Save' })}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
