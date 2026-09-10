export type GenerationResult =
  | {
      ok: true;
      filename?: string;
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
    };

export type QualityCheckState = 'not_validated' | 'valid' | 'errors' | 'stale';

export interface QualityCheckResult {
  executed: boolean;
  passed: boolean;
}
