/**
 * The product-analytics event catalog: every PostHog event the editor sends and its properties.
 *
 * Properties are content-free by contract (the privacy policy promises it): enums, counts,
 * booleans, durations, HTTP statuses and error class names. Never a name, label, prompt,
 * message, model content, repository, URL or key. Failures use `errorProperties(error)`.
 * PostHog adds the page path, browser and `editor_version` itself, and sends nothing without
 * analytics consent.
 */
import type { InterfaceMode } from '../../types/project';
import { captureEvent } from './lazy-analytics';
import { errorProperties, type ErrorProperties } from './errorProperties';

export { errorProperties, type ErrorProperties };

/** Where the user picked between the low-code editor and the agent. */
export type InterfaceChoiceSource = 'first_run' | 'new_project' | 'url';

/** How a project came to exist. */
export type ProjectCreationSource =
  | 'form'
  | 'template'
  | 'spreadsheet'
  | 'sdmx'
  | 'github'
  | 'file_import'
  | 'url_import';

/** The size of the generated model: counts only. */
export interface ModelMetrics {
  elements_count: number;
  classes_count: number;
  abstract_classes_count: number;
  attributes_count: number;
  methods_count: number;
  enumerations_count: number;
  relationships_count: number;
  total_size: number;
}

/** How a Spec-Driven run is paid for. */
export type SpecRunTier = 'free' | 'sponsored' | 'own_key';

/** What every Spec-Driven run event carries about the run's set-up. */
export interface SpecRunProperties {
  /** `generate` builds the app, `modify` edits the previous run's app; unset while the mode check runs. */
  run_mode?: 'generate' | 'modify';
  tier: SpecRunTier;
  provider: string;
  /** The model id from the catalog; unset for the free/demo tiers and a local model. */
  llm_model?: string;
  /** The mode was forced by the trigger rather than decided from the model change. */
  explicit_mode: boolean;
  has_budget: boolean;
  max_cost_usd?: number;
  max_runtime_s?: number;
  /** A generator key (`fastapi`, `django`, ...) the trigger pinned. */
  target_generator?: string;
  primary_kind?: string;
  skip_deterministic: boolean;
  /** Picked up again after a reload instead of started in this tab. */
  reattached: boolean;
}

/** Where a Spec-Driven run ended badly. */
/** Why a run on a linked repo did not start, when the user did not simply cancel. */
export type SpecRunStopReason = 'repo_busy' | 'unsaved_changes' | 'bad_model' | 'project_switched' | 'repo_changed';

export type SpecRunStage =
  | 'mode_check'
  | 'start'
  | 'stream'
  | 'stream_ended_early'
  | 'stall'
  | 'server'
  | 'no_result'
  | 'reattach';

interface SpecRunOutcome {
  duration_ms: number;
  cost_usd?: number;
}

export interface AnalyticsEvents {
  // ── App ──
  $pageview: Record<string, never>;
  /** Any failure shown to the user through `reportError`, wherever it happened. */
  error_shown: ErrorProperties;
  /** An error boundary caught a render crash: `app` blanks the page, `editor` only the canvas. */
  app_crashed: { boundary: 'app' | 'editor' } & ErrorProperties;
  /** An error nothing caught (`window` error or unhandled promise rejection). */
  uncaught_error: { kind: 'error' | 'rejection' } & ErrorProperties;

  // ── Interface choice and projects ──
  interface_chosen: { interface: InterfaceMode; source: InterfaceChoiceSource; remembered?: boolean };
  project_created: { interface: InterfaceMode; via: ProjectCreationSource };

