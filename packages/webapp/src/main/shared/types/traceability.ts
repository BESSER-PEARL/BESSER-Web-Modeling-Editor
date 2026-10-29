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
export const TRACE_SCHEMA_VERSION = 1;

export type OperationType =
  | 'MANUAL_MODELLING'
  | 'ASSISTANT_MODELLING'
  | 'IMPORT'
  | 'CODE_GENERATION'
  | 'LLM_CODE_EDITING'
  | 'VALIDATION';

export type OperationStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'TIMED_OUT';

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

export type TraceArtifact = ModelArtifact | CodeArtifact;

export interface TraceChange {
  id: string;
  kind: ChangeKind;
  artifactId: string;
  /** The changed feature (`name`, `type`, `multiplicity`, ...); UPDATED changes only. */
  feature?: string;
  oldValue?: string;
  newValue?: string;
  timestamp: string;
}

export interface TraceLogRecord {
  id: string;
  content: string;
  sequenceNumber: number;
  logType: LogType;
  toolId?: string;
  timestamp: string;
}

export interface TraceOperation {
  id: string;
  operationType: OperationType;
  status: OperationStatus;
  startedAt: string;
  endedAt?: string;
  performedBy: string[];
  uses: string[];
  consumes: string[];
  produces: string[];
  changes: TraceChange[];
  logs: TraceLogRecord[];
}

export type TraceEvidence =
  | { id: string; type: 'RuleEvidence'; rule: string; timestamp: string }
  | { id: string; type: 'AIEvidence'; algorithm: string; logIds: string[]; timestamp: string }
  | { id: string; type: 'ChangeEvidence'; changeIds: string[]; timestamp: string };

export interface TraceConfidence {
  id: string;
  value: number;
  basedOn: string[];
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
