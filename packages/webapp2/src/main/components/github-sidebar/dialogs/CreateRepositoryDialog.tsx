import React, { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/components/ui/form-field';
import { validateRepoName, validateFileName } from '../../../utils/validation';
import { useFieldValidation } from '../../../hooks/useFieldValidation';

interface CreateRepositoryDialogProps {
  open: boolean;
  isLoading: boolean;
  repoName: string;
  repoDescription: string;
  isRepoPrivate: boolean;
  fileName: string;
  folderPath: string;
  onOpenChange: (open: boolean) => void;
  onRepoNameChange: (value: string) => void;
  onRepoDescriptionChange: (value: string) => void;
  onRepoPrivateChange: (value: boolean) => void;
  onFileNameChange: (value: string) => void;
  onFolderPathChange: (value: string) => void;
  onCreate: () => void;
}

export const CreateRepositoryDialog: React.FC<CreateRepositoryDialogProps> = ({
  open,
  isLoading,
  repoName,
  repoDescription,
  isRepoPrivate,
  fileName,
  folderPath,
  onOpenChange,
  onRepoNameChange,
  onRepoDescriptionChange,
  onRepoPrivateChange,
  onFileNameChange,
  onFolderPathChange,
  onCreate,
}) => {
  // ── Inline validation ──────────────────────────────────────────────────
  const validators = useMemo(() => ({
    repoName: () => validateRepoName(repoName),
    fileName: () => validateFileName(fileName),
  }), [repoName, fileName]);
  const validation = useFieldValidation(validators);

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      validation.resetTouched();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Create Repository</DialogTitle>
          <DialogDescription>Create a new GitHub repository and push the current project.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <FormField
            label="Repository Name"
            required
            error={validation.getError('repoName')}
            helperText="Only lowercase letters, numbers, dashes, and underscores are allowed."
          >
            <Input
              placeholder="my-project"
              value={repoName}
              onChange={(event) => onRepoNameChange(event.target.value)}
              onBlur={() => validation.markTouched('repoName')}
              className={validation.getError('repoName') ? 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20' : ''}
            />
          </FormField>

          <FormField label="Description">
            <Textarea
              rows={2}
              placeholder="Optional description..."
              value={repoDescription}
              onChange={(event) => onRepoDescriptionChange(event.target.value)}
            />
          </FormField>

          <FormField label="Folder Path (optional)">
            <Input
              placeholder="e.g., projects/my-models"
              value={folderPath}
              onChange={(event) => onFolderPathChange(event.target.value)}
            />
          </FormField>

          <FormField label="File Name" required error={validation.getError('fileName')}>
            <Input
              placeholder="my_project.json"
              value={fileName}
              onChange={(event) => onFileNameChange(event.target.value)}
              onBlur={() => validation.markTouched('fileName')}
              className={validation.getError('fileName') ? 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20' : ''}
            />
          </FormField>

          <div className="rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-xs">
            <span className="font-semibold">Full path:</span>{' '}
            <code>/{folderPath ? `${folderPath.replace(/^\/+|\/+$/g, '')}/${fileName}` : fileName}</code>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isRepoPrivate}
              onChange={(event) => onRepoPrivateChange(event.target.checked)}
              className="size-4 rounded border-border"
            />
            Private repository
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onCreate} disabled={isLoading || !validation.isValid}>
            {isLoading ? 'Creating...' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
