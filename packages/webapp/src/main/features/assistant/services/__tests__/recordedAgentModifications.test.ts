/**
 * Object and state-machine modifications exactly as the modeling agent sends
 * them (recorded from its structured output, nulls included).
 *
 * Both modifiers read endpoints from `changes.source` / `changes.target`, but
 * the agent puts them on the target (`sourceObject` / `targetObject`,
 * `sourceState` / `targetState`). Every object `add_link` therefore failed,
 * and a state-machine `add_transition` resolved both missing names to the
 * empty-named pseudo-states and drew an unnamed initial -> final edge.
 */
import { describe, expect, it } from 'vitest';

import { ObjectDiagramModifier } from '../modifiers/ObjectDiagramModifier';
import { StateMachineModifier } from '../modifiers/StateMachineModifier';

const SM_CHANGES_NULLS = {
  name: null, stateType: null, entryAction: null, exitAction: null, doActivity: null,
  trigger: null, guard: null, effect: null, code: null, language: null,
};

function trafficLight(): any {
  const state = (id: string, name: string, x: number) => ({
    id, type: 'State', position: { x, y: 0 }, width: 160, height: 100,
    measured: { width: 160, height: 100 },
    data: { name, bodies: [{ id: `${id}-b`, name: 'light_body' }], fallbackBodies: [{ id: `${id}-f`, name: 'fallback_body' }] },
  });
  const edge = (id: string, source: string, target: string, name?: string) => ({
    id, type: 'StateTransition', source, target, sourceHandle: 'right', targetHandle: 'left',
    data: { ...(name ? { name } : {}), params: {}, points: [], isManuallyLayouted: false },
  });
  return {
    version: '4.0.0', id: 'sm', title: '', type: 'StateMachineDiagram',
    nodes: [
      { id: 'init', type: 'StateInitialNode', position: { x: -300, y: 0 }, width: 45, height: 45, data: { name: '' } },
      state('red', 'Red', 0),
      state('green', 'Green', 300),
      state('amber', 'Amber', 600),
      { id: 'fin', type: 'StateFinalNode', position: { x: 900, y: 0 }, width: 45, height: 45, data: { name: '' } },
    ],
    edges: [
      edge('t0', 'init', 'red'),
      edge('t1', 'red', 'green', 'chronometer_finished'),
      edge('t2', 'green', 'amber', 'chronometer_finished'),
      edge('t3', 'amber', 'red', 'chronometer_finished'),
    ],
    assessments: {},
  };
}

const node = (model: any, name: string) => model.nodes.find((n: any) => n.data?.name === name);
const edgesBetween = (model: any, s: string, t: string) =>
  model.edges.filter((e: any) => e.source === node(model, s).id && e.target === node(model, t).id);

describe('ObjectDiagramModifier — recorded add_link', () => {
  const objects = (): any => ({
    version: '4.0.0', id: '', title: 'LibraryObjects', type: 'ObjectDiagram',
    nodes: [
      { id: 'o1', type: 'objectName', position: { x: 0, y: 0 }, width: 240, height: 140, data: { name: 'cityLib', attributes: [], className: 'Library' } },
      { id: 'o2', type: 'objectName', position: { x: 0, y: 200 }, width: 240, height: 170, data: { name: 'dune', attributes: [], className: 'Book' } },
    ],
    edges: [],
    assessments: {},
  });

  it('links the objects named on target.sourceObject / target.targetObject, labelled by relationshipType', () => {
    const result: any = new ObjectDiagramModifier().applyModification(objects(), {
      action: 'add_link',
      target: { objectName: null, attributeName: null, sourceObject: 'cityLib', targetObject: 'dune' },
      changes: { objectName: null, className: null, classId: null, attributes: null, value: null, relationshipType: 'has' },
    } as any);

    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]).toMatchObject({ type: 'ObjectLink', source: 'o1', target: 'o2' });
    expect(result.edges[0].data.name).toBe('has');
  });

  it('still accepts endpoints on changes.source / changes.target', () => {
    const result: any = new ObjectDiagramModifier().applyModification(objects(), {
      action: 'add_link',
      target: {},
      changes: { source: 'dune', target: 'cityLib' },
    } as any);
    expect(result.edges[0]).toMatchObject({ source: 'o2', target: 'o1' });
  });
});

