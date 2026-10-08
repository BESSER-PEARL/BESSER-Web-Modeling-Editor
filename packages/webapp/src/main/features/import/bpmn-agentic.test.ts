import { describe, it, expect } from 'vitest';
import {
  UMLDiagramType,
  clampTrustScore,
  clampMultiplicity,
  findDownstreamAgenticConstructs,
  findOrphanedMergingGateways,
  resolveUpstreamDivergingGateway,
  generateGovernanceDsl,
} from '@besser/wme';
import type { UMLModel, BesserNode, BesserEdge } from '@besser/wme';
import { apollonBpmnToXml } from '../export/bpmn-xml-exporter';
import { bpmnXmlToModel } from './bpmn-xml-importer';

// ─── v4 fixture helpers ─────────────────────────────────────────────────────
// Agentic attributes live on `node.data` / `edge.data`; a node's lane or pool is
// its `parentId`, with a position relative to that parent.

function node(
  id: string,
  type: string,
  data: Record<string, unknown> = {},
  parentId?: string,
  geometry: { x: number; y: number; width: number; height: number } = { x: 0, y: 0, width: 40, height: 40 },
): BesserNode {
  return {
    id,
    type: type as BesserNode['type'],
    position: { x: geometry.x, y: geometry.y },
    width: geometry.width,
    height: geometry.height,
    measured: { width: geometry.width, height: geometry.height },
    data,
    ...(parentId ? { parentId } : {}),
  };
}

function flow(id: string, source: string, target: string, type = 'BPMNSequenceFlow', data = {}): BesserEdge {
  return {
    id,
    source,
    target,
    type: type as BesserEdge['type'],
    sourceHandle: '',
    targetHandle: '',
    data: { name: '', label: '', points: [], ...data },
  };
}

function v4Model(nodes: BesserNode[], edges: BesserEdge[] = []): UMLModel {
  return {
    version: '4.0.0',
    id: 'test-bpmn',
    title: 'Test BPMN',
    type: UMLDiagramType.BPMN,
    nodes,
    edges,
    assessments: {},
  };
}

const divergingGw = (id: string, extra: Record<string, unknown> = {}, parentId?: string) =>
  node(id, 'bpmnGateway', { gatewayType: 'parallel', isAgentic: true, gatewayRole: 'diverging', ...extra }, parentId);
const mergingGw = (id: string, extra: Record<string, unknown> = {}, parentId?: string) =>
  node(id, 'bpmnGateway', { gatewayType: 'parallel', isAgentic: true, gatewayRole: 'merging', ...extra }, parentId);
const task = (id: string, extra: Record<string, unknown> = {}, parentId?: string) =>
  node(id, 'bpmnTask', extra, parentId);

const dataByName = (model: UMLModel, name: string): Record<string, unknown> | undefined =>
  model.nodes.find((n) => n.data.name === name)?.data;

const nodeData = (model: UMLModel, id: string): Record<string, unknown> => {
  const found = model.nodes.find((n) => n.id === id);
  if (!found) throw new Error(`fixture has no node ${id}`);
  return found.data;
};

const mergingGatewayData = (model: UMLModel): Record<string, unknown> | undefined =>
  model.nodes.find((n) => n.type === 'bpmnGateway' && n.data.gatewayRole === 'merging')?.data;

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

