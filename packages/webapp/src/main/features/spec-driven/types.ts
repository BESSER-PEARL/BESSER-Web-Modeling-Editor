/**
 * Spec-Driven Agent SSE event types — mirror the backend schema at
 * `besser/utilities/web_modeling_editor/backend/services/spec_driven/sse_events.py`.
 *
 * The frontend receives these as a stream from `POST /besser_api/spec-driven/generate`
 * and renders them into the existing assistant chat message list.
 */

import type { LlmProviderId } from '../../shared/services/llmKeyStorage';

// Every provider a run can use (LLM_PROVIDERS); the SSE client maps 'local' to
// provider='openai' + base_url and sends no key for 'free' / 'sponsored'.
export type SpecDrivenProvider = LlmProviderId;

export type SpecDrivenPrimaryKind =
  | 'class'
  | 'gui'
  | 'agent'
  | 'state_machine'
  | 'object'
  | 'quantum'
  | 'bpmn'
  | 'nn';

/**
 * Run mode sent to `POST /besser_api/spec-driven/generate`.
 *   - `generate` (default): build the app from scratch.
 *   - `modify`: edit an existing run's output in place (incremental
 *     modify), identified by a companion `base_run_id`.
 */
export type SpecDrivenMode = 'generate' | 'modify';

export type SpecDrivenPhase =
  | 'select'
  | 'generate'
  | 'gap'
  | 'customize'
  | 'validate';

/**
 * UI-facing run-phase superset: the backend SSE phases plus the three
 * terminal / pre-start states that only live in the frontend slice.
 */
export type SpecDrivenRunPhase = SpecDrivenPhase | 'idle' | 'done' | 'error';

export type SpecDrivenToolCallStatus = 'executing' | 'done' | 'error';

export type SpecDrivenErrorCode =
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
  provider: SpecDrivenProvider;
  llmModel: string;
  maxCost: number;
  maxRuntime: number;
}

export interface PhaseEvent {
  event: 'phase';
  phase: SpecDrivenPhase;
  message: string;
  /** The run's totals when this phase started, measured like the `cost`
   * event. Absent from older backends. */
  usd?: number | null;
  turns?: number | null;
  elapsedSeconds?: number | null;
}

/**
 * Adds details to an existing phase row (e.g. the gap analyser surfaces
 * its task list this way after the planning LLM call returns). The
 * frontend looks up the matching phase entry by name and merges the
 * details into it so the chevron-expand in the run card has
 * something to show.
 */
export interface PhaseUpdateEvent {
  event: 'phase_update';
  phase: SpecDrivenPhase;
  details: string;
  message?: string | null;
}

/**
 * What the current phase is doing now, while one of its steps runs (during
 * `validate`: a check round, a requirement judge call, a fix attempt; one can
 * take minutes). Lasts until the next step, phase or terminal event.
 * `elapsedSeconds` is the run's elapsed time when the step started.
 */
export interface StepEvent {
  event: 'step';
  phase: SpecDrivenPhase;
  message: string;
  elapsedSeconds?: number | null;
}

export interface TextDeltaEvent {
  event: 'text';
  delta: string;
}

/**
 * The LLM serving the run changed mid-run — the provider's outage
 * fallback switched to a different model (sticky for the rest of the
 * run). The run card updates its header model and shows a note in the
 * run steps. `reason` distinguishes free-tier quota exhaustion from a
 * generic primary outage.
 */
export interface ModelUpdateEvent {
  event: 'model_update';
  model: string;
  previousModel?: string | null;
  reason?: 'quota_exhausted' | 'primary_unavailable' | string;
}

export interface ToolCallEvent {
  event: 'tool_call';
  turn: number;
  tool: string;
  status: SpecDrivenToolCallStatus;
  summary?: string | null;
  /** What the call targeted, as `key=value` pairs (`path=src/App.jsx`). Never file content. */
  detail?: string | null;
}

export interface CostEvent {
  event: 'cost';
  usd: number;
  turns: number;
  elapsedSeconds: number;
}

/**
 * One Phase 3 validation round. `attempt` is 0 for the first check and n for
 * the re-check after fix attempt n; the tool calls between two findings events
 * are that attempt's repairs. `restored`: the run went back to a better earlier
 * version, which these findings describe. `blockers` is capped (and each
 * message clipped); the counts are true totals.
 */
