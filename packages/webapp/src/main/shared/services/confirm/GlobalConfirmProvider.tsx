import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { GlobalConfirmOptions, setGlobalConfirmHandler } from './globalConfirm';

interface DialogState extends GlobalConfirmOptions {
  open: boolean;
}

const defaultState: DialogState = {
  open: false,
  title: '',
  description: '',
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
  variant: 'default',
};

/**
 * Mount this component once near the root of the application so that
 * `globalConfirm()` calls from non-React code (GrapesJS commands, vanilla DOM
 * handlers, etc.) are rendered as proper modal dialogs.
 */
export const GlobalConfirmProvider: React.FC = () => {
  const [state, setState] = useState<DialogState>(defaultState);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const handleRequest = useCallback((options: GlobalConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setState({
        open: true,
        title: options.title,
        description: options.description,
        confirmLabel: options.confirmLabel ?? 'Confirm',
        cancelLabel: options.cancelLabel ?? 'Cancel',
        variant: options.variant ?? 'default',
      });
    });
  }, []);

  useEffect(() => {
    setGlobalConfirmHandler(handleRequest);
    return () => setGlobalConfirmHandler(null);
  }, [handleRequest]);

  const handleConfirm = useCallback(() => {
    setState(defaultState);
    resolveRef.current?.(true);
    resolveRef.current = null;
  }, []);

  const handleCancel = useCallback(() => {
    setState(defaultState);
    resolveRef.current?.(false);
    resolveRef.current = null;
  }, []);

  return (
    <ConfirmDialog
      open={state.open}
      title={state.title}
      description={state.description}
      confirmLabel={state.confirmLabel}
      cancelLabel={state.cancelLabel}
      variant={state.variant}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );
};