describe('agentic round-trip', () => {
  it('preserves agentic attributes through export → import', () => {
    const xml = apollonBpmnToXml(buildFixtureAgenticModel());
    const { model: parsed, warnings } = bpmnXmlToModel(xml);
    // The fixture intentionally has a merging gateway with no sequence-flow
    // upstream (a shape collection, not a valid collaboration block). The
    // importer flags it as orphaned; out of scope for this fidelity test.
    const filtered = warnings.filter((w) => w.code !== 'orphaned-merging-gateway');
    expect(filtered).toEqual([]);

    const lane = dataByName(parsed, 'AgentReviewer');
    expect(lane?.isAgentic).toBe(true);
    expect(lane?.role).toBe('supervision');
    expect(lane?.trustScore).toBe(90);
    expect(lane?.multiplicity).toBe(3);

    const review = dataByName(parsed, 'Review');
    expect(review?.isAgentic).toBe(true);
    expect(review?.reflectionMode).toBe('cross');
    expect(review?.trustScore).toBe(80);

    const parGw = dataByName(parsed, 'AND');
    expect(parGw?.isAgentic).toBe(true);
    expect(parGw?.gatewayRole).toBe('diverging');
    expect(parGw?.trustScore).toBe(75);

    const incGw = dataByName(parsed, 'OR');
    expect(incGw?.isAgentic).toBe(true);
    expect(incGw?.gatewayRole).toBe('merging');
    expect(incGw?.trustScore).toBe(60);
  });

  it('preserves agentic attributes of a message flow on edge.data', () => {
    const model = buildFixtureAgenticModel();
    const mf = model.edges.find((e) => e.id === 'MF_1')!;
    Object.assign(mf.data, { isAgentic: true, trustScore: 55 });

    const xml = apollonBpmnToXml(model);
    expect(xml).toMatch(/<bpmn:messageFlow [^>]*>\s*<bpmn:extensionElements>\s*<agentic:agentic trustScore="55"/);

    const { model: parsed } = bpmnXmlToModel(xml);
    const parsedMf = parsed.edges.find((e) => e.id === 'MF_1');
    expect(parsedMf?.type).toBe('BPMNMessageFlow');
    expect(parsedMf?.data).toMatchObject({ isAgentic: true, trustScore: 55 });
  });

  it('warns on a malformed trustScore and still loads the element', () => {
    const xml = apollonBpmnToXml(buildFixtureAgenticModel());
    // The agentic lane carries trustScore="90"; corrupt it.
    const corrupted = xml.replace('trustScore="90"', 'trustScore="bogus"');
    const { warnings, model } = bpmnXmlToModel(corrupted);
    expect(warnings.some((w) => w.code === 'agentic-bad-trust-score')).toBe(true);
    expect(dataByName(model, 'AgentReviewer')).toBeDefined();
  });

  it('warns on a malformed multiplicity and still loads the lane', () => {
    const model = buildFixtureAgenticModel();
    nodeData(model, 'Lane_1').multiplicity = 3;
    const corrupted = apollonBpmnToXml(model).replace('multiplicity="3"', 'multiplicity="lots"');
    const { warnings, model: parsed } = bpmnXmlToModel(corrupted);
    expect(warnings.some((w) => w.code === 'agentic-bad-multiplicity')).toBe(true);
    const lane = dataByName(parsed, 'AgentReviewer');
    expect(lane).toBeDefined();
    // A bad value is left unset on the model; the editor applies the default of 1
    // (same posture as the trustScore test).
    expect(lane?.multiplicity).toBeUndefined();
  });

  it('warns on an unknown enum value', () => {
    const xml = apollonBpmnToXml(buildFixtureAgenticModel());
    // The agentic task carries reflectionMode="cross"; corrupt to an unknown value.
    const corrupted = xml.replace('reflectionMode="cross"', 'reflectionMode="telepathy"');
    const { warnings } = bpmnXmlToModel(corrupted);
    expect(warnings.some((w) => w.code === 'agentic-unknown-enum')).toBe(true);
  });

  it('non-agentic export contains no agentic extension blocks', () => {
    const xml = apollonBpmnToXml(buildFixtureNonAgenticModel());
    expect(xml).toContain('xmlns:agentic=');
    expect(xml).not.toContain('<agentic:agentic');
    expect(xml).not.toContain('<bpmn:extensionElements>');
  });

  // lane carries agentDiagramRef → survives round-trip on the lane only.
  it('preserves agentDiagramRef on the agentic lane through round-trip', () => {
    const REF = '3f0a1c2d-4e5b-4f6a-9012-3456789abcde';
    const model = buildFixtureAgenticModel();
    nodeData(model, 'Lane_1').agentDiagramRef = REF;

    const xml = apollonBpmnToXml(model);
    // Sanity: the attribute lands on the lane's agentic block.
    expect(xml).toMatch(/<agentic:agentic[^/]*agentDiagramRef="3f0a1c2d-4e5b-4f6a-9012-3456789abcde"/);

    const { model: parsed } = bpmnXmlToModel(xml);
    expect(dataByName(parsed, 'AgentReviewer')?.agentDiagramRef).toBe(REF);
    // Other agentic constructs MUST NOT pick up agentDiagramRef (lane-only).
    expect(dataByName(parsed, 'Review')?.agentDiagramRef).toBeUndefined();
  });

  // A non-agentic lane with a stale ref must NOT emit the extension
  // (extension presence implies isAgentic).
  it('does not emit agentDiagramRef on a non-agentic lane', () => {
    const model = buildFixtureNonAgenticModel();
    const lane = model.nodes.find((n) => n.type === 'bpmnSwimlane');
    expect(lane).toBeDefined();
    lane!.data.agentDiagramRef = 'should-not-be-emitted';
    const xml = apollonBpmnToXml(model);
    expect(xml).not.toContain('agentDiagramRef=');
    expect(xml).not.toContain('<agentic:agentic');
  });

  // Extension block present but no agentDiagramRef attribute → field stays
  // undefined; no warning.
  it('leaves agentDiagramRef undefined when the attribute is absent', () => {
    const xml = apollonBpmnToXml(buildFixtureAgenticModel());
    expect(xml).not.toContain('agentDiagramRef='); // fixture has no ref
    const { model: parsed, warnings } = bpmnXmlToModel(xml);
    expect(dataByName(parsed, 'AgentReviewer')?.agentDiagramRef).toBeUndefined();
    expect(warnings.some((w) => w.message.toLowerCase().includes('agentdiagramref'))).toBe(false);
  });

  // agentic task carries agentDiagramRef → survives round-trip.
  it('preserves agentDiagramRef on the agentic task through round-trip', () => {
    const REF = '7c1e9a40-2b3c-4d5e-8f90-1a2b3c4d5e6f';
    const model = buildFixtureAgenticModel();
    nodeData(model, 'Task_1').agentDiagramRef = REF;

    const xml = apollonBpmnToXml(model);
    expect(xml).toMatch(/agentDiagramRef="7c1e9a40-2b3c-4d5e-8f90-1a2b3c4d5e6f"/);

    const { model: parsed } = bpmnXmlToModel(xml);
    expect(dataByName(parsed, 'Review')?.agentDiagramRef).toBe(REF);
  });

  // A non-agentic task with a stale ref must NOT emit the extension.
  it('does not emit agentDiagramRef on a non-agentic task', () => {
    const model = buildFixtureNonAgenticModel();
    const plainTask = model.nodes.find((n) => n.type === 'bpmnTask');
    expect(plainTask).toBeDefined();
    plainTask!.data.agentDiagramRef = 'should-not-be-emitted';
    const xml = apollonBpmnToXml(model);
    expect(xml).not.toContain('agentDiagramRef=');
  });
});

