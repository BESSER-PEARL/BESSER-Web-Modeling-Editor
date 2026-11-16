import { ProjectStorageRepository } from '../../shared/services/storage/ProjectStorageRepository';
import { ALL_DIAGRAM_TYPES, diagramHasContent } from '../../shared/types/project';
import { DIAGRAM_MODEL_TYPES } from '../../shared/traceability/diagramModelDiff';
import { recordSpecDrivenOutcome } from '../../shared/traceability/traceStore';
import type { SpecDrivenRunSummary } from '../../shared/traceability/traceRecorder';
import type { DoneEvent, SpecDrivenErrorEvent, SpecDrivenEvent } from './types';

/**
 * What the project trace records of a Spec-Driven run. The `done` event of a backend that traces runs carries the
 * run's trace fragment, merged as it is; for an older backend the run is recorded from what its stream carried
 * (start, model changes, cost, and the outcome), so a run is never missing from the trace.
 */
export interface RunTraceState {
  startedAt?: string;
  provider?: string;
  model?: string;
  costUsd?: number;
  /** The RequirementArtifact ids sent with the run (`body.requirements`). */
  requirementIds: string[];
}

export const newRunTraceState = (requirementIds: string[] = []): RunTraceState => ({ requirementIds });

/** Take what a stream event says about the run. */
export function noteRunEvent(state: RunTraceState, event: SpecDrivenEvent): void {
  if (event.event === 'start') {
    state.startedAt = new Date().toISOString();
    state.provider = event.provider;
    state.model = event.llmModel;
  } else if (event.event === 'model_update' && event.model) {
    state.model = event.model;
  } else if (event.event === 'cost') {
    state.costUsd = event.usd;
    // The model the provider really served, when it says (a requested model may be aliased).
    const served = (event as { servedModel?: unknown }).servedModel;
    if (typeof served === 'string' && served.trim()) state.model = served.trim();
  }
}

const VERIFICATION_STATES = ['verified', 'notVerified', 'shippedUnenforced'] as const;

/** The trace's summary of a run that ended with `terminal`, from what the stream carried. */
export function runSummary(
  state: RunTraceState, runId: string, terminal: DoneEvent | SpecDrivenErrorEvent, diagrams: SpecDrivenRunSummary['diagrams'],
): Omit<SpecDrivenRunSummary, 'actorName'> {
  const endedAt = new Date().toISOString();
  const done = terminal.event === 'done' ? terminal : undefined;
  const status: SpecDrivenRunSummary['status'] = done
    ? 'SUCCEEDED'
    : terminal.event === 'error' && terminal.code === 'CANCELLED'
      ? 'CANCELLED'
      : 'FAILED';
  const generator = typeof done?.recipe?.generator_used === 'string' ? done.recipe.generator_used : undefined;
  return {
    runId,
    status,
    startedAt: state.startedAt ?? endedAt,
    endedAt,
    ...(state.model ? { llm: { model: state.model, ...(state.provider ? { provider: state.provider } : {}) } } : {}),
    ...(typeof done?.tokensUsed === 'number' ? { tokensUsed: done.tokensUsed } : {}),
    ...(state.costUsd !== undefined ? { costUsd: state.costUsd } : {}),
    ...(generator ? { generator } : {}),
    changedFiles: Array.isArray(done?.changedFiles) ? done!.changedFiles.filter((f): f is string => typeof f === 'string') : [],
    ...(typeof done?.changedFileCount === 'number' ? { changedFileCount: done.changedFileCount } : {}),
    verification: VERIFICATION_STATES.flatMap((verificationState) =>
      (done?.verification?.[verificationState] ?? []).map((item) => ({
        state: verificationState, kind: item.kind, id: item.id ?? '', what: item.what,
        ...(item.how || item.why ? { detail: (item.how || item.why)! } : {}),
      })),
    ),
    diagrams,
    requirementIds: state.requirementIds,
  };
}

/** Record a run that ended with `terminal` in its project's trace (when the project records traces). */
export function recordRunInTrace(projectId: string, runId: string, state: RunTraceState, terminal: DoneEvent | SpecDrivenErrorEvent): void {
  const project = ProjectStorageRepository.loadProject(projectId);
  if (!project) return;
  const diagrams = ALL_DIAGRAM_TYPES.flatMap((type) =>
    (project.diagrams[type] ?? []).filter(diagramHasContent).map((d) => ({ id: d.id, title: d.title, modelType: DIAGRAM_MODEL_TYPES[type] })),
  );
  const fragment = terminal.event === 'done' ? terminal.trace : undefined;
  recordSpecDrivenOutcome(project, fragment, runSummary(state, runId, terminal, diagrams));
}
