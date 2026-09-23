import { describe, it, expect } from 'vitest';
import {
  clampTrustScore,
  clampMultiplicity,
  findDownstreamAgenticConstructs,
  findOrphanedMergingGateways,
  resolveUpstreamDivergingGateway,
  generateGovernanceDsl,
} from '@besser/wme';
import type { UMLModel } from '@besser/wme';
import { apollonBpmnToXml } from '../export/bpmn-xml-exporter';
import { bpmnXmlToApollon } from './bpmn-xml-importer';

describe('clampTrustScore', () => {
  it('clamps below 0 and above 100', () => {
    expect(clampTrustScore(-10)).toBe(0);
    expect(clampTrustScore(150)).toBe(100);
  });
  it('passes in-range values through (rounded)', () => {
    expect(clampTrustScore(0)).toBe(0);
    expect(clampTrustScore(100)).toBe(100);
    expect(clampTrustScore(80)).toBe(80);
    expect(clampTrustScore(42.6)).toBe(43);
  });
});

describe('clampMultiplicity', () => {
  it('floors at 1 and rounds', () => {
    expect(clampMultiplicity(0)).toBe(1);
    expect(clampMultiplicity(-5)).toBe(1);
    expect(clampMultiplicity(1)).toBe(1);
    expect(clampMultiplicity(3)).toBe(3);
    expect(clampMultiplicity(2.6)).toBe(3);
  });
});