describe('importer orphaned-merging-gateway warning', () => {
  it('emits orphaned-merging-gateway warning when no upstream diverging exists', () => {
    // One merging gateway and nothing upstream of it.
    const model = v4Model([
      node('Pool_1', 'bpmnPool', { name: 'P' }, undefined, { x: 0, y: 0, width: 400, height: 200 }),
      node(
        'Gateway_OR',
        'bpmnGateway',
        { name: 'OrphanOR', gatewayType: 'inclusive', isAgentic: true, gatewayRole: 'merging', trustScore: 50 },
        'Pool_1',
        { x: 80, y: 80, width: 40, height: 40 },
      ),
    ]);
    const { warnings } = bpmnXmlToModel(apollonBpmnToXml(model));
    const orphan = warnings.find((w) => w.code === 'orphaned-merging-gateway');
    expect(orphan?.message).toContain('"OrphanOR"');
  });
});

// One of each agentic construct + supporting pools / lane / message flow.
// Coordinates are arbitrary: the agentic round-trip does not depend on
// geometry, only that the BPMN DI emits well-formed shapes.
function buildFixtureAgenticModel(): UMLModel {
  return v4Model(
    [
      node('Pool_1', 'bpmnPool', { name: 'Project Repository' }, undefined, { x: 0, y: 0, width: 600, height: 300 }),
      node('Pool_2', 'bpmnPool', { name: 'External Tool' }, undefined, { x: 0, y: 400, width: 600, height: 100 }),
      node(
        'Lane_1',
        'bpmnSwimlane',
        { name: 'AgentReviewer', isAgentic: true, role: 'supervision', trustScore: 90, multiplicity: 3 },
        'Pool_1',
        { x: 40, y: 0, width: 560, height: 300 },
      ),
      node(
        'Task_1',
        'bpmnTask',
        { name: 'Review', taskType: 'user', marker: 'none', isAgentic: true, reflectionMode: 'cross', trustScore: 80 },
        'Lane_1',
        { x: 40, y: 40, width: 100, height: 60 },
      ),
      node(
        'Gateway_1',
        'bpmnGateway',
        { name: 'AND', gatewayType: 'parallel', isAgentic: true, gatewayRole: 'diverging', trustScore: 75 },
        'Lane_1',
        { x: 180, y: 50, width: 40, height: 40 },
      ),
      node(
        'Gateway_2',
        'bpmnGateway',
        { name: 'OR', gatewayType: 'inclusive', isAgentic: true, gatewayRole: 'merging', trustScore: 60 },
        'Lane_1',
        { x: 280, y: 50, width: 40, height: 40 },
      ),
    ],
    [
      flow('MF_1', 'Pool_1', 'Pool_2', 'BPMNMessageFlow', {
        points: [
          { x: 300, y: 300 },
          { x: 300, y: 400 },
        ],
      }),
    ],
  );
}

