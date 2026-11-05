/**
 * The trace file (`<project>.trace.json`): everything recorded for one project,
 * stored apart from the project itself.
 *
 * Mirrors the backend: the metamodel `besser/BUML/metamodel/traceability` and
 * its JSON form in `services/converters/buml_to_json/trace_converter.py`. A
 * change there is a change here. Element references are ids, timestamps are
 * ISO 8601 UTC strings (`Date.toISOString()`), optional fields are omitted.
 */

/** Mirrors `TRACE_SCHEMA_VERSION` in the backend's `constants.py`. */
export const TRACE_SCHEMA_VERSION = 4;

/** How an execution went: an operation, or one of its tool calls. */
export type ExecutionStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'TIMED_OUT';

export type ChangeKind = 'CREATED' | 'UPDATED' | 'DELETED';

export type LogType =
  | 'INPUT_REQUEST'
  | 'OUTPUT_RESPONSE'
  | 'INTERMEDIATE_MESSAGE'
  | 'TOOL_CALL'
  | 'TOOL_RESULT'
  | 'ERROR'
  | 'INFO';

export interface TraceActor {
  id: string;
  type: 'Person' | 'Agent';
  name: string;
  version?: string;
  timestamp: string;
}

export interface TraceTool {
  id: string;
  type: 'Editor' | 'CodeGenerator' | 'LLM';
  name: string;
  version?: string;
  provider?: string;
  timestamp: string;
}

interface ArtifactBase {
  id: string;
  name: string;
  /** The artifact this one is a fragment of (a class for an attribute, a file for a line range). */
  parentId?: string;
  timestamp: string;
}

/** A model or a model element, referenced by its editor element id. */
export interface ModelArtifact extends ArtifactBase {
  type: 'ModelArtifact';
  elementId: string;
  /** B-UML metaclass name: `DomainModel`, `Class`, `Property`, `BinaryAssociation`, ... */
  elementType: string;
}

/** A generated file, or a line range of one (1-based, inclusive). */
export interface CodeArtifact extends ArtifactBase {
  type: 'CodeArtifact';
  path: string;
  contentHash: string;
  /** Kept only for files up to the server's size cap. */
  content?: string;
  startLine?: number;
  endLine?: number;
}

/** A message given to an agent, kept as an artifact because something was derived from it. */
export interface PromptArtifact extends ArtifactBase {
  type: 'PromptArtifact';
  content: string;
  contentHash: string;
}

export type TraceArtifact = ModelArtifact | CodeArtifact | PromptArtifact;

export interface TraceChangeEvent {
  id: string;
  kind: ChangeKind;
  artifactId: string;
  /** The changed feature (`name`, `type`, `multiplicity`, ...); UPDATED changes only. */
  feature?: string;
  oldValue?: string;
  newValue?: string;
  timestamp: string;
}

/** One message exchanged in a tool call (a prompt, an answer, an error). */
export interface TraceLogRecord {
  id: string;
  content: string;
  /** Position within its call. */
  sequenceNumber: number;
  logType: LogType;
  timestamp: string;
}

/** One use of a tool within an operation (an LLM prompted, a generator run, an editor session),
 *  with the messages exchanged with it. An operation reaches its tools only through these. */
export interface TraceToolCall {
  id: string;
  toolId: string;
  /** Position within its operation. */
  sequenceNumber: number;
  status: ExecutionStatus;
  startedAt: string;
  endedAt?: string;
  logs: TraceLogRecord[];
  /** Tokens an LLM read and wrote, when reported (what the call cost); only on a call to an LLM. */
  inputTokens?: number;
  outputTokens?: number;
}

interface OperationBase {
  id: string;
  status: ExecutionStatus;
  startedAt: string;
  endedAt?: string;
  /** A Person, an Agent, or both: who did the work tells manual from assistant modeling. */
  performedBy: string[];
  toolCalls: TraceToolCall[];
  reads: string[];
  writes: string[];
  /** How sure its result is; left out when not assessed (none is computed yet). */
  confidence?: TraceConfidence;
}

/** Edits made to models, change by change. */
export interface ModelingSessionOperation extends OperationBase {
  type: 'ModelingSession';
  changes: TraceChangeEvent[];
}

/** A generator run: code derived from models (a Transformation in the metamodel). */
export interface CodeGenerationOperation extends OperationBase {
  type: 'CodeGeneration';
}

/** A dialogue between a user and an agent: each turn is a call to the agent's LLM, holding the turn's
 *  messages. It may read prompts and write artifacts (requirements), or write nothing. */
export interface ConversationOperation extends OperationBase {
  type: 'Conversation';
}

/** An operation is one of these, told apart by `type` (the metamodel class name). */
export type TraceOperation = ModelingSessionOperation | CodeGenerationOperation | ConversationOperation;

export const isModelingSession = (operation: TraceOperation | undefined): operation is ModelingSessionOperation =>
  operation?.type === 'ModelingSession';

/** The changes of an operation: only a ModelingSession has any. */
export const changesOf = (operation: TraceOperation): TraceChangeEvent[] => (isModelingSession(operation) ? operation.changes : []);

/** `Operation./tools`, derived: the ids of the distinct tools its calls invoked, in call order. */
export const toolIdsOf = (operation: TraceOperation): string[] => [...new Set(operation.toolCalls.map((call) => call.toolId))];

/** An operation's messages, call by call, each call's in order. */
export const logsOf = (operation: TraceOperation): TraceLogRecord[] =>
  [...operation.toolCalls]
    .sort((a, b) => a.sequenceNumber - b.sequenceNumber)
    .flatMap((call) => [...call.logs].sort((a, b) => a.sequenceNumber - b.sequenceNumber));

/** Why a link holds: a deterministic rule, or an AI decision. Any evidence can rest on log records
 *  (`logIds`, left out when there are none). */
export type TraceEvidence =
  | { id: string; type: 'RuleEvidence'; rule: string; logIds?: string[]; timestamp: string }
  | { id: string; type: 'AIEvidence'; algorithm: string; logIds?: string[]; timestamp: string };

export interface TraceConfidence {
  id: string;
  value: number;
  explanation?: string;
  timestamp: string;
}

export interface TraceLink {
  id: string;
  sourceId: string;
  targetId: string;
  operationId: string;
  evidence: TraceEvidence[];
  confidence?: TraceConfidence;
  timestamp: string;
}

export interface TraceFile {
  schemaVersion: number;
  /** Null on a fragment not yet merged into a project trace (a generation run's). */
  projectId: string | null;
  actors: TraceActor[];
  tools: TraceTool[];
  artifacts: TraceArtifact[];
  operations: TraceOperation[];
  traceLinks: TraceLink[];
}

export const emptyTraceFile = (projectId: string): TraceFile => ({
  schemaVersion: TRACE_SCHEMA_VERSION,
  projectId,
  actors: [],
  tools: [],
  artifacts: [],
  operations: [],
  traceLinks: [],
});

export const isModelArtifact = (a: TraceArtifact | undefined): a is ModelArtifact => a?.type === 'ModelArtifact';
export const isCodeArtifact = (a: TraceArtifact | undefined): a is CodeArtifact => a?.type === 'CodeArtifact';
export const isPromptArtifact = (a: TraceArtifact | undefined): a is PromptArtifact => a?.type === 'PromptArtifact';
