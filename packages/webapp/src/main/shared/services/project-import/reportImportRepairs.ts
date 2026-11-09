import { toast } from 'react-toastify';

/**
 * Show what the backend changed to load an imported BUML file (its `warnings`,
 * a list of `{code, message}`), one toast per message: two repaired
 * associations share a code but each needs its own notice.
 */
export function reportImportRepairs(warnings: unknown): void {
  if (!Array.isArray(warnings)) return;
  for (const warning of warnings as Array<Record<string, unknown>>) {
    const message = warning?.message;
    if (typeof message !== 'string' || !message) continue;
    toast.warn(message, { toastId: `buml-import-${message}` });
  }
}
