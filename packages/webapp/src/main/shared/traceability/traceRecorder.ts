import type {
  CodeArtifact,
  ConversationOperation,
  LogType,
  ModelArtifact,
  ModelingSessionOperation,
  PromptArtifact,
  RequirementArtifact,
  RequirementExtractionOperation,
  TraceActor,
  TraceChangeEvent,
  TraceFile,
  TraceOperation,
  TraceTool,
  TraceToolCall,
} from '../types/traceability';
import { isCodeArtifact, isModelArtifact, isModelingSession, toolIdsOf } from '../types/traceability';
import type { AssistantRequirements } from './assistantRequirements';
import { findNamedElement } from './classModelDiff';
import { turnExtractionId, turnPromptId } from './traceQueries';
import type { ClassModelLike, ElementChange } from './classModelDiff';

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
/** The LLM the assistant answers with. The assistant does not report the model it ran, so the trace
 *  assumes the modeling agent's default for class diagrams and its classifier (`MODEL_GENERATION_SMALL`
 *  and `MODEL_CLASSIFIER` in its `model_config.py`); a deployment or a user's own key can change it. */
export const ASSISTANT_LLM_NAME = 'gpt-6-luna';
export const ASSISTANT_LLM_PROVIDER = 'openai';
/** A conversation message longer than this is cut in the trace (a pasted document would otherwise fill it). */
export const MAX_LOGGED_MESSAGE_CHARS = 10_000;
/** How much of a request names its prompt artifact. */
const PROMPT_NAME_CHARS = 60;
/** Why a requirement comes from a prompt, when its quote is found in the prompt's text. */
export const REQUIREMENT_QUOTE_RULE = 'requirement quote found in the prompt';

/** Who made an edit: the user alone, or the assistant for the user (both are recorded as actors). */
export type ModelingSource = 'user' | 'assistant';

export interface RecordContext {
  diagramId: string;
  diagramTitle: string;
  actorName: string;
  source: ModelingSource;
  /** ISO 8601 UTC. */
  now: string;
  /** The assistant request these edits answer: what the edited elements are linked from. */
  request?: AssistantRequest;
  /** The requirements the assistant extracted while answering `request`, with the elements realizing each one. */
  requirements?: AssistantRequirements;
  /** The request whose text states the requirements of `request`'s turn (every quote is in it): `request`
   *  itself, or an earlier one the assistant rebuilt the model from (a confirmed replace, an "Update model +
   *  generate"), which the turn's edits are then linked from too; undefined when no request this tab recorded
   *  states them, or the turn extracted none. */
  requirementsRequest?: AssistantRequest;
  /** The model after these edits, where the elements realizing `requirements` are looked up. */
  model?: ClassModelLike;
}

/** A request to the assistant: the turn (tool call) it opened, its message and the hash of its full text. */
export interface AssistantRequest {
  callId: string;
  logId: string;
  text: string;
  contentHash: string;
}

/** What the assistant sent back during a turn. */
export type AssistantReplyKind = 'progress' | 'answer' | 'error';

const REPLY_LOG_TYPES: Record<AssistantReplyKind, LogType> = {
  progress: 'INTERMEDIATE_MESSAGE',
  answer: 'OUTPUT_RESPONSE',
  error: 'ERROR',
};

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

