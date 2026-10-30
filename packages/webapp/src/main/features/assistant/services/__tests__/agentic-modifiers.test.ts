import { describe, expect, it } from 'vitest';
import { BPMNDiagramModifier } from '../modifiers/BPMNDiagramModifier';
import { ComponentDiagramModifier } from '../modifiers/ComponentDiagramModifier';
import { DeploymentDiagramModifier } from '../modifiers/DeploymentDiagramModifier';
import type { ModelModification } from '../modifiers/base';
import type { BESSERModel } from '../UMLModelingService';

const node = (id: string, type: string, name: string, parentId?: string, x = 0) => ({
  id,
  type,
  position: { x, y: 0 },
  width: 100,
  height: 60,
  measured: { width: 100, height: 60 },
  data: { name },
  ...(parentId ? { parentId } : {}),
});

const edge = (id: string, type: string, source: string, target: string) => ({
  id,
  type,
  source,
  target,
  sourceHandle: 'right',
  targetHandle: 'left',
  data: { name: '', label: '', points: [] },
});

const model = (type: string, nodes: any[], edges: any[] = []) =>
  ({ version: '4.0.0', id: '', title: '', type, nodes, edges, assessments: {} }) as unknown as BESSERModel;

const nodeIds = (m: BESSERModel) => ((m as any).nodes as any[]).map((n) => n.id).sort();
const edgeIds = (m: BESSERModel) => ((m as any).edges as any[]).map((e) => e.id);
const byName = (m: BESSERModel, name: string) => ((m as any).nodes as any[]).find((n) => n.data?.name === name);

const pooledBpmn = () =>
  model(
    'BPMNDiagram',
    [
      node('pool', 'bpmnPool', 'Shop'),
      node('lane', 'bpmnSwimlane', 'Sales', 'pool'),
      node('other', 'bpmnSwimlane', 'Billing', 'pool'),
      node('t1', 'bpmnTask', 'Quote', 'lane'),
      node('t2', 'bpmnTask', 'Invoice', 'other'),
      node('outside', 'bpmnTask', 'Outside'),
    ],
    [edge('f1', 'BPMNSequenceFlow', 't1', 't2'), edge('f2', 'BPMNSequenceFlow', 'outside', 'outside')],
  );

const mod = (action: ModelModification['action'], target: ModelModification['target'], changes = {}) =>
  ({ action, target, changes }) satisfies ModelModification;

describe('BPMNDiagramModifier pools and lanes', () => {
  const modifier = new BPMNDiagramModifier();

  it('removing a lane removes its tasks and the flows touching them', () => {
    const result = modifier.applyModification(pooledBpmn(), mod('remove_swimlane', { swimlaneName: 'Sales' }));
    expect(nodeIds(result)).toEqual(['other', 'outside', 'pool', 't2']);
    expect(edgeIds(result)).toEqual(['f2']);
  });

  it('removing a pool removes its lanes, their contents and their flows', () => {
    const result = modifier.applyModification(pooledBpmn(), mod('remove_pool', { poolName: 'Shop' }));
    expect(nodeIds(result)).toEqual(['outside']);
    expect(edgeIds(result)).toEqual(['f2']);
  });

  it('throws for a lane or pool that does not exist', () => {
    expect(() => modifier.applyModification(pooledBpmn(), mod('remove_swimlane', { swimlaneName: 'Nope' }))).toThrow(
      /not found/,
    );
    expect(() => modifier.applyModification(pooledBpmn(), mod('modify_swimlane', { swimlaneName: 'Nope' }))).toThrow(
      /not found/,
    );
    expect(() => modifier.applyModification(pooledBpmn(), mod('remove_pool', { poolName: 'Nope' }))).toThrow(
      /not found/,
    );
    expect(() =>
      modifier.applyModification(pooledBpmn(), mod('add_task', { nodeName: 'X' }, { owner: 'Nope' })),
    ).toThrow(/not found/);
  });

  it('adds a plain lane unless the change asks for an agentic one', () => {
    const plain = modifier.applyModification(pooledBpmn(), mod('add_swimlane', { nodeName: 'Ops' }, { poolName: 'Shop' }));
    expect(byName(plain, 'Ops')).toMatchObject({ type: 'bpmnSwimlane', parentId: 'pool' });
    expect(byName(plain, 'Ops').data).not.toHaveProperty('isAgentic');

    const agentic = modifier.applyModification(
      pooledBpmn(),
      mod('add_swimlane', { nodeName: 'Bot' }, { poolName: 'Shop', isAgentic: true }),
    );
    expect(byName(agentic, 'Bot')).toMatchObject({ data: { isAgentic: true } });
  });

  it('migrates a legacy lane role and clamps lane numbers', () => {
    const added = modifier.applyModification(
      pooledBpmn(),
      mod('add_swimlane', { nodeName: 'Boss' }, { poolName: 'Shop', isAgentic: true, role: 'manager', trustScore: 150, multiplicity: 0 }),
    );
    expect(byName(added, 'Boss').data).toMatchObject({ role: 'supervision', trustScore: 100, multiplicity: 1 });

    const modified = modifier.applyModification(
      pooledBpmn(),
      mod('modify_swimlane', { swimlaneName: 'Sales' }, { isAgentic: true, role: 'worker', trustScore: -5, multiplicity: 3 }),
    );
    expect(byName(modified, 'Sales').data).toMatchObject({ role: 'solution', trustScore: 0, multiplicity: 3 });
  });

  it('puts a task added to a lane inside that lane', () => {
    const result = modifier.applyModification(pooledBpmn(), mod('add_task', { nodeName: 'Ship' }, { owner: 'Billing' }));
    const task = byName(result, 'Ship');
    expect(task.parentId).toBe('other');
    const lane = byName(result, 'Billing');
    expect(task.position.x + task.width).toBeLessThanOrEqual(lane.width);
  });

  it('makes a flow between different pools a message flow', () => {
    const twoPools = model('BPMNDiagram', [
      node('p1', 'bpmnPool', 'Customer'),
      { ...node('p2', 'bpmnPool', 'Shop'), position: { x: 0, y: 300 } },
      node('a', 'bpmnTask', 'Order', 'p1'),
      node('b', 'bpmnTask', 'Receive', 'p2'),
    ]);
    const result = modifier.applyModification(twoPools, mod('add_flow', {}, { source: 'Order', target: 'Receive' }));
    expect((result as any).edges[0]).toMatchObject({
      type: 'BPMNMessageFlow',
      sourceHandle: 'bottom',
      targetHandle: 'top',
    });
  });
});