function buildFixtureNonAgenticModel(): UMLModel {
  return v4Model([
    node('Pool_1', 'bpmnPool', { name: 'Plain Pool' }, undefined, { x: 0, y: 0, width: 600, height: 200 }),
    node('Lane_1', 'bpmnSwimlane', { name: 'Plain Lane' }, 'Pool_1', { x: 40, y: 0, width: 560, height: 200 }),
    node('Task_1', 'bpmnTask', { name: 'Plain Task', taskType: 'default', marker: 'none' }, 'Lane_1', {
      x: 40,
      y: 40,
      width: 100,
      height: 60,
    }),
  ]);
}

// ─── Collaboration-block walkers ────────────────────────────────────────────

describe('resolveUpstreamDivergingGateway (block-pairing walker)', () => {
  it('walks one hop back to a diverging gateway', () => {
    const model = v4Model([divergingGw('G1'), task('T1', { isAgentic: true })], [flow('F1', 'G1', 'T1')]);
    expect(resolveUpstreamDivergingGateway('T1', model)?.id).toBe('G1');
  });

  it('walks multiple hops back through non-agentic intermediaries', () => {
    const model = v4Model(
      [divergingGw('G1'), task('T1'), task('T2', { isAgentic: true }), mergingGw('G2', { gatewayType: 'inclusive' })],
      [flow('F1', 'G1', 'T1'), flow('F2', 'T1', 'T2'), flow('F3', 'T2', 'G2')],
    );
    expect(resolveUpstreamDivergingGateway('G2', model)?.id).toBe('G1');
  });

  it('returns nearest enclosing diverging gateway in nested collaboration blocks', () => {
    // outer → middle task → inner diverging → inner task → inner merging
    // Inner task and inner merging must resolve to the INNER diverging.
    const model = v4Model(
      [
        divergingGw('Gouter'),
        task('Tmid'),
        divergingGw('Ginner'),
        task('Tinner', { isAgentic: true }),
        mergingGw('GinnerMerge'),
      ],
      [
        flow('F1', 'Gouter', 'Tmid'),
        flow('F2', 'Tmid', 'Ginner'),
        flow('F3', 'Ginner', 'Tinner'),
        flow('F4', 'Tinner', 'GinnerMerge'),
      ],
    );
    expect(resolveUpstreamDivergingGateway('Tinner', model)?.id).toBe('Ginner');
    expect(resolveUpstreamDivergingGateway('GinnerMerge', model)?.id).toBe('Ginner');
  });

  it('resolves outer merging to the OUTER diverging in nested blocks', () => {
    // Gouter → A → Ginner → B → GinnerMerge → C → GouterMerge
    // GouterMerge must resolve to Gouter, NOT Ginner.
    const model = nestedBlocksModel();
    expect(resolveUpstreamDivergingGateway('GouterMerge', model)?.id).toBe('Gouter');
    expect(resolveUpstreamDivergingGateway('GinnerMerge', model)?.id).toBe('Ginner');
    expect(resolveUpstreamDivergingGateway('B', model)?.id).toBe('Ginner');
  });

  it('returns undefined when no upstream diverging gateway exists', () => {
    const model = v4Model(
      [node('Start', 'bpmnStartEvent'), task('T1', { isAgentic: true })],
      [flow('F1', 'Start', 'T1')],
    );
    expect(resolveUpstreamDivergingGateway('T1', model)).toBeUndefined();
  });

  it('is cycle-safe (does not hang on cyclic graphs)', () => {
    const model = v4Model([task('T1'), task('T2')], [flow('F1', 'T1', 'T2'), flow('F2', 'T2', 'T1')]);
    expect(resolveUpstreamDivergingGateway('T2', model)).toBeUndefined();
  });

  it('ignores non-sequence flows when walking', () => {
    // Message flow from a diverging gateway must NOT count as upstream sequence.
    const model = v4Model(
      [divergingGw('G1'), task('T1', { isAgentic: true })],
      [flow('MF', 'G1', 'T1', 'BPMNMessageFlow')],
    );
    expect(resolveUpstreamDivergingGateway('T1', model)).toBeUndefined();
  });
});

