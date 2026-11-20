/**
 * The digest is a contract with the modeling agent: it validates `context.traceDigest` field by field and
 * silently drops what does not fit. This test mirrors that validation and checks nothing the editor builds is
 * dropped or cut. Mirrors modeling-agent `src/protocol/adapters.py::_parse_trace_digest` (and its `_digest_*`
 * helpers) with the caps of `src/common/agent_config.py` `TRACE_DIGEST_*` (another repo, no shared schema):
 * update both together.
 */
import { describe, expect, it } from 'vitest';
import { TRACE_DIGEST_CAPS, TRACE_DIGEST_MAX_CHARS, buildTraceDigest } from '../traceDigest';
import { indexTrace } from '../traceQueries';
import { emptyTraceFile } from '../../types/traceability';
import type { TraceFile, TraceOperation } from '../../types/traceability';

// agent_config.py
const AGENT_CAPS = { recentOperations: 15, requirements: 40, outOfDate: 30, generations: 10, focus: 5, history: 20, derivedFrom: 10, derived: 20, listItems: 20, name: 200, text: 500 };
// protocol/adapters.py
const OUT_OF_DATE_REASONS = ['SOURCE_CHANGED', 'TARGET_CHANGED', 'UPSTREAM_CHANGED'];
const CHANGE_KINDS = ['CREATED', 'UPDATED', 'DELETED'];
const OPERATION_TYPES = ['ModelingSession', 'CodeGeneration', 'RequirementExtraction', 'Conversation'];

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, cap: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, cap) : undefined);
const count = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : undefined);
const nameList = (v: unknown, allowed?: string[]) =>
  (Array.isArray(v) ? v : []).map((x) => str(x, AGENT_CAPS.name)).filter((x): x is string => !!x && (!allowed || allowed.includes(x))).slice(0, AGENT_CAPS.listItems);

function fields(item: Obj, spec: { names?: string[]; texts?: string[]; lists?: string[]; counts?: string[] }): Obj {
  const out: Obj = {};
  for (const k of spec.names ?? []) { const v = str(item[k], AGENT_CAPS.name); if (v) out[k] = v; }
  for (const k of spec.texts ?? []) { const v = str(item[k], AGENT_CAPS.text); if (v) out[k] = v; }
  for (const k of spec.lists ?? []) { const v = nameList(item[k]); if (v.length) out[k] = v; }
  for (const k of spec.counts ?? []) { const v = count(item[k]); if (v !== undefined) out[k] = v; }
  return out;
}
const list = (v: unknown, cap: number, parse: (o: Obj) => Obj | null) => {
  const out: Obj[] = [];
  for (const raw of Array.isArray(v) ? v : []) {
    if (out.length >= cap) break;
    const item = isObj(raw) ? parse(raw) : null;
    if (item) out.push(item);
  }
  return out;
};
const parseFocus = (raw: Obj): Obj | null => {
  const item = fields(raw, { names: ['artifactId', 'name', 'elementType'] });
  if (!item.artifactId || !item.name) return null;
  const history = list(raw.history, AGENT_CAPS.history, (r) =>
    CHANGE_KINDS.includes(r.kind as string) ? { kind: r.kind, ...fields(r, { names: ['feature', 'at', 'by', 'via'], texts: ['old', 'new'] }) } : null);
  const derivedFrom = list(raw.derivedFrom, AGENT_CAPS.derivedFrom, (r) => {
    const s = fields(r, { names: ['type', 'name'], texts: ['evidence'] });
    return s.name || s.type ? s : null;
  });
  const derived = list(raw.derived, AGENT_CAPS.derived, (r) => {
    const d = fields(r, { names: ['path', 'lines'] });
    const reasons = nameList(r.outOfDate, OUT_OF_DATE_REASONS);
    if (reasons.length) d.outOfDate = reasons;
    return d.path ? d : null;
  });
  if (history.length) item.history = history;
  if (derivedFrom.length) item.derivedFrom = derivedFrom;
  if (derived.length) item.derived = derived;
  return item;
};

