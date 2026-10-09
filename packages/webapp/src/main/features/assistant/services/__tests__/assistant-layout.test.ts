import { describe, expect, it } from 'vitest';
import { AgentDiagramConverter } from '../converters/AgentDiagramConverter';
import { BPMNDiagramConverter } from '../converters/BPMNDiagramConverter';
import { ClassDiagramConverter } from '../converters/ClassDiagramConverter';
import { ComponentDiagramConverter } from '../converters/ComponentDiagramConverter';
import { DeploymentDiagramConverter } from '../converters/DeploymentDiagramConverter';
import { ObjectDiagramConverter } from '../converters/ObjectDiagramConverter';
import { StateMachineConverter } from '../converters/StateMachineConverter';
import { BPMNDiagramModifier } from '../modifiers/BPMNDiagramModifier';
import { ClassDiagramModifier } from '../modifiers/ClassDiagramModifier';
import { ComponentDiagramModifier } from '../modifiers/ComponentDiagramModifier';
import { DeploymentDiagramModifier } from '../modifiers/DeploymentDiagramModifier';
import { StateMachineModifier } from '../modifiers/StateMachineModifier';
import type { BESSERModel } from '../UMLModelingService';

// Stored route points win over the editor's own routing, so a placeholder
// [(0,0),(100,0)] drew every assistant edge as a straight diagonal through
// the boxes. The assistant leaves the route to the editor.
const expectNoRoutePoints = (model: BESSERModel) => {
  expect(model.edges.length).toBeGreaterThan(0);
  for (const edge of model.edges) expect(edge.data.points).toEqual([]);
};

describe('assistant edges carry no placeholder route points', () => {
  it.each([
    [
      'class',
      () =>
        new ClassDiagramConverter().convertCompleteSystem({
          classes: [{ className: 'Book' }, { className: 'Author' }],
          relationships: [{ type: 'Association', sourceClass: 'Book', targetClass: 'Author', name: 'by' }],
        }),
    ],
    [
      'object',
      () =>
        new ObjectDiagramConverter().convertCompleteSystem({
          objects: [
            { objectName: 'b', className: 'Book' },
            { objectName: 'a', className: 'Author' },
          ],
          links: [{ source: 'b', target: 'a', relationshipType: 'by' }],
        }),
    ],
    [
      'state machine',
      () =>
        new StateMachineConverter().convertCompleteSystem({
          states: [{ stateType: 'initial' }, { stateName: 'Red' }],
          transitions: [{ source: 'initial', target: 'Red' }],
        }),
    ],
    [
      'agent',
      () =>
        new AgentDiagramConverter().convertCompleteSystem({
          states: [{ stateName: 'Welcome', replies: [{ text: 'Hi', replyType: 'text' }] }],
          transitions: [{ source: 'initial', target: 'Welcome' }],
        }),
    ],
    [
      'BPMN',
      () =>
        new BPMNDiagramConverter().convertCompleteSystem({
          nodes: [
            { id: 's', type: 'startEvent' },
            { id: 't', type: 'task', name: 'Work' },
          ],
          flows: [{ source: 's', target: 't' }],
        }),
    ],
    [
      'component',
      () =>
        new ComponentDiagramConverter().convertCompleteSystem({
          components: [
            { id: 'a', name: 'A' },
            { id: 'b', name: 'B' },
          ],
          dependencies: [{ source: 'a', target: 'b' }],
        }),
    ],
  ])('%s converter', (_label, build) => {
    expectNoRoutePoints(build() as BESSERModel);
  });

  it('modifiers', () => {
    const bpmn = new BPMNDiagramConverter().convertCompleteSystem({
      nodes: [
        { id: 's', type: 'startEvent', name: 'Start' },
        { id: 't', type: 'task', name: 'Work' },
      ],
    }) as BESSERModel;
    expectNoRoutePoints(
      new BPMNDiagramModifier().applyModification(bpmn, {
        action: 'add_flow',
        target: {},
        changes: { source: 'Start', target: 'Work' },
      }),
    );

    const classes = new ClassDiagramConverter().convertCompleteSystem({
      classes: [{ className: 'Book' }, { className: 'Author' }],
    }) as BESSERModel;
    expectNoRoutePoints(
      new ClassDiagramModifier().applyModification(classes, {
        action: 'add_relationship',
        target: {},
        changes: { relationshipType: 'Association', sourceClass: 'Book', targetClass: 'Author', name: 'by' },
      }),
    );

    const states = new StateMachineConverter().convertCompleteSystem({
      states: [{ stateName: 'Red' }, { stateName: 'Green' }],
    }) as BESSERModel;
    expectNoRoutePoints(
      new StateMachineModifier().applyModification(states, {
        action: 'add_transition',
        target: {},
        changes: { source: 'Red', target: 'Green' },
      }),
    );
  });
});

