import { describe, expect, it } from 'vitest';
import { BPMNDiagramModifier } from '../modifiers/BPMNDiagramModifier';
import { ComponentDiagramModifier } from '../modifiers/ComponentDiagramModifier';
import { DeploymentDiagramModifier } from '../modifiers/DeploymentDiagramModifier';
import type { ModelModification } from '../modifiers/base';
import type { BESSERModel } from '../UMLModelingService';

const bounds = (x = 0, y = 0) => ({ x, y, width: 100, height: 60 });

const model = (type: string, elements: BESSERModel['elements'], relationships: BESSERModel['relationships'] = {}) =>
  ({
    version: '3.0.0',
    type,
    size: { width: 800, height: 600 },
    elements,
    relationships,
    interactive: { elements: {}, relationships: {} },
    assessments: {},
  }) satisfies BESSERModel;

const flow = (id: string, source: string, target: string) => ({
  id,
  type: 'BPMNFlow',
  name: '',
  owner: null,
  bounds: bounds(),
  path: [],
  source: { element: source, direction: 'Right' },
  target: { element: target, direction: 'Left' },
  flowType: 'sequence',
});

const pooledBpmn = () =>
  model(
    'BPMNDiagram',
    {
      pool: { id: 'pool', type: 'BPMNPool', name: 'Shop', owner: null, bounds: bounds() },
      lane: { id: 'lane', type: 'BPMNSwimlane', name: 'Sales', owner: 'pool', bounds: bounds() },
      other: { id: 'other', type: 'BPMNSwimlane', name: 'Billing', owner: 'pool', bounds: bounds() },
      t1: { id: 't1', type: 'BPMNTask', name: 'Quote', owner: 'lane', bounds: bounds() },
      t2: { id: 't2', type: 'BPMNTask', name: 'Invoice', owner: 'other', bounds: bounds() },
      outside: { id: 'outside', type: 'BPMNTask', name: 'Outside', owner: null, bounds: bounds() },
    },
    { f1: flow('f1', 't1', 't2'), f2: flow('f2', 'outside', 'outside') },
  );

const mod = (action: ModelModification['action'], target: ModelModification['target'], changes = {}) =>
  ({ action, target, changes }) satisfies ModelModification;

describe('BPMNDiagramModifier pools and lanes', () => {
  const modifier = new BPMNDiagramModifier();

  it('removing a lane removes its tasks and the flows touching them', () => {
    const result = modifier.applyModification(pooledBpmn(), mod('remove_swimlane', { swimlaneName: 'Sales' }));
    expect(Object.keys(result.elements).sort()).toEqual(['other', 'outside', 'pool', 't2']);
    expect(Object.keys(result.relationships)).toEqual(['f2']);
  });

  it('removing a pool removes its lanes, their contents and their flows', () => {
    const result = modifier.applyModification(pooledBpmn(), mod('remove_pool', { poolName: 'Shop' }));
    expect(Object.keys(result.elements)).toEqual(['outside']);
    expect(Object.keys(result.relationships)).toEqual(['f2']);
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
    const plainLane = Object.values(plain.elements).find((el) => el.name === 'Ops');
    expect(plainLane).toMatchObject({ owner: 'pool', isAgentic: false });

    const agentic = modifier.applyModification(
      pooledBpmn(),
      mod('add_swimlane', { nodeName: 'Bot' }, { poolName: 'Shop', isAgentic: true }),
    );
    expect(Object.values(agentic.elements).find((el) => el.name === 'Bot')).toMatchObject({ isAgentic: true });
  });
});

describe('ComponentDiagramModifier', () => {
  const modifier = new ComponentDiagramModifier();
  const components = () =>
    model(
      'ComponentDiagram',
      {
        sub: { id: 'sub', type: 'Subsystem', name: 'Core', owner: null, bounds: bounds() },
        c1: { id: 'c1', type: 'Component', name: 'Planner', owner: 'sub', bounds: bounds() },
        c2: { id: 'c2', type: 'Component', name: 'Gateway', owner: null, bounds: bounds(200) },
      },
      { d1: { id: 'd1', type: 'ComponentDependency', source: { element: 'c2' }, target: { element: 'c1' } } },
    );

  it('removing a Subsystem removes its Components and their dependencies', () => {
    const result = modifier.applyModification(components(), mod('remove_element', { elementName: 'Core' }));
    expect(Object.keys(result.elements)).toEqual(['c2']);
    expect(result.relationships).toEqual({});
  });

  it('throws for elements and dependencies that do not exist', () => {
    expect(() => modifier.applyModification(components(), mod('modify_element', { elementName: 'Nope' }))).toThrow(
      /not found/,
    );
    expect(() =>
      modifier.applyModification(components(), mod('remove_dependency', {}, { source: 'Planner', target: 'Gateway' })),
    ).toThrow(/No dependency/);
  });
});

describe('DeploymentDiagramModifier', () => {
  const modifier = new DeploymentDiagramModifier();

  it('removing a Node removes its artifacts and their relationships', () => {
    const deployment = model(
      'DeploymentDiagram',
      {
        node: { id: 'node', type: 'DeploymentNode', name: 'Server', owner: null, bounds: bounds() },
        art: { id: 'art', type: 'DeploymentArtifact', name: 'app.jar', owner: 'node', bounds: bounds() },
        other: { id: 'other', type: 'DeploymentNode', name: 'DB', owner: null, bounds: bounds(300) },
      },
      { d1: { id: 'd1', type: 'DeploymentDependency', source: { element: 'art' }, target: { element: 'other' } } },
    );
    const result = modifier.applyModification(deployment, mod('remove_element', { elementName: 'Server' }));
    expect(Object.keys(result.elements)).toEqual(['other']);
    expect(result.relationships).toEqual({});
  });

  it('throws when an artifact names a Node that does not exist', () => {
    const empty = model('DeploymentDiagram', {});
    expect(() => modifier.applyModification(empty, mod('add_artifact', { elementName: 'a' }, { owner: 'Nope' }))).toThrow(
      /not found/,
    );
  });
});
