/**
 * The digest is built on the main thread with every message to the assistant: on a large trace it must stay well
 * under a second and a half, and a second message on the same trace must cost only its focus lookup. Before the
 * focus was looked up by names indexed once per trace, a trace like this one took 11 to 15 s per message.
 * The bounds are generous (several times the measured time) so a loaded machine does not fail them.
 */
import { describe, expect, it } from 'vitest';
import { buildTraceDigest, findFocusArtifacts } from '../traceDigest';
import { traceIndexOf } from '../traceQueries';
import { emptyTraceFile } from '../../types/traceability';
import type { TraceFile } from '../../types/traceability';

/** 5,000 operations, 50,000 artifacts (25,000 model elements in 10 diagrams, 25,000 code fragments), 100,000 links. */
function largeTrace(): TraceFile {
  const trace = emptyTraceFile('p');
  const ts = (i: number) => new Date(Date.UTC(2026, 0, 1) + i * 1000).toISOString();
  trace.actors.push({ id: 'u', type: 'Person', name: 'Ada', timestamp: ts(0) });
  trace.tools.push({ id: 'ed', type: 'Editor', name: 'Editor', timestamp: ts(0) });
  for (let g = 0; g < 10; g += 1) trace.tools.push({ id: `g${g}`, type: 'CodeGenerator', name: `gen${g}`, timestamp: ts(0) });
  for (let d = 0; d < 10; d += 1) trace.artifacts.push({ id: `D${d}`, type: 'ModelArtifact', name: `Diagram${d}`, elementId: `d${d}`, elementType: 'DomainModel', timestamp: ts(0) });
  for (let i = 0; i < 25000; i += 1) {
    trace.artifacts.push({ id: `M${i}`, type: 'ModelArtifact', name: `Elem${i}`, elementId: `e${i}`, elementType: 'Class', parentId: `D${i % 10}`, timestamp: ts(i) });
    trace.artifacts.push({ id: `C${i}`, type: 'CodeArtifact', name: `f${i}`, path: `f${i % 500}.py`, contentHash: 'h', startLine: 1, endLine: 2, timestamp: ts(i) });
  }
  for (let o = 0; o < 5000; o += 1) {
    const call = { id: `tc${o}`, sequenceNumber: 0, status: 'SUCCEEDED' as const, startedAt: ts(o * 10), logs: [] };
    if (o % 2 === 0) {
      trace.operations.push({ id: `O${o}`, type: 'ModelingSession', status: 'SUCCEEDED', startedAt: ts(o * 10), endedAt: ts(o * 10), performedBy: ['u'], reads: [], writes: [],
        changes: [{ id: `ch${o}`, kind: 'UPDATED', artifactId: `M${(o * 7) % 25000}`, feature: 'name', oldValue: 'a', newValue: 'b', timestamp: ts(o * 10) }],
        toolCalls: [{ ...call, toolId: 'ed' }] });
    } else {
      trace.operations.push({ id: `O${o}`, type: 'CodeGeneration', status: 'SUCCEEDED', startedAt: ts(o * 10), endedAt: ts(o * 10), performedBy: ['u'],
        reads: [`D${o % 10}`], writes: [`C${o % 25000}`], toolCalls: [{ ...call, toolId: `g${o % 10}` }] });
    }
  }
  for (let l = 0; l < 100000; l += 1) {
    trace.traceLinks.push({ id: `L${l}`, sourceId: `M${l % 25000}`, targetId: `C${(l * 3) % 25000}`, operationId: `O${2 * (l % 2500) + 1}`, timestamp: ts(l),
      evidence: [{ id: `ev${l}`, type: 'RuleEvidence', rule: 'r', timestamp: ts(l) }] });
  }
  return trace;
}

const timed = <T>(run: () => T): [T, number] => {
  const start = performance.now();
  const result = run();
  return [result, performance.now() - start];
};

describe('the trace digest of a large trace', () => {
  it('is built in well under a second and a half, and a second message costs only its focus', () => {
    const trace = largeTrace();
    const index = traceIndexOf(trace);
    expect(traceIndexOf(trace)).toBe(index); // one index per trace object

    const [first, cold] = timed(() => buildTraceDigest(trace, index, 'why does Elem42 exist?'));
    expect(first.focus?.map((f) => f.artifactId)).toEqual(['M42']);
    expect(cold).toBeLessThan(1500);

    const [second, warm] = timed(() => buildTraceDigest(trace, index, 'and what about Elem24999 and Diagram3?'));
    expect(second.focus?.map((f) => f.artifactId)).toEqual(['M24999', 'D3']);
    expect(warm).toBeLessThan(300);

    const [, focusOnly] = timed(() => findFocusArtifacts(index, 'Elem1 Elem2 Elem3 a long message '.repeat(50)));
    expect(focusOnly).toBeLessThan(100);
  }, 60000);
});