  // ── Spec-Driven Agent ──
  /** A run was asked for but could not start. `needs_key` opens the key dialog. */
  spec_run_blocked: { reason: 'needs_key' | 'already_running' | 'no_project' | 'invalid_provider' };
  spec_run_started: SpecRunProperties;
  spec_run_reattached: SpecRunProperties & { age_ms: number };
  /** Output is available; `outcome` says whether it is fully verified. */
  spec_run_completed: SpecRunProperties &
    SpecRunOutcome & {
      outcome: 'success' | 'incomplete' | 'unenforced';
      generator_used?: string;
      file_count?: number;
      changed_file_count?: number;
      tokens_used?: number;
      is_zip?: boolean;
      blocker_count: number;
      verified?: number;
      not_verified?: number;
      shipped_unenforced?: number;
    };
  spec_run_failed: SpecRunProperties &
    SpecRunOutcome &
    Partial<ErrorProperties> & { error_code: string; stage: SpecRunStage; events_received?: number };
  spec_run_cancelled: SpecRunProperties & SpecRunOutcome & { reason: 'user' | 'abandoned' | SpecRunStopReason; stage: SpecRunStage };
  /** A non-terminal notice: the run goes on and `done` follows. */
  spec_run_warning: { code: 'COST_CAP' | 'TIMEOUT' | 'INCOMPLETE' };
  /** The live stream dropped and the client is reconnecting (proxies cut long streams). */
  spec_stream_reconnecting: { attempt: number; stream_failures: number; polling: boolean };
  spec_result_downloaded: { is_zip: boolean; again: boolean; size_bytes?: number };
  spec_result_download_failed: { is_zip: boolean; again: boolean };

  // ── Modeling assistant ──
  /** A message (typed or voice) left for the modeling agent; `send_result` says how it went. */
  assistant_message: {
    input: 'text' | 'voice';
    send_result: 'sent' | 'queued' | 'error';
    diagram_type?: string;
    message_length?: number;
    elements_count?: number;
    relationships_count?: number;
    total_size?: number;
    attachment_count?: number;
    /** MIME types only, never file names. */
    attachment_types?: string[];
    audio_bytes?: number;
    uses_own_key: boolean;
    provider?: string;
  };
  /** A message that was never sent. */
  assistant_message_blocked: { reason: 'rate_limited' | 'file_too_large' | 'attachment_read_failed' | 'exception' } & Partial<ErrorProperties>;
  /** A reply arrived; `action` is the structured action, or `text` for prose. */
  assistant_reply: { action: string; latency_ms?: number; diagram_type?: string };
  assistant_model_applied: { action: string; diagram_type?: string };
  assistant_model_apply_failed: { action?: string; diagram_type?: string } & ErrorProperties;
  /** The modeling agent reported an error (`agent_error`). */
  assistant_error: { error_code: string; retryable: boolean; needs_api_key: boolean };
  /** The client gave up on a reply: malformed payload or the hard timeout. */
  assistant_client_error: { kind: 'protocol' | 'timeout' };
  /** WebSocket state changes; `attempt` counts reconnects. */
  assistant_connection: { state: 'connected' | 'reconnected' | 'disconnected' | 'reconnect_failed'; attempt: number };
  assistant_new_chat: { had_spec_run: boolean; message_count: number };
  assistant_issue_reported: { logs_truncated: boolean };
  assistant_issue_report_failed: { reason: 'popup_blocked' | 'exception' } & Partial<ErrorProperties>;

  // ── LLM key (one dialog for the assistant, Spec-Driven, KG and settings) ──
  llm_key_saved: {
    provider: string;
    model_source: 'default' | 'preset' | 'custom';
    /** Only a catalog model id, never one the user typed. */
    model?: string;
    surface?: string;
    armed_assistant?: boolean;
    budget_set?: boolean;
  };
  llm_key_save_failed: { reason: 'provider_mismatch' | 'custom_model_empty' | 'custom_model_invalid' | 'local_url_invalid' | 'storage'; provider?: string };
  llm_key_removed: { provider?: string };
  free_tier_selected: { model?: string; surface?: string };

