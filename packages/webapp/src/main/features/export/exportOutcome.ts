/**
 * How an exporter that reports its own errors (toast) ended, so its caller can tell a
 * failure from a success without parsing the toast.
 */
export type ExportOutcome =
  | { ok: true }
  | { ok: false; reason: 'validation' | 'no_model' | 'request'; error?: unknown };
