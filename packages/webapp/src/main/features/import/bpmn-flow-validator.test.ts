import { describe, it, expect } from 'vitest';
import {
  getAllowedBpmnFlowTypes,
  getDefaultBpmnFlowType,
  canSourceCarryDefault,
  validateBpmnFlow,
  validateAllBpmnFlows,
} from '@besser/wme';

// Minimal fixture helpers — the validator reads .id/.type/.source/.target/.flowType/.isDefault.
const node = (id: string, type: string, extra: Record<string, unknown> = {}) => ({ id, type, ...extra });
const flow = (id: string, sourceId: string, targetId: string, flowType: string, isDefault = false) => ({
  id,
  type: 'BPMNFlow',
  source: { element: sourceId },
  target: { element: targetId },
  flowType,
  isDefault,
});

describe('bpmn-flow-semantics', () => {
  it('allows sequence between flow nodes', () => {
    expect(getAllowedBpmnFlowTypes('BPMNTask' as any, 'BPMNGateway' as any)).toContain('sequence');
  });
  it('allows data association between task and data object', () => {
    expect(getAllowedBpmnFlowTypes('BPMNTask' as any, 'BPMNDataObject' as any)).toContain('data association');
  });
  it('allows association when an annotation is involved', () => {
    expect(getAllowedBpmnFlowTypes('BPMNAnnotation' as any, 'BPMNTask' as any)).toContain('association');
  });
  it('has deterministic default-type priority', () => {
    expect(getDefaultBpmnFlowType(['association', 'sequence'])).toBe('sequence');
    expect(getDefaultBpmnFlowType(['message', 'association'])).toBe('message');
  });
});

describe('canSourceCarryDefault (BPMN 2.0.2 § 8.3.13)', () => {
  it('accepts activities and exclusive/inclusive/complex gateways', () => {
    expect(canSourceCarryDefault({ type: 'BPMNTask' })).toBe(true);
    expect(canSourceCarryDefault({ type: 'BPMNGateway', gatewayType: 'exclusive' })).toBe(true);
    expect(canSourceCarryDefault({ type: 'BPMNGateway', gatewayType: 'inclusive' })).toBe(true);
  });
  it('rejects parallel/event-based gateways, events and undefined', () => {
    expect(canSourceCarryDefault({ type: 'BPMNGateway', gatewayType: 'parallel' })).toBe(false);
    expect(canSourceCarryDefault({ type: 'BPMNStartEvent' })).toBe(false);
    expect(canSourceCarryDefault(undefined)).toBe(false);
  });
});

describe('validateBpmnFlow', () => {
  it('returns no warnings for a legal sequence flow', () => {
    const els = {
      t1: node('t1', 'BPMNTask'),
      g1: node('g1', 'BPMNGateway', { gatewayType: 'exclusive' }),
    };
    const f = flow('f1', 't1', 'g1', 'sequence');
    expect(validateBpmnFlow(f, { ...els, f1: f as any })).toEqual([]);
  });

  it('flags an illegal flow type for the endpoint pair', () => {
    const els = { t1: node('t1', 'BPMNTask'), t2: node('t2', 'BPMNTask') };
    const f = flow('f1', 't1', 't2', 'association'); // task→task can't be an association
    const warnings = validateBpmnFlow(f, { ...els, f1: f as any });
    expect(warnings.map((w) => w.code)).toContain('illegal-flow-type');
  });

  it('flags a default flag on an ineligible source', () => {
    const els = {
      g1: node('g1', 'BPMNGateway', { gatewayType: 'parallel' }),
      t1: node('t1', 'BPMNTask'),
    };
    const f = flow('f1', 'g1', 't1', 'sequence', true); // parallel gw can't carry default
    const warnings = validateBpmnFlow(f, { ...els, f1: f as any });
    expect(warnings.map((w) => w.code)).toContain('default-flow-illegal-source');
  });

  it('flags a missing endpoint', () => {
    const f = flow('f1', 'ghost', 't1', 'sequence');
    const warnings = validateBpmnFlow(f, { f1: f as any, t1: node('t1', 'BPMNTask') });
    expect(warnings.map((w) => w.code)).toContain('missing-endpoint');
  });
});

describe('validateAllBpmnFlows', () => {
  it('collects warnings across every flow and ignores non-flows', () => {
    const t1 = node('t1', 'BPMNTask');
    const t2 = node('t2', 'BPMNTask');
    const bad = flow('bad', 't1', 't2', 'association');
    const good = flow('good', 't1', 't2', 'sequence');
    const warnings = validateAllBpmnFlows({ t1, t2, bad: bad as any, good: good as any });
    expect(warnings).toHaveLength(1);
    expect(warnings[0].flowId).toBe('bad');
  });
});
