import type { ReactNode } from 'react';

export interface GenerationOptions {
  /** False defers the download and returns the blob (assistant result card). */
  autoDownload?: boolean;
  /**
   * Replaces the error toast for a backend error detail (400/422/500 with a
   * string detail). Return null to show the detail itself.
   */
  describeError?: (status: number, detail: string) => ReactNode | null;
}

export type GenerationResult =
  | {
      ok: true;
      filename?: string;
      /** Generated from the stored class diagram rather than the open editor. */
      fromStoredModel?: boolean;
      /**
       * The generated artifact, present when generation ran with the download
       * deferred (e.g. the assistant flow, which renders a result card with a
       * manual Download button instead of auto-saving). Undefined when the
       * artifact was already auto-downloaded.
       */
      blob?: Blob;
    }
  | {
      ok: false;
      error: string;
      /** Why it failed, for analytics; unset means the request itself failed. */
      reason?:
        | 'no_project'
        | 'invalid_input'
        | 'validation'
        | 'wrong_context'
        | 'no_editor'
        | 'gui_empty'
        | 'auto_gui'
        | 'exception'
        /** The surface went away mid-run: not a failure. */
        | 'unmounted';
      /** The caught error, for analytics (never shown). */
      cause?: unknown;
    };
