import { beforeEach, describe, expect, it, vi } from 'vitest';
import { quoteIsInPrompt, readAssistantRequirements, requestStating } from '../assistantRequirements';
import type { AssistantRequirements } from '../assistantRequirements';
import { diffClassModel, findNamedElement } from '../classModelDiff';
import type { ClassModelLike } from '../classModelDiff';
import {
  ASSISTANT_LLM_NAME,
  ASSISTANT_LLM_PROVIDER,
  recordConversationRequest,
  recordElementChanges,
  REQUIREMENT_QUOTE_RULE,
} from '../traceRecorder';
import { latestRequirements } from '../traceQueries';
import {
  expectAssistantRequirements,
  flushTraceSaves,
  loadProjectTrace,
  projectRequirements,
  recordAssistantRequest,
  recordClassDiagramUpdate,
  setTraceStorage,
} from '../traceStore';
import { memoryTraceStorage } from '../traceDatabase';
import { emptyTraceFile, isRequirementArtifact } from '../../types/traceability';
import type {
  ConversationOperation,
  ModelingSessionOperation,
  RequirementExtractionOperation,
  TraceFile,
} from '../../types/traceability';
import type { BesserProject, ProjectDiagram } from '../../types/project';

/** A hotel class diagram as the assistant's converter builds it. */
const HOTEL: ClassModelLike = {
  elements: {
    room: { id: 'room', type: 'Class', name: 'Room', owner: null },
    number: { id: 'number', type: 'ClassAttribute', name: 'number', owner: 'room' },
    booking: { id: 'booking', type: 'Class', name: 'Booking', owner: null },
    guests: { id: 'guests', type: 'ClassAttribute', name: 'guestCount', owner: 'booking' },
    checkOut: { id: 'checkOut', type: 'ClassMethod', name: 'checkOut(day: int)', owner: 'booking' },
    status: { id: 'status', type: 'Enumeration', name: 'BookingStatus', owner: null },
    confirmed: { id: 'confirmed', type: 'ClassAttribute', name: 'CONFIRMED', owner: 'status' },
    ocl: {
      id: 'ocl', type: 'ClassOCLConstraint', name: '', owner: null,
      constraint: 'context Booking inv guestsWithinCapacity: self.guestCount <= 4\n\ncontext Booking inv other: true',
    },
  },
  relationships: {
    rooms: { id: 'rooms', type: 'ClassBidirectional', name: 'rooms', source: { element: 'booking' }, target: { element: 'room' } },
  },
};

const PROMPT = 'A hotel. Each room is identified by its number. Guests must not exceed the capacity. Use FastAPI.';
const REPLY = {
  requirements: [
    { id: 'R1', text: 'A room is identified by its number', quote: 'Each room is identified by its   NUMBER', kind: 'uniqueness' },
    { id: 'R2', text: 'Guests never exceed the capacity', quote: 'must not exceed the capacity', kind: 'rule' },
    { id: 'R3', text: 'The backend uses FastAPI', quote: 'Use FastAPI', kind: 'technical' },
  ],
  realizations: [
    { requirement: 'R1', elements: [{ type: 'Property', name: 'number', owner: 'Room' }] },
    { requirement: 'R2', elements: [
      { type: 'Constraint', name: 'guestsWithinCapacity', owner: 'Booking' },
      { type: 'Property', name: 'price', owner: 'Room' }, // not in the model
    ] },
  ],
  requirementsModel: { name: 'claude-haiku-5-5', provider: 'anthropic' },
};
const { requirementsModel, ...STATED } = REPLY;