describe('agentic round-trip (04D2)', () => {
  it('preserves agentic attributes through export → import', () => {
    const model = buildFixtureAgenticModel();
    const { xml } = apollonBpmnToXml(model);
    const { model: parsed, warnings } = bpmnXmlToApollon(xml);
    // The fixture intentionally has a merging gateway with no sequence-flow
    // upstream (it's a self-contained shape-collection, not a paper-valid
    // collaboration block). Post-04D2-followup-F3 flags it as orphaned — out
    // of scope for this round-trip-fidelity test. Filter the warning out.
    const filtered = warnings.filter((w) => w.code !== 'orphaned-merging-gateway');
    expect(filtered).toEqual([]);

    const findEl = (name: string): Record<string, unknown> | undefined =>
      Object.values(parsed.elements).find((e) => (e as { name?: string }).name === name) as
        | Record<string, unknown>
        | undefined;

    const lane = findEl('AgentReviewer');
    expect(lane?.isAgentic).toBe(true);
    expect(lane?.role).toBe('supervision');
    expect(lane?.trustScore).toBe(90);
    expect(lane?.multiplicity).toBe(3);

    const task = findEl('Review');
    expect(task?.isAgentic).toBe(true);
    expect(task?.reflectionMode).toBe('cross');
    expect(task?.trustScore).toBe(80);

    const parGw = findEl('AND');
    expect(parGw?.isAgentic).toBe(true);
    expect(parGw?.gatewayRole).toBe('diverging');
    expect(parGw?.trustScore).toBe(75);

    const incGw = findEl('OR');
    expect(incGw?.isAgentic).toBe(true);
    expect(incGw?.gatewayRole).toBe('merging');
    expect(incGw?.trustScore).toBe(60);
  });

  it('warns on a malformed trustScore and still loads the element', () => {
    const { xml } = apollonBpmnToXml(buildFixtureAgenticModel());
    // The agentic lane carries trustScore="90"; corrupt it.
    const corrupted = xml.replace('trustScore="90"', 'trustScore="bogus"');
    const { warnings, model } = bpmnXmlToApollon(corrupted);
    expect(warnings.some((w) => w.code === 'agentic-bad-trust-score')).toBe(true);
    const lane = Object.values(model.elements).find((e) => (e as { name?: string }).name === 'AgentReviewer');
    expect(lane).toBeDefined();
  });

  it('warns on a malformed multiplicity and still loads the lane', () => {
    const model = buildFixtureAgenticModel();
    (model.elements as Record<string, { multiplicity?: number }>)['Lane_1'].multiplicity = 3;
    const { xml } = apollonBpmnToXml(model);
    const corrupted = xml.replace('multiplicity="3"', 'multiplicity="lots"');
    const { warnings, model: parsed } = bpmnXmlToApollon(corrupted);
    expect(warnings.some((w) => w.code === 'agentic-bad-multiplicity')).toBe(true);
    const lane = Object.values(parsed.elements).find((e) => (e as { name?: string }).name === 'AgentReviewer');
    expect(lane).toBeDefined();
    // The importer leaves a bad value unset on the raw model JSON; the
    // default-to-1 is applied later by BPMNSwimlane.deserialize when the
    // editor instantiates the class (same posture as the trustScore test).
    expect((lane as { multiplicity?: number }).multiplicity).toBeUndefined();
  });

  it('warns on an unknown enum value', () => {
    const { xml } = apollonBpmnToXml(buildFixtureAgenticModel());
    // The agentic task carries reflectionMode="cross"; corrupt to an unknown value.
    const corrupted = xml.replace('reflectionMode="cross"', 'reflectionMode="telepathy"');
    const { warnings } = bpmnXmlToApollon(corrupted);
    expect(warnings.some((w) => w.code === 'agentic-unknown-enum')).toBe(true);
  });

  it('non-agentic export contains no agentic extension blocks', () => {
    const baseModel = buildFixtureNonAgenticModel();
    const { xml } = apollonBpmnToXml(baseModel);
    expect(xml).toContain('xmlns:agentic=');
    expect(xml).not.toContain('<agentic:agentic');
    expect(xml).not.toContain('<bpmn:extensionElements>');
  });

  // lane carries agentDiagramRef → survives round-trip on the lane only.
  it('preserves agentDiagramRef on the agentic lane through round-trip', () => {
    const REF = '3f0a1c2d-4e5b-4f6a-9012-3456789abcde';
    const model = buildFixtureAgenticModel();
    // Mutate the lane in the fixture to carry the ref; everything else stays.
    (model.elements as Record<string, { agentDiagramRef?: string }>)['Lane_1'].agentDiagramRef = REF;

    const { xml } = apollonBpmnToXml(model);
    // Sanity: the attribute lands on the lane's agentic block.
    expect(xml).toMatch(/<agentic:agentic[^/]*agentDiagramRef="3f0a1c2d-4e5b-4f6a-9012-3456789abcde"/);

    const { model: parsed } = bpmnXmlToApollon(xml);
    const lane = Object.values(parsed.elements).find((e) => (e as { name?: string }).name === 'AgentReviewer');
    expect((lane as { agentDiagramRef?: string }).agentDiagramRef).toBe(REF);

    // Other agentic constructs MUST NOT pick up agentDiagramRef (lane-only).
    const task = Object.values(parsed.elements).find((e) => (e as { name?: string }).name === 'Review');
    expect((task as { agentDiagramRef?: string }).agentDiagramRef).toBeUndefined();
  });

  // non-agentic lane with a stale ref must NOT emit the extension
  // (matches extension presence implies isAgentic).
  it('does not emit agentDiagramRef on a non-agentic lane', () => {
    const model = buildFixtureNonAgenticModel();
    // Find any swimlane in the non-agentic fixture and plant a stale ref.
    const lane = Object.values(model.elements ?? {}).find((e) => (e as { type?: string }).type === 'BPMNSwimlane') as
      | { agentDiagramRef?: string }
      | undefined;
    if (lane) lane.agentDiagramRef = 'should-not-be-emitted';
    const { xml } = apollonBpmnToXml(model);
    expect(xml).not.toContain('agentDiagramRef=');
    expect(xml).not.toContain('<agentic:agentic');
  });

  // extension block present but no agentDiagramRef attribute → field
  // stays undefined; no warning.
  it('leaves agentDiagramRef undefined when the attribute is absent', () => {
    const model = buildFixtureAgenticModel();
    const { xml } = apollonBpmnToXml(model);
    expect(xml).not.toContain('agentDiagramRef='); // fixture has no ref
    const { model: parsed, warnings } = bpmnXmlToApollon(xml);
    const lane = Object.values(parsed.elements).find((e) => (e as { name?: string }).name === 'AgentReviewer');
    expect((lane as { agentDiagramRef?: string }).agentDiagramRef).toBeUndefined();
    // No new warning code from 08.
    expect(warnings.some((w) => w.message.toLowerCase().includes('agentdiagramref'))).toBe(false);
  });

  // agentic task carries agentDiagramRef → survives round-trip.
  it('preserves agentDiagramRef on the agentic task through round-trip', () => {
    const REF = '7c1e9a40-2b3c-4d5e-8f90-1a2b3c4d5e6f';
    const model = buildFixtureAgenticModel();
    // The fixture's agentic task is named 'Review'.
    const taskEntry = Object.values(model.elements as Record<string, { name?: string; agentDiagramRef?: string }>).find(
      (e) => e.name === 'Review',
    );
    if (taskEntry) taskEntry.agentDiagramRef = REF;

    const { xml } = apollonBpmnToXml(model);
    expect(xml).toMatch(/agentDiagramRef="7c1e9a40-2b3c-4d5e-8f90-1a2b3c4d5e6f"/);

    const { model: parsed } = bpmnXmlToApollon(xml);
    const task = Object.values(parsed.elements).find((e) => (e as { name?: string }).name === 'Review');
    expect((task as { agentDiagramRef?: string }).agentDiagramRef).toBe(REF);
  });

  // non-agentic task with a stale ref must NOT emit the extension.
  it('does not emit agentDiagramRef on a non-agentic task', () => {
    const model = buildFixtureNonAgenticModel();
    const task = Object.values(model.elements ?? {}).find((e) => (e as { type?: string }).type === 'BPMNTask') as
      | { agentDiagramRef?: string }
      | undefined;
    if (task) task.agentDiagramRef = 'should-not-be-emitted';
    const { xml } = apollonBpmnToXml(model);
    expect(xml).not.toContain('agentDiagramRef=');
  });
});

