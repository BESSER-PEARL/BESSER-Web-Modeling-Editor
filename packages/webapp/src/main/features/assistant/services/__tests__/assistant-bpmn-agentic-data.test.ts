import { describe, expect, it } from 'vitest';
import { BPMNDiagramConverter } from '../converters/BPMNDiagramConverter';
import { BPMNDiagramModifier } from '../modifiers/BPMNDiagramModifier';
import type { ModelModification } from '../modifiers/base';
import type { BESSERModel } from '../UMLModelingService';
import { ModifierFactory } from '../modifiers/factory';
import { governancePolicyOf } from '../shared/v4Builders';

const AGENTIC_KEYS = [
  'isAgentic',
  'role',
  'trustScore',
  'multiplicity',
  'reflectionMode',
  'reflectionReviewerLaneId',
  'gatewayRole',
  'governanceDsl',
];

const byName = (model: BESSERModel, name: string) => model.nodes.find((n) => n.data?.name === name)!;
const agenticKeysOf = (model: BESSERModel, name: string) =>
  Object.keys(byName(model, name).data).filter((k) => AGENTIC_KEYS.includes(k));

// A swarm with one agentic lane and one plain (human) lane, a diverging /
// merging agentic gateway pair and a plain exclusive gateway.
type GovernanceSpec = { governancePolicy?: string; governanceDsl?: string };

const swarmSpec = (governance: GovernanceSpec) => ({
  systemName: 'Review swarm',
  pools: [
    {
      id: 'swarm',
      name: 'Swarm',
      lanes: [
        { id: 'bots', name: 'Reviewer Agents', isAgentic: true, role: 'solution', trustScore: 80, multiplicity: 3 },
        { id: 'user', name: 'User', isAgentic: false, role: 'solution', trustScore: 0, multiplicity: 1 },
      ],
    },
  ],
  nodes: [
    {
      id: 'submit',
      name: 'Submit',
      type: 'task',
      poolId: 'swarm',
      laneId: 'user',
      isAgentic: false,
      reflectionMode: 'none',
      trustScore: 0,
    },
    {
      id: 'split',
      name: 'Split',
      type: 'gateway',
      gatewayType: 'parallel',
      poolId: 'swarm',
      laneId: 'bots',
      isAgentic: true,
      gatewayRole: 'diverging',
    },
    {
      id: 'review',
      name: 'Review',
      type: 'task',
      poolId: 'swarm',
      laneId: 'bots',
      isAgentic: true,
      reflectionMode: 'self',
      trustScore: 70,
    },
    {
      id: 'merge',
      name: 'Merge',
      type: 'gateway',
      gatewayType: 'parallel',
      poolId: 'swarm',
      laneId: 'bots',
      isAgentic: true,
      gatewayRole: 'merging',
      ...governance,
    },
    {
      id: 'route',
      name: 'Route',
      type: 'gateway',
      gatewayType: 'exclusive',
      poolId: 'swarm',
      laneId: 'user',
      isAgentic: false,
      gatewayRole: 'diverging',
    },
  ],
  flows: [
    { source: 'submit', target: 'split' },
    { source: 'split', target: 'review' },
    { source: 'review', target: 'merge' },
    { source: 'merge', target: 'route' },
  ],
});

const convert = (governance: GovernanceSpec = {}) =>
  new BPMNDiagramConverter().convertCompleteSystem(swarmSpec(governance)) as BESSERModel;

const modify = (
  model: BESSERModel,
  action: ModelModification['action'],
  target: ModelModification['target'],
  changes = {},
) => new BPMNDiagramModifier().applyModification(model, { action, target, changes });

describe('assistant BPMN: lane children clear the lane header', () => {
  it('keeps every lane child right of the plain (30) or agentic (60) header', () => {
    const model = convert();
    const lanes = new Map(
      model.nodes.filter((n: any) => n.type === 'bpmnSwimlane').map((n: any) => [n.id, n]),
    );
    const children = model.nodes.filter((n: any) => lanes.has(n.parentId));
    expect(children.length).toBeGreaterThan(0);
    for (const child of children) {
      const lane: any = lanes.get(child.parentId);
      const header = lane.data?.isAgentic === true ? 60 : 30;
      expect(child.position.x).toBeGreaterThanOrEqual(header);
    }
  });
});