// Gouter → A → Ginner → B → GinnerMerge → C → GouterMerge
function nestedBlocksModel(): UMLModel {
  return v4Model(
    [
      divergingGw('Gouter', { collaborationMode: 'role' }),
      task('A'),
      divergingGw('Ginner', { collaborationMode: 'voting' }),
      task('B', { isAgentic: true }),
      mergingGw('GinnerMerge'),
      task('C'),
      mergingGw('GouterMerge'),
    ],
    [
      flow('F1', 'Gouter', 'A'),
      flow('F2', 'A', 'Ginner'),
      flow('F3', 'Ginner', 'B'),
      flow('F4', 'B', 'GinnerMerge'),
      flow('F5', 'GinnerMerge', 'C'),
      flow('F6', 'C', 'GouterMerge'),
    ],
  );
}

describe('findDownstreamAgenticConstructs', () => {
  it('collects agentic tasks and merging gateways downstream of a diverging gateway', () => {
    const model = v4Model(
      [
        divergingGw('G1', { collaborationMode: 'role' }),
        task('Ta', { isAgentic: true }),
        task('Tb', { isAgentic: true }),
        task('Tc'), // not agentic — excluded
        mergingGw('G2'),
      ],
      [
        flow('F1', 'G1', 'Ta'),
        flow('F2', 'G1', 'Tb'),
        flow('F3', 'Ta', 'Tc'),
        flow('F4', 'Tb', 'G2'),
        flow('F5', 'Tc', 'G2'),
      ],
    );
    const result = findDownstreamAgenticConstructs('G1', model);
    expect(result.taskIds.sort()).toEqual(['Ta', 'Tb']);
    expect(result.mergingGatewayIds).toEqual(['G2']);
  });

  it('stops at a nested diverging gateway (does not bleed into inner block)', () => {
    const model = v4Model(
      [
        divergingGw('Gouter', { collaborationMode: 'role' }),
        task('Tmid', { isAgentic: true }),
        divergingGw('Ginner', { collaborationMode: 'voting' }),
        task('Tinner', { isAgentic: true }),
        mergingGw('GinnerMerge'),
      ],
      [
        flow('F1', 'Gouter', 'Tmid'),
        flow('F2', 'Tmid', 'Ginner'),
        flow('F3', 'Ginner', 'Tinner'),
        flow('F4', 'Tinner', 'GinnerMerge'),
      ],
    );
    const result = findDownstreamAgenticConstructs('Gouter', model);
    // Tmid is reachable; Ginner blocks further descent; Tinner / GinnerMerge belong to inner block.
    expect(result.taskIds).toEqual(['Tmid']);
    expect(result.mergingGatewayIds).toEqual([]);
  });

  it('jumps past a nested block to reach the outer merging (forward)', () => {
    // Propagating from Gouter must collect GouterMerge but NOT B / GinnerMerge
    // (those belong to Ginner's block).
    const result = findDownstreamAgenticConstructs('Gouter', nestedBlocksModel());
    expect(result.taskIds).toEqual([]); // B belongs to inner block, A/C non-agentic
    expect(result.mergingGatewayIds).toEqual(['GouterMerge']);
  });

  it('stops descending past the paired merging gateway', () => {
    // G1 → T1 → G2 (merging) → T2 (agentic) → G3 (merging)
    // Propagating from G1 must collect only G2 (the immediate paired merging),
    // not T2 or G3 (which belong to the next enclosing block, or are orphans).
    const model = v4Model(
      [
        divergingGw('G1', { collaborationMode: 'role' }),
        task('T1', { isAgentic: true }),
        mergingGw('G2'),
        task('T2', { isAgentic: true }),
        mergingGw('G3'),
      ],
      [flow('F1', 'G1', 'T1'), flow('F2', 'T1', 'G2'), flow('F3', 'G2', 'T2'), flow('F4', 'T2', 'G3')],
    );
    const result = findDownstreamAgenticConstructs('G1', model);
    expect(result.taskIds).toEqual(['T1']);
    expect(result.mergingGatewayIds).toEqual(['G2']);
  });
});

