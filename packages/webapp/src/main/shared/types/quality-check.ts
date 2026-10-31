export type QualityCheckState = 'not_validated' | 'valid' | 'errors' | 'stale';

export interface QualityCheckResult {
  executed: boolean;
  passed: boolean;
}
