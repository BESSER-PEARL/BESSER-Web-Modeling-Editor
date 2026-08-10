/**
 * Global confirmation service for use in non-React code (e.g., GrapesJS commands,
 * vanilla DOM event handlers). A React component must subscribe via
 * `setGlobalConfirmHandler()` to actually display the dialog.
 *
 * Usage from imperative code:
 *   import { globalConfirm } from '../../services/confirm/globalConfirm';
 *   const ok = await globalConfirm({ title: 'Delete?', description: '...' });
 */

export interface GlobalConfirmOptions {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
}

type ConfirmHandler = (options: GlobalConfirmOptions) => Promise<boolean>;

let handler: ConfirmHandler | null = null;

/**
 * Register the React-side handler that will display the confirm dialog.
 * Called once from the provider component.
 */
export function setGlobalConfirmHandler(fn: ConfirmHandler | null): void {
  handler = fn;
}

/**
 * Show a confirmation dialog from non-React code.
 * Falls back to `window.confirm()` if no React handler is registered.
 */
export function globalConfirm(options: GlobalConfirmOptions): Promise<boolean> {
  if (handler) {
    return handler(options);
  }
  // Fallback: should never happen in practice, but provides safety
  return Promise.resolve(window.confirm(`${options.title}\n\n${options.description}`));
}
