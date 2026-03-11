import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { GitHubCommit } from '../../../services/github/useGitHubStorage';

interface RestoreVersionDialogProps {
  open: boolean;
  isSaving: boolean;
  selectedCommit: GitHubCommit | null;
  formatDate: (value: string) => string;
  onOpenChange: (open: boolean) => void;
  onRestore: () => void;
}

export const RestoreVersionDialog: React.FC<RestoreVersionDialogProps> = ({
  open,
  isSaving,
  selectedCommit,
  formatDate,
  onOpenChange,
  onRestore,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Restore Version</DialogTitle>
          <DialogDescription>
            Your current unsaved changes will be lost. Consider pushing your current work first.
          </DialogDescription>
        </DialogHeader>

        {selectedCommit && (
          <div className="rounded-md border border-border/70 bg-muted/30 px-3 py-2">
            <p className="text-sm font-semibold">{selectedCommit.message}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {selectedCommit.author} - {formatDate(selectedCommit.date)}
            </p>
          </div>
        )}

        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4" />
          Restore this commit?
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onRestore} disabled={isSaving} className="gap-2">
            {isSaving ? 'Restoring...' : null}
            Restore This Version
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