describe('importer orphaned-merging-gateway warning', () => {
  it('emits orphaned-merging-gateway warning when no upstream diverging exists', () => {
    // Fixture from buildFixtureAgenticModel — it has Gateway_2 (OR, merging)
    // with no sequence-flow upstream. Reuse it and assert the warning fires.
    const { xml } = apollonBpmnToXml(buildFixtureAgenticModelForOrphan());
    const { warnings } = bpmnXmlToApollon(xml);
    expect(warnings.some((w) => w.code === 'orphaned-merging-gateway')).toBe(true);
  });

  // Minimal fixture: one merging gateway and nothing else upstream of it.
  function buildFixtureAgenticModelForOrphan(): UMLModel {
    const bounds = (x: number, y: number, w: number, h: number) => ({ x, y, width: w, height: h });
    return {
      version: '3.0.0',
      type: 'BPMNDiagram' as UMLModel['type'],
      size: { width: 400, height: 200 },
      interactive: { elements: {}, relationships: {} },
      assessments: {},
      elements: {
        Pool_1: {
          id: 'Pool_1',
          name: 'P',
          type: 'BPMNPool',
          owner: null,
          bounds: bounds(0, 0, 400, 200),
        },
        Gateway_OR: {
          id: 'Gateway_OR',
          name: 'OrphanOR',
          type: 'BPMNGateway',
          owner: 'Pool_1',
          bounds: bounds(80, 80, 40, 40),
          gatewayType: 'inclusive',
          isAgentic: true,
          gatewayRole: 'merging',
          trustScore: 50,
        } as unknown as UMLModel['elements'][string],
      },
      relationships: {},
    } as unknown as UMLModel;
  }
});

// Build a minimal UMLModel with one of each agentic construct + supporting
// pools / lanes / flow. Coordinates are arbitrary — the agentic round-trip
// doesn't depend on geometry, only that the BPMN DI emits well-formed shapes.
function buildFixtureAgenticModel(): UMLModel {
  const bounds = (x: number, y: number, w: number, h: number) => ({ x, y, width: w, height: h });
  return {
    version: '3.0.0',
    type: 'BPMNDiagram' as UMLModel['type'],
    size: { width: 1000, height: 600 },
    interactive: { elements: {}, relationships: {} },
    assessments: {},
    elements: {
      Pool_1: {
        id: 'Pool_1',
        name: 'Project Repository',
        type: 'BPMNPool',
        owner: null,
        bounds: bounds(0, 0, 600, 300),
      },
      Pool_2: {
        id: 'Pool_2',
        name: 'External Tool',
        type: 'BPMNPool',
        owner: null,
        bounds: bounds(0, 400, 600, 100),
      },
      Lane_1: {
        id: 'Lane_1',
        name: 'AgentReviewer',
        type: 'BPMNSwimlane',
        owner: 'Pool_1',
        bounds: bounds(40, 0, 560, 300),
        isAgentic: true,
        role: 'supervision',
        trustScore: 90,
        multiplicity: 3,
      } as unknown as UMLModel['elements'][string],
      Task_1: {
        id: 'Task_1',
        name: 'Review',
        type: 'BPMNTask',
        owner: 'Lane_1',
        bounds: bounds(80, 40, 100, 60),
        taskType: 'user',
        marker: 'none',
        isAgentic: true,
        reflectionMode: 'cross',
        trustScore: 80,
      } as unknown as UMLModel['elements'][string],
      Gateway_1: {
        id: 'Gateway_1',
        name: 'AND',
        type: 'BPMNGateway',
        owner: 'Lane_1',
        bounds: bounds(220, 50, 40, 40),
        gatewayType: 'parallel',
        isAgentic: true,
        gatewayRole: 'diverging',
        trustScore: 75,
      } as unknown as UMLModel['elements'][string],
      Gateway_2: {
        id: 'Gateway_2',
        name: 'OR',
        type: 'BPMNGateway',
        owner: 'Lane_1',
        bounds: bounds(320, 50, 40, 40),
        gatewayType: 'inclusive',
        isAgentic: true,
        gatewayRole: 'merging',
        trustScore: 60,
      } as unknown as UMLModel['elements'][string],
    },
    relationships: {
      MF_1: {
        id: 'MF_1',
        name: '',
        type: 'BPMNFlow',
        owner: null,
        bounds: bounds(300, 300, 10, 100),
        path: [
          { x: 0, y: 0 },
          { x: 0, y: 100 },
        ],
        source: { element: 'Pool_1', direction: 'Down' as never },
        target: { element: 'Pool_2', direction: 'Up' as never },
        flowType: 'message',
      } as unknown as UMLModel['relationships'][string],
    },
  } as unknown as UMLModel;
}

// ─── 04D2-followup: collab-mode resolver + downstream walker (F1) ───────────
//
// The helpers operate on a *unified* `elementsById` map (elements + flows
// merged) — same shape `validateAllBpmnFlows` consumes after the 04C FB1 fix.
// Build helpers below produce that shape directly.