  // ── Code generation (deterministic generators) ──
  generator_used: {
    generator_type: string;
    diagram_type?: string;
    source?: 'menu' | 'assistant';
    duration_ms?: number;
    from_stored_model?: boolean;
    vocab?: string;
    nodes_count?: number;
    edges_count?: number;
  } & Partial<ModelMetrics>;
  generator_failed: {
    generator_type: string;
    diagram_type?: string;
    source?: 'menu' | 'assistant';
    reason: 'no_project' | 'wrong_context' | 'no_editor' | 'gui_empty' | 'auto_gui' | 'invalid_input' | 'validation' | 'request' | 'exception';
    duration_ms?: number;
  } & Partial<ErrorProperties>;
  /** The user chose not to run a generator: fix the validation warnings first. Not a failure. */
  generator_blocked: {
    generator_type: string;
    diagram_type?: string;
    source?: 'menu' | 'assistant';
    reason: 'warnings_declined';
  };
  quality_check_run: { diagram_type?: string; passed: boolean; error_count: number; warning_count: number };
  quality_check_failed: {
    diagram_type?: string;
    reason: 'no_project' | 'not_supported' | 'no_diagram' | 'empty_diagram' | 'exception';
  } & Partial<ErrorProperties>;
  /** Local deploy refused before it started (no diagram open, invalid names). */
  local_deploy_blocked: { generator_type: string; reason: 'no_diagram' | 'invalid_input' | 'validation' | 'warnings_declined' | 'request' };
  local_deploy_succeeded: { duration_ms: number };
  local_deploy_failed: { duration_ms: number } & ErrorProperties;

  // ── Deploy to Render (via GitHub) ──
  render_deploy_blocked: { reason: 'unavailable' | 'not_signed_in' | 'no_project' | 'missing_diagrams' | 'invalid_input' };
  render_deploy_started: { deployment_target: string; is_private: boolean; is_redeployment: boolean; personalization: boolean };
  render_deploy_success: {
    deployment_status: 'success';
    is_private: boolean;
    files_uploaded?: number;
    is_redeployment: boolean;
    diagram_type?: string;
    deployment_target: string;
    duration_ms?: number;
  };
  render_deploy_failure: {
    deployment_status: 'failed';
    is_private: boolean;
    diagram_type?: string;
    deployment_target: string;
    stage?: 'github' | 'render' | 'exception';
    duration_ms?: number;
  } & Partial<ErrorProperties>;

  // ── Projects, diagrams, import and export ──
  project_creation_failed: { via: ProjectCreationSource; reason?: 'request' | 'import' | 'invalid_input' | 'exception' } & Partial<ErrorProperties>;
  project_opened: { source: 'hub' | 'startup' };
  project_open_failed: { source: 'hub' | 'startup' } & ErrorProperties;
  project_deleted: { remaining_projects: number };
  project_delete_failed: ErrorProperties;
  /** A whole project was saved to a new GitHub repository when it was created. */
  project_saved_on_github: Record<string, never>;
  project_save_on_github_failed: ErrorProperties;
  diagram_created: { type: string };
  diagram_deleted: { type: string; remaining: number };
  object_diagram_generated_from_class: { created: number; skipped: number; links: number };
  template_used: { diagram_type?: string; mode: 'project' | 'replace' | 'new_tab'; had_model: boolean };
  template_failed: { diagram_type?: string } & ErrorProperties;
  diagram_imported: { format: string; diagram_type?: string; source?: string };
  diagram_import_failed: {
    format?: string;
    source?: string;
    reason: 'unsupported' | 'limit_reached' | 'invalid' | 'request' | 'no_project' | 'exception';
  } & Partial<ErrorProperties>;
  diagram_exported: { format: string; diagram_count?: number; diagram_type?: string; source?: ExportSource };
  diagram_export_failed: { format: string; reason: 'validation' | 'no_model' | 'request' | 'exception'; source?: ExportSource } & Partial<ErrorProperties>;