describe('ComponentDiagramModifier', () => {
  const modifier = new ComponentDiagramModifier();
  const components = () =>
    model(
      'ComponentDiagram',
      [
        node('sub', 'componentSubsystem', 'Core'),
        node('c1', 'component', 'Planner', 'sub'),
        node('c2', 'component', 'Gateway', undefined, 200),
      ],
      [edge('d1', 'ComponentDependency', 'c2', 'c1')],
    );

  it('removing a Subsystem removes its Components and their dependencies', () => {
    const result = modifier.applyModification(components(), mod('remove_element', { elementName: 'Core' }));
    expect(nodeIds(result)).toEqual(['c2']);
    expect(edgeIds(result)).toEqual([]);
  });

  it('throws for elements and dependencies that do not exist', () => {
    expect(() => modifier.applyModification(components(), mod('modify_element', { elementName: 'Nope' }))).toThrow(
      /not found/,
    );
    expect(() =>
      modifier.applyModification(components(), mod('remove_dependency', {}, { source: 'Planner', target: 'Gateway' })),
    ).toThrow(/No dependency/);
  });

  it('adds a component inside the named Subsystem and a stereotyped dependency', () => {
    let result = modifier.applyModification(
      components(),
      mod('add_component', { elementName: 'Reviewer' }, { owner: 'Core', stereotype: 'supervision' }),
    );
    result = modifier.applyModification(
      result,
      mod('add_dependency', {}, { source: 'Reviewer', target: 'Planner', dependencyStereotype: 'supervises' }),
    );
    const reviewer = byName(result, 'Reviewer');
    expect(reviewer).toMatchObject({ type: 'component', parentId: 'sub', data: { stereotype: 'supervision' } });
    const sub = byName(result, 'Core');
    expect(reviewer.position.y + reviewer.height).toBeLessThanOrEqual(sub.height);
    expect((result as any).edges.at(-1)).toMatchObject({
      type: 'ComponentDependency',
      source: reviewer.id,
      target: 'c1',
      data: { stereotype: 'supervises' },
    });
  });
});

describe('DeploymentDiagramModifier', () => {
  const modifier = new DeploymentDiagramModifier();

  it('removing a Node removes its artifacts and their relationships', () => {
    const deployment = model(
      'DeploymentDiagram',
      [
        node('node', 'deploymentNode', 'Server'),
        node('art', 'deploymentArtifact', 'app.jar', 'node'),
        node('other', 'deploymentNode', 'DB', undefined, 300),
      ],
      [edge('d1', 'DeploymentDependency', 'art', 'other')],
    );
    const result = modifier.applyModification(deployment, mod('remove_element', { elementName: 'Server' }));
    expect(nodeIds(result)).toEqual(['other']);
    expect(edgeIds(result)).toEqual([]);
  });

  it('throws when an artifact names a Node that does not exist', () => {
    const empty = model('DeploymentDiagram', []);
    expect(() => modifier.applyModification(empty, mod('add_artifact', { elementName: 'a' }, { owner: 'Nope' }))).toThrow(
      /not found/,
    );
  });

  it('stacks an artifact inside the named Node', () => {
    const withNode = model('DeploymentDiagram', [node('node', 'deploymentNode', 'Server')]);
    const result = modifier.applyModification(withNode, mod('add_artifact', { elementName: 'app.jar' }, { owner: 'Server' }));
    const artifact = byName(result, 'app.jar');
    expect(artifact).toMatchObject({ type: 'deploymentArtifact', parentId: 'node', data: { manifests: [] } });
    expect(artifact.position.y + artifact.height).toBeLessThanOrEqual(byName(result, 'Server').height);
  });
});
