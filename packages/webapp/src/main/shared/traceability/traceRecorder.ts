import type {
  CodeArtifact,
  ModelArtifact,
  ModelingOperation,
  TraceActor,
  TraceChange,
  TraceFile,
  TraceOperation,
  TraceTool,
} from '../types/traceability';
import { isCodeArtifact, isModelArtifact, isModeling } from '../types/traceability';
import type { ElementChange } from './classModelDiff';

/**
 * Writes what happened into a project trace. Every function here updates the
 * given trace in place; the store (`traceStore.ts`) owns the object and
 * publishes a new reference after each update.
 */

/** A modeling session ends after this long without an edit. */
export const SESSION_IDLE_MS = 10 * 60 * 1000;
/** Updates of the same feature this close together are one change (typing a name). */
export const COALESCE_MS = 5 * 1000;
/** Updates this soon after an element was created belong to its creation
 *  ("Created class Book", not "Created Class1, renamed to Book"). */
export const CREATION_FOLD_MS = 30 * 1000;
/** Generated files whose content is kept per path; older generations keep only their hash
 *  (browser storage is about 5 MB per origin). */
export const KEPT_CONTENTS_PER_PATH = 3;
/** Generation runs per generator whose trace links are kept. An older run keeps its operation and
 *  its files' hashes (what was generated, by whom, when), so the trace stops growing with every run;
 *  its links were superseded by the newer runs' anyway. */
export const KEPT_GENERATIONS_PER_GENERATOR = 5;

export const EDITOR_TOOL_NAME = 'BESSER Web Modeling Editor';
export const ASSISTANT_AGENT_NAME = 'BESSER modeling assistant';

/** Who made an edit: the user alone, or the assistant for the user (both are recorded as actors). */
export type ModelingSource = 'user' | 'assistant';

export interface RecordContext {
  diagramId: string;
  diagramTitle: string;
  actorName: string;
  source: ModelingSource;
  /** ISO 8601 UTC. */
  now: string;
}

const newId = (): string => crypto.randomUUID();
const ms = (iso: string): number => Date.parse(iso);

function ensureActor(trace: TraceFile, type: TraceActor['type'], name: string, now: string): TraceActor {
  let actor = trace.actors.find((a) => a.type === type && a.name === name);
  if (!actor) {
    actor = { id: newId(), type, name, timestamp: now };
    trace.actors.push(actor);
  }
  return actor;
}

function ensureTool(trace: TraceFile, type: TraceTool['type'], name: string, now: string, version?: string): TraceTool {
  let tool = trace.tools.find((t) => t.type === type && t.name === name && t.version === version);
  if (!tool) {
    tool = { id: newId(), type, name, timestamp: now, ...(version ? { version } : {}) };
    trace.tools.push(tool);
  }
  return tool;
}

/** The model artifact of `elementId`, or undefined. */
export function findModelArtifact(trace: TraceFile, elementId: string): ModelArtifact | undefined {
  return trace.artifacts.find((a): a is ModelArtifact => isModelArtifact(a) && a.elementId === elementId);
}

function ensureModelArtifact(
  trace: TraceFile, elementId: string, elementType: string, name: string, parentId: string | undefined, now: string,
): ModelArtifact {
  let artifact = findModelArtifact(trace, elementId);
  if (!artifact) {
    artifact = {
      id: newId(), type: 'ModelArtifact', name: name || elementType, elementId, elementType, timestamp: now,
      ...(parentId ? { parentId } : {}),
    };
    trace.artifacts.push(artifact);
  }
  return artifact;
}

function sameIds(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id) => b.includes(id));
}

/** The open modeling session of these actors, or a new one when the last operation is another one or idle. */
function sessionFor(trace: TraceFile, ctx: RecordContext, actorIds: string[], toolIds: string[]): ModelingOperation {
  const last = trace.operations[trace.operations.length - 1];
  const lastActivity = last ? ms(last.endedAt ?? last.startedAt) : 0;
  if (
    isModeling(last) &&
    sameIds(last.performedBy, actorIds) &&
    ms(ctx.now) - lastActivity <= SESSION_IDLE_MS
  ) {
    return last;
  }
  const session: ModelingOperation = {
    id: newId(), type: 'Modeling', status: 'SUCCEEDED', startedAt: ctx.now, endedAt: ctx.now,
    performedBy: actorIds, uses: toolIds, consumes: [], produces: [], changes: [], logs: [],
  };
  trace.operations.push(session);
  return session;
}

