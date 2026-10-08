import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CloudUpload, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/components/ui/form-field';
import { validateRequired } from '../../../shared/utils/validation';
import { useFieldValidation } from '../../../shared/hooks/useFieldValidation';

interface CommitDialogProps {
  open: boolean;
  isSaving: boolean;
  message: string;
  onOpenChange: (open: boolean) => void;
  onMessageChange: (value: string) => void;
  onCommit: () => void;
}

export const CommitDialog: React.FC<CommitDialogProps> = ({
  open,
  isSaving,
  message,
  onOpenChange,
  onMessageChange,
  onCommit,
}) => {
  const { t } = useTranslation();
  const validators = useMemo(() => ({
    message: () => validateRequired(message, t('github.commit.messageLabel')),
  }), [message, t]);
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
          <DialogTitle>{t('github.commit.title')}</DialogTitle>
          <DialogDescription>{t('github.commit.description')}</DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!isSaving && validation.isValid) onCommit();
          }}
        >
        <FormField label={t('github.commit.messageLabel')} htmlFor="github-commit-message" required error={validation.getError('message')}>
          <Textarea
            id="github-commit-message"
            rows={2}
            placeholder={t('github.commit.messagePlaceholder')}
            value={message}
            onChange={(event) => onMessageChange(event.target.value)}
            onBlur={() => validation.markTouched('message')}
            onKeyDown={(event) => {
              // Enter commits; Shift+Enter adds a line for a longer message.
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            autoFocus
            className={validation.getError('message') ? 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20' : ''}
          />
        </FormField>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={isSaving || !validation.isValid} className="gap-2">
            {isSaving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {t('github.commit.pushing')}
              </>
            ) : (
              <>
                <CloudUpload className="size-4" />
                {t('github.commit.push')}
              </>
            )}
          </Button>
        </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
