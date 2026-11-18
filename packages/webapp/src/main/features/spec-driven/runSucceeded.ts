/**
 * A Spec-Driven run of a project finished in this tab with its whole output: not
 * stopped by the user and not cut short. The GitHub feature listens to push the
 * generated code of a linked project (useAutoPushFinishedRuns).
 */
export const SPEC_DRIVEN_RUN_SUCCEEDED_EVENT = 'besser:spec-driven-run-succeeded';

export interface SpecDrivenRunSucceededDetail {
  projectId: string;
  runId: string;
}

export function announceRunSucceeded(detail: SpecDrivenRunSucceededDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<SpecDrivenRunSucceededDetail>(SPEC_DRIVEN_RUN_SUCCEEDED_EVENT, { detail }));
}
