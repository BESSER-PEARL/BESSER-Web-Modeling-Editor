import { describe, expect, it } from 'vitest';
import { traceOfDiagrams } from '../traceSubset';
import { emptyTraceFile } from '../../types/traceability';
import type { TraceFile } from '../../types/traceability';

const t = '2026-11-01T10:00:00.000Z';

/** A class diagram `cd` with Book, a GUI `gui` with a table bound to Book, a prompt and a requirement Book
 *  realizes, a generation run reading both diagrams, and a session that edited both. */
function project(): TraceFile {
  return {
    ...emptyTraceFile('p'),
    actors: [
      { id: 'ada', type: 'Person', name: 'Ada', timestamp: t },
      { id: 'bot', type: 'Agent', name: 'assistant', timestamp: t },
    ],
    tools: [
      { id: 'editor', type: 'Editor', name: 'editor', timestamp: t },
      { id: 'gen', type: 'CodeGenerator', name: 'web_app', timestamp: t },
      { id: 'llm', type: 'LLM', name: 'm', timestamp: t },
    ],
    artifacts: [
      { id: 'cd', type: 'ModelArtifact', name: 'Library', elementId: 'cd', elementType: 'DomainModel', timestamp: t },
      { id: 'book', type: 'ModelArtifact', name: 'Book', elementId: 'b', elementType: 'Class', parentId: 'cd', timestamp: t },
      { id: 'gui', type: 'ModelArtifact', name: 'GUI', elementId: 'gui', elementType: 'GUIModel', timestamp: t },
      { id: 'table', type: 'ModelArtifact', name: 'Table', elementId: 't', elementType: 'Table', parentId: 'gui', timestamp: t },
      { id: 'prompt', type: 'PromptArtifact', name: 'a library', content: 'a library', contentHash: 'h', timestamp: t },
      { id: 'req', type: 'RequirementArtifact', name: 'Books', quote: 'library', kind: 'data', timestamp: t },
      { id: 'file', type: 'CodeArtifact', name: 'app.py', path: 'app.py', contentHash: 'h', timestamp: t },
      { id: 'range', type: 'CodeArtifact', name: 'Book', path: 'app.py', contentHash: 'h', startLine: 1, endLine: 3, parentId: 'file', timestamp: t },
    ],
    operations: [
      { id: 'chat', type: 'Conversation', status: 'SUCCEEDED', startedAt: t, performedBy: ['ada', 'bot'], reads: [], writes: ['prompt'],
        toolCalls: [{ id: 'turn', toolId: 'llm', sequenceNumber: 0, status: 'SUCCEEDED', startedAt: t, logs: [
          { id: 'log', content: 'a library', sequenceNumber: 0, logType: 'INPUT_REQUEST', timestamp: t }] }] },
      { id: 'session', type: 'ModelingSession', status: 'SUCCEEDED', startedAt: t, performedBy: ['ada'], reads: [], writes: [],
        toolCalls: [{ id: 'ec', toolId: 'editor', sequenceNumber: 0, status: 'SUCCEEDED', startedAt: t, logs: [] }],
        changes: [{ id: 'c1', kind: 'CREATED', artifactId: 'book', timestamp: t }, { id: 'c2', kind: 'CREATED', artifactId: 'table', timestamp: t }] },
      { id: 'gui-only', type: 'ModelingSession', status: 'SUCCEEDED', startedAt: t, performedBy: ['ada'], reads: [], writes: [],
        toolCalls: [{ id: 'ec2', toolId: 'editor', sequenceNumber: 0, status: 'SUCCEEDED', startedAt: t, logs: [] }],
        changes: [{ id: 'c3', kind: 'UPDATED', artifactId: 'table', feature: 'name', timestamp: t }] },
      { id: 'run', type: 'CodeGeneration', status: 'SUCCEEDED', startedAt: t, performedBy: ['ada'], reads: ['cd', 'gui'], writes: ['file', 'range'],
        toolCalls: [{ id: 'gc', toolId: 'gen', sequenceNumber: 0, status: 'SUCCEEDED', startedAt: t, logs: [] }] },
    ],
    traceLinks: [
      { id: 'l1', sourceId: 'prompt', targetId: 'req', operationId: 'session', evidence: [], timestamp: t },
      { id: 'l2', sourceId: 'req', targetId: 'book', operationId: 'session', timestamp: t,
        evidence: [{ id: 'e', type: 'AIEvidence', algorithm: 'm', logIds: ['log'], timestamp: t }] },
      { id: 'l3', sourceId: 'book', targetId: 'table', operationId: 'session', evidence: [], timestamp: t },
      { id: 'l4', sourceId: 'book', targetId: 'range', operationId: 'run', evidence: [], timestamp: t },
    ],
  };
}

describe('traceOfDiagrams', () => {
  it('keeps the selected diagrams, what they derive and what they come from, and nothing about the others', () => {
    const subset = traceOfDiagrams(project(), new Set(['cd']));
    expect(subset.artifacts.map((a) => a.id)).toEqual(['cd', 'book', 'prompt', 'req', 'file', 'range']);
    expect(subset.operations.map((o) => o.id)).toEqual(['chat', 'session', 'run']);
    const session = subset.operations.find((o) => o.id === 'session');
    expect(session?.type === 'ModelingSession' && session.changes.map((c) => c.id)).toEqual(['c1']);
    expect(subset.operations.find((o) => o.id === 'run')?.reads).toEqual(['cd']);
    expect(subset.traceLinks.map((l) => l.id)).toEqual(['l1', 'l2', 'l4']);
    expect(subset.traceLinks[1].evidence[0]).toMatchObject({ logIds: ['log'] }); // the conversation's log is kept
    expect(subset.tools.map((t) => t.id)).toEqual(['editor', 'gen', 'llm']);
  });

  it('drops the log ids of a conversation that is not kept', () => {
    const trace = project();
    trace.operations = trace.operations.filter((o) => o.id !== 'chat');
    const subset = traceOfDiagrams(trace, new Set(['cd']));
    expect(subset.traceLinks.find((l) => l.id === 'l2')!.evidence[0]).not.toHaveProperty('logIds');
  });

  it('keeps a GUI alone with its own sessions', () => {
    const subset = traceOfDiagrams(project(), new Set(['gui']));
    expect(subset.artifacts.map((a) => a.id)).toEqual(['gui', 'table', 'file', 'range']);
    expect(subset.operations.map((o) => o.id)).toEqual(['session', 'gui-only', 'run']);
    expect(subset.traceLinks).toEqual([]); // every link has an end outside the GUI
  });
});