describe('StateMachineModifier — recorded modifications', () => {
  const modifier = new StateMachineModifier();

  it('add_transition connects target.sourceState -> target.targetState with the trigger as its event', () => {
    const result: any = modifier.applyModification(trafficLight(), {
      action: 'add_transition',
      target: { stateName: null, sourceState: 'Amber', targetState: 'Green' },
      changes: { ...SM_CHANGES_NULLS, trigger: 'skip' },
    } as any);

    expect(result.edges).toHaveLength(5);
    const [added] = edgesBetween(result, 'Amber', 'Green');
    expect(added).toBeDefined();
    expect(added.data.name).toBe('skip');
    // Never the empty-named pseudo-states.
    expect(result.edges.filter((e: any) => e.source === 'init' && e.target === 'fin')).toHaveLength(0);
  });

  it('add_transition keeps the guard and effect in their own fields', () => {
    const result: any = modifier.applyModification(trafficLight(), {
      action: 'add_transition',
      target: { sourceState: 'Red', targetState: 'Amber' },
      changes: { ...SM_CHANGES_NULLS, trigger: 'warn', guard: 'x > 1', effect: 'blink()' },
    } as any);
    const [added] = edgesBetween(result, 'Red', 'Amber');
    expect(added.data).toMatchObject({ name: 'warn', guard: 'x > 1', code: 'blink()' });
  });

  it('add_transition with no endpoint names throws instead of drawing initial -> final', () => {
    expect(() =>
      modifier.applyModification(trafficLight(), {
        action: 'add_transition',
        target: { stateName: null, sourceState: null, targetState: null },
        changes: { ...SM_CHANGES_NULLS, trigger: 'warn' },
      } as any),
    ).toThrow();
  });

  it('add_transition resolves the "initial" / "final" keywords to the pseudo-states', () => {
    const result: any = modifier.applyModification(trafficLight(), {
      action: 'add_transition',
      target: { sourceState: 'Amber', targetState: 'final' },
      changes: { trigger: 'off' },
    } as any);
    expect(result.edges.some((e: any) => e.source === 'amber' && e.target === 'fin')).toBe(true);
  });

  it('modify_transition renames the trigger and sets the guard on the existing edge', () => {
    const result: any = modifier.applyModification(trafficLight(), {
      action: 'modify_transition',
      target: { stateName: null, sourceState: 'Red', targetState: 'Green' },
      changes: { ...SM_CHANGES_NULLS, trigger: 'go', guard: 'ready' },
    } as any);
    expect(result.edges).toHaveLength(4);
    const edge = result.edges.find((e: any) => e.id === 't1');
    expect(edge.data).toMatchObject({ name: 'go', guard: 'ready' });
  });

  it('modify_state applies the entry action (and leaves a "regular" state where it is)', () => {
    const result: any = modifier.applyModification(trafficLight(), {
      action: 'modify_state',
      target: { stateName: 'Red', sourceState: null, targetState: null },
      changes: { ...SM_CHANGES_NULLS, stateType: 'regular', entryAction: 'beep' },
    } as any);
    const red = node(result, 'Red');
    expect(red.data.bodies.map((b: any) => b.name)).toEqual(['light_body', 'entry / beep']);
    expect(red.height).toBeGreaterThanOrEqual(41 + 3 * 30);
    expect(result.edges).toHaveLength(4);
  });

  it('modify_state replaces an existing entry action rather than adding a second', () => {
    let model: any = modifier.applyModification(trafficLight(), {
      action: 'modify_state', target: { stateName: 'Red' }, changes: { entryAction: 'beep', exitAction: 'stop' },
    } as any);
    model = modifier.applyModification(model, {
      action: 'modify_state', target: { stateName: 'Red' }, changes: { entryAction: 'ring', doActivity: 'glow' },
    } as any);
    expect(node(model, 'Red').data.bodies.map((b: any) => b.name)).toEqual([
      'light_body', 'entry / ring', 'exit / stop', 'do / glow',
    ]);
  });

  it('modify_state with stateType "initial" re-points the initial pseudo-state', () => {
    const result: any = modifier.applyModification(trafficLight(), {
      action: 'modify_state', target: { stateName: 'Green' }, changes: { stateType: 'initial' },
    } as any);
    const fromInit = result.edges.filter((e: any) => e.source === 'init');
    expect(fromInit).toHaveLength(1);
    expect(fromInit[0].target).toBe('green');
  });

  it('modify_state with stateType "final" leads the state into the final pseudo-state', () => {
    const result: any = modifier.applyModification(trafficLight(), {
      action: 'modify_state', target: { stateName: 'Amber' }, changes: { stateType: 'final' },
    } as any);
    expect(result.edges.some((e: any) => e.source === 'amber' && e.target === 'fin')).toBe(true);
  });

  it('modify_state rename (recorded) still works', () => {
    const result: any = modifier.applyModification(trafficLight(), {
      action: 'modify_state',
      target: { stateName: 'Green', sourceState: null, targetState: null },
      changes: { ...SM_CHANGES_NULLS, name: 'Go' },
    } as any);
    expect(node(result, 'Go')).toBeDefined();
  });

  it('remove_element with both endpoints removes the transition, not a state', () => {
    const result: any = modifier.applyModification(trafficLight(), {
      action: 'remove_element',
      target: { stateName: null, sourceState: 'Red', targetState: 'Green' },
      changes: null,
    } as any);
    expect(result.nodes).toHaveLength(5);
    expect(result.edges.map((e: any) => e.id)).toEqual(['t0', 't2', 't3']);
  });

  it('remove_element with a state name removes the state and its transitions', () => {
    const result: any = modifier.applyModification(trafficLight(), {
      action: 'remove_element', target: { stateName: 'Green' }, changes: null,
    } as any);
    expect(node(result, 'Green')).toBeUndefined();
    expect(result.edges.map((e: any) => e.id)).toEqual(['t0', 't3']);
  });

  it('remove_transition by endpoints or by id', () => {
    let result: any = modifier.applyModification(trafficLight(), {
      action: 'remove_transition', target: { sourceState: 'Amber', targetState: 'Red' }, changes: {},
    } as any);
    expect(result.edges.map((e: any) => e.id)).toEqual(['t0', 't1', 't2']);
    result = modifier.applyModification(result, {
      action: 'remove_transition', target: { transitionId: 't1' }, changes: {},
    } as any);
    expect(result.edges.map((e: any) => e.id)).toEqual(['t0', 't2']);
  });
});
