/**
 * Smart Generator SSE event types — mirror the backend schema at
 * `besser/utilities/web_modeling_editor/backend/services/smart_generation/sse_events.py`.
 *
 * The frontend receives these as a stream from `POST /besser_api/smart-generate`
 * and renders them into the existing assistant chat message list.
 */

export type SmartGenProvider = 'anthropic' | 'openai' | 'mistral';

export type SmartGenPrimaryKind =
  | 'class'
  | 'gui'
  | 'agent'
  | 'state_machine'
  | 'object'
  | 'quantum'
  | 'bpmn'
  | 'nn';

/**
 * Run mode sent to `POST /besser_api/smart-generate`.
 *   - `generate` (default): build the app from scratch.
 *   - `modify`: edit an existing run's output in place (incremental
 *     vibe-modify), identified by a companion `base_run_id`.
 */
export type SmartGenMode = 'generate' | 'modify';

export type SmartGenPhase =
  | 'select'
  | 'generate'
  | 'gap'
  | 'customize'
  | 'validate';

/**
 * UI-facing run-phase superset: the backend SSE phases plus the three
 * terminal / pre-start states that only live in the frontend slice.
 */
export type SmartGenRunPhase = SmartGenPhase | 'idle' | 'done' | 'error';

export type SmartGenToolCallStatus = 'executing' | 'done' | 'error';

export type SmartGenErrorCode =
  | 'INVALID_KEY'
  | 'UPSTREAM_LLM'
  | 'COST_CAP'
  | 'TIMEOUT'
  // Non-terminal warning: the run produced output but the customization
  // loop was cut short (provider rate-limit / turn cap). `done` follows.
  | 'INCOMPLETE'
  | 'INTERNAL'
  | 'BAD_REQUEST'
  | 'CANCELLED';

export interface StartEvent {
  event: 'start';
  runId: string;
  provider: SmartGenProvider;
  llmModel: string;
  maxCost: number;
  maxRuntime: number;
}

export interface PhaseEvent {
  event: 'phase';
  phase: SmartGenPhase;
  message: string;
}

/**
 * Adds details to an existing phase row (e.g. the gap analyser surfaces
 * its task list this way after the planning LLM call returns). The
 * frontend looks up the matching phase entry by name and merges the
 * details into it so the chevron-expand in the smart-gen card has
 * something to show.
 */
export interface PhaseUpdateEvent {
  event: 'phase_update';
  phase: SmartGenPhase;
  details: string;
  message?: string | null;
}

export interface TextDeltaEvent {
  event: 'text';
  delta: string;
}

export interface ToolCallEvent {
  event: 'tool_call';
  turn: number;
  tool: string;
  status: SmartGenToolCallStatus;
  summary?: string | null;
}

export interface CostEvent {
  event: 'cost';
  usd: number;
  turns: number;
  elapsedSeconds: number;
}

export interface DoneEvent {
  event: 'done';
  /** Run id carried explicitly by newer backends; older backends only
   * encode it inside `downloadUrl` (see the regex fallback). */
  runId?: string;
  downloadUrl: string;
  fileName: string;
  isZip: boolean;
  recipe: Record<string, unknown>;
  /** True when output was produced but the customization loop did not
   * finish cleanly — the download may be missing requested changes. */
  incomplete?: boolean;
  incompleteReason?: string;
}

export interface SmartGenErrorEvent {
  event: 'error';
  code: SmartGenErrorCode;
  message: string;
}

export type SmartGenEvent =
  | StartEvent
  | PhaseEvent
  | PhaseUpdateEvent
  | TextDeltaEvent
  | ToolCallEvent
  | CostEvent
  | DoneEvent
  | SmartGenErrorEvent;

/**
 * The `trigger_smart_generator` action emitted by the modeling agent.
 * The frontend consumes this from the existing assistant WebSocket
 * action dispatcher and kicks off a smart-generation run.
 *
 * ``provider``, ``llmModel``, and ``message`` are always sent by the
 * modeling agent today (see
 * ``modeling-agent/src/handlers/smart_generation_handler.py::build_trigger_smart_generator_payload``)
 * but kept optional here so the frontend handles older / alternative
 * sources gracefully — ``useSmartGenTrigger`` falls back to the
 * sessionStorage provider and a default intro message when they're
 * absent.
 */
export interface TriggerSmartGeneratorPayload {
  action: 'trigger_smart_generator';
  instructions: string;
  provider?: SmartGenProvider;
  llmModel?: string;
  message?: string;
  /**
   * Incremental vibe-modify overrides. Normally the frontend decides
   * automatically (see ``useSmartGenTrigger`` / ``decideRunMode``): a
   * follow-up run reuses the previous successful run's output while it's
   * still fresh. The agent MAY force the decision by setting these — e.g.
   * ``mode:'modify'`` with an explicit ``baseRunId`` — otherwise they stay
   * absent and the automatic heuristic drives the choice.
   */
  mode?: SmartGenMode;
  baseRunId?: string;
  /** Primary model selected by the user-approved preview plan. */
  primaryKindOverride?: SmartGenPrimaryKind;
  /** Deterministic Phase-1 generator selected by the approved preview plan. */
  targetGeneratorOverride?: string;
  /**
   * Internal UI attestation that the approved preview explicitly selected an
   * LLM-from-scratch run. Incoming agent payloads are rebuilt by
   * `useAssistantLogic` and never copy this field.
   */
  skipDeterministicGenerator?: boolean;
  /**
   * Internal UI attestation. Incoming agent payloads are rebuilt by
   * `useAssistantLogic` and never copy this field, so only the preview dialog
   * can authorize a paid run.
   */
  planApproved?: boolean;
}

export interface SmartGenPreviewModelSummaryEntry {
  kind: SmartGenPrimaryKind;
  classes?: number;
  enumerations?: number;
  associations?: number;
  modules?: number;
  screens?: number;
  count?: number;
}

export interface SmartGenPreviewPlan {
  primaryKind: SmartGenPrimaryKind;
  auxiliaryKinds: SmartGenPrimaryKind[];
  executionMode: SmartGenMode;
  targetGenerator: string | null;
  targetGeneratorConfidence: number;
  summary: string;
  estimatedTurns: number;
  estimatedCostUsd: number;
  estimatedDurationSeconds: number;
  notes: string[];
  modelSummary: {
    primary: SmartGenPrimaryKind;
    present: SmartGenPreviewModelSummaryEntry[];
  };
}
