import { beforeEach, describe, expect, it } from 'vitest';
import { diffClassModel } from '../classModelDiff';
import type { ClassModelLike } from '../classModelDiff';
import {
  ASSISTANT_LLM_NAME,
  endConversation,
  MAX_LOGGED_MESSAGE_CHARS,
  recordConversationReply,
  recordConversationRequest,
  recordElementChanges,
  SESSION_IDLE_MS,
} from '../traceRecorder';
import {
  endAssistantConversation,
  flushTraceSaves,
  loadProjectTrace,
  recordAssistantReply,
  recordAssistantRequest,
  recordClassDiagramUpdate,
  setTraceStorage,
} from '../traceStore';
import { memoryTraceStorage } from '../traceDatabase';
import { emptyTraceFile, logsOf } from '../../types/traceability';
import type { ConversationOperation, ModelingOperation, TraceFile } from '../../types/traceability';
import type { BesserProject, ProjectDiagram } from '../../types/project';

const T0 = Date.parse('2026-10-29T10:00:00.000Z');
const at = (ms: number) => new Date(T0 + ms).toISOString();
const who = { actorName: 'Ada' };

const conversations = (trace: TraceFile) => trace.operations.filter((o): o is ConversationOperation => o.type === 'Conversation');
const cls = (id: string, name: string) => ({ id, type: 'Class', name, owner: null, bounds: { x: 0, y: 0 } });
const model = (elements: ReturnType<typeof cls>[]): ClassModelLike => ({
  elements: Object.fromEntries(elements.map((e) => [e.id, e])), relationships: {},
});

describe('conversations with the assistant', () => {
  it('records each request as a turn: a call to the assistant’s LLM holding the turn’s messages', () => {
    const trace = emptyTraceFile('p1');
    recordConversationRequest(trace, 'Add a Book class', { ...who, now: at(0) });
    expect(recordConversationReply(trace, 'progress', 'Designing the class…', at(1000))).toBe(true);
    recordConversationReply(trace, 'answer', 'Book added.', at(2000));

    const [chat] = conversations(trace);
    expect(chat.status).toBe('RUNNING'); // the conversation goes on
    expect(trace.actors.map((a) => a.type)).toEqual(['Person', 'Agent']);
    expect(trace.tools).toEqual([expect.objectContaining({ type: 'LLM', name: ASSISTANT_LLM_NAME, provider: 'unknown' })]);
    const [turn] = chat.toolCalls;
    expect(turn).toMatchObject({ toolId: trace.tools[0].id, sequenceNumber: 0, status: 'SUCCEEDED', endedAt: at(2000) });
    expect(turn.logs.map((l) => [l.sequenceNumber, l.logType, l.content])).toEqual([
      [0, 'INPUT_REQUEST', 'Add a Book class'],
      [1, 'INTERMEDIATE_MESSAGE', 'Designing the class…'],
      [2, 'OUTPUT_RESPONSE', 'Book added.'],
    ]);
  });

  it('fails a turn on an error and cancels one left without a reply', () => {
    const trace = emptyTraceFile('p1');
    recordConversationRequest(trace, 'first', { ...who, now: at(0) });
    recordConversationRequest(trace, 'second', { ...who, now: at(5000) }); // no reply came to the first
    recordConversationReply(trace, 'error', 'The assistant is taking too long to respond.', at(9000));
    const [first, second] = conversations(trace)[0].toolCalls;
    expect([first.status, first.endedAt]).toEqual(['CANCELLED', at(0)]);
    expect([second.sequenceNumber, second.status]).toEqual([1, 'FAILED']);
    expect(second.logs.map((l) => l.logType)).toEqual(['INPUT_REQUEST', 'ERROR']);
  });

  it('starts a new conversation after a new chat or an idle time', () => {
    const trace = emptyTraceFile('p1');
    recordConversationRequest(trace, 'one', { ...who, now: at(0) });
    recordConversationReply(trace, 'answer', 'ok', at(1000));
    expect(endConversation(trace)).toBe(true);
    recordConversationRequest(trace, 'two', { ...who, now: at(2000) });
    recordConversationRequest(trace, 'three', { ...who, now: at(2000 + SESSION_IDLE_MS + 1) });
    const chats = conversations(trace);
    expect(chats.map((c) => [c.status, c.toolCalls.length])).toEqual([['SUCCEEDED', 1], ['SUCCEEDED', 1], ['RUNNING', 1]]);
    expect(chats[0].endedAt).toBe(at(1000)); // its last message
    expect(chats[1].toolCalls[0].status).toBe('CANCELLED');
  });

  it('records no reply that belongs to no request, and cuts very long messages', () => {
    const trace = emptyTraceFile('p1');
    expect(recordConversationReply(trace, 'answer', 'Hello! How can I help?', at(0))).toBe(false);
    expect(trace.operations).toEqual([]);
    recordConversationRequest(trace, 'x'.repeat(MAX_LOGGED_MESSAGE_CHARS + 5), { ...who, now: at(0) });
    const [request] = logsOf(conversations(trace)[0]);
    expect(request.content.startsWith('x'.repeat(MAX_LOGGED_MESSAGE_CHARS))).toBe(true);
    expect(request.content.endsWith('[5 more characters not kept]')).toBe(true);
  });

  it('links the elements an assistant edit created or changed to the request that asked for it', () => {
    const trace = emptyTraceFile('p1');
    const { callId, logId } = recordConversationRequest(trace, 'Add Book and Author\nwith titles', { ...who, now: at(0) });
    const request = { callId, logId, text: 'Add Book and Author\nwith titles', contentHash: 'h' };
    const edit = (previous: ClassModelLike, next: ClassModelLike, ms: number) =>
      recordElementChanges(trace, diffClassModel(previous, next), {
        diagramId: 'd1', diagramTitle: 'Library', actorName: 'Ada', source: 'assistant', now: at(ms), request,
      });
    edit(model([cls('old', 'Old')]), model([cls('c1', 'Book'), cls('c2', 'Author')]), 1000);
    edit(model([cls('c1', 'Book'), cls('c2', 'Author')]), model([cls('c1', 'Volume'), cls('c2', 'Author')]), 2000);

    const prompt = trace.artifacts.find((a) => a.type === 'PromptArtifact')!;
    expect(prompt).toMatchObject({ name: 'Add Book and Author', content: request.text, contentHash: 'h', timestamp: at(0) });
    expect(conversations(trace)[0].produces).toEqual([prompt.id]);
    const session = trace.operations.find((o): o is ModelingOperation => o.type === 'Modeling')!;
    expect(session.consumes).toEqual([prompt.id]);
    // One link per created or changed element, made by the edits' session; the deleted class gets none.
    const targets = trace.traceLinks.map((l) => trace.artifacts.find((a) => a.id === l.targetId)!.name).sort();
    expect(targets).toEqual(['Author', 'Volume']);
    expect(trace.traceLinks.every((l) => l.sourceId === prompt.id && l.operationId === session.id && !l.confidence)).toBe(true);
    expect(trace.traceLinks[0].evidence).toEqual([expect.objectContaining({ type: 'AIEvidence', algorithm: ASSISTANT_LLM_NAME, logIds: [logId] })]);
  });
});