/** What the agent keeps of a digest (`WorkspaceContext.trace_digest`), or null when it drops it whole. */
function agentParse(context: Obj): Obj | null {
  const raw = context.traceDigest;
  if (!isObj(raw)) return null;
  const version = raw.schemaVersion ?? 1;
  if (count(version) === undefined || (version as number) < 1) return null;
  const digest: Obj = { schemaVersion: version, recording: raw.recording !== false };
  if (isObj(raw.counts)) {
    const counts = fields(raw.counts, { counts: ['artifacts', 'links', 'outOfDateLinks'] });
    if (isObj(raw.counts.operations)) {
      const per = Object.fromEntries(OPERATION_TYPES.flatMap((k) => (count((raw.counts as Obj & { operations: Obj }).operations[k]) !== undefined ? [[k, (raw.counts as Obj & { operations: Obj }).operations[k]]] : [])));
      if (Object.keys(per).length) counts.operations = per;
    }
    if (Object.keys(counts).length) digest.counts = counts;
  }
  const lists: Array<[string, number, (o: Obj) => Obj | null]> = [
    ['recentOperations', AGENT_CAPS.recentOperations, (r) => {
      const o = fields(r, { names: ['id', 'type', 'status', 'startedAt'], texts: ['summary'], lists: ['by', 'tools'] });
      return o.type || o.summary ? o : null;
    }],
    ['requirements', AGENT_CAPS.requirements, (r) => {
      const o = fields(r, { names: ['id', 'kind'], texts: ['text', 'quote'], lists: ['realizedBy'] });
      if (typeof r.covered === 'boolean') o.covered = r.covered;
      return o.id || o.text ? o : null;
    }],
    ['outOfDate', AGENT_CAPS.outOfDate, (r) => {
      const o = fields(r, { names: ['source', 'target', 'generation'] });
      const reasons = nameList(r.reasons, OUT_OF_DATE_REASONS);
      if (reasons.length) o.reasons = reasons;
      return o.source || o.target ? o : null;
    }],
    ['generations', AGENT_CAPS.generations, (r) => {
      const o = fields(r, { names: ['generator', 'at'], counts: ['files', 'outOfDateFiles'] });
      return o.generator ? o : null;
    }],
    ['focus', AGENT_CAPS.focus, parseFocus],
  ];
  for (const [key, cap, parse] of lists) {
    const items = list(raw[key], cap, parse);
    if (items.length) digest[key] = items;
  }
  return digest;
}

const at = (minute: number) => new Date(Date.UTC(2026, 9, 29, 10, minute)).toISOString();
const op = (id: string, type: TraceOperation['type'], minute: number, extra: Record<string, unknown> = {}) =>
  ({ id, type, status: 'SUCCEEDED', startedAt: at(minute), performedBy: ['ada'], toolCalls: [], reads: [], writes: [], ...(type === 'ModelingSession' ? { changes: [] } : {}), ...extra }) as TraceOperation;

