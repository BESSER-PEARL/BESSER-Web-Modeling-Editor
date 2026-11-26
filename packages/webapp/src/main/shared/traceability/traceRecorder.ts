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
import { llmKeyRedactor } from '../services/llmKeyStorage';
import { changesOf, isCodeArtifact, isModelArtifact, isModelingSession, toolIdsOf } from '../types/traceability';
import type { AssistantRequirements } from './assistantRequirements';
import { findNamedElement } from './classModelDiff';
import { MAX_PARENT_DEPTH, turnExtractionId, turnPromptId } from './traceQueries';
import type { ClassModelLike } from './classModelDiff';
import type { ElementChange } from './modelDiff';
import type { BoundElement } from './guiModelDiff';
import type { TraceArtifact } from '../types/traceability';

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
/** Generation runs per generator kept at all. A run older than these is removed with the files it wrote, so the
 *  operations and file artifacts of generation stop growing too (see {@link pruneOldGenerations}). */
export const KEPT_GENERATION_RECORDS_PER_GENERATOR = 20;

export const EDITOR_TOOL_NAME = 'BESSER Web Modeling Editor';
export const ASSISTANT_AGENT_NAME = 'BESSER modeling assistant';
/** The LLM a turn of the assistant is filed under until the agent reports the model it ran (`llmUsage` on a
 *  terminal reply, see {@link recordConversationReply}); it stays when the agent never reports it (an older
 *  agent). It names no real model on purpose: the deployment, or the user's own key, decides which one ran. */
export const UNKNOWN_ASSISTANT_LLM_NAME = 'unknown model (not reported by the assistant)';
/** The Spec-Driven Agent, an agent of its own in the trace. */
export const SPEC_DRIVEN_AGENT_NAME = 'BESSER Spec-Driven Agent';
/** A conversation message longer than this is cut in the trace (a pasted document would otherwise fill it). */
export const MAX_LOGGED_MESSAGE_CHARS = 10_000;
/** How much of a request names its prompt artifact. */
const PROMPT_NAME_CHARS = 60;
/** Why a requirement comes from a prompt, when its quote is found in the prompt's text. */
export const REQUIREMENT_QUOTE_RULE = 'requirement quote found in the prompt';
/** Why a GUI element comes from a class-diagram element: it is bound to it (a table's data source, a column's
 *  attribute, a button's method). */
export const GUI_BINDING_RULE = 'GUI element bound to the model element';
/** The model generator that derives a GUI from a class diagram (the GUI editor's auto-generation). */
export const GUI_GENERATOR_NAME = 'BESSER GUI generator';

/** Who made an edit: the user alone, or the assistant for the user (both are recorded as actors). */
export type ModelingSource = 'user' | 'assistant';