type AnyEl = { id: string; type: string; [k: string]: unknown };

function el(id: string, type: string, extra: Record<string, unknown> = {}): AnyEl {
  return { id, type, ...extra };
}

function seqFlow(id: string, sourceId: string, targetId: string): AnyEl {
  return {
    id,
    type: 'BPMNFlow',
    flowType: 'sequence',
    source: { element: sourceId },
    target: { element: targetId },
  };
}

describe('resolveUpstreamDivergingGateway (block-pairing walker)', () => {
  it('walks one hop back to a diverging gateway', () => {
    const elementsById: Record<string, AnyEl> = {
      G1: el('G1', 'BPMNGateway', {
        gatewayType: 'parallel',
        isAgentic: true,
        gatewayRole: 'diverging',
      }),
      T1: el('T1', 'BPMNTask', { isAgentic: true }),
      F1: seqFlow('F1', 'G1', 'T1'),
    };
    expect((resolveUpstreamDivergingGateway('T1', elementsById) as { id: string } | undefined)?.id).toBe('G1');
  });

  it('walks multiple hops back through non-agentic intermediaries', () => {
    const elementsById: Record<string, AnyEl> = {
      G1: el('G1', 'BPMNGateway', {
        gatewayType: 'parallel',
        isAgentic: true,
        gatewayRole: 'diverging',
      }),
      T1: el('T1', 'BPMNTask'),
      T2: el('T2', 'BPMNTask', { isAgentic: true }),
      G2: el('G2', 'BPMNGateway', {
        gatewayType: 'inclusive',
        isAgentic: true,
        gatewayRole: 'merging',
      }),
      F1: seqFlow('F1', 'G1', 'T1'),
      F2: seqFlow('F2', 'T1', 'T2'),
      F3: seqFlow('F3', 'T2', 'G2'),
    };
    expect((resolveUpstreamDivergingGateway('G2', elementsById) as { id: string } | undefined)?.id).toBe('G1');
  });

  it('returns nearest enclosing diverging gateway in nested collaboration blocks', () => {
    // outer → middle task → inner diverging → inner task → inner merging
    // Inner task and inner merging must resolve to the INNER diverging.
    const elementsById: Record<string, AnyEl> = {
      Gouter: el('Gouter', 'BPMNGateway', {
        gatewayType: 'parallel',
        isAgentic: true,
        gatewayRole: 'diverging',
      }),
      Tmid: el('Tmid', 'BPMNTask'),
      Ginner: el('Ginner', 'BPMNGateway', {
        gatewayType: 'parallel',
        isAgentic: true,
        gatewayRole: 'diverging',
      }),
      Tinner: el('Tinner', 'BPMNTask', { isAgentic: true }),
      GinnerMerge: el('GinnerMerge', 'BPMNGateway', {
        gatewayType: 'parallel',
        isAgentic: true,
        gatewayRole: 'merging',
      }),
      F1: seqFlow('F1', 'Gouter', 'Tmid'),
      F2: seqFlow('F2', 'Tmid', 'Ginner'),
      F3: seqFlow('F3', 'Ginner', 'Tinner'),
      F4: seqFlow('F4', 'Tinner', 'GinnerMerge'),
    };
    expect((resolveUpstreamDivergingGateway('Tinner', elementsById) as { id: string } | undefined)?.id).toBe('Ginner');
    expect((resolveUpstreamDivergingGateway('GinnerMerge', elementsById) as { id: string } | undefined)?.id).toBe(
      'Ginner',
    );
  });

  it('resolves outer merging to the OUTER diverging in nested blocks', () => {
    // Gouter → A → Ginner → B → GinnerMerge → C → GouterMerge
    // GouterMerge must resolve to Gouter, NOT Ginner.
    const elementsById: Record<string, AnyEl> = {
      Gouter: el('Gouter', 'BPMNGateway', {
        gatewayType: 'parallel',
        isAgentic: true,
        gatewayRole: 'diverging',
      }),
      A: el('A', 'BPMNTask'),
      Ginner: el('Ginner', 'BPMNGateway', {
        gatewayType: 'parallel',
        isAgentic: true,
        gatewayRole: 'diverging',
      }),
      B: el('B', 'BPMNTask', { isAgentic: true }),
      GinnerMerge: el('GinnerMerge', 'BPMNGateway', {
        gatewayType: 'parallel',
        isAgentic: true,
        gatewayRole: 'merging',
      }),
      C: el('C', 'BPMNTask'),
      GouterMerge: el('GouterMerge', 'BPMNGateway', {
        gatewayType: 'parallel',
        isAgentic: true,
        gatewayRole: 'merging',
      }),
      F1: seqFlow('F1', 'Gouter', 'A'),
      F2: seqFlow('F2', 'A', 'Ginner'),
      F3: seqFlow('F3', 'Ginner', 'B'),
      F4: seqFlow('F4', 'B', 'GinnerMerge'),
      F5: seqFlow('F5', 'GinnerMerge', 'C'),
      F6: seqFlow('F6', 'C', 'GouterMerge'),
    };
    expect((resolveUpstreamDivergingGateway('GouterMerge', elementsById) as { id: string } | undefined)?.id).toBe(
      'Gouter',
    );
    expect((resolveUpstreamDivergingGateway('GinnerMerge', elementsById) as { id: string } | undefined)?.id).toBe(
      'Ginner',
    );
    expect((resolveUpstreamDivergingGateway('B', elementsById) as { id: string } | undefined)?.id).toBe('Ginner');
  });

  it('returns undefined when no upstream diverging gateway exists', () => {
    const elementsById: Record<string, AnyEl> = {
      Start: el('Start', 'BPMNStartEvent'),
      T1: el('T1', 'BPMNTask', { isAgentic: true }),
      F1: seqFlow('F1', 'Start', 'T1'),
    };
    expect(resolveUpstreamDivergingGateway('T1', elementsById)).toBeUndefined();
  });

  it('is cycle-safe (does not hang on cyclic graphs)', () => {
    const elementsById: Record<string, AnyEl> = {
      T1: el('T1', 'BPMNTask'),
      T2: el('T2', 'BPMNTask'),
      F1: seqFlow('F1', 'T1', 'T2'),
      F2: seqFlow('F2', 'T2', 'T1'),
    };
    expect(resolveUpstreamDivergingGateway('T2', elementsById)).toBeUndefined();
  });

  it('ignores non-sequence flows when walking', () => {
    // Message flow from a diverging gateway must NOT count as upstream sequence.
    const elementsById: Record<string, AnyEl> = {
      G1: el('G1', 'BPMNGateway', {
        gatewayType: 'parallel',
        isAgentic: true,
        gatewayRole: 'diverging',
      }),
      T1: el('T1', 'BPMNTask', { isAgentic: true }),
      MF: {
        id: 'MF',
        type: 'BPMNFlow',
        flowType: 'message',
        source: { element: 'G1' },
        target: { element: 'T1' },
      },
    };
    expect(resolveUpstreamDivergingGateway('T1', elementsById)).toBeUndefined();
  });
});