function trace(): TraceFile {
  const call = (toolId: string, minute: number) => ({ id: `${toolId}-${minute}`, toolId, sequenceNumber: 0, status: 'SUCCEEDED' as const, startedAt: at(minute), logs: [] });
  return {
    ...emptyTraceFile('p'),
    actors: [{ id: 'ada', type: 'Person', name: 'Ada', timestamp: at(0) }],
    tools: [{ id: 'gen', type: 'CodeGenerator', name: 'sqlalchemy', timestamp: at(0) }],
    artifacts: [
      { id: 'cd', type: 'ModelArtifact', name: 'Library', elementId: 'e', elementType: 'DomainModel', timestamp: at(0) },
      { id: 'book', type: 'ModelArtifact', name: 'Book', elementId: 'e2', elementType: 'Class', parentId: 'cd', timestamp: at(0) },
      { id: 'f', type: 'CodeArtifact', name: 'f', path: 'models.py', contentHash: 'h', timestamp: at(0) },
      { id: 'b', type: 'CodeArtifact', name: 'b', path: 'models.py', parentId: 'f', startLine: 3, endLine: 9, contentHash: 'h', timestamp: at(0) },
      { id: 'r1', type: 'RequirementArtifact', name: 'Books have a title', quote: 'a title', kind: 'data', timestamp: at(0) },
      { id: 'pr', type: 'PromptArtifact', name: 'Prompt', content: 'p', contentHash: 'h', timestamp: at(0) },
    ],
    operations: [
      op('x', 'RequirementExtraction', 0, { writes: ['r1'], reads: ['pr'] }),
      op('m', 'ModelingSession', 1, { toolCalls: [call('gen', 1)], changes: [{ id: 'c', kind: 'CREATED', artifactId: 'book', newValue: 'Book', timestamp: at(1) }] }),
      op('g', 'CodeGeneration', 2, { toolCalls: [call('gen', 2)], writes: ['f', 'b'] }),
      op('u', 'ModelingSession', 5, { changes: [{ id: 'c2', kind: 'UPDATED', artifactId: 'book', feature: 'name', oldValue: 'A', newValue: 'Book', timestamp: at(5) }] }),
      op('cv', 'Conversation', 6),
    ],
    traceLinks: [
      { id: 'l1', sourceId: 'r1', targetId: 'book', operationId: 'm', timestamp: at(1), evidence: [{ id: 'e', type: 'AIEvidence', algorithm: 'gpt', timestamp: at(1) }] },
      { id: 'l2', sourceId: 'book', targetId: 'b', operationId: 'g', timestamp: at(2), evidence: [] },
      { id: 'l3', sourceId: 'cd', targetId: 'f', operationId: 'g', timestamp: at(2), evidence: [] },
    ],
  };
}

describe('the digest against the agent\'s validation', () => {
  it('loses nothing: every list, field and focus entry survives the agent\'s drop rules unchanged', () => {
    const t = trace();
    const digest = buildTraceDigest(t, indexTrace(t), 'Why is Book out of date?', { summarize: (o) => `summary ${o.id}` });
    // Make sure the sample exercises every section.
    for (const key of ['counts', 'recentOperations', 'requirements', 'outOfDate', 'generations', 'focus'] as const) expect(digest[key]).toBeDefined();
    const wire = JSON.parse(JSON.stringify({ traceDigest: digest }));
    expect(agentParse(wire)).toEqual(wire.traceDigest);
  });

  it('a digest cut to the size bound is still entirely accepted, and stays under it', () => {
    const t = trace();
    const digest = buildTraceDigest(t, indexTrace(t), 'Book', { maxChars: 1500 });
    const json = JSON.stringify(digest);
    expect(json.length).toBeLessThanOrEqual(1500);
    expect(agentParse(JSON.parse(`{"traceDigest":${json}}`))).toEqual(JSON.parse(json));
  });

  it('the editor\'s caps equal the agent\'s', () => {
    expect(TRACE_DIGEST_CAPS).toMatchObject({
      recentOperations: AGENT_CAPS.recentOperations, requirements: AGENT_CAPS.requirements, outOfDate: AGENT_CAPS.outOfDate,
      generations: AGENT_CAPS.generations, focus: AGENT_CAPS.focus, focusHistory: AGENT_CAPS.history,
      focusDerivedFrom: AGENT_CAPS.derivedFrom, focusDerived: AGENT_CAPS.derived, listItems: AGENT_CAPS.listItems,
      nameChars: AGENT_CAPS.name, textChars: AGENT_CAPS.text,
    });
    expect(TRACE_DIGEST_MAX_CHARS).toBeLessThanOrEqual(12000);
  });

  it('the mirror drops what the agent drops (sanity for this test)', () => {
    expect(agentParse({ traceDigest: { schemaVersion: 0 } })).toBeNull();
    const kept = agentParse({ traceDigest: { schemaVersion: 1, focus: [{ name: 'x' }], outOfDate: [{ source: 's', reasons: ['NOPE'] }] } });
    expect(kept).toEqual({ schemaVersion: 1, recording: true, outOfDate: [{ source: 's' }] });
  });
});
