import type { TraceFile, TraceLogRecord, TraceOperation, TraceTool, TraceToolCall } from '../types/traceability';
import { TRACE_SCHEMA_VERSION } from '../types/traceability';
import { ASSISTANT_LLM_NAME, ASSISTANT_LLM_PROVIDER } from './traceRecorder';

/**
 * Brings a trace written by an older version up to {@link TRACE_SCHEMA_VERSION}, so traces already
 * kept in a browser or in an exported project still load. Anything else is returned unchanged.
 *
 * Version 1 had one Operation class with an `operationType`; version 2 has one class per kind of
 * operation (`type`), and tells manual from assistant modeling by the actors, not by the type.
 * Version 3 reaches tools only through tool calls: an operation's `uses` became one call per tool,
 * and its `logs` moved into the calls of the tools they named. Version 4 renamed what an operation
 * `consumes` and `produces` to what it `reads` and `writes`, and the `Modeling` operation to `ModelingSession`.
 * Version 5 added requirement artifacts: a version 4 trace has none, so it is already a valid version 5 one.
 */
export function migrateTraceFile(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  let trace = value as { schemaVersion?: unknown; operations?: unknown };
  if (!Array.isArray(trace.operations) || ![1, 2, 3, 4].includes(trace.schemaVersion as number)) return value;
  if (trace.schemaVersion === 1) {
    trace = { ...(trace as object), schemaVersion: 2, operations: (trace.operations as Record<string, unknown>[]).map(operationV1toV2) };
  }
  if (trace.schemaVersion === 2) trace = traceV2toV3(trace as unknown as V2Trace);
  if (trace.schemaVersion === 3) trace = traceV3toV4(trace as unknown as V3Trace);
  return { ...(trace as TraceFile), schemaVersion: TRACE_SCHEMA_VERSION };
}

function operationV1toV2(raw: Record<string, unknown>): Record<string, unknown> {
  const { operationType, changes, ...rest } = raw;
  if (operationType === 'CODE_GENERATION') return { ...rest, type: 'CodeGeneration' };
  // MANUAL_MODELLING and ASSISTANT_MODELLING (the other types were never recorded): the actors already say who.
  return { ...rest, type: 'Modeling', changes: Array.isArray(changes) ? changes : [] };
}

/** An operation as version 3 wrote it: `consumes` and `produces`, and `Modeling` for a modeling session. */
type V3Operation = Omit<TraceOperation, 'type' | 'reads' | 'writes'> & {
  type: 'Modeling' | 'CodeGeneration' | 'Conversation';
  consumes?: string[];
  produces?: string[];
};
type V3Trace = Omit<TraceFile, 'operations'> & { operations: V3Operation[] };
type V2Log = TraceLogRecord & { toolId?: string };
type V2Operation = Omit<V3Operation, 'toolCalls'> & { uses?: string[]; logs?: V2Log[] };
type V2Trace = Omit<TraceFile, 'operations'> & { operations: V2Operation[] };

function traceV2toV3(trace: V2Trace): V3Trace {
  const tools: TraceTool[] = [...(trace.tools ?? [])];
  const assistantLlm = (startedAt: string): TraceTool => {
    let tool = tools.find((t) => t.type === 'LLM' && t.name === ASSISTANT_LLM_NAME);
    if (!tool) {
      tool = { id: 'assistant-llm', type: 'LLM', name: ASSISTANT_LLM_NAME, provider: ASSISTANT_LLM_PROVIDER, timestamp: startedAt };
      tools.push(tool);
    }
    return tool;
  };
  const operations = trace.operations.map((operation): V3Operation => {
    const { uses = [], logs = [], ...rest } = operation;
    const toolIds = [...new Set(uses)];
    // A message naming none of the operation's tools goes to its first one; with no tool at all, it was
    // exchanged with the assistant, whose model is unknown.
    if (toolIds.length === 0 && logs.length > 0) toolIds.push(assistantLlm(operation.startedAt).id);
    const callOf = (log: V2Log) => (log.toolId && toolIds.includes(log.toolId) ? log.toolId : toolIds[0]);
    const toolCalls: TraceToolCall[] = toolIds.map((toolId, sequenceNumber) => ({
      id: `${operation.id}:call:${sequenceNumber}`,
      toolId,
      sequenceNumber,
      status: operation.status,
      startedAt: operation.startedAt,
      ...(operation.endedAt ? { endedAt: operation.endedAt } : {}),
      logs: logs.filter((log) => callOf(log) === toolId).map(({ toolId: _named, ...log }) => log),
    }));
    return { ...rest, toolCalls } as V3Operation;
  });
  return { ...trace, schemaVersion: 3, tools, operations };
}

function traceV3toV4(trace: V3Trace): TraceFile {
  const operations = trace.operations.map(({ type, consumes = [], produces = [], ...rest }) =>
    ({ ...rest, type: type === 'Modeling' ? 'ModelingSession' : type, reads: consumes, writes: produces }) as TraceOperation);
  return { ...trace, schemaVersion: 4, operations };
}