describe('findDownstreamAgenticConstructs (04D2-followup F1)', () => {
  it('collects agentic tasks and merging gateways downstream of a diverging gateway', () => {
    const elementsById: Record<string, AnyEl> = {
      G1: el('G1', 'BPMNGateway', {
        gatewayType: 'parallel',
        isAgentic: true,
        gatewayRole: 'diverging',
        collaborationMode: 'role',
      }),
      Ta: el('Ta', 'BPMNTask', { isAgentic: true }),
      Tb: el('Tb', 'BPMNTask', { isAgentic: true }),
      Tc: el('Tc', 'BPMNTask'), // not agentic — excluded
      G2: el('G2', 'BPMNGateway', {
        gatewayType: 'parallel',
        isAgentic: true,
        gatewayRole: 'merging',
      }),
      F1: seqFlow('F1', 'G1', 'Ta'),
      F2: seqFlow('F2', 'G1', 'Tb'),
      F3: seqFlow('F3', 'Ta', 'Tc'),
      F4: seqFlow('F4', 'Tb', 'G2'),
      F5: seqFlow('F5', 'Tc', 'G2'),
    };
    const result = findDownstreamAgenticConstructs('G1', elementsById);
    expect(result.taskIds.sort()).toEqual(['Ta', 'Tb']);
    expect(result.mergingGatewayIds).toEqual(['G2']);
  });

  it('stops at a nested diverging gateway (does not bleed into inner block)', () => {
    const elementsById: Record<string, AnyEl> = {
      Gouter: el('Gouter', 'BPMNGateway', {
        gatewayType: 'parallel',
        isAgentic: true,
        gatewayRole: 'diverging',
        collaborationMode: 'role',
      }),
      Tmid: el('Tmid', 'BPMNTask', { isAgentic: true }),
      Ginner: el('Ginner', 'BPMNGateway', {
        gatewayType: 'parallel',
        isAgentic: true,
        gatewayRole: 'diverging',
        collaborationMode: 'voting',
      }),
      Tinner: el('Tinner', 'BPMNTask', { isAgentic: true }),
      GinnerMerge: el('GinnerMerge', 'BPMNGateway', {
        gatewayType: 'parallel',
        isAgentic: true,
        gatewayRole: 'merging',
      }),
      F1: seqFlow('F1', 'Gouter', 'Tmid'),
      F2: seqFlow('F2', 'Tmid', 'Ginner'),
      F3: seqFlow('F3', 'Ginner', 'Tinner'),
      F4: seqFlow('F4', 'Tinner', 'GinnerMerge'),
    };
    const result = findDownstreamAgenticConstructs('Gouter', elementsById);
    // Tmid is reachable; Ginner blocks further descent; Tinner / GinnerMerge belong to inner block.
    expect(result.taskIds).toEqual(['Tmid']);
    expect(result.mergingGatewayIds).toEqual([]);
  });

  it('jumps past a nested block to reach the outer merging (O3 fix, forward)', () => {
    // Gouter → A → Ginner → B → GinnerMerge → C → GouterMerge
    // Propagating from Gouter must collect GouterMerge but NOT B / GinnerMerge
    // (those belong to Ginner's block).
    const elementsById: Record<string, AnyEl> = {
      Gouter: el('Gouter', 'BPMNGateway', {
        gatewayType: 'parallel',
        isAgentic: true,
        gatewayRole: 'diverging',
        collaborationMode: 'role',
      }),
      A: el('A', 'BPMNTask'),
      Ginner: el('Ginner', 'BPMNGateway', {
        gatewayType: 'parallel',
        isAgentic: true,
        gatewayRole: 'diverging',
        collaborationMode: 'voting',
      }),
      B: el('B', 'BPMNTask', { isAgentic: true }),
      GinnerMerge: el('GinnerMerge', 'BPMNGateway', {
        gatewayType: 'parallel',
        isAgentic: true,
        gatewayRole: 'merging',
      }),
      C: el('C', 'BPMNTask'),
      GouterMerge: el('GouterMerge', 'BPMNGateway', {
        gatewayType: 'parallel',
        isAgentic: true,
        gatewayRole: 'merging',
      }),
      F1: seqFlow('F1', 'Gouter', 'A'),
      F2: seqFlow('F2', 'A', 'Ginner'),
      F3: seqFlow('F3', 'Ginner', 'B'),
      F4: seqFlow('F4', 'B', 'GinnerMerge'),
      F5: seqFlow('F5', 'GinnerMerge', 'C'),
      F6: seqFlow('F6', 'C', 'GouterMerge'),
    };
    const result = findDownstreamAgenticConstructs('Gouter', elementsById);
    expect(result.taskIds).toEqual([]); // B belongs to inner block, A/C non-agentic
    expect(result.mergingGatewayIds).toEqual(['GouterMerge']);
  });

  it('stops descending past the paired merging gateway', () => {
    // G1 → T1 → G2 (merging) → T2 (agentic) → G3 (merging)
    // Propagating from G1 must collect only G2 (the immediate paired merging),
    // not T2 or G3 (which belong to the next enclosing block, or are orphans).
    const elementsById: Record<string, AnyEl> = {
      G1: el('G1', 'BPMNGateway', {
        gatewayType: 'parallel',
        isAgentic: true,
        gatewayRole: 'diverging',
        collaborationMode: 'role',
      }),
      T1: el('T1', 'BPMNTask', { isAgentic: true }),
      G2: el('G2', 'BPMNGateway', {
        gatewayType: 'parallel',
        isAgentic: true,
        gatewayRole: 'merging',
      }),
      T2: el('T2', 'BPMNTask', { isAgentic: true }),
      G3: el('G3', 'BPMNGateway', {
        gatewayType: 'parallel',
        isAgentic: true,
        gatewayRole: 'merging',
      }),
      F1: seqFlow('F1', 'G1', 'T1'),
      F2: seqFlow('F2', 'T1', 'G2'),
      F3: seqFlow('F3', 'G2', 'T2'),
      F4: seqFlow('F4', 'T2', 'G3'),
    };
    const result = findDownstreamAgenticConstructs('G1', elementsById);
    expect(result.taskIds).toEqual(['T1']);
    expect(result.mergingGatewayIds).toEqual(['G2']);
  });
});

