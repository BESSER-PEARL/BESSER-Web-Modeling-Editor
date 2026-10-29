import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Loader2, RefreshCw, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { RepoSync } from '../hooks/useRepoSync';
import { getModelHistory, type ModelHistoryEntry } from '../../../shared/api/github';
import { CommitAuthor } from '../../../shared/components/github/CommitAuthor';
import { RestoreVersionDialog } from './RestoreVersionDialog';

interface ModelHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sync: RepoSync;
}

// Entries show their first change lines; the rest is one "and N more".
const HISTORY_CHANGE_LINES = 4;

/** The linked repository's model history, by who changed what, with a restore per version. */
export const ModelHistoryDialog: React.FC<ModelHistoryDialogProps> = ({ open, onOpenChange, sync }) => {
  const { t } = useTranslation();
  const { link, githubSession, status } = sync;
  const [history, setHistory] = useState<ModelHistoryEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<ModelHistoryEntry | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const load = useCallback(async () => {
    if (!link || !githubSession) return;
    setHistory(null);
    setFailed(false);
    try {
      setHistory(await getModelHistory(githubSession, link.owner, link.repo, link.branch));
    } catch {
      setFailed(true);
      setHistory([]);
    }
  }, [link, githubSession]);

  useEffect(() => {
    if (open) void load();
    // Reload when the branch head moves (a save, a pull, someone else's push).
  }, [open, link?.owner, link?.repo, link?.branch, status?.head_sha, githubSession]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRestore = async () => {
    if (!restoreTarget) return;
    setIsRestoring(true);
    try {
      await sync.restore(restoreTarget.sha);
      setRestoreTarget(null);
      onOpenChange(false);
      toast.success(t('github.toasts.projectRestored'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <div className="flex items-center gap-2 pr-8">
              <DialogTitle>{t('github.panel.historyTitle', { defaultValue: 'Model history' })}</DialogTitle>
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto size-8"
                onClick={() => void load()}
                disabled={history === null}
                aria-label={t('github.linked.refreshHistory')}
              >
                {history === null ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              </Button>
            </div>
            {link && (
              <DialogDescription>
                {link.owner}/{link.repo} · {link.branch}
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto overscroll-contain rounded-lg border border-border/70">
            {history === null ? (
              <div role="status" className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                <span className="sr-only">{t('common.loading')}</span>
              </div>
            ) : failed ? (
              <p className="px-4 py-8 text-center text-sm text-destructive">
                {t('github.panel.historyFailed', { defaultValue: 'Could not load the history.' })}
              </p>
            ) : history.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">{t('github.linked.noCommits')}</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {history.map((entry, index) => (
                  <li key={entry.sha} className="flex flex-col gap-1.5 px-4 py-3">
                    <div className="flex items-start gap-3">
                      <p className="line-clamp-2 flex-1 text-sm font-medium">
                        {index === 0 && (
                          <Badge variant="soft" size="sm" className="mr-2">
                            {t('github.linked.latest')}
                          </Badge>
                        )}
                        {entry.message.split('\n')[0]}
                      </p>
                      {index > 0 && (
                        <Button size="xs" variant="outline" className="shrink-0" onClick={() => setRestoreTarget(entry)}>
                          <RotateCcw aria-hidden="true" />
                          {t('github.menu.restore', { defaultValue: 'Restore' })}
                        </Button>
                      )}
                    </div>
                    <CommitAuthor commit={entry} />
                    {entry.changes.length > 0 && (
                      <ul className="flex flex-col gap-0.5 text-[11px] text-muted-foreground">
                        {entry.changes.slice(0, HISTORY_CHANGE_LINES).map((change) => (
                          <li key={change} className="truncate font-mono" title={change}>
                            {change}
                          </li>
                        ))}
                        {entry.changes.length > HISTORY_CHANGE_LINES && (
                          <li>
                            {t('github.panel.moreChanges', {
                              defaultValue: 'and {{count}} more',
                              count: entry.changes.length - HISTORY_CHANGE_LINES,
                            })}
                          </li>
                        )}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <RestoreVersionDialog
        open={restoreTarget !== null}
        isSaving={isRestoring}
        selectedCommit={restoreTarget}
        onOpenChange={(next) => !next && setRestoreTarget(null)}
        onRestore={() => void handleRestore()}
      />
    </>
  );
};