describe('assistant subsystems keep their name clear of their components', () => {
  // The «subsystem» stereotype and the name end ~51 px below the top edge.
  const HEADER_BOTTOM = 51;

  it('the converter stacks components below the header', () => {
    const model = new ComponentDiagramConverter().convertCompleteSystem({
      subsystems: [{ id: 's', name: 'Backend' }],
      components: [
        { id: 'a', name: 'Api', owner: 's' },
        { id: 'b', name: 'Db', owner: 's' },
      ],
    }) as BESSERModel;
    const children = model.nodes.filter((n) => n.parentId);
    expect(children).toHaveLength(2);
    for (const child of children) expect(child.position.y).toBeGreaterThan(HEADER_BOTTOM);
  });

  it('the modifier adds the first component of a subsystem below the header', () => {
    const base = new ComponentDiagramConverter().convertCompleteSystem({
      subsystems: [{ id: 's', name: 'Backend' }],
    }) as BESSERModel;
    const model = new ComponentDiagramModifier().applyModification(base, {
      action: 'add_component',
      target: { elementName: 'Api' },
      changes: { owner: 'Backend' },
    });
    const child = model.nodes.find((n) => n.data.name === 'Api')!;
    expect(child.parentId).toBeDefined();
    expect(child.position.y).toBeGreaterThan(HEADER_BOTTOM);
  });
});

// An empty stereotype means "header hidden", so the assistant always writes one.
describe('assistant components, subsystems and deployment components carry a stereotype', () => {
  const stereotypes = (model: BESSERModel) =>
    model.nodes
      .filter((n) => ['component', 'componentSubsystem', 'deploymentComponent'].includes(n.type))
      .map((n) => [n.data.name, n.data.stereotype]);

  it('converters', () => {
    const components = new ComponentDiagramConverter().convertCompleteSystem({
      subsystems: [{ id: 's', name: 'Backend' }],
      components: [
        { id: 'a', name: 'Api', owner: 's' },
        { id: 'b', name: 'Planner', stereotype: 'agent' },
      ],
    }) as BESSERModel;
    expect(stereotypes(components)).toEqual([
      ['Backend', 'subsystem'],
      ['Api', 'solution'],
      ['Planner', 'agent'],
    ]);
    const deployment = new DeploymentDiagramConverter().convertCompleteSystem({
      deployComponents: [{ id: 'c', name: 'Worker', stereotype: '' }],
    }) as BESSERModel;
    expect(stereotypes(deployment)).toEqual([['Worker', 'solution']]);
  });

  it('modifiers', () => {
    const empty = (type: string) =>
      ({ version: '4.0.0', id: '', title: '', type, nodes: [], edges: [], assessments: {} }) as unknown as BESSERModel;
    let components = new ComponentDiagramModifier().applyModification(empty('ComponentDiagram'), {
      action: 'add_subsystem',
      target: { elementName: 'Backend' },
      changes: {},
    });
    components = new ComponentDiagramModifier().applyModification(components, {
      action: 'add_component',
      target: { elementName: 'Api' },
      changes: { owner: 'Backend' },
    });
    expect(stereotypes(components)).toEqual([
      ['Backend', 'subsystem'],
      ['Api', 'solution'],
    ]);
    const deployment = new DeploymentDiagramModifier().applyModification(empty('DeploymentDiagram'), {
      action: 'add_component',
      target: { elementName: 'Worker' },
      changes: { stereotype: '' },
    });
    expect(stereotypes(deployment)).toEqual([['Worker', 'solution']]);
  });
});