describe('findOrphanedMergingGateways (04D2-followup F1)', () => {
  it('flags merging gateways with no upstream diverging gateway', () => {
    const elementsById: Record<string, AnyEl> = {
      Start: el('Start', 'BPMNStartEvent'),
      T1: el('T1', 'BPMNTask', { isAgentic: true }),
      Orphan: el('Orphan', 'BPMNGateway', {
        gatewayType: 'parallel',
        isAgentic: true,
        gatewayRole: 'merging',
      }),
      F1: seqFlow('F1', 'Start', 'T1'),
      F2: seqFlow('F2', 'T1', 'Orphan'),
    };
    expect(findOrphanedMergingGateways(elementsById)).toEqual(['Orphan']);
  });

  it('does not flag merging gateways that have an upstream diverging gateway', () => {
    const elementsById: Record<string, AnyEl> = {
      G1: el('G1', 'BPMNGateway', {
        gatewayType: 'parallel',
        isAgentic: true,
        gatewayRole: 'diverging',
        collaborationMode: 'role',
      }),
      T1: el('T1', 'BPMNTask', { isAgentic: true }),
      G2: el('G2', 'BPMNGateway', {
        gatewayType: 'parallel',
        isAgentic: true,
        gatewayRole: 'merging',
      }),
      F1: seqFlow('F1', 'G1', 'T1'),
      F2: seqFlow('F2', 'T1', 'G2'),
    };
    expect(findOrphanedMergingGateways(elementsById)).toEqual([]);
  });

  it('ignores non-agentic gateways and diverging gateways', () => {
    const elementsById: Record<string, AnyEl> = {
      Plain: el('Plain', 'BPMNGateway', { gatewayType: 'parallel' }),
      Diverging: el('Diverging', 'BPMNGateway', {
        gatewayType: 'parallel',
        isAgentic: true,
        gatewayRole: 'diverging',
        collaborationMode: 'role',
      }),
    };
    expect(findOrphanedMergingGateways(elementsById)).toEqual([]);
  });
});

