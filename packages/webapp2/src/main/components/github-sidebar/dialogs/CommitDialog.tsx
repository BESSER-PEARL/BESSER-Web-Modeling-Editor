import React, { useMemo } from 'react';
import { CloudUpload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/components/ui/form-field';
import { validateRequired } from '../../../utils/validation';
import { useFieldValidation } from '../../../hooks/useFieldValidation';

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
  const validators = useMemo(() => ({
    message: () => validateRequired(message, 'Commit message'),
  }), [message]);
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
          <DialogTitle>Push to GitHub</DialogTitle>
          <DialogDescription>Write a commit message for your changes.</DialogDescription>
        </DialogHeader>

        <FormField label="Commit Message" required error={validation.getError('message')}>
          <Textarea
            rows={2}
            placeholder="Describe your changes..."
            value={message}
            onChange={(event) => onMessageChange(event.target.value)}
            onBlur={() => validation.markTouched('message')}
            autoFocus
            className={validation.getError('message') ? 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20' : ''}
          />
        </FormField>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onCommit} disabled={isSaving || !validation.isValid} className="gap-2">
            {isSaving ? 'Pushing...' : <CloudUpload className="h-4 w-4" />}
            Push
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