function ensureTool(
  trace: TraceFile, type: TraceTool['type'], name: string, now: string, version?: string, provider?: string,
): TraceTool {
  let tool = trace.tools.find((t) => t.type === type && t.name === name && t.version === version);
  if (!tool) {
    tool = { id: newId(), type, name, timestamp: now, ...(version ? { version } : {}), ...(provider ? { provider } : {}) };
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

/** The open modeling session of these actors, or a new one (with one call to the editor, which lasts as
 *  long as the session) when the last operation is another one or idle. */
function sessionFor(trace: TraceFile, ctx: RecordContext, actorIds: string[], editorId: string): ModelingSessionOperation {
  const last = trace.operations[trace.operations.length - 1];
  const lastActivity = last ? ms(last.endedAt ?? last.startedAt) : 0;
  if (
    isModelingSession(last) &&
    sameIds(last.performedBy, actorIds) &&
    ms(ctx.now) - lastActivity <= SESSION_IDLE_MS
  ) {
    return last;
  }
  const session: ModelingSessionOperation = {
    id: newId(), type: 'ModelingSession', status: 'SUCCEEDED', startedAt: ctx.now, endedAt: ctx.now,
    performedBy: actorIds, reads: [], writes: [], changes: [],
    toolCalls: [{ id: newId(), toolId: editorId, sequenceNumber: 0, status: 'SUCCEEDED', startedAt: ctx.now, endedAt: ctx.now, logs: [] }],
  };
  trace.operations.push(session);
  return session;
}

function lastChange(session: ModelingSessionOperation, match: (c: TraceChangeEvent) => boolean): TraceChangeEvent | undefined {
  for (let i = session.changes.length - 1; i >= 0; i -= 1) {
    if (match(session.changes[i])) return session.changes[i];
  }
  return undefined;
}

/** Fold an update into an earlier change of the session when the merging rules say so. Returns true when folded. */
function foldUpdate(session: ModelingSessionOperation, artifactId: string, change: ElementChange, now: string): boolean {
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
  const session = sessionFor(trace, ctx, actors.map((a) => a.id), editor.id);

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
  for (const call of session.toolCalls) if (call.toolId === editor.id) call.endedAt = ctx.now;
  if (session.changes.length === 0) {
    trace.operations.splice(trace.operations.indexOf(session), 1);
    return;
  }
  if (ctx.source === 'assistant' && ctx.request) {
    const touched = changes.filter((c) => c.kind !== 'DELETED').map((c) => findModelArtifact(trace, c.elementId)!);
    if (ctx.requirements) linkRequirements(trace, session, ctx, ctx.request, ctx.requirements);
    // An element a requirement of this turn realizes comes from the prompt through that requirement; the
    // others come from the prompt directly: the request the model was built from, else the turn's own.
    const realized = realizedInTurn(trace, ctx.request);
    const builtFrom =
      ctx.requirementsRequest && conversationOf(trace, ctx.requirementsRequest) ? ctx.requirementsRequest : ctx.request;
    linkRequest(trace, session, builtFrom, touched.filter((a) => !realized.has(a.id)), ctx.now);
  }
}

/* ------------------------------------------------------------------ conversations with the assistant */

const capped = (text: string): string =>
  text.length <= MAX_LOGGED_MESSAGE_CHARS
    ? text
    : `${text.slice(0, MAX_LOGGED_MESSAGE_CHARS)}… [${text.length - MAX_LOGGED_MESSAGE_CHARS} more characters not kept]`;

/** The conversation under way: the last one that has not ended. */
function openConversation(trace: TraceFile): ConversationOperation | undefined {
  for (let i = trace.operations.length - 1; i >= 0; i -= 1) {
    const operation = trace.operations[i];
    if (operation.type === 'Conversation') return operation.status === 'RUNNING' ? operation : undefined;
  }
  return undefined;
}

const lastActivity = (conversation: ConversationOperation): string =>
  conversation.toolCalls
    .flatMap((call) => [call.startedAt, call.endedAt ?? '', ...call.logs.map((log) => log.timestamp)])
    .reduce((latest, time) => (time > latest ? time : latest), conversation.startedAt);

/** A turn that got no reply is cancelled: its request is kept, as what it was. */
function cancelUnanswered(conversation: ConversationOperation): void {
  for (const call of conversation.toolCalls) {
    if (call.status !== 'RUNNING') continue;
    call.status = 'CANCELLED';
    call.endedAt = call.logs[call.logs.length - 1]?.timestamp ?? call.startedAt;
  }
}

function closeConversation(conversation: ConversationOperation): void {
  cancelUnanswered(conversation);
  conversation.status = 'SUCCEEDED';
  conversation.endedAt = lastActivity(conversation);
}

/**
 * Record a request to the assistant: a new turn, a call to the assistant's LLM opened by the request.
 * The conversation goes on until it is ended (a new chat) or idle as long as a modeling session.
 */
export function recordConversationRequest(
  trace: TraceFile, text: string, ctx: { actorName: string; now: string },
): { callId: string; logId: string } {
  let conversation = openConversation(trace);
  if (conversation && ms(ctx.now) - ms(lastActivity(conversation)) > SESSION_IDLE_MS) {
    closeConversation(conversation);
    conversation = undefined;
  }
  if (!conversation) {
    const actors = [ensureActor(trace, 'Person', ctx.actorName, ctx.now), ensureActor(trace, 'Agent', ASSISTANT_AGENT_NAME, ctx.now)];
    conversation = {
      id: newId(), type: 'Conversation', status: 'RUNNING', startedAt: ctx.now,
      performedBy: actors.map((a) => a.id), toolCalls: [], reads: [], writes: [],
    };
    trace.operations.push(conversation);
  }
  cancelUnanswered(conversation);
  const llm = ensureTool(trace, 'LLM', ASSISTANT_LLM_NAME, ctx.now, undefined, ASSISTANT_LLM_PROVIDER);
  const log = { id: newId(), content: capped(text), sequenceNumber: 0, logType: 'INPUT_REQUEST' as const, timestamp: ctx.now };
  const call: TraceToolCall = {
    id: newId(), toolId: llm.id, sequenceNumber: conversation.toolCalls.length, status: 'RUNNING', startedAt: ctx.now, logs: [log],
  };
  conversation.toolCalls.push(call);
  return { callId: call.id, logId: log.id };
}

/** Record what the assistant sent back in the last turn; an answer or an error ends the turn (a later
 *  reply of the same turn, such as the message after an edit, is still added to it). */
export function recordConversationReply(trace: TraceFile, kind: AssistantReplyKind, text: string, now: string): boolean {
  const calls = openConversation(trace)?.toolCalls ?? [];
  const call = calls[calls.length - 1];
  // A reply before any request (a greeting when the assistant connects) belongs to no turn.
  if (!call) return false;
  call.logs.push({ id: newId(), content: capped(text), sequenceNumber: call.logs.length, logType: REPLY_LOG_TYPES[kind], timestamp: now });
  if (kind !== 'progress') {
    call.status = kind === 'error' ? 'FAILED' : 'SUCCEEDED';
    call.endedAt = now;
  }
  return true;
}

/** End the conversation under way (a new chat starts). */
export function endConversation(trace: TraceFile): boolean {
  const conversation = openConversation(trace);
  if (conversation) closeConversation(conversation);
  return conversation !== undefined;
}

/** The conversation holding `request`'s turn, or undefined when the turn is not in this trace. */
function conversationOf(trace: TraceFile, request: AssistantRequest): ConversationOperation | undefined {
  return trace.operations.find(
    (operation): operation is ConversationOperation =>
      operation.type === 'Conversation' && operation.toolCalls.some((call) => call.id === request.callId),
  );
}

const promptIdOf = (request: AssistantRequest): string => turnPromptId(request.callId);

/** The id of `request`'s prompt artifact, written by the conversation holding its turn; made on first use.
 *  Undefined when the turn is not in this project's trace. */
function ensurePrompt(trace: TraceFile, request: AssistantRequest): string | undefined {
  const conversation = conversationOf(trace, request);
  if (!conversation) return undefined;
  const promptId = promptIdOf(request);
  if (!trace.artifacts.some((a) => a.id === promptId)) {
    const firstLine = request.text.trim().split('\n')[0];
    const prompt: PromptArtifact = {
      id: promptId, type: 'PromptArtifact', contentHash: request.contentHash, content: capped(request.text),
      name: firstLine.length > PROMPT_NAME_CHARS ? `${firstLine.slice(0, PROMPT_NAME_CHARS)}…` : firstLine,
      timestamp: conversation.toolCalls.find((call) => call.id === request.callId)!.startedAt,
    };
    trace.artifacts.push(prompt);
    conversation.writes.push(promptId);
  }
  return promptId;
}

/**
 * The elements a requirement extracted in `request`'s turn is linked to, when those requirements are linked
 * from a prompt (their extraction read one): such an element comes from the prompt through them.
 */
function realizedInTurn(trace: TraceFile, request: AssistantRequest): Set<string> {
  const extraction = trace.operations.find((o) => o.id === turnExtractionId(request.callId));
  if (!extraction || extraction.reads.length === 0) return new Set();
  const requirements = new Set(extraction.writes);
  return new Set(trace.traceLinks.filter((link) => requirements.has(link.sourceId)).map((link) => link.targetId));
}

/**
 * Link the elements the assistant edited to the request they were built from: the request becomes a
 * prompt artifact the conversation wrote and the edits' session read, and each element gets a
 * link from it. An LLM decided the edits, so the evidence is the request's message; no confidence is
 * claimed, since the assistant reports none.
 */
function linkRequest(
  trace: TraceFile, session: ModelingSessionOperation, request: AssistantRequest, targets: ModelArtifact[], now: string,
): void {
  const promptId = ensurePrompt(trace, request);
  if (!promptId) return; // the turn is not in this project's trace
  if (!session.reads.includes(promptId)) session.reads.push(promptId);
  for (const target of new Set(targets)) {
    if (trace.traceLinks.some((link) => link.sourceId === promptId && link.targetId === target.id)) continue;
    trace.traceLinks.push({
      id: newId(), sourceId: promptId, targetId: target.id, operationId: session.id, timestamp: now,
      evidence: [{ id: newId(), type: 'AIEvidence', algorithm: ASSISTANT_LLM_NAME, logIds: [request.logId], timestamp: now }],
    });
  }
}

/**
 * The extraction made while answering `request`: the assistant's call to the LLM that extracted the
 * requirements, between the request and the reply, reading the prompt that states them (`promptId`; none
 * when no recorded request does). Made on the first reply that carries them; a replayed reply finds it by id.
 */
function ensureExtraction(
  trace: TraceFile, conversation: ConversationOperation, request: AssistantRequest, stated: AssistantRequirements,
  promptId: string | undefined, now: string,
): RequirementExtractionOperation {
  const id = turnExtractionId(request.callId);
  const existing = trace.operations.find((o): o is RequirementExtractionOperation => o.id === id && o.type === 'RequirementExtraction');
  if (existing) return existing;
  // An agent that does not name the model ran the one the whole conversation is assumed to run.
  const model = stated.model ?? { name: ASSISTANT_LLM_NAME, provider: ASSISTANT_LLM_PROVIDER };
  const llm = ensureTool(trace, 'LLM', model.name, now, undefined, model.provider);
  const startedAt = conversation.toolCalls.find((call) => call.id === request.callId)!.startedAt;
  const extraction: RequirementExtractionOperation = {
    id, type: 'RequirementExtraction', status: 'SUCCEEDED', startedAt, endedAt: now,
    performedBy: [ensureActor(trace, 'Agent', ASSISTANT_AGENT_NAME, now).id],
    toolCalls: [{ id: newId(), toolId: llm.id, sequenceNumber: 0, status: 'SUCCEEDED', startedAt, endedAt: now, logs: [] }],
    reads: promptId ? [promptId] : [], writes: [],
  };
  trace.operations.push(extraction);
  return extraction;
}

/**
 * Record the requirements the assistant extracted while answering a request, and what realizes them. The
 * extraction is an operation of its own ({@link ensureExtraction}) that writes each requirement. It reads the
 * prompt of the request whose text states them (`ctx.requirementsRequest`: on a resumed turn, the earlier
 * application request the assistant rebuilt from), and each requirement is linked from that prompt, the
 * evidence being its quote found there. When no recorded request states them, they are recorded without a
 * prompt, with a warning, rather than linked to a request that does not state them. Each element the
 * assistant says realizes a requirement gets a link from it, made by the edits' session, which reads it; an
 * element the model does not have is left out with a warning, so the requirement reads as not modeled.
 */
function linkRequirements(
  trace: TraceFile, session: ModelingSessionOperation, ctx: RecordContext, request: AssistantRequest,
  stated: AssistantRequirements,
): void {
  const conversation = conversationOf(trace, request);
  if (!conversation) return;
  const { now } = ctx;
  const promptId = ctx.requirementsRequest && ensurePrompt(trace, ctx.requirementsRequest);
  if (!promptId) {
    console.warn('No recorded request to the assistant states the requirements it extracted; they are recorded without their prompt.');
  }
  const extraction = ensureExtraction(trace, conversation, request, stated, promptId, now);
  const artifactIds = new Map(stated.requirements.map((r) => [r.id, `${request.callId}:${r.id}`]));

  for (const requirement of stated.requirements) {
    const id = artifactIds.get(requirement.id)!;
    if (trace.artifacts.some((a) => a.id === id)) continue; // a replayed reply
    const artifact: RequirementArtifact = {
      id, type: 'RequirementArtifact', name: requirement.text, quote: requirement.quote, kind: requirement.kind, timestamp: now,
    };
    trace.artifacts.push(artifact);
    extraction.writes.push(id);
    if (!promptId) continue;
    const evidence = [{ id: newId(), type: 'RuleEvidence' as const, rule: REQUIREMENT_QUOTE_RULE, timestamp: now }];
    trace.traceLinks.push({ id: newId(), sourceId: promptId, targetId: id, operationId: extraction.id, evidence, timestamp: now });
  }
  const aiEvidence = (algorithm: string) =>
    [{ id: newId(), type: 'AIEvidence' as const, algorithm, logIds: [request.logId], timestamp: now }];

  const diagram = findModelArtifact(trace, ctx.diagramId);
  for (const realization of stated.realizations) {
    const sourceId = artifactIds.get(realization.requirement);
    if (!sourceId) continue;
    for (const ref of realization.elements) {
      const elementId = findNamedElement(ctx.model, ref);
      if (!elementId) {
        console.warn(`Requirement ${realization.requirement} names ${ref.type} ${ref.name}, which the model does not have; it is not linked.`);
        continue;
      }
      // An element the edits did not touch (a merge into an existing model) enters the trace here.
      const target = ensureModelArtifact(trace, elementId, ref.type, ref.name, diagram?.id, now);
      if (trace.traceLinks.some((link) => link.sourceId === sourceId && link.targetId === target.id)) continue;
      if (!session.reads.includes(sourceId)) session.reads.push(sourceId);
      trace.traceLinks.push({
        id: newId(), sourceId, targetId: target.id, operationId: session.id, evidence: aiEvidence(ASSISTANT_LLM_NAME), timestamp: now,
      });
    }
  }
}

/**
 * Merge the trace fragment of a generation run (from the backend) into the project trace.
 *
 * Actors and tools are matched by type and name, model artifacts by element id
 * (so the generated code links to the elements the editor recorded); code
 * artifacts are new, since each run writes new output.
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
      toolCalls: op.toolCalls.map((call) => ({ ...call, toolId: mapped(call.toolId) })),
      reads: op.reads.map(mapped),
      writes: op.writes.map(mapped),
    };
    if (merged.type === 'ModelingSession') merged.changes = merged.changes.map((c) => ({ ...c, artifactId: mapped(c.artifactId) }));
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
    const generator = toolIdsOf(operation).join(',');
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
    for (const id of operation.writes) {
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
    operation.writes = operation.writes.filter((id) => !dropped.has(id));
    operation.reads = operation.reads.filter((id) => !dropped.has(id));
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