function buildFixtureNonAgenticModel(): UMLModel {
  const bounds = (x: number, y: number, w: number, h: number) => ({ x, y, width: w, height: h });
  return {
    version: '3.0.0',
    type: 'BPMNDiagram' as UMLModel['type'],
    size: { width: 600, height: 300 },
    interactive: { elements: {}, relationships: {} },
    assessments: {},
    elements: {
      Pool_1: {
        id: 'Pool_1',
        name: 'Plain Pool',
        type: 'BPMNPool',
        owner: null,
        bounds: bounds(0, 0, 600, 200),
      },
      Lane_1: {
        id: 'Lane_1',
        name: 'Plain Lane',
        type: 'BPMNSwimlane',
        owner: 'Pool_1',
        bounds: bounds(40, 0, 560, 200),
      } as unknown as UMLModel['elements'][string],
      Task_1: {
        id: 'Task_1',
        name: 'Plain Task',
        type: 'BPMNTask',
        owner: 'Lane_1',
        bounds: bounds(80, 40, 100, 60),
        taskType: 'default',
        marker: 'none',
      } as unknown as UMLModel['elements'][string],
    },
    relationships: {},
  } as unknown as UMLModel;
}

describe('governance DSL round-trip', () => {
  it('preserves a multi-line governance DSL through export → import', () => {
    const model = buildFixtureAgenticModel();
    const dsl = [
      '// Generated from agentic merging gateway "AND"',
      'Scopes:',
      '    Tasks:',
      '        AND',
      'Participants:',
      '    Individuals :',
      '        (Agent) WorkerAgent { confidence : 0.80 }',
      'MajorityPolicy ANDPolicy {',
      '    Scope: AND',
      '    DecisionType as BooleanDecision',
      '    Participant list : WorkerAgent',
      '    Parameters:',
      '        ratio : 0.5',
      '}',
    ].join('\n');

    const mergingGw = Object.values(model.elements).find(
      (e) =>
        (e as { type?: string }).type === 'BPMNGateway' && (e as { gatewayRole?: string }).gatewayRole === 'merging',
    ) as Record<string, unknown>;
    mergingGw.governanceDsl = dsl;

    const { xml } = apollonBpmnToXml(model);
    expect(xml).toContain('<agentic:governance><![CDATA[');

    const { model: parsed } = bpmnXmlToApollon(xml);
    const gw2 = Object.values(parsed.elements).find(
      (e) =>
        (e as { type?: string }).type === 'BPMNGateway' && (e as { gatewayRole?: string }).gatewayRole === 'merging',
    ) as Record<string, unknown>;
    expect(gw2.governanceDsl).toBe(dsl);
  });

  it('round-trips a DSL containing a literal ]]> sequence', () => {
    const model = buildFixtureAgenticModel();
    const dsl = '// edge ]]> case\nMajorityPolicy P { Scope: S }';
    const mergingGw = Object.values(model.elements).find(
      (e) => (e as { gatewayRole?: string }).gatewayRole === 'merging',
    ) as Record<string, unknown>;
    mergingGw.governanceDsl = dsl;
    const { xml } = apollonBpmnToXml(model);
    const { model: parsed } = bpmnXmlToApollon(xml);
    const gw2 = Object.values(parsed.elements).find(
      (e) => (e as { gatewayRole?: string }).gatewayRole === 'merging',
    ) as Record<string, unknown>;
    expect(gw2.governanceDsl).toBe(dsl);
  });
});