export interface FindingsEvent {
  event: 'findings';
  attempt: number;
  blockers: string[];
  blockerCount: number;
  issueCount: number;
  restored?: boolean;
}

/**
 * What the run checked, could not check, and shipped unenforced.
 *
 * A blocker count is one number over three different results. An app scored
 * 11/11 with a passing booking workflow still double-sold rooms because two
 * OCL constraints failed conversion and never reached the generated code —
 * the run knew, and the number hid it. Mirrors ``VerificationReport`` /
 * ``VerificationItem`` in the backend's ``sse_events.py``.
 */
export type SpecDrivenVerificationKind =
  | 'requirement'
  | 'ocl_constraint'
  | 'api_workflow'
  | 'check';

export interface SpecDrivenVerificationItem {
  kind: SpecDrivenVerificationKind;
  /** Stable label (`R7`, an OCL constraint name, a scenario id). May be ''. */
  id: string;
  /** Requirement items only: the requirement's artifact id in the run's trace (`done.trace`); `id` keeps `R<n>`. */
  traceRef?: string;
  /** What the thing is, in the user's terms. */
  what: string;
  /** Set on a verified item (what was run) and a found-in-code item (the cited source). */
  how?: string;
  /** Set on the other two: why nothing reached it, or what is missing. */
  why?: string;
}

export interface SpecDrivenVerificationReport {
  /** A call to the running app exercised it and it works. */
  verified: SpecDrivenVerificationItem[];
  /** Its source is cited, but nothing ran it. Absent from older backends. */
  foundInCode?: SpecDrivenVerificationItem[];
  /** We could not check — unknown, not absent. */
  notVerified: SpecDrivenVerificationItem[];
  /** We checked and it is MISSING from the delivered code. */
  shippedUnenforced: SpecDrivenVerificationItem[];
  /** A test the agent wrote ran against the app and failed. Absent from older backends. */
  failed?: SpecDrivenVerificationItem[];
  /** TRUE totals. The three lists above are capped by the backend, so a
   * count may exceed its list length — the UI says "showing N of M". */
  counts: {
    verified: number;
    foundInCode?: number;
    notVerified: number;
    shippedUnenforced: number;
    failed?: number;
  };
}

/** The done event's field listing classes of checks the server has switched off. */
export const CHECKS_OFF_FIELD = 'checksOff';

export interface DoneEvent {
  event: 'done';
  /** Run id carried explicitly by newer backends; older backends only
   * encode it inside `downloadUrl` (see the regex fallback). */
  runId?: string;
  downloadUrl: string;
  fileName: string;
  isZip: boolean;
  recipe: Record<string, unknown>;
  /** How many user files the run produced. */
  fileCount?: number;
  /** Top-level entries (dir/file names at the project root, capped), for a
   * concrete "what was generated" summary. */
  topLevel?: string[];
  /** Total LLM tokens the run consumed (0 for a purely deterministic run).
   * NOTE: this is a cumulative sum across turns and re-counts context re-sent
   * each turn, so it is NOT a clean measure of effort — prefer `fileSplit`
   * (below) as the honest headline. */
  tokensUsed?: number;
  /** File provenance in this run, not correctness, coverage, or token savings.
   * `generator_untouched` = generator-tagged files not edited this run;
   * `generator_llm_modified` = generator-tagged files edited this run;
   * `llm_authored` = all other files, including harness-created files.
   * `*_pct` are percentages of the total file count. */
  fileSplit?: {
    generator_untouched?: number;
    generator_llm_modified?: number;
    llm_authored?: number;
    total?: number;
    generator_untouched_pct?: number;
    generator_llm_modified_pct?: number;
    llm_authored_pct?: number;
  };
  /** Output exists, but the run stopped early or left unresolved blockers. */
  incomplete?: boolean;
  incompleteReason?: string;
  /** True exactly when a request to stop the run was honoured; absent from older backends. */
  cancelled?: boolean;
  /** Number of unresolved blocker-severity issues left by a run whose
   * loop COMPLETED (0 for runs that were genuinely cut short). Drives
   * "finished with N unresolved issues" framing instead of the
   * misleading "stopped early" copy. On a run that is not incomplete it is
   * padded for released editors: it also counts `notConfirmedCount`, notes of
   * checks switched off, and on an unverified run at least one per class of
   * checks that never ran. */
  blockerCount?: number;
  /** Findings where a check reached no conclusion; never blockers. Absent from older backends. */
  notConfirmedCount?: number;
  /** The real unresolved blockers, on every run. Absent from older backends. */
  unresolvedBlockerCount?: number;
  /** The run is not incomplete, but a whole class of checks left no evidence
   * on the delivered app; `unverifiedReason` is the sentence to show. */
  unverified?: boolean;
  unverifiedReason?: string | null;
  /** Classes of checks switched off on the server (e.g. "build"); never makes a run unverified. */
  [CHECKS_OFF_FIELD]?: string[];
  /** The three states `blockerCount` collapses into one number: what the run
   * verified, what it could not check, and what it delivered UNENFORCED.
   * Additive — absent on older/interrupted runs, in which case the card
   * falls back to the blocker-count summary. */
  verification?: SpecDrivenVerificationReport;
  /** "modify" when the run updated an existing app (e.g. a GitHub repo). */
  mode?: 'create' | 'modify';
  /** Paths the agent wrote, edited or deleted (capped; `changedFileCount` is the total). */
  changedFiles?: string[];
  changedFileCount?: number;
  /** How the model differs from the one the base app was built from (modify runs). */
  modelChanges?: string[];
  /** The trace of the run (a trace file fragment, `projectId` null): its generator and LLM calls, the files the
   *  LLM wrote, and requirement -> code links whose requirements are the RequirementArtifact ids the editor sent.
   *  Absent from an older backend; untrusted, checked and migrated before it is merged (cross-repo traceability
   *  contract, section 2). */
  trace?: unknown;
}

