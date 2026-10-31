/**
 * Spec-Driven Agent SSE event types — mirror the backend schema at
 * `besser/utilities/web_modeling_editor/backend/services/spec_driven/sse_events.py`.
 *
 * The frontend receives these as a stream from `POST /besser_api/spec-driven/generate`
 * and renders them into the existing assistant chat message list.
 */

// 'local' is a frontend-only label for the user's OpenAI-compatible server; on
// the wire it is sent as provider='openai' + a base_url (the SSE client maps
// it), so it only works when the WME backend runs locally. 'pia' is sent as-is:
// a gateway the server resolves from its model catalog.
// 'free' is the keyless server-hosted open-weight tier: sent to the backend as
// provider='free' with NO api_key and NO base_url — the server injects the
// hosted endpoint + token. Offered only when /spec-driven/config advertises it.
export type SpecDrivenProvider =
  | 'anthropic'
  | 'openai'
  | 'mistral'
  // Nebius Token Factory: a real backend provider, sent on the wire as-is
  // with NO base_url (the endpoint is pinned server-side).
  | 'nebius'
  | 'pia'
  | 'local'
  | 'free'
  // Server-paid demo tier: endpoint, token and model all live in server env.
  | 'sponsored';

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
  /** What the thing is, in the user's terms. */
  what: string;
  /** Set on a VERIFIED item: what was actually run or re-checked. */
  how?: string;
  /** Set on the other two: why nothing reached it, or what is missing. */
  why?: string;
}

export interface SpecDrivenVerificationReport {
  /** We checked and it works. */
  verified: SpecDrivenVerificationItem[];
  /** We could not check — unknown, not absent. */
  notVerified: SpecDrivenVerificationItem[];
  /** We checked and it is MISSING from the delivered code. */
  shippedUnenforced: SpecDrivenVerificationItem[];
  /** TRUE totals. The three lists above are capped by the backend, so a
   * count may exceed its list length — the UI says "showing N of M". */
  counts: {
    verified: number;
    notVerified: number;
    shippedUnenforced: number;
  };
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
  /** Number of unresolved blocker-severity issues left by a run whose
   * loop COMPLETED (0 for runs that were genuinely cut short). Drives
   * "finished with N unresolved issues" framing instead of the
   * misleading "stopped early" copy. */
  blockerCount?: number;
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
  | TextDeltaEvent
  | ModelUpdateEvent
  | ToolCallEvent
  | CostEvent
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
 * ``provider``, ``llmModel``, and ``message`` are always sent by the
 * modeling agent today (see
 * ``modeling-agent/src/handlers/smart_generation_handler.py::build_trigger_smart_generator_payload``)
 * but kept optional here so the frontend handles older / alternative
 * sources gracefully — ``useSpecDrivenTrigger`` falls back to the
 * sessionStorage provider and a default intro message when they're
 * absent.
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

export interface SpecDrivenPhaseView {
  phase: string;
  label: string;
  message: string;
  toolCalls: SpecDrivenToolCallView[];
  /**
   * Long-form details attached to a phase after the fact (e.g. the gap
   * analyser's task list). Rendered behind a chevron in
   * SpecDrivenPhaseRow when present.
   */
  details?: string;
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
  what: string;
  /** VERIFIED items: what was actually run or re-checked. */
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
  notVerified: SpecDrivenVerificationItemView[];
  shippedUnenforced: SpecDrivenVerificationItemView[];
  counts: {
    verified: number;
    notVerified: number;
    shippedUnenforced: number;
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
  warnings: SpecDrivenWarningView[];
  text: string;
  status: 'running' | 'done' | 'error';
  /** Finished transport/artifact does not imply the generated app passed validation. */
  incomplete?: boolean;
  incompleteReason?: string;
  blockerCount?: number;
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
  /**
   * Generation succeeded but the browser download failed. The artifact
   * stays on the server (~30 min TTL) so "Download again" can retry.
   */
  downloadFailed?: boolean;
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
