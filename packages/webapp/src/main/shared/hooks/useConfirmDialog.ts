import { useCallback, useRef, useState } from 'react';

export interface ConfirmOptions {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
}

export interface ConfirmDialogState extends ConfirmOptions {
  open: boolean;
}

const defaultState: ConfirmDialogState = {
  open: false,
  title: '',
  description: '',
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
  variant: 'default',
};

/**
 * Hook that provides a promise-based `confirm()` function and the state needed
 * to render a `<ConfirmDialog />`.
 *
 * Usage:
 * ```tsx
 * const { confirm, dialogState, handleConfirm, handleCancel } = useConfirmDialog();
 *
 * const ok = await confirm({ title: 'Delete?', description: 'Cannot be undone.' });
 * if (!ok) return;
 *
 * // In render:
 * <ConfirmDialog
 *   open={dialogState.open}
 *   title={dialogState.title}
 *   description={dialogState.description}
 *   confirmLabel={dialogState.confirmLabel}
 *   cancelLabel={dialogState.cancelLabel}
 *   variant={dialogState.variant}
 *   onConfirm={handleConfirm}
 *   onCancel={handleCancel}
 * />
 * ```
 */
export function useConfirmDialog() {
  const [dialogState, setDialogState] = useState<ConfirmDialogState>(defaultState);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setDialogState({
        open: true,
        title: options.title,
        description: options.description,
        confirmLabel: options.confirmLabel ?? 'Confirm',
        cancelLabel: options.cancelLabel ?? 'Cancel',
        variant: options.variant ?? 'default',
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setDialogState(defaultState);
    resolveRef.current?.(true);
    resolveRef.current = null;
  }, []);

  const handleCancel = useCallback(() => {
    setDialogState(defaultState);
    resolveRef.current?.(false);
    resolveRef.current = null;
  }, []);

  return { confirm, dialogState, handleConfirm, handleCancel };
}
