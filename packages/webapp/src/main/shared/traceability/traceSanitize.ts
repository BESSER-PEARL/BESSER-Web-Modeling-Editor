import { REQUIREMENT_KINDS } from '../types/traceability';
import type {
  TraceActor,
  TraceArtifact,
  TraceChangeEvent,
  TraceConfidence,
  TraceEvidence,
  TraceFile,
  TraceLink,
  TraceLogRecord,
  TraceOperation,
  TraceTool,
  TraceToolCall,
} from '../types/traceability';

/**
 * The one check of a trace's items, for every trace that comes from outside this tab's own recording: an imported
 * project's trace, a generation's fragment from the backend, the trace stored in the browser (another version of
 * the editor, or another tab, wrote it). The top-level check (`traceFileProblem`) only says it is a trace file of
 * the right version; this one makes the views safe to run on it:
 *
 * - an item of the wrong shape (not an object, a required field missing or of the wrong type, an unknown `type`)
 *   is dropped, and so is an item whose id an earlier item already has;
 * - a reference to an item the trace does not have is dropped (a dangling `parentId` or `revisionOfId` is removed,
 *   an operation's dangling actor, tool call, read or write is left out, a change or link to a missing artifact or
 *   operation is dropped). A backend fragment may name the project's own artifacts, so its references are kept
 *   ({@link SanitizeOptions.externalReferences});
 * - a `parentId` that closes a cycle is removed, so every walk up the parents ends;
 * - a trace with more items than {@link TRACE_LIMITS} allows is refused (`tooLarge`); an over-long string is cut
 *   (a generated file's content is dropped, its hash kept).
 */

/** The most items a trace may hold (the backend refuses more than 250,000 of each list on a B-UML export); a bigger one is refused rather than slowing or crashing the page. */
export const TRACE_LIMITS = {
  actors: 10_000,
  tools: 10_000,
  artifacts: 250_000,
  operations: 100_000,
  traceLinks: 250_000,
  /** Tool calls, changes, logs and evidence of one item. */
  perItem: 100_000,
} as const;

/** The longest text kept: a stored file content (longer ones are dropped, their hash kept). */
export const MAX_CONTENT_CHARS = 8 * 1024 * 1024;
/** The longest other text (names, values, messages); longer ones are cut. */
export const MAX_TEXT_CHARS = 1024 * 1024;

export interface SanitizeOptions {
  /** A fragment to merge into a project trace: its references may name the project trace's own items. */
  externalReferences?: boolean;
}

export type SanitizeResult =
  | { trace: TraceFile; dropped: number }
  | { tooLarge: { list: string; count: number; max: number } };

type Raw = Record<string, unknown>;

const isObject = (value: unknown): value is Raw => !!value && typeof value === 'object' && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === 'string';
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const optional = (value: unknown, check: (v: unknown) => boolean) => value === undefined || check(value);
const text = (value: string, max = MAX_TEXT_CHARS) => (value.length > max ? `${value.slice(0, max)}…` : value);