export interface SpecDrivenErrorEvent {
  event: 'error';
  code: SpecDrivenErrorCode;
  message: string;
  /** Distinguishes an explicit stop from the disconnected grace policy. */
  reason?: 'user' | 'abandoned';
  /** True only when the backend verified a checkpoint exists on disk. */
  resumeAvailable?: boolean;
}

export type SpecDrivenEvent = (
  | StartEvent
  | PhaseEvent
  | PhaseUpdateEvent
  | StepEvent
  | TextDeltaEvent
  | ModelUpdateEvent
  | ToolCallEvent
  | CostEvent
  | FindingsEvent
  | DoneEvent
  | SpecDrivenErrorEvent
) & {
  /** Monotonic durable-log position added by replay-capable backends. */
  sequence?: number;
};

/**
 * The `trigger_smart_generator` action emitted by the modeling agent.
 * The frontend consumes this from the existing assistant WebSocket
 * action dispatcher and kicks off a spec-driven run.
 *
 * ``provider`` and ``message`` are always sent by the modeling agent
 * (``src/codegen/smart_generation_handler.py::build_trigger_smart_generator_payload``);
 * ``llmModel`` only when the user picked a model, otherwise the backend's
 * catalog default decides. All three stay optional: ``useSpecDrivenTrigger``
 * falls back to the sessionStorage provider and a default intro message.
 */
export interface TriggerSpecDrivenPayload {
  action: 'trigger_smart_generator';
  instructions: string;
  provider?: SpecDrivenProvider;
  llmModel?: string;
  message?: string;
  /**
   * Incremental modify overrides. Normally the frontend decides
   * automatically (see ``useSpecDrivenTrigger`` / ``decideRunMode``): a
   * follow-up run reuses the previous successful run's output while it's
   * still fresh. The agent MAY force the decision by setting these — e.g.
   * ``mode:'modify'`` with an explicit ``baseRunId`` — otherwise they stay
   * absent and the automatic heuristic drives the choice.
   */
  mode?: SpecDrivenMode;
  baseRunId?: string;
  /** Primary model selected by the user-approved preview plan. */
  primaryKindOverride?: SpecDrivenPrimaryKind;
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
   * `useAssistantLogic` and never copy this field, so only the BYOK run
   * dialog (where the user confirms key + budget) can authorize a paid run.
   */
  planApproved?: boolean;
}

/* Run-card state rendered by the chat message card (chatbot-kit/ui/chat-message). */

export interface SpecDrivenToolCallView {
  turn: number;
  tool: string;
  summary?: string | null;
  detail?: string | null;
}

