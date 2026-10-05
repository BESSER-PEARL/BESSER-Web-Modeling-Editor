import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { DialogOverlay, dialogContentBaseClass } from './dialog';

export interface ConfirmDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  onConfirm,
  onCancel,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
}) => {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onCancel(); }}>
      <DialogPrimitive.Portal>
        <DialogOverlay />
        <DialogPrimitive.Content
          className={cn(dialogContentBaseClass, 'max-w-md')}
          onEscapeKeyDown={onCancel}
        >
          <div className="flex flex-col gap-2">
            <DialogPrimitive.Title className="text-lg font-semibold leading-none tracking-tight">
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-sm text-muted-foreground">
              {description}
            </DialogPrimitive.Description>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={onCancel}>
              {cancelLabel}
            </Button>
            <Button
              variant={variant === 'danger' ? 'destructive' : 'default'}
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