function lastChange(session: ModelingOperation, match: (c: TraceChange) => boolean): TraceChange | undefined {
  for (let i = session.changes.length - 1; i >= 0; i -= 1) {
    if (match(session.changes[i])) return session.changes[i];
  }
  return undefined;
}

/** Fold an update into an earlier change of the session when the merging rules say so. Returns true when folded. */
function foldUpdate(session: ModelingOperation, artifactId: string, change: ElementChange, now: string): boolean {
  // The element's latest creation or deletion: an update folds into a creation only while it still stands.
  const lifecycle = lastChange(session, (c) => c.artifactId === artifactId && c.kind !== 'UPDATED');
  const created = lifecycle?.kind === 'CREATED' ? lifecycle : undefined;
  if (created && ms(now) - ms(created.timestamp) <= CREATION_FOLD_MS) {
    if (change.feature === 'name') created.newValue = change.newValue;
    return true;
  }
  const previous = lastChange(session, (c) => c.artifactId === artifactId && c.feature === change.feature);
  if (previous?.kind === 'UPDATED' && ms(now) - ms(previous.timestamp) <= COALESCE_MS) {
    previous.newValue = change.newValue;
    previous.timestamp = now;
    if (previous.newValue === previous.oldValue) session.changes.splice(session.changes.indexOf(previous), 1);
    return true;
  }
  return false;
}

/** Record the changes of one model save into the trace. */
export function recordElementChanges(trace: TraceFile, changes: ElementChange[], ctx: RecordContext): void {
  if (changes.length === 0) return;
  const actors = [ensureActor(trace, 'Person', ctx.actorName, ctx.now)];
  if (ctx.source === 'assistant') actors.push(ensureActor(trace, 'Agent', ASSISTANT_AGENT_NAME, ctx.now));
  const editor = ensureTool(trace, 'Editor', EDITOR_TOOL_NAME, ctx.now);
  const model = ensureModelArtifact(trace, ctx.diagramId, 'DomainModel', ctx.diagramTitle, undefined, ctx.now);
  model.name = ctx.diagramTitle || model.name;
  const session = sessionFor(trace, ctx, actors.map((a) => a.id), [editor.id]);

  for (const change of changes) {
    // An owner that existed before recording started is recorded now, so its members are filed under it.
    const parent = change.parentElementId
      ? findModelArtifact(trace, change.parentElementId) ??
        (change.parent &&
          ensureModelArtifact(trace, change.parentElementId, change.parent.elementType, change.parent.name, model.id, ctx.now))
      : undefined;
    const artifact = ensureModelArtifact(
      trace, change.elementId, change.elementType, change.name, (parent ?? model).id, ctx.now,
    );
    if (change.kind !== 'DELETED' && change.name) artifact.name = change.name;
    if (change.feature === 'owner' && parent) artifact.parentId = parent.id;
    if (change.kind === 'UPDATED' && foldUpdate(session, artifact.id, change, ctx.now)) continue;
    session.changes.push({
      id: newId(), kind: change.kind, artifactId: artifact.id, timestamp: ctx.now,
      ...(change.feature !== undefined ? { feature: change.feature } : {}),
      ...(change.oldValue !== undefined ? { oldValue: change.oldValue } : {}),
      ...(change.newValue !== undefined ? { newValue: change.newValue } : {}),
    });
  }
  session.endedAt = ctx.now;
  if (session.changes.length === 0) trace.operations.splice(trace.operations.indexOf(session), 1);
}

/**
 * Merge the trace fragment of a generation run (from the backend) into the project trace.
 *
 * Actors and tools are matched by type and name, model artifacts by element id
 * (so the generated code links to the elements the editor recorded); code
 * artifacts are new, since each run produces new output.
 */