export interface RecordContext {
  diagramId: string;
  diagramTitle: string;
  /** The diagram's B-UML model class: `DomainModel` (the default) for a class diagram, `GUIModel` for a GUI. */
  modelType?: string;
  /** What each changed element is bound to in another model (a GUI element's class-diagram elements), by
   *  element id: each gets a link from what it is bound to. */
  bindings?: Map<string, BoundElement[]>;
  /** The diagram holding the bound elements. */
  boundModel?: { id: string; title: string; modelType: string };
  /** Why a bound element's link holds (the evidence's rule); {@link GUI_BINDING_RULE} when unset. */
  bindingRule?: string;
  /** The model generator that derived these changes in one run (a GUI generated from its class diagram), when
   *  they were not made in the editor: their session calls it, and is never merged with another. */
  generatorName?: string;
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

/** The tool of this type, name, version and provider, made on first use: the same model name served by two
 *  providers is two tools. */
function ensureTool(
  trace: TraceFile, type: TraceTool['type'], name: string, now: string, version?: string, provider?: string,
): TraceTool {
  let tool = trace.tools.find((t) => t.type === type && t.name === name && t.version === version && t.provider === provider);
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

/** The open editor session of these actors, or a new one (with one call to `tool`, which lasts as long as the
 *  session) when the last operation is another one or idle. A generator's run is a session of its own: edits
 *  made after it are not part of it, so they mark its links out of date. */
function sessionFor(trace: TraceFile, ctx: RecordContext, actorIds: string[], tool: TraceTool): ModelingSessionOperation {
  const last = trace.operations[trace.operations.length - 1];
  const lastActivity = last ? ms(last.endedAt ?? last.startedAt) : 0;
  if (
    tool.type === 'Editor' &&
    isModelingSession(last) &&
    sameIds(last.performedBy, actorIds) &&
    sameIds(toolIdsOf(last), [tool.id]) &&
    ms(ctx.now) - lastActivity <= SESSION_IDLE_MS
  ) {
    return last;
  }
  const session: ModelingSessionOperation = {
    id: newId(), type: 'ModelingSession', status: 'SUCCEEDED', startedAt: ctx.now, endedAt: ctx.now,
    performedBy: actorIds, reads: [], writes: [], changes: [],
    toolCalls: [{ id: newId(), toolId: tool.id, sequenceNumber: 0, status: 'SUCCEEDED', startedAt: ctx.now, endedAt: ctx.now, logs: [] }],
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

/** Record the changes of one model save, or of one generator run (`ctx.generatorName`), into the trace. */
export function recordElementChanges(trace: TraceFile, changes: ElementChange[], ctx: RecordContext): void {
  if (changes.length === 0) return;
  const actors = [ensureActor(trace, 'Person', ctx.actorName, ctx.now)];
  if (ctx.source === 'assistant') actors.push(ensureActor(trace, 'Agent', ASSISTANT_AGENT_NAME, ctx.now));
  const tool = ctx.generatorName
    ? ensureTool(trace, 'ModelGenerator', ctx.generatorName, ctx.now)
    : ensureTool(trace, 'Editor', EDITOR_TOOL_NAME, ctx.now);
  const model = ensureModelArtifact(trace, ctx.diagramId, ctx.modelType ?? 'DomainModel', ctx.diagramTitle, undefined, ctx.now);
  model.name = ctx.diagramTitle || model.name;
  const session = sessionFor(trace, ctx, actors.map((a) => a.id), tool);

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
    // The artifact has the element's current metaclass (it changes when the element is retyped).
    if (change.kind !== 'DELETED' && change.elementType && artifact.elementType !== change.elementType) artifact.elementType = change.elementType;
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
  for (const call of session.toolCalls) if (call.toolId === tool.id) call.endedAt = ctx.now;
  if (session.changes.length === 0) {
    trace.operations.splice(trace.operations.indexOf(session), 1);
    return;
  }
  linkBindings(trace, session, changes.filter((c) => c.kind === 'CREATED' || c.feature === 'bindings'), ctx);
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

/**
 * Link each element of `changes` to what it is bound to in another model (`ctx.bindings`): a GUI table to the
 * class it shows, a column's attribute. The operation reads those elements; the evidence is the binding. A link
 * already there is not repeated (a generator run makes it again); one to an element no longer bound stays, as
 * what the element was derived from then (the edit since marks it out of date).
 */
function linkBindings(trace: TraceFile, operation: TraceOperation, changes: ElementChange[], ctx: RecordContext): void {
  if (!ctx.bindings || !ctx.boundModel) return;
  const boundModel = ensureModelArtifact(trace, ctx.boundModel.id, ctx.boundModel.modelType, ctx.boundModel.title, undefined, ctx.now);
  for (const change of changes) {
    const target = findModelArtifact(trace, change.elementId);
    if (!target) continue;
    for (const bound of ctx.bindings.get(change.elementId) ?? []) {
      const owner = bound.parent
        ? ensureModelArtifact(trace, bound.parent.elementId, bound.parent.elementType, bound.parent.name, boundModel.id, ctx.now)
        : undefined;
      const source = ensureModelArtifact(trace, bound.elementId, bound.elementType, bound.name, (owner ?? boundModel).id, ctx.now);
      if (!operation.reads.includes(source.id)) operation.reads.push(source.id);
      const evidence = [{ id: newId(), type: 'RuleEvidence' as const, rule: ctx.bindingRule ?? GUI_BINDING_RULE, timestamp: ctx.now }];
      const existing = trace.traceLinks.find((link) => link.sourceId === source.id && link.targetId === target.id);
      if (existing && ctx.generatorName) {
        // A generator run that derives the element again makes the link again: it holds from this run on.
        Object.assign(existing, { operationId: operation.id, timestamp: ctx.now, evidence });
        continue;
      }
      if (existing) continue;
      trace.traceLinks.push({
        id: newId(), sourceId: source.id, targetId: target.id, operationId: operation.id, timestamp: ctx.now, evidence,
      });
    }
  }
}



/* ------------------------------------------------------------------ conversations with the assistant */

/** A message as the trace keeps it: without the stored LLM key (the user may have pasted it into the chat), cut to
 *  {@link MAX_LOGGED_MESSAGE_CHARS}. */
const capped = (raw: string): string => {
  const text = llmKeyRedactor()(raw);
  return text.length <= MAX_LOGGED_MESSAGE_CHARS
    ? text
    : `${text.slice(0, MAX_LOGGED_MESSAGE_CHARS)}… [${text.length - MAX_LOGGED_MESSAGE_CHARS} more characters not kept]`;
};

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
  const llm = ensureTool(trace, 'LLM', UNKNOWN_ASSISTANT_LLM_NAME, ctx.now);
  const log = { id: newId(), content: capped(text), sequenceNumber: 0, logType: 'INPUT_REQUEST' as const, timestamp: ctx.now };
  const call: TraceToolCall = {
    id: newId(), toolId: llm.id, sequenceNumber: conversation.toolCalls.length, status: 'RUNNING', startedAt: ctx.now, logs: [log],
  };
  conversation.toolCalls.push(call);
  return { callId: call.id, logId: log.id };
}

/** Record what the assistant sent back in the last turn; an answer or an error ends the turn (a later
 *  reply of the same turn, such as the message after an edit, is still added to it). `usage`, which a terminal
 *  reply may carry, is the turn's LLM and token totals: see {@link recordTurnUsage}. */
export function recordConversationReply(
  trace: TraceFile, kind: AssistantReplyKind, text: string, now: string, usage?: LlmUsage,
): boolean {
  const calls = openConversation(trace)?.toolCalls ?? [];
  const call = calls[calls.length - 1];
  // A reply before any request (a greeting when the assistant connects) belongs to no turn.
  if (!call) return false;
  if (text.trim()) {
    call.logs.push({ id: newId(), content: capped(text), sequenceNumber: call.logs.length, logType: REPLY_LOG_TYPES[kind], timestamp: now });
  }
  if (kind !== 'progress') {
    call.status = kind === 'error' ? 'FAILED' : 'SUCCEEDED';
    call.endedAt = now;
  }
  if (usage) recordTurnUsage(trace, call, usage, now);
  return true;
}

/** The LLM and the tokens of a turn, as the modeling agent reports them (`llmUsage`: the totals of the turn's
 *  LLM calls). */
export interface LlmUsage {
  model: string;
  provider?: string;
  inputTokens?: number;
  outputTokens?: number;
}

/**
 * File a turn under the LLM the agent reports, with its token totals (the latest report of the turn wins: each
 * carries the totals so far). The AI evidence of the links the turn made names the reported model from then on,
 * and the placeholder tool is dropped once no call uses it.
 */
function recordTurnUsage(trace: TraceFile, call: TraceToolCall, usage: LlmUsage, now: string): void {
  const previous = trace.tools.find((t) => t.id === call.toolId);
  const llm = ensureTool(trace, 'LLM', usage.model, now, undefined, usage.provider);
  call.toolId = llm.id;
  if (usage.inputTokens !== undefined) call.inputTokens = usage.inputTokens;
  if (usage.outputTokens !== undefined) call.outputTokens = usage.outputTokens;
  if (!previous || previous.id === llm.id) return;
  const turnLogs = new Set(call.logs.map((log) => log.id));
  for (const link of trace.traceLinks) {
    for (const evidence of link.evidence) {
      if (evidence.type === 'AIEvidence' && evidence.algorithm === previous.name && evidence.logIds?.some((id) => turnLogs.has(id))) {
        evidence.algorithm = llm.name;
      }
    }
  }
  const stillUsed = trace.operations.some((operation) => operation.toolCalls.some((c) => c.toolId === previous.id));
  if (!stillUsed) trace.tools.splice(trace.tools.indexOf(previous), 1);
}

/** The name of the LLM `request`'s turn is filed under (the reported one, else the placeholder). */
function turnLlmName(trace: TraceFile, request: AssistantRequest): string {
  const call = conversationOf(trace, request)?.toolCalls.find((c) => c.id === request.callId);
  return trace.tools.find((t) => t.id === call?.toolId)?.name ?? UNKNOWN_ASSISTANT_LLM_NAME;
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
    const content = capped(request.text);
    const firstLine = content.trim().split('\n')[0];
    const prompt: PromptArtifact = {
      id: promptId, type: 'PromptArtifact', contentHash: request.contentHash, content,
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
      evidence: [{ id: newId(), type: 'AIEvidence', algorithm: turnLlmName(trace, request), logIds: [request.logId], timestamp: now }],
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
  // An agent that does not name the extraction's model ran the one its turn is filed under.
  const turnCall = conversation.toolCalls.find((call) => call.id === request.callId);
  const llm = stated.model
    ? ensureTool(trace, 'LLM', stated.model.name, now, undefined, stated.model.provider)
    : trace.tools.find((t) => t.id === turnCall?.toolId) ?? ensureTool(trace, 'LLM', UNKNOWN_ASSISTANT_LLM_NAME, now);
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
        id: newId(), sourceId, targetId: target.id, operationId: session.id, evidence: aiEvidence(turnLlmName(trace, request)), timestamp: now,
      });
    }
  }
}

/**
 * Merge a trace fragment (a generation run's from the backend, or a Spec-Driven run's) into the project trace.
 *
 * - Actors are matched by type and name, tools by type, name, version and provider.
 * - A model artifact is matched by element id, so generated code links to the elements the editor recorded; a
 *   fragment may read several models of any diagram type (one root per diagram, its id as `elementId`).
 * - Any other artifact whose id the trace already has (a RequirementArtifact the editor sent to a Spec-Driven
 *   run, a prompt) is that artifact: the fragment's links join it rather than duplicate it.
 * - Code artifacts are new, since each run writes new output; operations and links already in the trace (a
 *   fragment merged again, after a run was reattached) are not added twice.
 * - An operation the trace already has is replaced in place, with what it wrote and its links, when the trace's
 *   one is a Spec-Driven stream summary ({@link isStreamSummary}: the backend's trace always beats it) or a
 *   Spec-Driven run that ended earlier than the incoming one: a resumed Spec-Driven run keeps its id, and the backend builds each `done.trace`
 *   from the run's whole, append-only run log, so the later fragment holds everything the earlier one did. An
 *   incoming Spec-Driven run that ended no later is the one already merged: when every operation of the fragment
 *   is, the fragment is left out whole (an older fragment arriving late adds no orphan files).
 *
 * The cost is linear in the fragment plus one pass over the trace to index it.
 */
export function mergeTraceFragment(trace: TraceFile, fragment: TraceFile): void {
  const replaced = supersededOperations(trace, fragment);
  if (replaced === null) return;
  for (const old of replaced.values()) removeOperationOutput(trace, old);

  const idMap = new Map<string, string>();
  const mapped = (id: string): string => idMap.get(id) ?? id;
  const byId = new Map(trace.artifacts.map((a) => [a.id, a]));
  const byElementId = new Map<string, ModelArtifact>();
  for (const artifact of trace.artifacts) {
    if (isModelArtifact(artifact) && !byElementId.has(artifact.elementId)) byElementId.set(artifact.elementId, artifact);
  }

  for (const actor of fragment.actors ?? []) idMap.set(actor.id, ensureActor(trace, actor.type, actor.name, actor.timestamp).id);
  for (const tool of fragment.tools ?? []) {
    idMap.set(tool.id, ensureTool(trace, tool.type, tool.name, tool.timestamp, tool.version, tool.provider).id);
  }
  const added: TraceArtifact[] = [];
  for (const artifact of fragment.artifacts ?? []) {
    const existing = isModelArtifact(artifact) ? byElementId.get(artifact.elementId) : byId.get(artifact.id);
    if (existing && existing.type === artifact.type) {
      idMap.set(artifact.id, existing.id);
      continue;
    }
    const copy = { ...artifact };
    trace.artifacts.push(copy);
    added.push(copy);
    byId.set(copy.id, copy);
    if (isModelArtifact(copy)) byElementId.set(copy.elementId, copy);
  }
  // Only the fragment's own artifacts can refer to its ids.
  for (const artifact of added) {
    if (artifact.parentId) artifact.parentId = mapped(artifact.parentId);
    if (isCodeArtifact(artifact) && artifact.revisionOfId) artifact.revisionOfId = mapped(artifact.revisionOfId);
  }
  const operationIds = new Set(trace.operations.map((o) => o.id));
  for (const op of fragment.operations ?? []) {
    if (operationIds.has(op.id) && !replaced.has(op.id)) continue;
    const merged: TraceOperation = {
      ...op,
      performedBy: op.performedBy.map(mapped),
      toolCalls: op.toolCalls.map((call) => ({ ...call, toolId: mapped(call.toolId) })),
      reads: [...new Set(op.reads.map(mapped))],
      writes: [...new Set(op.writes.map(mapped))],
    };
    if (merged.type === 'ModelingSession') merged.changes = merged.changes.map((c) => ({ ...c, artifactId: mapped(c.artifactId) }));
    const position = replaced.has(op.id) ? trace.operations.findIndex((o) => o.id === op.id) : -1;
    if (position >= 0) trace.operations[position] = merged; // where the run was, in the history
    else trace.operations.push(merged);
  }
  if (replaced.size > 0) dropUnusedActorsAndTools(trace, [...replaced.values()]);
  const linkIds = new Set(trace.traceLinks.map((l) => l.id));
  for (const link of fragment.traceLinks ?? []) {
    if (linkIds.has(link.id)) continue;
    trace.traceLinks.push({ ...link, sourceId: mapped(link.sourceId), targetId: mapped(link.targetId) });
  }
  const compacted = pruneOldGenerations(trace);
  if (compacted > 0) console.info(`Compacted or removed ${compacted} older generation run(s) of the project trace.`);
  pruneStoredContents(trace);
}

/**
 * The operations of `trace` the fragment replaces, by id (see {@link mergeTraceFragment}); null when the fragment
 * holds only Spec-Driven runs already merged as they are or later, and is left out whole.
 */
function supersededOperations(trace: TraceFile, fragment: TraceFile): Map<string, TraceOperation> | null {
  const replaced = new Map<string, TraceOperation>();
  const incoming = fragment.operations ?? [];
  if (incoming.length === 0) return replaced;
  const existing = new Map(trace.operations.map((o) => [o.id, o]));
  const linked = new Set(trace.traceLinks.map((link) => link.operationId));
  const ended = (o: TraceOperation) => ms(o.endedAt ?? o.startedAt);
  let skipped = 0;
  for (const op of incoming) {
    const old = existing.get(op.id);
    if (!old) continue;
    // Only a Spec-Driven run reuses its id (a resumed run); another generation's id is new each run.
    const resumed = old.id.startsWith(specDrivenOperationId('')) && ended(op) > ended(old);
    if (isStreamSummary(old, linked) || resumed) replaced.set(op.id, old);
    else if (old.id.startsWith(specDrivenOperationId(''))) skipped += 1;
  }
  return skipped === incoming.length ? null : replaced;
}

/** Remove from `trace` what `operation` wrote and nothing else uses, other than model artifacts, and its links. */
function removeOperationOutput(trace: TraceFile, operation: TraceOperation): void {
  const usedElsewhere = new Set(
    trace.operations.filter((o) => o.id !== operation.id).flatMap((o) => [...o.reads, ...o.writes, ...changesOf(o).map((c) => c.artifactId)]),
  );
  const removed = new Set(operation.writes.filter((id) => !usedElsewhere.has(id)));
  for (const artifact of trace.artifacts) {
    if (isModelArtifact(artifact)) removed.delete(artifact.id);
  }
  // A line range of a removed file goes with it.
  for (let grew = removed.size > 0; grew; ) {
    grew = false;
    for (const artifact of trace.artifacts) {
      if (artifact.parentId && removed.has(artifact.parentId) && !isModelArtifact(artifact) && !removed.has(artifact.id)) {
        removed.add(artifact.id);
        grew = true;
      }
    }
  }
  trace.artifacts = trace.artifacts.filter((a) => !removed.has(a.id));
  for (const artifact of trace.artifacts) {
    if (isCodeArtifact(artifact) && artifact.revisionOfId && removed.has(artifact.revisionOfId)) delete artifact.revisionOfId;
  }
  trace.traceLinks = trace.traceLinks.filter(
    (link) => link.operationId !== operation.id && !removed.has(link.sourceId) && !removed.has(link.targetId),
  );
  for (const other of trace.operations) {
    if (other.id === operation.id) continue;
    other.reads = other.reads.filter((id) => !removed.has(id));
  }
}

/** Drop the actors and tools only the replaced operations used. */
function dropUnusedActorsAndTools(trace: TraceFile, replaced: TraceOperation[]): void {
  const usedTools = new Set(trace.operations.flatMap((o) => o.toolCalls.map((c) => c.toolId)));
  const usedActors = new Set(trace.operations.flatMap((o) => o.performedBy));
  const formerTools = new Set(replaced.flatMap((o) => o.toolCalls.map((c) => c.toolId)));
  const formerActors = new Set(replaced.flatMap((o) => o.performedBy));
  trace.tools = trace.tools.filter((t) => usedTools.has(t.id) || !formerTools.has(t.id));
  trace.actors = trace.actors.filter((a) => usedActors.has(a.id) || !formerActors.has(a.id));
}

/**
 * The generation runs of `trace`, by generator, newest first. A generator is the set of tools a run's calls invoked,
 * except for a Spec-Driven run: the LLM serving it changes from run to run (the user's model, a fallback), so its
 * runs are grouped by the deterministic generator they started from alone, and all count against one cap.
 */
function generationRunsByGenerator(trace: TraceFile): TraceOperation[][] {
  const codeGenerators = new Set(trace.tools.filter((t) => t.type === 'CodeGenerator').map((t) => t.id));
  const runsByGenerator = new Map<string, TraceOperation[]>();
  for (const operation of trace.operations) {
    if (operation.type !== 'CodeGeneration') continue;
    const tools = toolIdsOf(operation);
    const generator = operation.id.startsWith(specDrivenOperationId(''))
      ? specDrivenOperationId(tools.filter((id) => codeGenerators.has(id)).join(','))
      : tools.join(',');
    runsByGenerator.set(generator, [...(runsByGenerator.get(generator) ?? []), operation]);
  }
  const runs = [...runsByGenerator.values()];
  for (const list of runs) list.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  return runs;
}

/**
 * Bound what generation runs keep, per generator (the tools a run called; a Spec-Driven run's deterministic
 * generator, whatever LLM served it):
 *
 * 1. the newest `keep` runs ({@link KEPT_GENERATIONS_PER_GENERATOR}) keep everything: their trace links, the line
 *    ranges they link, and their files (whose content {@link pruneStoredContents} bounds per path);
 * 2. the runs after them, up to `keepRecords` in all ({@link KEPT_GENERATION_RECORDS_PER_GENERATOR}), are
 *    compacted: their links and line ranges go, their operation and their whole files stay, with hashes but no
 *    content (what was generated, by whom, when);
 * 3. older runs are removed: their operation and every file they wrote. A later file that was a revision of one
 *    removed no longer names it, and no operation reads it any more.
 *
 * So a project keeps at most `keepRecords` runs per generator. Returns how many runs were compacted or removed
 * (a run compacted earlier is not counted again).
 */
export function pruneOldGenerations(
  trace: TraceFile,
  keep: number = KEPT_GENERATIONS_PER_GENERATOR,
  keepRecords: number = Math.max(keep, KEPT_GENERATION_RECORDS_PER_GENERATOR),
): number {
  const linked = new Set(trace.traceLinks.map((link) => link.operationId));
  const compact = new Set<string>();
  const remove = new Set<string>();
  for (const runs of generationRunsByGenerator(trace)) {
    runs.slice(keep, keepRecords).forEach((run) => {
      if (linked.has(run.id)) compact.add(run.id);
    });
    runs.slice(keepRecords).forEach((run) => remove.add(run.id));
  }
  if (compact.size === 0 && remove.size === 0) return 0;

  const artifacts = new Map(trace.artifacts.map((a) => [a.id, a]));
  const dropped = new Set<string>();
  for (const operation of trace.operations) {
    const removed = remove.has(operation.id);
    if (!removed && !compact.has(operation.id)) continue;
    for (const id of operation.writes) {
      const artifact = artifacts.get(id);
      if (!isCodeArtifact(artifact)) continue;
      // A line range only means something through its links; a removed run takes its files along.
      if (removed || artifact.parentId) dropped.add(id);
      else delete artifact.content;
    }
  }
  // A line range of a dropped file goes with it.
  for (const artifact of trace.artifacts) {
    if (artifact.parentId && dropped.has(artifact.parentId)) dropped.add(artifact.id);
  }
  trace.traceLinks = trace.traceLinks.filter(
    (link) => !compact.has(link.operationId) && !remove.has(link.operationId) && !dropped.has(link.sourceId) && !dropped.has(link.targetId),
  );
  trace.artifacts = trace.artifacts.filter((a) => !dropped.has(a.id));
  for (const artifact of trace.artifacts) {
    if (isCodeArtifact(artifact) && artifact.revisionOfId && dropped.has(artifact.revisionOfId)) delete artifact.revisionOfId;
  }
  trace.operations = trace.operations.filter((o) => !remove.has(o.id));
  for (const operation of trace.operations) {
    operation.writes = operation.writes.filter((id) => !dropped.has(id));
    operation.reads = operation.reads.filter((id) => !dropped.has(id));
  }
  // Actors and tools only the removed runs used go with them.
  const usedTools = new Set(trace.operations.flatMap((o) => o.toolCalls.map((c) => c.toolId)));
  const usedActors = new Set(trace.operations.flatMap((o) => o.performedBy));
  if (remove.size > 0) {
    trace.tools = trace.tools.filter((t) => usedTools.has(t.id));
    trace.actors = trace.actors.filter((a) => usedActors.has(a.id));
  }
  return compact.size + remove.size;
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

/* ------------------------------------------------------------------ model generators */

/** One element a model generator derived, and the element of the source model it was derived from. */
export interface DerivedElement {
  /** The derived element (in the diagram being recorded). */
  elementId: string;
  source: BoundElement;
}

/**
 * Link derived elements to the source elements they were derived from (`project.elementLineage`: a component
 * diagram derived from a BPMN, a deployment from components, an agent from a lane), under the model generator's
 * session that wrote `diagramId`: the newest ModelGenerator session that changed an element of it, else a new
 * session of `generatorName`. The session reads the source elements; the evidence is `rule`. A link already there
 * is not repeated. Returns whether anything was recorded.
 */
export function linkDerivedElements(
  trace: TraceFile,
  derived: DerivedElement[],
  ctx: {
    diagramId: string; diagramTitle: string; modelType: string;
    sourceModel: { id: string; title: string; modelType: string };
    generatorName: string; rule: string; actorName: string; now: string;
  },
): boolean {
  const diagram = ensureModelArtifact(trace, ctx.diagramId, ctx.modelType, ctx.diagramTitle, undefined, ctx.now);
  const sourceRoot = ensureModelArtifact(trace, ctx.sourceModel.id, ctx.sourceModel.modelType, ctx.sourceModel.title, undefined, ctx.now);
  const artifactsById = new Map(trace.artifacts.map((a) => [a.id, a]));
  const inDiagram = (artifactId: string): boolean => {
    let steps = 0;
    for (let a = artifactsById.get(artifactId); a && steps <= MAX_PARENT_DEPTH; a = a.parentId ? artifactsById.get(a.parentId) : undefined, steps += 1) {
      if (a.id === diagram.id) return true;
    }
    return false;
  };
  const generatorTools = new Set(trace.tools.filter((t) => t.type === 'ModelGenerator').map((t) => t.id));
  let session = [...trace.operations].reverse().find(
    (o): o is ModelingSessionOperation =>
      isModelingSession(o) && toolIdsOf(o).some((id) => generatorTools.has(id)) && o.changes.some((c) => inDiagram(c.artifactId)),
  );
  if (!session) {
    const tool = ensureTool(trace, 'ModelGenerator', ctx.generatorName, ctx.now);
    session = {
      id: newId(), type: 'ModelingSession', status: 'SUCCEEDED', startedAt: ctx.now, endedAt: ctx.now,
      performedBy: [ensureActor(trace, 'Person', ctx.actorName, ctx.now).id], reads: [], writes: [], changes: [],
      toolCalls: [{ id: newId(), toolId: tool.id, sequenceNumber: 0, status: 'SUCCEEDED', startedAt: ctx.now, endedAt: ctx.now, logs: [] }],
    };
    trace.operations.push(session);
  }
  let recorded = false;
  for (const { elementId, source } of derived) {
    const target = findModelArtifact(trace, elementId) ?? undefined;
    if (!target) continue;
    const owner = source.parent
      ? ensureModelArtifact(trace, source.parent.elementId, source.parent.elementType, source.parent.name, sourceRoot.id, ctx.now)
      : undefined;
    const from = ensureModelArtifact(trace, source.elementId, source.elementType, source.name, (owner ?? sourceRoot).id, ctx.now);
    if (!session.reads.includes(from.id)) session.reads.push(from.id);
    if (trace.traceLinks.some((link) => link.sourceId === from.id && link.targetId === target.id)) continue;
    trace.traceLinks.push({
      id: newId(), sourceId: from.id, targetId: target.id, operationId: session.id, timestamp: ctx.now,
      evidence: [{ id: newId(), type: 'RuleEvidence', rule: ctx.rule, timestamp: ctx.now }],
    });
    recorded = true;
  }
  return recorded;
}

/* ------------------------------------------------------------------ Spec-Driven runs without a trace */

/** What the stream of a Spec-Driven run carried, for a backend whose `done` event has no `trace`. */
export interface SpecDrivenRunSummary {
  runId: string;
  status: TraceOperation['status'];
  startedAt: string;
  endedAt: string;
  actorName: string;
  /** The LLM that served the run (the start event's, the outage fallback's, or the provider-reported one). */
  llm?: { model: string; provider?: string };
  /** Total tokens the run used, input and output together (the stream does not split them). */
  tokensUsed?: number;
  costUsd?: number;
  /** The deterministic generator the run started from (`recipe.generator_used`). */
  generator?: string;
  changedFiles: string[];
  changedFileCount?: number;
  verification: Array<{ state: 'verified' | 'notVerified' | 'shippedUnenforced'; kind: string; id: string; traceRef?: string; what: string; detail?: string }>;
  /** The diagrams the run read: id, title and B-UML model type. */
  diagrams: Array<{ id: string; title: string; modelType: string }>;
  /** The RequirementArtifact ids sent with the run. */
  requirementIds: string[];
}

export const specDrivenOperationId = (runId: string): string => `spec-driven:${runId}`;

/**
 * The first message of a Spec-Driven run recorded from its stream ({@link recordSpecDrivenRun}): it marks the
 * operation as a stream summary, which the backend's trace of the run replaces whenever it arrives. A log record,
 * so the mark is part of the trace file and survives export and import.
 */
export const SPEC_DRIVEN_STREAM_SUMMARY = 'Recorded from the Spec-Driven run\'s stream: the backend sent no trace of this run.';

/**
 * Whether `operation` is a Spec-Driven run recorded from its stream: marked {@link SPEC_DRIVEN_STREAM_SUMMARY}, or,
 * recorded before the mark, a Spec-Driven run that wrote nothing and has no link (`linked`: the ids of the operations
 * that have links), which the backend's trace of a run never is.
 */
export function isStreamSummary(operation: TraceOperation, linked: Set<string>): boolean {
  if (operation.type !== 'CodeGeneration' || !operation.id.startsWith(specDrivenOperationId(''))) return false;
  if (operation.toolCalls.some((call) => call.logs.some((log) => log.content === SPEC_DRIVEN_STREAM_SUMMARY))) return true;
  return operation.writes.length === 0 && !linked.has(operation.id);
}

/**
 * Record a Spec-Driven run from the events its stream carried, when the backend sent no trace of it: one
 * CodeGeneration operation, by the user and the Spec-Driven Agent, that reads the project's diagrams and the
 * requirements sent with it and calls the deterministic generator (when one ran) and the LLM (with the run's
 * outcome, cost, changed files and verification report as its messages). It writes no file artifact: the stream
 * reports paths, not contents or hashes. Recording the same run twice records it once.
 */
export function recordSpecDrivenRun(trace: TraceFile, run: SpecDrivenRunSummary): boolean {
  const id = specDrivenOperationId(run.runId);
  if (trace.operations.some((o) => o.id === id)) return false;
  const performedBy = [
    ensureActor(trace, 'Person', run.actorName, run.startedAt).id,
    ensureActor(trace, 'Agent', SPEC_DRIVEN_AGENT_NAME, run.startedAt).id,
  ];
  const reads = run.diagrams.map((d) => ensureModelArtifact(trace, d.id, d.modelType, d.title, undefined, run.startedAt).id);
  const known = new Set(trace.artifacts.map((a) => a.id));
  // The run's own requirements, and the artifacts its verification items name (`traceRef`).
  const refs = run.verification.flatMap((v) => (v.traceRef ? [v.traceRef] : []));
  reads.push(...[...run.requirementIds, ...refs].filter((rid) => known.has(rid)));
  const toolCalls: TraceToolCall[] = [];
  const log = (call: TraceToolCall, content: string, logType: LogType = 'INFO') =>
    call.logs.push({ id: newId(), content: capped(content), sequenceNumber: call.logs.length, logType, timestamp: run.endedAt });
  if (run.generator) {
    const tool = ensureTool(trace, 'CodeGenerator', run.generator, run.startedAt);
    toolCalls.push({ id: newId(), toolId: tool.id, sequenceNumber: toolCalls.length, status: 'SUCCEEDED', startedAt: run.startedAt, endedAt: run.endedAt, logs: [] });
  }
  const llmTool = ensureTool(trace, 'LLM', run.llm?.model ?? UNKNOWN_ASSISTANT_LLM_NAME, run.startedAt, undefined, run.llm?.provider);
  const llmCall: TraceToolCall = {
    id: newId(), toolId: llmTool.id, sequenceNumber: toolCalls.length, status: run.status, startedAt: run.startedAt, endedAt: run.endedAt, logs: [],
  };
  toolCalls.push(llmCall);
  log(llmCall, SPEC_DRIVEN_STREAM_SUMMARY);
  if (run.tokensUsed !== undefined) log(llmCall, `Tokens used (input and output together): ${run.tokensUsed}`);
  if (run.costUsd !== undefined) log(llmCall, `Cost: ${run.costUsd.toFixed(4)} USD`);
  if (run.changedFiles.length > 0) {
    const more = (run.changedFileCount ?? run.changedFiles.length) - run.changedFiles.length;
    log(llmCall, `Files written or edited:\n${run.changedFiles.join('\n')}${more > 0 ? `\n… and ${more} more` : ''}`, 'TOOL_RESULT');
  }
  for (const item of run.verification) {
    log(llmCall, `${item.state} ${item.kind}${item.id ? ` ${item.id}` : ''}: ${item.what}${item.detail ? ` (${item.detail})` : ''}`);
  }
  trace.operations.push({
    id, type: 'CodeGeneration', status: run.status, startedAt: run.startedAt, endedAt: run.endedAt,
    performedBy, toolCalls, reads: [...new Set(reads)], writes: [],
  });
  return true;
}