describe('the requirements an assistant reply carries', () => {
  it('reads well-formed requirements and their realizations', () => {
    expect(readAssistantRequirements(REPLY)).toEqual({ ...STATED, model: requirementsModel });
  });

  it('names no model when the reply names none or a malformed one', () => {
    expect(readAssistantRequirements(STATED)).toEqual(STATED);
    expect(readAssistantRequirements({ ...STATED, requirementsModel: { name: 'gpt' } })).toEqual(STATED);
  });

  it('leaves out what is malformed, and realizations of requirements it does not carry', () => {
    const read = readAssistantRequirements({
      requirements: [REPLY.requirements[0], { id: 'R2', text: 'x', quote: 'y', kind: 'feature' }, 'R3', { id: 'R4', text: ' ', quote: 'q', kind: 'rule' }],
      realizations: [
        { requirement: 'R1', elements: [{ type: 'Class', name: 'Room' }, { type: 'Class' }, 42] },
        { requirement: 'R2', elements: [{ type: 'Class', name: 'Booking' }] },
        { requirement: 'R1', elements: [] },
      ],
    });
    expect(read).toEqual({
      requirements: [REPLY.requirements[0]],
      realizations: [{ requirement: 'R1', elements: [{ type: 'Class', name: 'Room' }] }],
    });
  });

  it('carries none when there are none, or when two share an id', () => {
    expect(readAssistantRequirements({})).toBeUndefined();
    expect(readAssistantRequirements({ requirements: [] })).toBeUndefined();
    expect(readAssistantRequirements({ requirements: [REPLY.requirements[0], REPLY.requirements[0]] })).toBeUndefined();
  });

  it('finds a quote in its prompt whatever the case and the spacing', () => {
    expect(quoteIsInPrompt('Each room is identified by its   NUMBER', PROMPT)).toBe(true);
    expect(quoteIsInPrompt('use Django', PROMPT)).toBe(false);
  });

  it('finds the request that states every quote, newest first', () => {
    const stated = readAssistantRequirements(REPLY)!;
    const original = { text: `Hello. ${PROMPT}` };
    expect(requestStating(stated, [{ text: 'replace' }, original, { text: PROMPT }])).toBe(original);
    // A request stating some of the quotes is not the one they were extracted from.
    expect(requestStating(stated, [{ text: 'Each room is identified by its number.' }])).toBeUndefined();
  });
});

describe('finding an element the assistant names', () => {
  it.each([
    [{ type: 'Class', name: 'Room' }, 'room'],
    [{ type: 'Enumeration', name: 'BookingStatus' }, 'status'],
    [{ type: 'Property', name: 'number', owner: 'Room' }, 'number'],
    [{ type: 'EnumerationLiteral', name: 'CONFIRMED', owner: 'BookingStatus' }, 'confirmed'],
    [{ type: 'Method', name: 'checkOut', owner: 'Booking' }, 'checkOut'],
    [{ type: 'Constraint', name: 'guestsWithinCapacity', owner: 'Booking' }, 'ocl'],
    [{ type: 'BinaryAssociation', name: 'rooms', owner: 'Booking' }, 'rooms'],
  ])('finds %o', (ref, id) => {
    expect(findNamedElement(HOTEL, ref)).toBe(id);
  });

  it.each([
    { type: 'Property', name: 'number', owner: 'Booking' },
    { type: 'Class', name: 'Guest' },
    { type: 'Constraint', name: 'guestsWithin' },
    { type: 'BinaryAssociation', name: 'rooms', owner: 'Room' },
    { type: 'Property', name: 'number' },
  ])('finds nothing for %o', (ref) => {
    expect(findNamedElement(HOTEL, ref)).toBeUndefined();
  });
});

interface OperationsByType {
  Conversation: ConversationOperation;
  ModelingSession: ModelingSessionOperation;
  RequirementExtraction: RequirementExtractionOperation;
}
const operations = <T extends keyof OperationsByType>(trace: TraceFile, type: T) =>
  trace.operations.filter((o) => o.type === type) as OperationsByType[T][];
/** The names of the model elements `promptId` is linked to. */
const builtFrom = (trace: TraceFile, promptId: string) =>
  trace.traceLinks
    .filter((l) => l.sourceId === promptId)
    .map((l) => trace.artifacts.find((a) => a.id === l.targetId))
    .filter((a) => a?.type === 'ModelArtifact')
    .map((a) => a!.name);