  // ── GitHub ──
  github_sign_in_started: { source: string };
  github_signed_in: { verified: boolean };
  github_sign_in_failed: { reason: 'oauth_error' | 'invalid_callback' | 'session_rejected' };
  github_session_expired: { reason: 'rejected' | 'age' };
  github_signed_out: Record<string, never>;
  /** A Spec-Driven result was pushed; `status` is the server's outcome. */
  github_push_completed: {
    status: string;
    new_repo: boolean;
    to_linked_repo: boolean;
    is_private?: boolean;
    push_mode?: 'commit' | 'pull_request';
    is_first_push?: boolean;
    files_uploaded?: number;
    warnings_count: number;
    took_run_model: boolean;
  };
  github_push_failed: {
    /** `upload_failed`: a deterministic generator's output could not be stored as a run to push. */
    code: 'expired' | 'repo_missing' | 'auth' | 'forbidden' | 'conflict' | 'branch_moved' | 'other' | 'nothing_to_push' | 'no_session' | 'no_project' | 'upload_failed';
    new_repo?: boolean;
  } & Partial<ErrorProperties>;
  /** "Continue from a GitHub repo": a project now tracks the repository. */
  github_repo_opened: {
    source: 'hub' | 'start_dialog' | 'assistant';
    reused: boolean;
    kept_local_changes: boolean;
    besser_repo?: boolean;
    proposed_model?: boolean;
    ai_reading?: boolean;
    entity_count?: number;
  };
  github_repo_open_failed: { source: 'hub' | 'start_dialog' | 'assistant'; reason: 'invalid_link' | 'not_signed_in' | 'request' | 'exception' } & Partial<ErrorProperties>;
  /** The smaller GitHub actions, one event pair keyed by `action`. */
  github_action_completed: {
    action: GitHubAction;
    status?: string;
    is_private?: boolean;
    warnings_count?: number;
    behind?: number;
    has_model?: boolean;
    kind?: string;
  };
  github_action_failed: { action: GitHubAction; reason?: string } & Partial<ErrorProperties>;
  github_star_toggled: { starred: boolean };
  github_star_failed: Partial<ErrorProperties>;

  // ── Workspace shell ──
  diagram_type_switched: { from_type?: string; to_type: string; source?: string };
  diagram_type_switch_failed: { to_type: string } & ErrorProperties;
  diagram_create_failed: { type: string; reason: 'limit_reached' | 'exception' } & Partial<ErrorProperties>;
  diagram_renamed: { type?: string };
  diagram_rename_failed: { type?: string } & Partial<ErrorProperties>;
  project_renamed: Record<string, never>;
  theme_changed: { theme: 'dark' | 'light'; source?: string };
  language_changed: { from?: string; to: string };
  /** Clicks that open help, links, dialogs and palette commands. */
  ui_action: {
    action: UiAction;
    source?: string;
    section?: string;
    link?: string;
    action_id?: string;
    unread_count?: number;
    entry_id?: string;
    diagram_type?: string;
  };
  feedback_submitted: { satisfaction: string; category?: string; has_email: boolean };
  feedback_failed: { reason: 'missing_rating' | 'request' } & Partial<ErrorProperties>;
  agent_variant_switched: { to_base: boolean; variant_count: number };
  agent_variant_switch_failed: { reason: 'no_base' | 'missing_variant' | 'exception' } & Partial<ErrorProperties>;

  // ── Editors (GUI, quantum, knowledge graph, UML) ──
  editor_action: {
    editor: EditorKind;
    action: string;
    pages_count?: number;
    classes_count?: number;
    block_id?: string;
    gate_type?: string;
    qubit_count?: number;
    nodes_count?: number;
    edges_count?: number;
    issue_count?: number;
    kind?: string;
  };
  editor_action_failed: { editor: EditorKind; action: string; kind?: string; reason?: string } & Partial<ErrorProperties>;