describe('assistant BPMN: agentic keys only on agentic elements', () => {
  it('the converter writes no agentic key on a plain lane, task or gateway', () => {
    const model = convert();
    expect(agenticKeysOf(model, 'User')).toEqual([]);
    expect(agenticKeysOf(model, 'Submit')).toEqual([]);
    expect(agenticKeysOf(model, 'Route')).toEqual([]);
    expect(byName(model, 'Reviewer Agents').data).toMatchObject({
      isAgentic: true,
      role: 'solution',
      trustScore: 80,
      multiplicity: 3,
    });
    expect(byName(model, 'Review').data).toMatchObject({ isAgentic: true, reflectionMode: 'self', trustScore: 70 });
    expect(byName(model, 'Split').data).toMatchObject({ isAgentic: true, gatewayRole: 'diverging', trustScore: 0 });
  });

  it('the modifier adds plain lanes, tasks and gateways without agentic keys', () => {
    let model = convert();
    model = modify(model, 'add_swimlane', { nodeName: 'Ops' }, { poolName: 'Swarm', role: 'solution', trustScore: 0 });
    model = modify(model, 'add_task', { nodeName: 'Archive' }, { owner: 'Ops', reflectionMode: 'none', trustScore: 0 });
    model = modify(model, 'add_gateway', { nodeName: 'Check' }, { owner: 'Ops', gatewayRole: 'diverging' });
    expect(agenticKeysOf(model, 'Ops')).toEqual([]);
    expect(agenticKeysOf(model, 'Archive')).toEqual([]);
    expect(agenticKeysOf(model, 'Check')).toEqual([]);
  });

  it('switching an element off drops its agentic keys; switching on fills the defaults', () => {
    let model = convert();
    model = modify(model, 'modify_node', { nodeName: 'Review' }, { isAgentic: false });
    model = modify(model, 'modify_swimlane', { swimlaneName: 'Reviewer Agents' }, { isAgentic: false });
    expect(agenticKeysOf(model, 'Review')).toEqual([]);
    expect(agenticKeysOf(model, 'Reviewer Agents')).toEqual([]);

    model = modify(model, 'modify_node', { nodeName: 'Submit' }, { isAgentic: true, trustScore: 40 });
    expect(byName(model, 'Submit').data).toMatchObject({ isAgentic: true, reflectionMode: 'none', trustScore: 40 });
  });

  it('ignores agentic fields sent for a plain element', () => {
    const model = modify(
      convert(),
      'modify_swimlane',
      { swimlaneName: 'User' },
      { role: 'supervision', trustScore: 50 },
    );
    expect(agenticKeysOf(model, 'User')).toEqual([]);
  });
});

describe('assistant BPMN: governance policy', () => {
  it.each([
    ['consensus', 'ConsensusPolicy'],
    ['Majority', 'MajorityPolicy'],
    ['absolute majority', 'AbsoluteMajorityPolicy'],
    ['leader-driven', 'LeaderDrivenPolicy'],
    ['LeaderDrivenPolicy', 'LeaderDrivenPolicy'],
    ['Policy: MajorityPolicy', 'MajorityPolicy'],
  ])('reads "%s" as %s', (keyword, policy) => {
    expect(governancePolicyOf(keyword)).toBe(policy);
  });

  it('"change the merging gateway policy to consensus" (changes.governancePolicy) stores a generated DSL', () => {
    const before = convert({ governancePolicy: 'MajorityPolicy' });
    const model = modify(before, 'modify_node', { nodeName: 'Merge' }, { governancePolicy: 'ConsensusPolicy' });
    const merge = byName(model, 'Merge');
    expect(merge.data.governanceDsl).toContain('ConsensusPolicy MergePolicy {');
    expect(merge.data.governanceDsl).toContain('(Agent) Reviewer_Agents { confidence : 0.80 }');
    expect(merge.data).not.toHaveProperty('governancePolicy');
  });

  it('expands spec.governancePolicy in a created diagram once the flows exist', () => {
    const merge = byName(convert({ governancePolicy: 'MajorityPolicy' }), 'Merge');
    expect(merge.data.governanceDsl).toContain('MajorityPolicy MergePolicy {');
    expect(merge.data.governanceDsl).toContain('Reviewer_Agents');
    expect(merge.data).not.toHaveProperty('governancePolicy');
  });

  it('ignores an unknown governancePolicy', () => {
    expect(byName(convert({ governancePolicy: 'Dictatorship' }), 'Merge').data).not.toHaveProperty('governanceDsl');
    const model = modify(convert(), 'modify_node', { nodeName: 'Merge' }, { governancePolicy: 'Dictatorship' });
    expect(byName(model, 'Merge').data).not.toHaveProperty('governanceDsl');
  });

  it('older agents: expands a policy keyword sent as governanceDsl', () => {
    const model = modify(convert(), 'modify_node', { nodeName: 'Merge' }, { governanceDsl: 'consensus' });
    expect(byName(model, 'Merge').data.governanceDsl).toContain('ConsensusPolicy MergePolicy {');
  });

  it('keeps a full DSL text unchanged', () => {
    const text = 'Scopes:\n    Tasks:\n        Merge\nConsensusPolicy P {\n    Scope: Merge\n}';
    expect(byName(convert({ governanceDsl: text }), 'Merge').data.governanceDsl).toBe(text);
    const model = modify(convert(), 'modify_node', { nodeName: 'Merge' }, { governanceDsl: text });
    expect(byName(model, 'Merge').data.governanceDsl).toBe(text);
  });
});

describe('assistant BPMN: one modify_model batch', () => {
  // useModelInjection applies a batch in order with the 'BPMN' modifier; the agent
  // names a reviewer lane that an earlier change of the same batch adds.
  it('resolves a reviewer lane added earlier in the same batch by its name', () => {
    const modifier = ModifierFactory.getModifier('BPMN');
    const batch: ModelModification[] = [
      {
        action: 'add_swimlane',
        target: { nodeName: 'QA Reviewer' },
        changes: { poolName: 'Swarm', isAgentic: true, role: 'supervision', trustScore: 90 },
      },
      {
        action: 'modify_node',
        target: { nodeName: 'Review' },
        changes: { reflectionMode: 'cross', reflectionReviewerLaneId: 'QA Reviewer' },
      },
    ];
    const model = batch.reduce((m, mod) => modifier.applyModification(m, mod), convert());
    const qa = byName(model, 'QA Reviewer');
    expect(qa).toMatchObject({ type: 'bpmnSwimlane', data: { isAgentic: true, role: 'supervision', trustScore: 90 } });
    expect(byName(model, 'Review').data).toMatchObject({ reflectionMode: 'cross', reflectionReviewerLaneId: qa.id });
  });
});