describe('recording the requirements of an assistant edit', () => {
  const record = (requirements: AssistantRequirements) => {
    const trace = emptyTraceFile('p1');
    const { callId, logId } = recordConversationRequest(trace, PROMPT, { actorName: 'Ada', now: '2026-11-06T10:00:00.000Z' });
    const request = { callId, logId, text: PROMPT, contentHash: 'h' };
    recordElementChanges(trace, diffClassModel({}, HOTEL), {
      diagramId: 'd1', diagramTitle: 'Hotel', actorName: 'Ada', source: 'assistant', now: '2026-11-06T10:00:05.000Z',
      request, requirements, requirementsRequest: request, model: HOTEL,
    });
    return { trace, callId, logId };
  };

  it('records each requirement as written by an extraction from the prompt', () => {
    const { trace, callId, logId } = record(readAssistantRequirements(REPLY)!);
    const requirements = trace.artifacts.filter(isRequirementArtifact);
    expect(requirements.map((r) => [r.id, r.name, r.kind])).toEqual([
      [`${callId}:R1`, 'A room is identified by its number', 'uniqueness'],
      [`${callId}:R2`, 'Guests never exceed the capacity', 'rule'],
      [`${callId}:R3`, 'The backend uses FastAPI', 'technical'],
    ]);
    const [chat] = operations(trace, 'Conversation');
    expect(chat.writes).toEqual([`${callId}:prompt`]);
    const [extraction] = operations(trace, 'RequirementExtraction');
    expect(extraction).toMatchObject({
      reads: [`${callId}:prompt`], writes: requirements.map((r) => r.id), status: 'SUCCEEDED',
      startedAt: '2026-11-06T10:00:00.000Z', endedAt: '2026-11-06T10:00:05.000Z',
    });
    const agent = trace.actors.find((a) => a.type === 'Agent')!;
    expect(extraction.performedBy).toEqual([agent.id]);
    const llm = trace.tools.find((tool) => tool.id === extraction.toolCalls[0].toolId);
    expect(llm).toMatchObject({ type: 'LLM', name: 'claude-haiku-5-5', provider: 'anthropic' });
    const fromPrompt = trace.traceLinks.filter((l) => l.sourceId === `${callId}:prompt` && l.targetId.includes(':R'));
    expect(fromPrompt.every((l) => l.operationId === extraction.id)).toBe(true);
    expect(fromPrompt.map((l) => l.evidence[0])).toEqual(
      Array(3).fill(expect.objectContaining({ type: 'RuleEvidence', rule: REQUIREMENT_QUOTE_RULE })),
    );
  });

  it('links the requirements of a resumed turn to the earlier request that states them', () => {
    const trace = emptyTraceFile('p1');
    const first = recordConversationRequest(trace, PROMPT, { actorName: 'Ada', now: '2026-11-06T10:00:00.000Z' });
    const second = recordConversationRequest(trace, 'replace', { actorName: 'Ada', now: '2026-11-06T10:01:00.000Z' });
    recordElementChanges(trace, diffClassModel({}, HOTEL), {
      diagramId: 'd1', diagramTitle: 'Hotel', actorName: 'Ada', source: 'assistant', now: '2026-11-06T10:01:05.000Z',
      request: { ...second, text: 'replace', contentHash: 'h2' },
      requirements: readAssistantRequirements(REPLY)!,
      requirementsRequest: { ...first, text: PROMPT, contentHash: 'h1' },
      model: HOTEL,
    });
    const [extraction] = operations(trace, 'RequirementExtraction');
    expect(extraction).toMatchObject({ id: `${second.callId}:extraction`, reads: [`${first.callId}:prompt`] });
    expect(trace.traceLinks.filter((l) => l.operationId === extraction.id).map((l) => l.sourceId)).toEqual(
      Array(3).fill(`${first.callId}:prompt`),
    );
    // The model was built from the first request: "replace" only confirmed it, and stays a message.
    expect(builtFrom(trace, `${first.callId}:prompt`)).toEqual(expect.arrayContaining(['Room', 'Booking']));
    const [chat] = operations(trace, 'Conversation');
    expect(chat.writes).toEqual([`${first.callId}:prompt`]);
    expect(trace.artifacts.some((a) => a.id === `${second.callId}:prompt`)).toBe(false);
    expect(latestRequirements(trace)).toHaveLength(3);
  });

  it('records requirements no recorded request states without a prompt', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const trace = emptyTraceFile('p1');
    const { callId, logId } = recordConversationRequest(trace, 'replace', { actorName: 'Ada', now: '2026-11-06T10:00:00.000Z' });
    recordElementChanges(trace, diffClassModel({}, HOTEL), {
      diagramId: 'd1', diagramTitle: 'Hotel', actorName: 'Ada', source: 'assistant', now: '2026-11-06T10:00:05.000Z',
      request: { callId, logId, text: 'replace', contentHash: 'h' }, requirements: readAssistantRequirements(REPLY)!, model: HOTEL,
    });
    const [extraction] = operations(trace, 'RequirementExtraction');
    expect(extraction.reads).toEqual([]);
    expect(extraction.writes).toHaveLength(3);
    expect(trace.traceLinks.some((l) => l.operationId === extraction.id)).toBe(false);
    // The requirements do not reach a prompt, so every element keeps its link from the turn's own.
    expect(builtFrom(trace, `${callId}:prompt`)).toEqual(expect.arrayContaining(['number', 'guestsWithinCapacity, other', 'Room']));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('without their prompt'));
    warn.mockRestore();
  });

  it('links an element a requirement realizes from the requirement only, and the others from the prompt', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { trace, callId } = record(readAssistantRequirements(REPLY)!);
    const fromPrompt = builtFrom(trace, `${callId}:prompt`);
    expect(fromPrompt).toEqual(expect.arrayContaining(['Room', 'Booking', 'guestCount', 'BookingStatus']));
    // number realizes R1 and the constraint box R2: the prompt reaches them through those requirements.
    expect(fromPrompt).not.toContain('number');
    expect(fromPrompt).not.toContain('guestsWithinCapacity, other');
    expect(builtFrom(trace, `${callId}:R1`)).toEqual(['number']);
    warn.mockRestore();
  });

  it('records an extraction whose model the reply does not name as a call to the assistant’s LLM', () => {
    const { trace } = record(readAssistantRequirements(STATED)!);
    const [extraction] = operations(trace, 'RequirementExtraction');
    const llm = trace.tools.find((tool) => tool.id === extraction.toolCalls[0].toolId);
    expect(llm).toMatchObject({ name: ASSISTANT_LLM_NAME, provider: ASSISTANT_LLM_PROVIDER });
  });

  it('links each requirement to the elements that realize it, through the edits’ session', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { trace, callId, logId } = record(readAssistantRequirements(REPLY)!);
    const elementOf = (artifactId: string) => trace.artifacts.find((a) => a.id === artifactId);
    const realized = trace.traceLinks
      .filter((l) => l.sourceId.startsWith(`${callId}:R`))
      .map((l) => [l.sourceId.slice(callId.length + 1), elementOf(l.targetId)?.name]);
    expect(realized).toEqual([['R1', 'number'], ['R2', 'guestsWithinCapacity, other']]); // the box holding the invariant
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Property price'));
    const [session] = operations(trace, 'ModelingSession');
    expect(session.reads).toEqual(expect.arrayContaining([`${callId}:R1`, `${callId}:R2`]));
    expect(session.reads).not.toContain(`${callId}:R3`); // realized by no element: not modeled
    const link = trace.traceLinks.find((l) => l.sourceId === `${callId}:R1`)!;
    expect(link).toMatchObject({ operationId: session.id, evidence: [{ type: 'AIEvidence', algorithm: ASSISTANT_LLM_NAME, logIds: [logId] }] });
    warn.mockRestore();
  });

  const LIBRARY: ClassModelLike = { elements: { b: { id: 'b', type: 'Class', name: 'Book', owner: null } } };
  const LIBRARY_REQUEST = 'A library. Books are unique by ISBN.';
  const LIBRARY_REQUIREMENTS: AssistantRequirements = {
    requirements: [{ id: 'R1', text: 'Books are unique by ISBN', quote: 'unique by ISBN', kind: 'uniqueness' }],
    realizations: [{ requirement: 'R1', elements: [{ type: 'Class', name: 'Book' }] }],
  };

  it('offers the newest extraction to a generation run', () => {
    const { trace, callId } = record(readAssistantRequirements(REPLY)!);
    const second = recordConversationRequest(trace, LIBRARY_REQUEST, { actorName: 'Ada', now: '2026-11-06T11:00:00.000Z' });
    const request = { ...second, text: LIBRARY_REQUEST, contentHash: 'h2' };
    recordElementChanges(trace, diffClassModel(HOTEL, LIBRARY), {
      diagramId: 'd1', diagramTitle: 'Library', actorName: 'Ada', source: 'assistant', now: '2026-11-06T11:00:05.000Z',
      request, requirementsRequest: request, requirements: LIBRARY_REQUIREMENTS, model: LIBRARY,
    });
    expect(latestRequirements(trace).map((r) => r.id)).toEqual([`${second.callId}:R1`]);
    expect(latestRequirements(emptyTraceFile('p1'))).toEqual([]);
    expect(trace.artifacts.some((a) => a.id === `${callId}:R1`)).toBe(true); // the earlier ones stay in the trace
  });

  it('offers requirements no element realizes while the model built with them stands', () => {
    const { trace } = record({
      requirements: [
        { id: 'R1', text: 'Guests book from a calendar page', quote: 'Each room is identified', kind: 'ui' },
        { id: 'R2', text: 'The backend uses FastAPI', quote: 'Use FastAPI', kind: 'technical' },
      ],
      realizations: [],
    });
    expect(latestRequirements(trace).map((r) => r.kind)).toEqual(['ui', 'technical']);
    const second = recordConversationRequest(trace, 'a library', { actorName: 'Ada', now: '2026-11-06T11:00:00.000Z' });
    recordElementChanges(trace, diffClassModel(HOTEL, LIBRARY), {
      diagramId: 'd1', diagramTitle: 'Library', actorName: 'Ada', source: 'assistant', now: '2026-11-06T11:00:05.000Z',
      request: { ...second, text: 'a library', contentHash: 'h2' }, model: LIBRARY,
    });
    expect(latestRequirements(trace)).toEqual([]);
  });

  it('offers none once the model that realized them is rebuilt without an extraction', () => {
    const { trace } = record(readAssistantRequirements(REPLY)!);
    expect(latestRequirements(trace)).toHaveLength(3);
    // A short request (no extraction) replaces the hotel with a library: the hotel's requirements are gone.
    const second = recordConversationRequest(trace, 'a library', { actorName: 'Ada', now: '2026-11-06T11:00:00.000Z' });
    recordElementChanges(trace, diffClassModel(HOTEL, LIBRARY), {
      diagramId: 'd1', diagramTitle: 'Library', actorName: 'Ada', source: 'assistant', now: '2026-11-06T11:00:05.000Z',
      request: { ...second, text: 'a library', contentHash: 'h2' }, model: LIBRARY,
    });
    expect(latestRequirements(trace)).toEqual([]);
  });

  it('offers an earlier extraction the model still realizes when the newest is no longer realized', () => {
    const { trace, callId } = record(readAssistantRequirements(REPLY)!);
    const second = recordConversationRequest(trace, LIBRARY_REQUEST, { actorName: 'Ada', now: '2026-11-06T11:00:00.000Z' });
    const request = { ...second, text: LIBRARY_REQUEST, contentHash: 'h2' };
    const merged: ClassModelLike = { ...HOTEL, elements: { ...HOTEL.elements, ...LIBRARY.elements } };
    recordElementChanges(trace, diffClassModel(HOTEL, merged), {
      diagramId: 'd1', diagramTitle: 'Hotel', actorName: 'Ada', source: 'assistant', now: '2026-11-06T11:00:05.000Z',
      request, requirementsRequest: request, requirements: LIBRARY_REQUIREMENTS, model: merged,
    });
    // The user deletes the books again: the hotel's requirements are the ones the model realizes.
    recordElementChanges(trace, diffClassModel(merged, HOTEL), {
      diagramId: 'd1', diagramTitle: 'Hotel', actorName: 'Ada', source: 'user', now: '2026-11-06T11:30:00.000Z',
    });
    expect(latestRequirements(trace).map((r) => r.id)).toEqual(['R1', 'R2', 'R3'].map((id) => `${callId}:${id}`));
  });
});

