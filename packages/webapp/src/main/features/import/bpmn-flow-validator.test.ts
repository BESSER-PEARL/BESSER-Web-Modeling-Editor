import { describe, it, expect } from 'vitest';
import {
  UMLDiagramType,
  getAllowedBpmnFlowTypes,
  getDefaultBpmnFlowType,
  canSourceCarryDefault,
  validateBpmnFlow,
  validateAllBpmnFlows,
} from '@besser/wme';
import type { UMLModel, BesserNode, BesserEdge } from '@besser/wme';

// v4 fixture helpers — the validator reads node `.id/.type/.data.gatewayType`
// and edge `.id/.type/.source/.target/.data.isDefault`. The BPMN flow subtype
// is carried by the edge `type` (`BPMNSequenceFlow` / `BPMNMessageFlow` /
// `BPMNAssociationFlow` / `BPMNDataAssociationFlow`) instead of develop's
// single `BPMNFlow` + `flowType`.
const node = (id: string, type: string, data: Record<string, unknown> = {}): BesserNode => ({
  id,
  type: type as BesserNode['type'],
  position: { x: 0, y: 0 },
  width: 100,
  height: 50,
  measured: { width: 100, height: 50 },
  data: { name: id, ...data },
});

const flow = (id: string, source: string, target: string, type: string, isDefault = false): BesserEdge => ({
  id,
  type: type as BesserEdge['type'],
  source,
  target,
  sourceHandle: '',
  targetHandle: '',
  data: { name: '', label: '', ...(isDefault ? { isDefault: true } : {}), points: [] },
});

const byId = (nodes: BesserNode[]): Record<string, BesserNode> =>
  Object.fromEntries(nodes.map((n) => [n.id, n]));

const model = (nodes: BesserNode[], edges: BesserEdge[]): UMLModel => ({
  version: '4.0.0',
  id: 'm',
  title: 'BPMN',
  type: UMLDiagramType.BPMN,
  nodes,
  edges,
  assessments: {},
});

describe('bpmn-flow-semantics', () => {
  it('allows sequence between flow nodes', () => {
    expect(getAllowedBpmnFlowTypes('bpmnTask', 'bpmnGateway')).toContain('sequence');
  });
  it('allows data association between task and data object', () => {
    const allowed = getAllowedBpmnFlowTypes('bpmnTask', 'bpmnDataObject');
    // A task ↔ data-object pair is neither a sequence nor a message flow; the
    // only legal subtype is the (data) association flavour.
    expect(allowed).not.toContain('sequence');
    expect(allowed).not.toContain('message');
    expect(allowed.some((t) => /association/.test(t))).toBe(true);
  });
  it('allows association when an annotation is involved', () => {
    expect(getAllowedBpmnFlowTypes('bpmnAnnotation', 'bpmnTask')).toContain('association');
  });
  it('has deterministic default-type priority', () => {
    expect(getDefaultBpmnFlowType(['association', 'sequence'])).toBe('sequence');
    expect(getDefaultBpmnFlowType(['message', 'association'])).toBe('message');
  });
});

describe('canSourceCarryDefault (BPMN 2.0.2 § 8.3.13)', () => {
  it('accepts activities and exclusive/inclusive/complex gateways', () => {
    expect(canSourceCarryDefault(node('t1', 'bpmnTask'))).toBe(true);
    expect(canSourceCarryDefault(node('g1', 'bpmnGateway', { gatewayType: 'exclusive' }))).toBe(true);
    expect(canSourceCarryDefault(node('g2', 'bpmnGateway', { gatewayType: 'inclusive' }))).toBe(true);
  });
  it('rejects parallel/event-based gateways, events and undefined', () => {
    expect(canSourceCarryDefault(node('g1', 'bpmnGateway', { gatewayType: 'parallel' }))).toBe(false);
    expect(canSourceCarryDefault(node('g2', 'bpmnGateway', { gatewayType: 'event-based' }))).toBe(false);
    expect(canSourceCarryDefault(node('s1', 'bpmnStartEvent'))).toBe(false);
    expect(canSourceCarryDefault(undefined)).toBe(false);
  });
});

describe('validateBpmnFlow', () => {
  it('returns no warnings for a legal sequence flow', () => {
    const nodes = byId([node('t1', 'bpmnTask'), node('g1', 'bpmnGateway', { gatewayType: 'exclusive' })]);
    const f = flow('f1', 't1', 'g1', 'BPMNSequenceFlow');
    expect(validateBpmnFlow(f, nodes)).toEqual([]);
  });

  it('flags an illegal flow type for the endpoint pair', () => {
    const nodes = byId([node('t1', 'bpmnTask'), node('t2', 'bpmnTask')]);
    const f = flow('f1', 't1', 't2', 'BPMNAssociationFlow'); // task→task can't be an association
    const warnings = validateBpmnFlow(f, nodes);
    expect(warnings.map((w) => w.code)).toContain('illegal-flow-type');
  });

  it('flags a default flag on an ineligible source', () => {
    const nodes = byId([node('g1', 'bpmnGateway', { gatewayType: 'parallel' }), node('t1', 'bpmnTask')]);
    const f = flow('f1', 'g1', 't1', 'BPMNSequenceFlow', true); // parallel gw can't carry default
    const warnings = validateBpmnFlow(f, nodes);
    expect(warnings.map((w) => w.code)).toContain('default-flow-illegal-source');
  });

  it('flags a missing endpoint', () => {
    const f = flow('f1', 'ghost', 't1', 'BPMNSequenceFlow');
    const warnings = validateBpmnFlow(f, byId([node('t1', 'bpmnTask')]));
    expect(warnings.map((w) => w.code)).toContain('missing-endpoint');
    expect(warnings[0].flowId).toBe('f1');
  });
});

describe('validateAllBpmnFlows', () => {
  it('collects warnings across every flow of a model', () => {
    const t1 = node('t1', 'bpmnTask');
    const t2 = node('t2', 'bpmnTask');
    const bad = flow('bad', 't1', 't2', 'BPMNAssociationFlow');
    const good = flow('good', 't1', 't2', 'BPMNSequenceFlow');
    const warnings = validateAllBpmnFlows(model([t1, t2], [bad, good]));
    expect(warnings).toHaveLength(1);
    expect(warnings[0].flowId).toBe('bad');
    expect(warnings[0].code).toBe('illegal-flow-type');
  });

  it('returns nothing for a model without edges', () => {
    expect(validateAllBpmnFlows(model([node('t1', 'bpmnTask')], []))).toEqual([]);
  });
});
