import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/components/ui/form-field';
import { validateRepoName, validateFileName } from '../../../shared/utils/validation';
import { useFieldValidation } from '../../../shared/hooks/useFieldValidation';

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
  const { t } = useTranslation();
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
          <DialogTitle>{t('github.createRepo.title')}</DialogTitle>
          <DialogDescription>{t('github.createRepo.description')}</DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!isLoading && validation.isValid) onCreate();
          }}
        >
        <div className="flex flex-col gap-4">
          <FormField
            label={t('github.createRepo.repoNameLabel')}
            htmlFor="github-create-repo-name"
            required
            error={validation.getError('repoName')}
            helperText={t('github.createRepo.repoNameHelper')}
          >
            <Input
              id="github-create-repo-name"
              name="repo-name"
              autoComplete="off"
              spellCheck={false}
              placeholder="my-project"
              value={repoName}
              onChange={(event) => onRepoNameChange(event.target.value)}
              onBlur={() => validation.markTouched('repoName')}
              className={validation.getError('repoName') ? 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20' : ''}
            />
          </FormField>

          <FormField label={t('github.createRepo.descriptionLabel')} htmlFor="github-create-repo-description">
            <Textarea
              id="github-create-repo-description"
              rows={2}
              placeholder={t('github.createRepo.descriptionPlaceholder')}
              value={repoDescription}
              onChange={(event) => onRepoDescriptionChange(event.target.value)}
            />
          </FormField>

          <FormField label={t('github.folderPathLabel')} htmlFor="github-create-repo-folder">
            <Input
              id="github-create-repo-folder"
              name="folder-path"
              autoComplete="off"
              spellCheck={false}
              placeholder={t('github.folderPathPlaceholder')}
              value={folderPath}
              onChange={(event) => onFolderPathChange(event.target.value)}
            />
          </FormField>

          <FormField label={t('github.fileNameLabel')} htmlFor="github-create-repo-file" required error={validation.getError('fileName')}>
            <Input
              id="github-create-repo-file"
              name="file-name"
              autoComplete="off"
              spellCheck={false}
              placeholder="my_project.json"
              value={fileName}
              onChange={(event) => onFileNameChange(event.target.value)}
              onBlur={() => validation.markTouched('fileName')}
              className={validation.getError('fileName') ? 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20' : ''}
            />
          </FormField>

          <div className="rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-xs">
            <span className="font-semibold">{t('github.fullPath')}</span>{' '}
            <code className="break-all">/{folderPath ? `${folderPath.replace(/^\/+|\/+$/g, '')}/${fileName}` : fileName}</code>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox id="github-create-repo-private" checked={isRepoPrivate} onCheckedChange={onRepoPrivateChange} />
            <Label htmlFor="github-create-repo-private" className="font-normal">
              {t('github.createRepo.privateRepository')}
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={isLoading || !validation.isValid}>
            {isLoading ? t('github.createRepo.creating') : t('github.createRepo.create')}
          </Button>
        </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