export function mergeTraceFragment(trace: TraceFile, fragment: TraceFile): void {
  const idMap = new Map<string, string>();
  const mapped = (id: string): string => idMap.get(id) ?? id;

  for (const actor of fragment.actors) idMap.set(actor.id, ensureActor(trace, actor.type, actor.name, actor.timestamp).id);
  for (const tool of fragment.tools) {
    idMap.set(tool.id, ensureTool(trace, tool.type, tool.name, tool.timestamp, tool.version).id);
  }
  for (const artifact of fragment.artifacts) {
    const existing = isModelArtifact(artifact) ? findModelArtifact(trace, artifact.elementId) : undefined;
    if (existing) {
      idMap.set(artifact.id, existing.id);
    } else {
      trace.artifacts.push({ ...artifact });
    }
  }
  for (const artifact of trace.artifacts) {
    if (artifact.parentId && idMap.has(artifact.parentId)) artifact.parentId = mapped(artifact.parentId);
  }
  for (const op of fragment.operations) {
    const merged: TraceOperation = {
      ...op,
      performedBy: op.performedBy.map(mapped),
      uses: op.uses.map(mapped),
      consumes: op.consumes.map(mapped),
      produces: op.produces.map(mapped),
      logs: op.logs.map((l) => ({ ...l, ...(l.toolId ? { toolId: mapped(l.toolId) } : {}) })),
    };
    if (merged.type === 'Modeling') merged.changes = merged.changes.map((c) => ({ ...c, artifactId: mapped(c.artifactId) }));
    trace.operations.push(merged);
  }
  for (const link of fragment.traceLinks) {
    trace.traceLinks.push({ ...link, sourceId: mapped(link.sourceId), targetId: mapped(link.targetId) });
  }
  const compacted = pruneOldGenerations(trace);
  if (compacted > 0) console.info(`Kept ${compacted} older generation run(s) as operation and file hashes only.`);
  pruneStoredContents(trace);
}

/**
 * Compact the generation runs older than the newest `keep` of each generator: drop their trace links
 * and their line-range fragments, and the content of their files. Their operation and their files
 * (with hashes) stay. Returns how many runs were compacted (each once).
 */
export function pruneOldGenerations(trace: TraceFile, keep: number = KEPT_GENERATIONS_PER_GENERATOR): number {
  const runsByGenerator = new Map<string, TraceOperation[]>();
  for (const operation of trace.operations) {
    if (operation.type !== 'CodeGeneration') continue;
    const generator = operation.uses.join(',');
    runsByGenerator.set(generator, [...(runsByGenerator.get(generator) ?? []), operation]);
  }
  const linked = new Set(trace.traceLinks.map((link) => link.operationId));
  const old = new Set<string>();
  for (const runs of runsByGenerator.values()) {
    runs.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    for (const run of runs.slice(keep)) if (linked.has(run.id)) old.add(run.id);
  }
  if (old.size === 0) return 0;

  const artifacts = new Map(trace.artifacts.map((a) => [a.id, a]));
  const dropped = new Set<string>();
  for (const operation of trace.operations) {
    if (!old.has(operation.id)) continue;
    for (const id of operation.produces) {
      const artifact = artifacts.get(id);
      if (!isCodeArtifact(artifact)) continue;
      if (artifact.parentId) dropped.add(id); // a line range: only its links gave it meaning
      else delete artifact.content;
    }
  }
  trace.traceLinks = trace.traceLinks.filter(
    (link) => !old.has(link.operationId) && !dropped.has(link.sourceId) && !dropped.has(link.targetId),
  );
  trace.artifacts = trace.artifacts.filter((a) => !dropped.has(a.id));
  for (const operation of trace.operations) {
    operation.produces = operation.produces.filter((id) => !dropped.has(id));
    operation.consumes = operation.consumes.filter((id) => !dropped.has(id));
  }
  return old.size;
}

/** Keep the content of the newest `KEPT_CONTENTS_PER_PATH` files per path; older ones keep their hash only.
 *  Returns how many contents were dropped. */
export function pruneStoredContents(trace: TraceFile, keep: number = KEPT_CONTENTS_PER_PATH): number {
  const byPath = new Map<string, CodeArtifact[]>();
  for (const artifact of trace.artifacts) {
    if (isCodeArtifact(artifact) && artifact.content !== undefined) {
      byPath.set(artifact.path, [...(byPath.get(artifact.path) ?? []), artifact]);
    }
  }
  let dropped = 0;
  for (const files of byPath.values()) {
    files.sort((a, b) => ms(b.timestamp) - ms(a.timestamp));
    for (const file of files.slice(keep)) {
      delete file.content;
      dropped += 1;
    }
  }
  return dropped;
}
