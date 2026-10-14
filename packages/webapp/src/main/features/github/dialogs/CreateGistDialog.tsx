import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
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

        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!isLoading) onCreate();
          }}
        >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="github-gist-description">{t('github.gist.descriptionLabel')}</Label>
            <Textarea
              id="github-gist-description"
              rows={2}
              placeholder={t('github.gist.descriptionPlaceholder')}
              value={description}
              onChange={(event) => onDescriptionChange(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Checkbox id="github-gist-public" checked={isPublic} onCheckedChange={onPublicChange} />
              <Label htmlFor="github-gist-public" className="font-normal">
                {t('github.gist.publicGist')}
              </Label>
            </div>
            <p className="pl-6 text-xs text-muted-foreground">
              {t('github.gist.secretHint')}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? t('github.gist.creating') : t('github.gist.createGist')}
          </Button>
        </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