describe('findOrphanedMergingGateways', () => {
  it('flags merging gateways with no upstream diverging gateway', () => {
    const model = v4Model(
      [node('Start', 'bpmnStartEvent'), task('T1', { isAgentic: true }), mergingGw('Orphan')],
      [flow('F1', 'Start', 'T1'), flow('F2', 'T1', 'Orphan')],
    );
    expect(findOrphanedMergingGateways(model)).toEqual(['Orphan']);
  });

  it('does not flag merging gateways that have an upstream diverging gateway', () => {
    const model = v4Model(
      [divergingGw('G1', { collaborationMode: 'role' }), task('T1', { isAgentic: true }), mergingGw('G2')],
      [flow('F1', 'G1', 'T1'), flow('F2', 'T1', 'G2')],
    );
    expect(findOrphanedMergingGateways(model)).toEqual([]);
  });

  it('ignores non-agentic gateways and diverging gateways', () => {
    const model = v4Model([
      node('Plain', 'bpmnGateway', { gatewayType: 'parallel' }),
      divergingGw('Diverging', { collaborationMode: 'role' }),
    ]);
    expect(findOrphanedMergingGateways(model)).toEqual([]);
  });
});

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
    mergingGatewayData(model)!.governanceDsl = dsl;

    const xml = apollonBpmnToXml(model);
    expect(xml).toContain('<agentic:governance><![CDATA[');

    const { model: parsed } = bpmnXmlToModel(xml);
    expect(mergingGatewayData(parsed)?.governanceDsl).toBe(dsl);
  });

  it('round-trips a DSL containing a literal ]]> sequence', () => {
    const model = buildFixtureAgenticModel();
    const dsl = '// edge ]]> case\nMajorityPolicy P { Scope: S }';
    mergingGatewayData(model)!.governanceDsl = dsl;
    const { model: parsed } = bpmnXmlToModel(apollonBpmnToXml(model));
    expect(mergingGatewayData(parsed)?.governanceDsl).toBe(dsl);
  });
});

