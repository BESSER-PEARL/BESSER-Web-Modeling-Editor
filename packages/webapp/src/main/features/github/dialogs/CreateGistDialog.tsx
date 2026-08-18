import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface CreateGistDialogProps {
  open: boolean;
  isLoading: boolean;
  description: string;
  isPublic: boolean;
  onOpenChange: (open: boolean) => void;
  onDescriptionChange: (value: string) => void;
  onPublicChange: (value: boolean) => void;
  onCreate: () => void;
}

export const CreateGistDialog: React.FC<CreateGistDialogProps> = ({
  open,
  isLoading,
  description,
  isPublic,
  onOpenChange,
  onDescriptionChange,
  onPublicChange,
  onCreate,
}) => {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('github.gist.title')}</DialogTitle>
          <DialogDescription>{t('github.gist.description')}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>{t('github.gist.descriptionLabel')}</Label>
            <Textarea
              rows={2}
              placeholder={t('github.gist.descriptionPlaceholder')}
              value={description}
              onChange={(event) => onDescriptionChange(event.target.value)}
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(event) => onPublicChange(event.target.checked)}
              className="size-4 rounded border-border"
            />
            {t('github.gist.publicGist')}
          </label>

          <p className="text-xs text-muted-foreground">
            {t('github.gist.secretHint')}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={onCreate} disabled={isLoading}>
            {isLoading ? t('github.gist.creating') : t('github.gist.createGist')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