describe('recording a conversation in the project trace', () => {
  const project = { id: 'p-chat', name: 'Library', owner: 'Ada', settings: { traceabilityEnabled: true } } as unknown as BesserProject;
  const diagram = { id: 'd1', title: 'Library' } as unknown as ProjectDiagram;

  beforeEach(() => setTraceStorage(memoryTraceStorage()));

  it('records the request, the replies and the edits they led to', async () => {
    await recordAssistantRequest(project, 'Add a Book class');
    recordAssistantReply(project, 'progress', 'Working on it…');
    recordClassDiagramUpdate(project, diagram, model([]), model([cls('c1', 'Book')]), 'assistant');
    recordAssistantReply(project, 'answer', 'Book added.');
    endAssistantConversation(project);
    await flushTraceSaves();

    const trace = await loadProjectTrace(project.id);
    const [chat] = conversations(trace);
    expect(chat.status).toBe('SUCCEEDED');
    expect(logsOf(chat).map((l) => l.logType)).toEqual(['INPUT_REQUEST', 'INTERMEDIATE_MESSAGE', 'OUTPUT_RESPONSE']);
    const prompt = trace.artifacts.find((a) => a.type === 'PromptArtifact')!;
    // The hash is the SHA-256 of the request.
    expect(prompt).toMatchObject({ content: 'Add a Book class', contentHash: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect(trace.traceLinks.map((l) => [l.sourceId, trace.artifacts.find((a) => a.id === l.targetId)!.name])).toEqual([[prompt.id, 'Book']]);
  });

  it('records nothing for a project that does not record traces', async () => {
    const off = { ...project, id: 'p-off', settings: {} } as unknown as BesserProject;
    await recordAssistantRequest(off, 'Add a Book class');
    recordAssistantReply(off, 'answer', 'Book added.');
    expect((await loadProjectTrace(off.id)).operations).toEqual([]);
  });
});