describe('generateGovernanceDsl policyType', () => {
  const merging = (name = 'Merge') => mergingGw('M', { name, trustScore: 70 });
  const singleGateway = v4Model([merging()]);

  it('emits the chosen policy keyword and a ratio for the voting family', () => {
    const dsl = generateGovernanceDsl('M', singleGateway, 'MajorityPolicy');
    expect(dsl).toContain('MajorityPolicy MergePolicy {');
    expect(dsl).toContain('ratio : 0.5');
    expect(dsl).toContain('// policyType=MajorityPolicy, trustScore=70');
    expect(dsl).not.toContain('collaborationMode');
  });

  it('emits a valid placeholder participant when the block has no agentic lane', () => {
    const dsl = generateGovernanceDsl('M', singleGateway, 'MajorityPolicy');
    expect(dsl).not.toContain('Roles :');
    expect(dsl).toContain('(Agent) Participant { confidence : 0.00 }');
    expect(dsl).toContain('Participant list : Participant');
  });

  it('keeps a gateway name with line breaks inside its comment line', () => {
    const dsl = generateGovernanceDsl('M', v4Model([merging('Merge\nScopes: injected')]), 'MajorityPolicy');
    expect(dsl.split('\n')[0]).toBe('// Generated from agentic merging gateway "Merge Scopes: injected"');
  });

  it('omits Parameters for leader-driven', () => {
    const dsl = generateGovernanceDsl('M', singleGateway, 'LeaderDrivenPolicy');
    expect(dsl).toContain('LeaderDrivenPolicy MergePolicy {');
    expect(dsl).not.toContain('ratio');
  });

  it('emits a consensus skeleton without Parameters', () => {
    const dsl = generateGovernanceDsl('M', singleGateway, 'ConsensusPolicy');
    expect(dsl).toContain('ConsensusPolicy MergePolicy {');
    expect(dsl).not.toContain('ratio');
  });

  it('discovers participant lanes for a non-agentic task in an agentic lane', () => {
    const model = v4Model(
      [
        divergingGw('DIV'),
        node('L1', 'bpmnSwimlane', { name: 'WorkerLane', isAgentic: true, trustScore: 80 }),
        task('T1', {}, 'L1'), // normal task — NOT isAgentic
        mergingGw('MR', { name: 'Merge', trustScore: 70 }),
      ],
      [flow('F1', 'DIV', 'T1'), flow('F2', 'T1', 'MR')],
    );
    const dsl = generateGovernanceDsl('MR', model, 'MajorityPolicy');
    expect(dsl).toContain('WorkerLane');
    expect(dsl).not.toContain('TODO');
  });

  // Manager lane owns both gateways but has NO tasks; worker lane owns the task.
  const managerWorkerBlock = () =>
    v4Model(
      [
        node('L_MGR', 'bpmnSwimlane', { name: 'ManagerLane', isAgentic: true, role: 'supervision', trustScore: 90 }),
        node('L_WRK', 'bpmnSwimlane', { name: 'WorkerLane', isAgentic: true, role: 'solution', trustScore: 80 }),
        divergingGw('DIV', {}, 'L_MGR'),
        task('T1', {}, 'L_WRK'),
        mergingGw('MR', { name: 'Merge', trustScore: 70 }, 'L_MGR'),
      ],
      [flow('F1', 'DIV', 'T1'), flow('F2', 'T1', 'MR')],
    );

  it('includes a gateway-only manager lane as a participant', () => {
    // The BFS walk would miss the manager lane entirely without the explicit
    // owner-seeding step.
    const dsl = generateGovernanceDsl('MR', managerWorkerBlock(), 'MajorityPolicy');
    expect(dsl).toContain('ManagerLane');
    expect(dsl).toContain('WorkerLane');
    expect(dsl).not.toContain('TODO');
  });

  it('LeaderDrivenPolicy uses only manager lanes as participants', () => {
    // For LeaderDrivenPolicy the participant list must show the manager, not the workers.
    const dsl = generateGovernanceDsl('MR', managerWorkerBlock(), 'LeaderDrivenPolicy');
    expect(dsl).toContain('ManagerLane');
    expect(dsl).not.toContain('WorkerLane');
    expect(dsl).not.toContain('role :');
    expect(dsl).not.toContain('Roles :');
    expect(dsl).not.toContain('TODO');
  });
});

describe('generateGovernanceDsl participant ids', () => {
  it('gives same-named lanes distinct participant ids', () => {
    const lane = (id: string) => node(id, 'bpmnSwimlane', { name: 'Reviewer', isAgentic: true, trustScore: 50 });
    const model = v4Model(
      [
        lane('L1'),
        lane('L2'),
        divergingGw('DIV', {}, 'L1'),
        task('T1', {}, 'L2'),
        mergingGw('MR', { name: 'Merge' }, 'L1'),
      ],
      [flow('F1', 'DIV', 'T1'), flow('F2', 'T1', 'MR')],
    );
    const dsl = generateGovernanceDsl('MR', model, 'MajorityPolicy');
    expect(dsl).toContain('Participant list : Reviewer, Reviewer_2');
  });
});