describe('generateGovernanceDsl policyType (T1c)', () => {
  const merging = {
    id: 'M',
    type: 'BPMNGateway',
    name: 'Merge',
    isAgentic: true,
    gatewayRole: 'merging',
    trustScore: 70,
  };
  const elementsById = { M: merging } as Record<string, never>;

  it('emits the chosen policy keyword and a ratio for the voting family', () => {
    const dsl = generateGovernanceDsl('M', elementsById, 'MajorityPolicy');
    expect(dsl).toContain('MajorityPolicy MergePolicy {');
    expect(dsl).toContain('ratio : 0.5');
    expect(dsl).toContain('// policyType=MajorityPolicy, trustScore=70');
    expect(dsl).not.toContain('collaborationMode');
  });

  it('omits Parameters for leader-driven', () => {
    const dsl = generateGovernanceDsl('M', elementsById, 'LeaderDrivenPolicy');
    expect(dsl).toContain('LeaderDrivenPolicy MergePolicy {');
    expect(dsl).not.toContain('ratio');
  });

  it('emits a consensus skeleton without Parameters', () => {
    const dsl = generateGovernanceDsl('M', elementsById, 'ConsensusPolicy');
    expect(dsl).toContain('ConsensusPolicy MergePolicy {');
    expect(dsl).not.toContain('ratio');
  });

  it('discovers participant lanes for a non-agentic task in an agentic lane', () => {
    const fixture = {
      DIV: { id: 'DIV', type: 'BPMNGateway', isAgentic: true, gatewayRole: 'diverging' },
      L1: { id: 'L1', type: 'BPMNSwimlane', name: 'WorkerLane', isAgentic: true, trustScore: 80 },
      T1: { id: 'T1', type: 'BPMNTask', owner: 'L1' }, // normal task — NOT isAgentic
      MR: { id: 'MR', type: 'BPMNGateway', name: 'Merge', isAgentic: true, gatewayRole: 'merging', trustScore: 70 },
      F1: { id: 'F1', type: 'BPMNFlow', flowType: 'sequence', source: { element: 'DIV' }, target: { element: 'T1' } },
      F2: { id: 'F2', type: 'BPMNFlow', flowType: 'sequence', source: { element: 'T1' }, target: { element: 'MR' } },
    } as Record<string, never>;
    const dsl = generateGovernanceDsl('MR', fixture, 'MajorityPolicy');
    expect(dsl).toContain('WorkerLane');
    expect(dsl).not.toContain('TODO');
  });

  it('includes a gateway-only manager lane as a participant', () => {
    // ManagerLane owns both gateways but has NO tasks — the BFS walk would
    // miss it entirely without the explicit owner-seeding step.
    const fixture = {
      L_MGR: {
        id: 'L_MGR',
        type: 'BPMNSwimlane',
        name: 'ManagerLane',
        isAgentic: true,
        role: 'supervision',
        trustScore: 90,
      },
      L_WRK: {
        id: 'L_WRK',
        type: 'BPMNSwimlane',
        name: 'WorkerLane',
        isAgentic: true,
        role: 'solution',
        trustScore: 80,
      },
      DIV: { id: 'DIV', type: 'BPMNGateway', isAgentic: true, gatewayRole: 'diverging', owner: 'L_MGR' },
      T1: { id: 'T1', type: 'BPMNTask', owner: 'L_WRK' },
      MR: {
        id: 'MR',
        type: 'BPMNGateway',
        name: 'Merge',
        isAgentic: true,
        gatewayRole: 'merging',
        owner: 'L_MGR',
        trustScore: 70,
      },
      F1: { id: 'F1', type: 'BPMNFlow', flowType: 'sequence', source: { element: 'DIV' }, target: { element: 'T1' } },
      F2: { id: 'F2', type: 'BPMNFlow', flowType: 'sequence', source: { element: 'T1' }, target: { element: 'MR' } },
    } as Record<string, never>;
    const dsl = generateGovernanceDsl('MR', fixture, 'MajorityPolicy');
    expect(dsl).toContain('ManagerLane');
    expect(dsl).toContain('WorkerLane');
    expect(dsl).not.toContain('TODO');
  });

  it('LeaderDrivenPolicy uses only manager lanes as participants', () => {
    // Same block: manager lane (gateways only) + worker lane (task). For
    // LeaderDrivenPolicy the participant list must show the manager, not the workers.
    const fixture = {
      L_MGR: {
        id: 'L_MGR',
        type: 'BPMNSwimlane',
        name: 'ManagerLane',
        isAgentic: true,
        role: 'supervision',
        trustScore: 90,
      },
      L_WRK: {
        id: 'L_WRK',
        type: 'BPMNSwimlane',
        name: 'WorkerLane',
        isAgentic: true,
        role: 'solution',
        trustScore: 80,
      },
      DIV: { id: 'DIV', type: 'BPMNGateway', isAgentic: true, gatewayRole: 'diverging', owner: 'L_MGR' },
      T1: { id: 'T1', type: 'BPMNTask', owner: 'L_WRK' },
      MR: {
        id: 'MR',
        type: 'BPMNGateway',
        name: 'Merge',
        isAgentic: true,
        gatewayRole: 'merging',
        owner: 'L_MGR',
        trustScore: 70,
      },
      F1: { id: 'F1', type: 'BPMNFlow', flowType: 'sequence', source: { element: 'DIV' }, target: { element: 'T1' } },
      F2: { id: 'F2', type: 'BPMNFlow', flowType: 'sequence', source: { element: 'T1' }, target: { element: 'MR' } },
    } as Record<string, never>;
    const dsl = generateGovernanceDsl('MR', fixture, 'LeaderDrivenPolicy');
    expect(dsl).toContain('ManagerLane');
    expect(dsl).not.toContain('WorkerLane');
    expect(dsl).not.toContain('role :');
    expect(dsl).not.toContain('Roles :');
    expect(dsl).not.toContain('TODO');
  });
});