  // ── Agent features ──
  agent_simulation_checked: {
    passed: boolean;
    errors_count: number;
    agent_platform?: string;
    intent_recognition?: string;
    llm_provider?: string;
  };
  agent_simulation_started: { key_mode: string; has_openai_key: boolean; has_hf_token: boolean; has_replicate_key: boolean };
  agent_simulation_start_failed: { reason?: string } & Partial<ErrorProperties>;
  agent_simulation_connection: { state: 'connected' | 'auth_failed' | 'refused' | 'error' | 'no_url'; close_code?: number };
  agent_simulation_stopped: { source: string; duration_s?: number };
  agent_simulation_runtime_error: Record<string, never>;
  agent_config_action: {
    action: 'save' | 'recommend_rules' | 'recommend_llm' | 'load' | 'delete' | 'reset' | 'download' | 'upload';
    agent_platform?: string;
    agent_language?: string;
    intent_recognition?: string;
    llm_provider?: string;
    matched_rules?: number;
    duration_ms?: number;
  };
  agent_config_action_failed: { action: string; reason?: string } & Partial<ErrorProperties>;
  agent_component_changed: { change: 'added' | 'removed'; type: string };
  inter_diagram_derived: { kind: 'component' | 'deployment' | 'lane_agent'; warnings_count: number };
  inter_diagram_derive_failed: { kind: 'component' | 'deployment' | 'lane_agent'; reason: string } & Partial<ErrorProperties>;

  // ── Settings ──
  /** A setting changed; `value` only when it is an enum, boolean or number. */
  settings_changed: { area: 'project' | 'display' | 'perspective' | 'kg'; setting: string; value?: string | boolean | number };
  settings_change_failed: { area: 'project' | 'display' | 'perspective' | 'kg'; setting: string } & Partial<ErrorProperties>;
}

/** Where an export was asked for. */
export type ExportSource = 'dialog' | 'assistant' | 'settings';

export type UiAction =
  | 'about_opened'
  | 'feedback_opened'
  | 'help_opened'
  | 'link_opened'
  | 'shortcuts_opened'
  | 'command_palette_action'
  | 'whats_new_opened'
  | 'whats_new_entry_opened';

export type EditorKind = 'gui' | 'quantum' | 'kg' | 'uml';

/** The GitHub actions reported through `github_action_completed` / `github_action_failed`. */
export type GitHubAction =
  | 'create_repo'
  | 'save_model'
  | 'open_pull_request'
  | 'open_conflict_pull_request'
  | 'dismiss_pending'
  | 'pull'
  | 'link'
  | 'unlink'
  | 'restore_version'
  | 'go_live';

export type AnalyticsEventName = keyof AnalyticsEvents;

/** Send one catalogued event. Safe before PostHog has loaded and without consent (then dropped). */
export function track<E extends AnalyticsEventName>(event: E, properties: AnalyticsEvents[E]): void {
  captureEvent(event, properties as Record<string, unknown>);
}

/** Send `<name>_failed` style events: the catalogued properties plus the error's kind. */
export function trackFailure<E extends AnalyticsEventName>(
  event: E,
  error: unknown,
  properties: Omit<AnalyticsEvents[E], keyof ErrorProperties>,
): void {
  captureEvent(event, { ...(properties as Record<string, unknown>), ...errorProperties(error) });
}

/** A page view; the router changes pages without a reload, so each route change sends one. */
export const trackPageview = (): void => track('$pageview', {});

/** Bounds one page's uncaught-error events, so an error thrown in a render or animation loop cannot flood PostHog. */
const MAX_UNCAUGHT_ERRORS_PER_PAGE = 20;

/** Report errors nothing caught. Call once from the entry file. */
export function trackUncaughtErrors(): void {
  let sent = 0;
  const send = (kind: 'error' | 'rejection', error: unknown) => {
    if (sent >= MAX_UNCAUGHT_ERRORS_PER_PAGE) return;
    sent += 1;
    track('uncaught_error', { kind, ...errorProperties(error) });
  };
  window.addEventListener('error', (event) => {
    // No error object: browser notices such as "ResizeObserver loop completed with undelivered
    // notifications" or a cross-origin "Script error.", with nothing to classify.
    if (event.error == null) return;
    send('error', event.error);
  });
  window.addEventListener('unhandledrejection', (event) => send('rejection', event.reason));
}

/** Milliseconds since `start` (a `performance.now()` value), rounded. */
export const elapsedMs = (start: number): number => Math.round(performance.now() - start);
