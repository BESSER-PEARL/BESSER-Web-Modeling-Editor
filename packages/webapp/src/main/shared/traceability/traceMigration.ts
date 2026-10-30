import type { TraceFile, TraceOperation } from '../types/traceability';
import { TRACE_SCHEMA_VERSION } from '../types/traceability';

/**
 * Brings a trace written by an older version up to {@link TRACE_SCHEMA_VERSION}, so traces already
 * kept in a browser or in an exported project still load. Anything else is returned unchanged.
 *
 * Version 1 had one Operation class with an `operationType`; version 2 has one class per kind of
 * operation (`type`), and tells manual from assistant modeling by the actors, not by the type.
 */
export function migrateTraceFile(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  const trace = value as { schemaVersion?: unknown; operations?: unknown };
  if (trace.schemaVersion !== 1 || !Array.isArray(trace.operations)) return value;
  return { ...(value as TraceFile), schemaVersion: TRACE_SCHEMA_VERSION, operations: trace.operations.map(operationV1toV2) };
}

function operationV1toV2(raw: Record<string, unknown>): TraceOperation {
  const { operationType, changes, ...rest } = raw;
  const base = rest as Omit<TraceOperation, 'type'>;
  if (operationType === 'CODE_GENERATION') return { ...base, type: 'CodeGeneration' };
  // MANUAL_MODELLING and ASSISTANT_MODELLING (the other types were never recorded): the actors already say who.
  return { ...base, type: 'Modeling', changes: Array.isArray(changes) ? (changes as never) : [] };
}
