/**
 * Smart Generator SSE event types — mirror the backend schema at
 * `besser/utilities/web_modeling_editor/backend/services/smart_generation/sse_events.py`.
 *
 * The frontend receives these as a stream from `POST /besser_api/smart-generate`
 * and renders them into the existing assistant chat message list.
 */

export type SmartGenProvider = 'anthropic' | 'openai';

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
  downloadUrl: string;
  fileName: string;
  isZip: boolean;
  recipe: Record<string, unknown>;
}

export interface SmartGenErrorEvent {
  event: 'error';
  code: SmartGenErrorCode;
  message: string;
}

export type SmartGenEvent =
  | StartEvent
  | PhaseEvent
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
}