/** The run's cost, turns and elapsed seconds at one point (a phase's start). */
export interface SpecDrivenRunTotals {
  usd: number;
  turns: number;
  elapsedSeconds: number;
}

/** One validation round on the validate row, placed among its tool calls. */
export interface SpecDrivenFindingsView {
  attempt: number;
  blockers: string[];
  blockerCount: number;
  issueCount: number;
  restored: boolean;
  /** How many of the row's tool calls came before this round. */
  afterToolCalls: number;
}

export interface SpecDrivenPhaseView {
  phase: string;
  label: string;
  message: string;
  toolCalls: SpecDrivenToolCallView[];
  /** Run totals when the phase started; absent from older backends. */
  startedAt?: SpecDrivenRunTotals;
  /** Validation rounds (validate row only), in order. */
  findings?: SpecDrivenFindingsView[];
  /**
   * Long-form details attached to a phase after the fact (e.g. the gap
   * analyser's task list). Rendered behind a chevron in
   * SpecDrivenPhaseRow when present.
   */
  details?: string;
}

/** The step a running phase is on (from the latest `step` event). */
export interface SpecDrivenStepView {
  message: string;
  /** Run elapsed seconds when the step started; absent if unstamped. */
  startedAt?: number;
  /** Tool calls on the card when the step started: later ones belong to it. */
  toolCallsBefore: number;
  /** Prose length when the step started: later text was written during it. */
  textBefore: number;
}

export interface SpecDrivenWarningView {
  code: string;
  message: string;
  /**
   * How severely to render the notice. `error` = the run failed (red);
   * `warning` = the run continued / finished but the output may be
   * affected (amber); `info` = an informational note about how the run
   * proceeded (e.g. "previous generation expired — rebuilding from
   * scratch"), rendered in a neutral style so it does not read as a
   * failure. Defaults to `warning` when absent (older producers).
   */
  severity?: 'info' | 'warning' | 'error';
}

/**
 * One thing the run checked, could not check, or found missing from the
 * delivered code. Mirrors the backend's `VerificationItem`.
 */
export interface SpecDrivenVerificationItemView {
  kind: 'requirement' | 'ocl_constraint' | 'api_workflow' | 'check';
  /** Stable label (`R7`, an OCL constraint name, a scenario id). May be "". */
  id: string;
  /** Requirement items only: the requirement's artifact id in the project trace. */
  traceRef?: string;
  what: string;
  /** Verified items: what was run; found-in-code items: the cited source. */
  how?: string;
  /** The other two: why nothing reached it, or what is missing. */
  why?: string;
}

/**
 * The three states a blocker count collapses into one number. `counts`
 * carries the TRUE totals — the lists are capped by the backend, so the
 * panel says "showing 5 of 23" rather than quietly under-reporting.
 */
export interface SpecDrivenVerificationView {
  verified: SpecDrivenVerificationItemView[];
  /** Absent on cards saved before this state existed. */
  foundInCode?: SpecDrivenVerificationItemView[];
  notVerified: SpecDrivenVerificationItemView[];
  shippedUnenforced: SpecDrivenVerificationItemView[];
  /** Absent on cards saved before this state existed. */
  failed?: SpecDrivenVerificationItemView[];
  counts: {
    verified: number;
    foundInCode?: number;
    notVerified: number;
    shippedUnenforced: number;
    failed?: number;
  };
}