describe('recording the requirements in the project trace', () => {
  const project = { id: 'p-req', name: 'Hotel', owner: 'Ada', settings: { traceabilityEnabled: true } } as unknown as BesserProject;
  const diagram = { id: 'd1', title: 'Hotel' } as unknown as ProjectDiagram;

  beforeEach(() => setTraceStorage(memoryTraceStorage()));

  it('keeps the reply’s requirements for the edits it makes, and offers them to a generation run', async () => {
    await recordAssistantRequest(project, PROMPT);
    expectAssistantRequirements(project, REPLY);
    recordClassDiagramUpdate(project, diagram, {}, HOTEL, 'assistant');
    recordClassDiagramUpdate(project, diagram, HOTEL, { ...HOTEL, elements: { ...HOTEL.elements } }, 'assistant');
    await flushTraceSaves();

    const trace = await loadProjectTrace(project.id);
    expect(trace.artifacts.filter(isRequirementArtifact)).toHaveLength(3); // recorded once
    expect(trace.operations.filter((o) => o.type === 'RequirementExtraction')).toHaveLength(1);
    expect((await projectRequirements(project)).map((r) => [r.name, r.kind])).toEqual([
      ['A room is identified by its number', 'uniqueness'],
      ['Guests never exceed the capacity', 'rule'],
      ['The backend uses FastAPI', 'technical'],
    ]);
  });

  it('links the requirements of a confirmed replace to the request that states them', async () => {
    const resumed = { ...project, id: 'p-req-resumed' } as BesserProject;
    await recordAssistantRequest(resumed, PROMPT);
    await recordAssistantRequest(resumed, 'replace');
    expectAssistantRequirements(resumed, REPLY);
    recordClassDiagramUpdate(resumed, diagram, {}, HOTEL, 'assistant');
    await flushTraceSaves();

    const trace = await loadProjectTrace(resumed.id);
    const [chat] = operations(trace, 'Conversation');
    const [extraction] = operations(trace, 'RequirementExtraction');
    expect(extraction.reads).toEqual([`${chat.toolCalls[0].id}:prompt`]);
    expect(extraction.id).toBe(`${chat.toolCalls[1].id}:extraction`);
  });

  it('links every edit of a confirmed replace to the request the model was built from', async () => {
    const resumed = { ...project, id: 'p-req-resumed-edits' } as BesserProject;
    await recordAssistantRequest(resumed, PROMPT);
    await recordAssistantRequest(resumed, 'replace');
    expectAssistantRequirements(resumed, REPLY);
    recordClassDiagramUpdate(resumed, diagram, {}, HOTEL, 'assistant');
    // A later edit of the same reply (a layout or repair pass) adds an element.
    const guest = { id: 'guest', type: 'Class', name: 'Guest', owner: null };
    recordClassDiagramUpdate(resumed, diagram, HOTEL, { ...HOTEL, elements: { ...HOTEL.elements, guest } }, 'assistant');
    await flushTraceSaves();

    const trace = await loadProjectTrace(resumed.id);
    const [chat] = operations(trace, 'Conversation');
    expect(builtFrom(trace, `${chat.toolCalls[0].id}:prompt`)).toEqual(expect.arrayContaining(['Room', 'Guest']));
    expect(trace.artifacts.some((a) => a.id === `${chat.toolCalls[1].id}:prompt`)).toBe(false);
  });

  it('offers none for a project that does not record traces', async () => {
    const off = { ...project, id: 'p-req-off', settings: {} } as unknown as BesserProject;
    await recordAssistantRequest(off, PROMPT);
    expectAssistantRequirements(off, REPLY);
    recordClassDiagramUpdate(off, diagram, {}, HOTEL, 'assistant');
    expect(await projectRequirements(off)).toEqual([]);
  });
});
