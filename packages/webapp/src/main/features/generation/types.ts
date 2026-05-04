export type GenerationResult =
  | {
      ok: true;
      filename?: string;
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