const ACTOR_TYPES = new Set(['Person', 'Agent']);
const TOOL_TYPES = new Set(['Editor', 'CodeGenerator', 'ModelGenerator', 'LLM']);
const STATUSES = new Set(['PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'TIMED_OUT']);
const OPERATION_TYPES = new Set(['ModelingSession', 'CodeGeneration', 'RequirementExtraction', 'Conversation']);
const CHANGE_KINDS = new Set(['CREATED', 'UPDATED', 'DELETED']);
const KINDS = new Set<string>(REQUIREMENT_KINDS);

/** Check the trace's items (see the module comment); `trace` passed the top-level check. */
export function sanitizeTraceFile(trace: TraceFile, options: SanitizeOptions = {}): SanitizeResult {
  for (const list of ['actors', 'tools', 'artifacts', 'operations', 'traceLinks'] as const) {
    const count = (trace[list] as unknown[]).length;
    if (count > TRACE_LIMITS[list]) return { tooLarge: { list, count, max: TRACE_LIMITS[list] } };
  }
  let dropped = 0;
  const keep = <T>(items: unknown[], read: (raw: Raw) => T | undefined, ids: Set<string>): T[] => {
    const result: T[] = [];
    for (const raw of items) {
      const item = isObject(raw) && isString(raw.id) && !ids.has(raw.id) ? read(raw) : undefined;
      if (item === undefined) {
        dropped += 1;
        continue;
      }
      ids.add((item as { id: string }).id);
      result.push(item);
    }
    return result;
  };
  const known = (ids: Set<string>) => (id: unknown): id is string => isString(id) && (options.externalReferences || ids.has(id));

  const actorIds = new Set<string>();
  const actors = keep<TraceActor>(trace.actors, readActor, actorIds);
  const toolIds = new Set<string>();
  const tools = keep<TraceTool>(trace.tools, readTool, toolIds);
  const artifactIds = new Set<string>();
  const artifacts = keep<TraceArtifact>(trace.artifacts, readArtifact, artifactIds);
  const isArtifact = known(artifactIds);
  dropped += fixParents(artifacts, isArtifact);

  const operationIds = new Set<string>();
  const operations = keep<TraceOperation>(trace.operations, (raw) => {
    const operation = readOperation(raw, known(actorIds), known(toolIds), isArtifact);
    if (operation) dropped += operation.dropped;
    return operation?.operation;
  }, operationIds);
  const isOperation = known(operationIds);
  const traceLinks = keep<TraceLink>(trace.traceLinks, (raw) => readLink(raw, isArtifact, isOperation), new Set());
  // Built from the known fields only: an unknown key (an own `__proto__` from JSON.parse) is not carried along.
  const { schemaVersion, projectId } = trace;
  return { trace: { schemaVersion, projectId, actors, tools, artifacts, operations, traceLinks }, dropped };
}

function readActor(raw: Raw): TraceActor | undefined {
  if (!ACTOR_TYPES.has(raw.type as string) || !isString(raw.name) || !isString(raw.timestamp) || !optional(raw.version, isString)) return undefined;
  return { ...(raw as unknown as TraceActor), name: text(raw.name) };
}

function readTool(raw: Raw): TraceTool | undefined {
  if (!TOOL_TYPES.has(raw.type as string) || !isString(raw.name) || !isString(raw.timestamp)) return undefined;
  if (!optional(raw.version, isString) || !optional(raw.provider, isString)) return undefined;
  return { ...(raw as unknown as TraceTool), name: text(raw.name) };
}

function readArtifact(raw: Raw): TraceArtifact | undefined {
  if (!isString(raw.name) || !isString(raw.timestamp) || !optional(raw.parentId, isString)) return undefined;
  const base: Raw = { ...raw, name: text(raw.name) };
  switch (raw.type) {
    case 'ModelArtifact':
      return isString(raw.elementId) && isString(raw.elementType) ? (base as unknown as TraceArtifact) : undefined;
    case 'CodeArtifact': {
      if (!isString(raw.path) || !isString(raw.contentHash)) return undefined;
      if (!optional(raw.content, isString) || !optional(raw.startLine, isNumber) || !optional(raw.endLine, isNumber)) return undefined;
      if (!optional(raw.revisionOfId, isString)) return undefined;
      if (isString(raw.content) && raw.content.length > MAX_CONTENT_CHARS) delete base.content;
      return base as unknown as TraceArtifact;
    }
    case 'PromptArtifact':
      if (!isString(raw.content) || !isString(raw.contentHash)) return undefined;
      return { ...base, content: text(raw.content, MAX_CONTENT_CHARS) } as unknown as TraceArtifact;
    case 'RequirementArtifact':
      return isString(raw.quote) && KINDS.has(raw.kind as string) ? ({ ...base, quote: text(raw.quote) } as unknown as TraceArtifact) : undefined;
    default:
      return undefined;
  }
}

/** Remove dangling `parentId`s and `revisionOfId`s, and every `parentId` that closes a cycle; how many were removed. */
function fixParents(artifacts: TraceArtifact[], isArtifact: (id: unknown) => id is string): number {
  let removed = 0;
  const byId = new Map(artifacts.map((a) => [a.id, a]));
  for (const artifact of artifacts) {
    if (artifact.parentId !== undefined && (!isArtifact(artifact.parentId) || artifact.parentId === artifact.id)) {
      delete artifact.parentId;
      removed += 1;
    }
    if (artifact.type === 'CodeArtifact' && artifact.revisionOfId !== undefined && !isArtifact(artifact.revisionOfId)) {
      delete artifact.revisionOfId;
      removed += 1;
    }
  }
  // Walk up from each artifact; a walk that meets an artifact of the same walk has found a cycle, which is broken
  // at the artifact the walk reached it from. Artifacts already known to end are not walked again.
  const ends = new Set<string>();
  for (const start of artifacts) {
    const walk = new Set<string>();
    let current: TraceArtifact | undefined = start;
    while (current && !ends.has(current.id)) {
      walk.add(current.id);
      const parent: TraceArtifact | undefined = current.parentId !== undefined ? byId.get(current.parentId) : undefined;
      if (parent && walk.has(parent.id)) {
        delete current.parentId;
        removed += 1;
        break;
      }
      current = parent;
    }
    walk.forEach((id) => ends.add(id));
  }
  return removed;
}

function readOperation(
  raw: Raw,
  isActor: (id: unknown) => id is string,
  isTool: (id: unknown) => id is string,
  isArtifact: (id: unknown) => id is string,
): { operation: TraceOperation; dropped: number } | undefined {
  if (!OPERATION_TYPES.has(raw.type as string) || !STATUSES.has(raw.status as string) || !isString(raw.startedAt)) return undefined;
  if (!optional(raw.endedAt, isString)) return undefined;
  const lists = ['performedBy', 'toolCalls', 'reads', 'writes'] as const;
  if (!lists.every((key) => Array.isArray(raw[key]) && (raw[key] as unknown[]).length <= TRACE_LIMITS.perItem)) return undefined;
  if (raw.type === 'ModelingSession' && !(Array.isArray(raw.changes) && raw.changes.length <= TRACE_LIMITS.perItem)) return undefined;
  let dropped = 0;
  const filter = <T>(items: unknown[], accept: (item: unknown) => T | undefined): T[] => {
    const result: T[] = [];
    for (const item of items) {
      const kept = accept(item);
      if (kept === undefined) dropped += 1;
      else result.push(kept);
    }
    return result;
  };
  const ids = (items: unknown[], isKnown: (id: unknown) => id is string) => [...new Set(filter(items, (id) => (isKnown(id) ? id : undefined)))];
  const callIds = new Set<string>();
  const operation = {
    ...raw,
    performedBy: ids(raw.performedBy as unknown[], isActor),
    toolCalls: filter(raw.toolCalls as unknown[], (call) => {
      const read = readToolCall(call, isTool);
      if (!read || callIds.has(read.call.id)) return undefined;
      callIds.add(read.call.id);
      dropped += read.dropped;
      return read.call;
    }),
    reads: ids(raw.reads as unknown[], isArtifact),
    writes: ids(raw.writes as unknown[], isArtifact),
    ...(raw.type === 'ModelingSession' ? { changes: filter(raw.changes as unknown[], (change) => readChange(change, isArtifact)) } : {}),
  } as unknown as TraceOperation;
  setConfidence(operation, raw.confidence);
  return { operation, dropped };
}

function readToolCall(raw: unknown, isTool: (id: unknown) => id is string): { call: TraceToolCall; dropped: number } | undefined {
  if (!isObject(raw) || !isString(raw.id) || !isTool(raw.toolId) || !isNumber(raw.sequenceNumber)) return undefined;
  if (!STATUSES.has(raw.status as string) || !isString(raw.startedAt) || !optional(raw.endedAt, isString)) return undefined;
  if (!Array.isArray(raw.logs) || raw.logs.length > TRACE_LIMITS.perItem) return undefined;
  if (!optional(raw.inputTokens, isNumber) || !optional(raw.outputTokens, isNumber)) return undefined;
  const logs: TraceLogRecord[] = [];
  for (const log of raw.logs) {
    if (isObject(log) && isString(log.id) && isString(log.content) && isNumber(log.sequenceNumber) && isString(log.logType) && isString(log.timestamp)) {
      logs.push({ ...(log as unknown as TraceLogRecord), content: text(log.content) });
    }
  }
  return { call: { ...(raw as unknown as TraceToolCall), logs }, dropped: raw.logs.length - logs.length };
}

function readChange(raw: unknown, isArtifact: (id: unknown) => id is string): TraceChangeEvent | undefined {
  if (!isObject(raw) || !isString(raw.id) || !CHANGE_KINDS.has(raw.kind as string) || !isArtifact(raw.artifactId) || !isString(raw.timestamp)) return undefined;
  if (!optional(raw.feature, isString) || !optional(raw.oldValue, isString) || !optional(raw.newValue, isString)) return undefined;
  return {
    ...(raw as unknown as TraceChangeEvent),
    ...(isString(raw.oldValue) ? { oldValue: text(raw.oldValue) } : {}),
    ...(isString(raw.newValue) ? { newValue: text(raw.newValue) } : {}),
  };
}

function readLink(raw: Raw, isArtifact: (id: unknown) => id is string, isOperation: (id: unknown) => id is string): TraceLink | undefined {
  if (!isArtifact(raw.sourceId) || !isArtifact(raw.targetId) || !isOperation(raw.operationId) || !isString(raw.timestamp)) return undefined;
  if (!Array.isArray(raw.evidence) || raw.evidence.length > TRACE_LIMITS.perItem) return undefined;
  const evidence = raw.evidence.filter((e): e is TraceEvidence =>
    isObject(e) && isString(e.id) && isString(e.timestamp) && optional(e.logIds, (ids) => Array.isArray(ids) && ids.every(isString))
    && ((e.type === 'RuleEvidence' && isString(e.rule)) || (e.type === 'AIEvidence' && isString(e.algorithm))));
  const link = { ...(raw as unknown as TraceLink), evidence };
  setConfidence(link, raw.confidence);
  return link;
}

/** Keep `raw` as the item's confidence only when the views can show it: a value in [0, 1] and an explanation that
 *  is text, when there is one. Operations and links (and so the requirement verdicts read from them) use it. */
function setConfidence(item: { confidence?: TraceConfidence }, raw: unknown): void {
  const valid = isObject(raw) && isNumber(raw.value) && raw.value >= 0 && raw.value <= 1 && optional(raw.explanation, isString);
  if (valid) item.confidence = raw as unknown as TraceConfidence;
  else delete item.confidence;
}
