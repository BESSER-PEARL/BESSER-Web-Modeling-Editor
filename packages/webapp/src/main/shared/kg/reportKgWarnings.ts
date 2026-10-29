import { toast } from 'react-toastify';

/**
 * Show the backend's `warnings` (a list of `{code, message}`) as toast warnings,
 * one per code, so users see anomalies (UNDECLARED_CLASS, BLANK_SKIPPED,
 * SHACL_QUALIFIED_COUNT_INVALID, ...) without being spammed when many edges
 * trigger the same code.
 *
 * `scope` keeps the toast ids of different flows apart: the same code raised by
 * an import and by a later conversion should both be shown.
 */
export function reportKgWarnings(warnings: unknown, scope: 'kg-conv' | 'kg-import'): void {
  if (!Array.isArray(warnings)) return;
  const seen = new Set<string>();
  for (const warning of warnings as Array<Record<string, unknown>>) {
    const code = typeof warning?.code === 'string' ? warning.code : '';
    if (!code || seen.has(code)) continue;
    seen.add(code);
    const message = typeof warning?.message === 'string' ? warning.message : code;
    toast.warn(message, { toastId: `${scope}-${code}` });
  }
}