export interface SpecDrivenMessageState {
  /**
   * Live-run subscription key (client-generated, assigned before the
   * backend run id exists). Present while a spec-driven run is streaming:
   * the card then renders from the Redux slice entry
   * `specDriven.runs[liveKey]` — updated on every SSE event — instead of
   * this embedded snapshot, so live progress re-renders by construction
   * regardless of which chat surface is mounted or remounts mid-run.
   * The final snapshot written into the message at completion drops it.
   */
  liveKey?: string;
  runId?: string;
  provider?: string;
  model?: string;
  phases: SpecDrivenPhaseView[];
  /** What the run is doing now; cleared when a phase starts or the run ends. */
  step?: SpecDrivenStepView;
  warnings: SpecDrivenWarningView[];
  text: string;
  status: 'running' | 'done' | 'error';
  /** Finished transport/artifact does not imply the generated app passed validation. */
  incomplete?: boolean;
  incompleteReason?: string;
  blockerCount?: number;
  /** Absent on cards from a backend that does not split findings not confirmed out. */
  notConfirmedCount?: number;
  /** The backend's real unresolved blockers; absent from older backends. */
  unresolvedBlockerCount?: number;
  /** A whole class of checks left no evidence; absent unless the backend said so. */
  unverified?: boolean;
  unverifiedReason?: string;
  /** Classes of checks the server has switched off; absent when none or not reported. */
  checksOff?: string[];
  /**
   * What the run verified, could not verify, and shipped UNENFORCED. This is
   * the field a human reads; `blockerCount` is the same evidence collapsed to
   * one number. Undefined on older or interrupted runs — the card then falls
   * back to the blocker-count summary.
   */
  verification?: SpecDrivenVerificationView;
  /** Live spend so far in USD (from the backend's 2s cost events). */
  costUsd?: number;
  /** Elapsed run time in seconds (from the backend's 2s cost events). */
  elapsedSeconds?: number;
  /** LLM turns so far (from the backend's 2s cost events). */
  turns?: number;
  /** Cost budget for this run in USD (from the start event). */
  maxCost?: number;
  /** Runtime budget for this run in seconds (from the start event). */
  maxRuntime?: number;
  /** Backend download URL carried by the done event. */
  downloadUrl?: string;
  /** Artifact filename carried by the done event. */
  fileName?: string;
  /** Whether the artifact is a zip (done event). */
  isZip?: boolean;
  /**
   * The deterministic generator BESSER used (e.g. `fastapi`, `django`,
   * `web_app`), read from the done event's recipe. Shown on the compact
   * completion card as a short "what was generated" hint.
   */
  generatorUsed?: string;
  /** Number of user files the run produced — shown on the compact card. */
  fileCount?: number;
  /** "modify" when the run updated an existing app rather than creating one. */
  runMode?: 'create' | 'modify';
  /** Files the agent changed this run (capped) and their total count. */
  changedFiles?: string[];
  changedFileCount?: number;
  /** How the model changed against the app's base model (modify runs). */
  modelChanges?: string[];
  /** Total LLM tokens this run consumed. NOT shown as a headline number —
   * it is a cumulative sum that re-counts context re-sent each turn, so it
   * overstates effort. Kept only for the deterministic-split badge's tooltip. */
  tokensUsed?: number;
  /**
   * Share (0–100) of output files tagged as scaffold and not edited this run
   * (`fileSplit.generator_untouched_pct`). File provenance, not a measure of
   * requirements covered, correctness, lines of code, or token savings.
   */
  detPct?: number;
  /** Share (0–100) of files outside the generator-tagged scaffold
   * (`fileSplit.llm_authored_pct`) — shown in the badge breakdown. */
  aiPct?: number;
  /** Share (0–100) of files the generator wrote that the LLM then edited
   * (`fileSplit.generator_llm_modified_pct`) — the middle bucket, shown in the
   * badge breakdown so detPct + modPct + aiPct reconcile to ~100. */
  modPct?: number;
  /**
   * Honest token breakdown from the run recipe's usage summary. The card leads
   * with ACTIVE = input + output (the real cost) and shows `cacheRead` as a
   * secondary number, instead of the misleading `total` that re-counts re-sent
   * context. Undefined when the provider reported no split.
   */
  tokenUsage?: {
    input: number;
    output: number;
    cacheRead: number;
    total: number;
  };
  /** Epoch ms at which a successful run finished; the server keeps its output for the download lifetime from then. */
  finishedAt?: number;
  /**
   * Generation succeeded and the artifact is ready, but it has NOT been
   * saved to the user's disk yet. The run no longer auto-downloads —
   * the user must click "Download" on the card to consent to the save.
   */
  needsDownload?: boolean;
  /**
   * True when this card is a purely DETERMINISTIC generator run (no LLM) —
   * BESSER's built-in generators. Renders "Generated deterministically" with a
   * "0 tokens" badge instead of provider/model, and downloads the in-hand
   * artifact blob directly (there is no server-side run id to re-fetch).
   */
  deterministic?: boolean;
  /** The generated artifact for a deterministic run's manual Download button. */
  deterministicBlob?: Blob;
}
