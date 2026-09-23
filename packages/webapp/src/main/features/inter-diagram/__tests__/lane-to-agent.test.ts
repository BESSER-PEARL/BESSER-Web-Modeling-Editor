import { describe, it, expect } from 'vitest';
import type { UMLModel } from '@besser/wme';
import { laneToAgentModel } from '../lane-to-agent';
import divergeMerge from './fixtures/diverge-merge.json';

function bpmn(): UMLModel {
  return {
    version: '3.0.0',
    // UMLDiagramType.BPMN's wire value is 'BPMNDiagram' (04E divergence) — the
    // transform guards on the enum, so the fixture must use the wire value.
    type: 'BPMNDiagram',
    size: { width: 800, height: 600 },
    elements: {},
    interactive: { elements: {}, relationships: {} },
    relationships: {},
    assessments: {},
  } as unknown as UMLModel;
}
const lane = (id: string, agentic = true) => ({
  id,
  name: 'Coder',
  type: 'BPMNSwimlane',
  owner: null,
  isAgentic: agentic,
  bounds: { x: 0, y: 0, width: 400, height: 200 },
});
const task = (id: string, name: string, x: number) => ({
  id,
  name,
  type: 'BPMNTask',
  owner: 'L',
  bounds: { x, y: 0, width: 100, height: 60 },
});
const gw = (id: string, x: number) => ({
  id,
  name: '',
  type: 'BPMNGateway',
  owner: 'L',
  bounds: { x, y: 0, width: 40, height: 40 },
});
const seq = (id: string, s: string, t: string) => ({
  id,
  name: '',
  type: 'BPMNFlow',
  flowType: 'sequence',
  owner: null,
  path: [],
  source: { element: s, direction: 'Right' },
  target: { element: t, direction: 'Left' },
});

describe('29 — laneToAgentModel', () => {
  it('refuses a non-BPMN model', () => {
    const m = bpmn();
    (m as unknown as { type: string }).type = 'ComponentDiagram';
    const r = laneToAgentModel(m, 'L');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not-a-bpmn-diagram');
  });

  it('refuses a non-agentic lane', () => {
    const m = bpmn();
    Object.assign(m.elements, { L: lane('L', false), t1: task('t1', 'A', 10) });
    const r = laneToAgentModel(m, 'L');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('lane-not-agentic');
  });

  it('emits one AgentState per task, a chained transition, and one init', () => {
    const m = bpmn();
    Object.assign(m.elements, { L: lane('L'), t1: task('t1', 'Plan', 10), t2: task('t2', 'Code', 200) });
    Object.assign(m.relationships, { f1: seq('f1', 't1', 't2') });
    const r = laneToAgentModel(m, 'L');
    if (!r.ok) throw new Error('expected ok');
    const els = Object.values(r.model.elements);
    expect(
      els
        .filter((e) => e.type === 'AgentState')
        .map((e) => e.name)
        .sort(),
    ).toEqual(['Code', 'Coder_greet', 'Plan']); // greeting state added
    expect(els.filter((e) => e.type === 'StateInitialNode')).toHaveLength(1); // → greeting
    const rels = Object.values(r.model.relationships);
    expect(rels.filter((e) => e.type === 'AgentStateTransition')).toHaveLength(2); // +1 greeting→Plan
    expect(rels.filter((e) => e.type === 'AgentStateTransitionInit')).toHaveLength(1);
    // lineage maps state → task
    const planState = els.find((e) => e.name === 'Plan')!;
    expect(r.elementMapping[planState.id]).toBe('t1');
  });

  it('collapses an in-lane gateway between two tasks', () => {
    const m = bpmn();
    Object.assign(m.elements, { L: lane('L'), t1: task('t1', 'A', 10), g: gw('g', 120), t2: task('t2', 'B', 240) });
    Object.assign(m.relationships, { f1: seq('f1', 't1', 'g'), f2: seq('f2', 'g', 't2') });
    const r = laneToAgentModel(m, 'L');
    if (!r.ok) throw new Error('expected ok');
    const trans = Object.values(r.model.relationships).filter((e) => e.type === 'AgentStateTransition');
    expect(trans).toHaveLength(2); // Coder_greet → A + A → B (gateway collapsed)
    expect(Object.values(r.model.elements).filter((e) => e.type === 'StateInitialNode')).toHaveLength(1); // → greeting
  });

  describe('30 → 45 — cross-lane I/O (boundary states removed; A2A tags + DQ-3 cold-start)', () => {
    const laneB = (id: string, name: string) => ({
      id,
      name,
      type: 'BPMNSwimlane',
      owner: null,
      isAgentic: false,
      bounds: { x: 0, y: 300, width: 400, height: 200 },
    });
    const taskIn = (id: string, name: string, owner: string, x: number) => ({
      id,
      name,
      type: 'BPMNTask',
      owner,
      bounds: { x, y: 0, width: 100, height: 60 },
    });

    it('non-agentic inbound → no boundary state; cold-start greeting → entry task', () => {
      // Before the boundary-state removal: a from_Reviewer «input» state was emitted.
      // After: non-agentic peer folds into the cold-start (the non-agentic fallback path).
      const m = bpmn();
      Object.assign(m.elements, {
        L: lane('L'),
        R: laneB('R', 'Reviewer'),
        t1: taskIn('t1', 'Work', 'L', 10),
        r1: taskIn('r1', 'Review', 'R', 10),
      });
      Object.assign(m.relationships, { f1: seq('f1', 'r1', 't1') }); // Reviewer → worker
      const res = laneToAgentModel(m, 'L');
      if (!res.ok) throw new Error('expected ok');
      const boundaryStates = Object.values(res.model.elements).filter(
        (e) => e.type === 'AgentState' && ['input', 'output'].includes((e as { stereotype?: string }).stereotype ?? ''),
      );
      expect(boundaryStates).toHaveLength(0);
      // greeting → Work directly via when_no_intent_matched
      const greet = Object.values(res.model.elements).find((e) => e.type === 'AgentState' && e.name === 'Coder_greet')!;
      const greetEdge = Object.values(res.model.relationships).find(
        (e) => e.type === 'AgentStateTransition' && e.source.element === greet.id,
      )!;
      expect(greetEdge).toBeDefined();
      expect((greetEdge as unknown as { predefined?: { predefinedType?: string } }).predefined?.predefinedType).toBe(
        'when_no_intent_matched',
      );
    });

    it('non-agentic outbound → a2a:out description tag on producing states; no boundary state', () => {
      // Before the boundary-state removal: a single to_Reviewer «output» state was emitted (deduped).
      // After: an a2a:out tag is appended to each producing task-state's description.
      const m = bpmn();
      Object.assign(m.elements, {
        L: lane('L'),
        R: laneB('R', 'Reviewer'),
        t1: taskIn('t1', 'A', 'L', 10),
        t2: taskIn('t2', 'B', 'L', 200),
        r1: taskIn('r1', 'X', 'R', 10),
      });
      // two outgoing flows from L to the SAME external lane R
      Object.assign(m.relationships, { f1: seq('f1', 't1', 'r1'), f2: seq('f2', 't2', 'r1') });
      const res = laneToAgentModel(m, 'L');
      if (!res.ok) throw new Error('expected ok');
      const boundaryStates = Object.values(res.model.elements).filter(
        (e) => e.type === 'AgentState' && ['input', 'output'].includes((e as { stereotype?: string }).stereotype ?? ''),
      );
      expect(boundaryStates).toHaveLength(0);
      // both A and B task-states carry an a2a:out tag (no kind for non-agentic)
      const stateA = Object.values(res.model.elements).find((e) => e.type === 'AgentState' && e.name === 'A')!;
      const stateB = Object.values(res.model.elements).find((e) => e.type === 'AgentState' && e.name === 'B')!;
      const descA = (stateA as unknown as { description?: string }).description ?? '';
      const descB = (stateB as unknown as { description?: string }).description ?? '';
      expect(descA).toContain('a2a:out;peer=Reviewer;');
      expect(descB).toContain('a2a:out;peer=Reviewer;');
    });

    it('does not emit boundaries for a self-contained lane', () => {
      const m = bpmn();
      Object.assign(m.elements, { L: lane('L'), t1: task('t1', 'A', 10), t2: task('t2', 'B', 200) });
      Object.assign(m.relationships, { f1: seq('f1', 't1', 't2') });
      const res = laneToAgentModel(m, 'L');
      if (!res.ok) throw new Error('expected ok');
      const boundaries = Object.values(res.model.elements).filter(
        (e) => e.type === 'AgentState' && ['input', 'output'].includes((e as { stereotype?: string }).stereotype ?? ''),
      );
      expect(boundaries).toHaveLength(0);
    });

    // 45 replaces the boundary-state removal (IO-4): with no boundary states the entry always gets
    // the init via greeting — no double-start risk.
    it('non-agentic sources → 0 boundary states; 1 StateInitialNode (greeting)', () => {
      const m = bpmn();
      Object.assign(m.elements, {
        L: lane('L'),
        R: laneB('R', 'Reviewer'),
        t1: taskIn('t1', 'A', 'L', 10),
        t2: taskIn('t2', 'B', 'L', 200),
        r1: taskIn('r1', 'X', 'R', 10),
      });
      Object.assign(m.relationships, { f1: seq('f1', 'r1', 't1'), f2: seq('f2', 'r1', 't2') });
      const res = laneToAgentModel(m, 'L');
      if (!res.ok) throw new Error('expected ok');
      expect(
        Object.values(res.model.elements).filter(
          (e) =>
            e.type === 'AgentState' && ['input', 'output'].includes((e as { stereotype?: string }).stereotype ?? ''),
        ),
      ).toHaveLength(0);
      expect(Object.values(res.model.elements).filter((e) => e.type === 'StateInitialNode')).toHaveLength(1);
    });

    // 45 replaces the boundary-state removal (IO-6): non-agentic gateway-mediated cross-lane flow →
    // no boundary state; greeting wires directly to the first entry task.
    it('non-agentic gateway-mediated input → 0 boundary states; greeting → first entry', () => {
      const m = bpmn();
      Object.assign(m.elements, {
        L: lane('L'),
        R: laneB('R', 'Reviewer'),
        impl: taskIn('impl', 'Implement', 'L', 10),
        tnew: taskIn('tnew', 'Downstream', 'L', 200),
        g: gw('g', 120),
        r1: taskIn('r1', 'X', 'R', 10),
      });
      Object.assign(m.relationships, { f1: seq('f1', 'r1', 'g'), f2: seq('f2', 'g', 'tnew') });
      const res = laneToAgentModel(m, 'L');
      if (!res.ok) throw new Error('expected ok');
      expect(
        Object.values(res.model.elements).filter(
          (e) => e.type === 'AgentState' && (e as { stereotype?: string }).stereotype === 'input',
        ),
      ).toHaveLength(0);
      expect(Object.values(res.model.elements).filter((e) => e.type === 'StateInitialNode')).toHaveLength(1);
      const stateId = (name: string) =>
        Object.values(res.model.elements).find((e) => e.type === 'AgentState' && e.name === name)!.id;
      const greetState = Object.values(res.model.elements).find((e) => e.name === 'Coder_greet')!;
      const greetToEntry = Object.values(res.model.relationships).find(
        (e) => e.type === 'AgentStateTransition' && e.source.element === greetState.id,
      );
      expect(greetToEntry).toBeDefined();
      expect(greetToEntry!.target.element).toBe(stateId('Implement'));
    });

    it('item 22 — a lane-owned start event does NOT produce a from_<self> boundary', () => {
      const startEvt = (id: string, owner: string) => ({
        id,
        name: '',
        type: 'BPMNStartEvent',
        owner,
        bounds: { x: -80, y: 0, width: 30, height: 30 },
      });
      const m = bpmn();
      Object.assign(m.elements, {
        L: lane('L'), // agentic BPMNSwimlane, name 'Coder'
        s1: startEvt('s1', 'L'), // start event OWNED by lane L
        t1: task('t1', 'coordinate_work', 10), // outer helper hardcodes owner 'L'
      });
      // intra-lane: start event (owned by L) → the lane's entry task
      Object.assign(m.relationships, { f1: seq('f1', 's1', 't1') });
      const res = laneToAgentModel(m, 'L');
      if (!res.ok) throw new Error('expected ok');
      const boundaries = Object.values(res.model.elements).filter(
        (e) => e.type === 'AgentState' && ['input', 'output'].includes((e as { stereotype?: string }).stereotype ?? ''),
      );
      expect(boundaries).toHaveLength(0); // no from_L / to_L
      // and exactly one cold-start marker on the entry task
      const inits = Object.values(res.model.elements).filter((e) => e.type === 'StateInitialNode');
      expect(inits).toHaveLength(1);
    });
  });

  describe('item 17 — BUML validity: state-name sanitization + guaranteed init', () => {
    it('Bug 1a: task name with spaces → underscored state name, no whitespace in output', () => {
      const m = bpmn();
      Object.assign(m.elements, { L: lane('L'), t1: task('t1', 'Plan Code', 10) });
      const r = laneToAgentModel(m, 'L');
      if (!r.ok) throw new Error('expected ok');
      const states = Object.values(r.model.elements).filter((e) => e.type === 'AgentState');
      expect(states.every((e) => !/\s/.test(e.name))).toBe(true);
      const taskState = states.find((e) => !(e as { stereotype?: string }).stereotype);
      expect(taskState?.name).toBe('Plan_Code');
    });

    it('Bug 1b: task name with hyphens/dots → underscored, no non-word chars', () => {
      const m = bpmn();
      Object.assign(m.elements, { L: lane('L'), t1: task('t1', 'Foo-Bar.Baz', 10) });
      const r = laneToAgentModel(m, 'L');
      if (!r.ok) throw new Error('expected ok');
      // greeting state also has no stereotype; isolate task-derived states
      // via elementMapping (greeting is synthetic and has no mapping entry).
      const taskStates = Object.values(r.model.elements).filter(
        (e) => e.type === 'AgentState' && r.elementMapping[e.id],
      );
      expect(taskStates).toHaveLength(1);
      expect(taskStates[0].name).toBe('Foo_Bar_Baz');
      expect(/[^\w]/.test(taskStates[0].name)).toBe(false);
    });

    it('Bug 1c: non-agentic external lane → no boundary state emitted (DQ-3)', () => {
      // Before the boundary-state removal: a from_Code_Reviewer «input» state with sanitized name
      // was emitted. After: non-agentic peer folds into cold-start; no state.
      const m = bpmn();
      Object.assign(m.elements, {
        L: lane('L'),
        R: {
          id: 'R',
          name: 'Code Reviewer',
          type: 'BPMNSwimlane',
          owner: null,
          isAgentic: false,
          bounds: { x: 0, y: 300, width: 400, height: 200 },
        },
        t1: { id: 't1', name: 'Work', type: 'BPMNTask', owner: 'L', bounds: { x: 10, y: 0, width: 100, height: 60 } },
        r1: { id: 'r1', name: 'Review', type: 'BPMNTask', owner: 'R', bounds: { x: 10, y: 0, width: 100, height: 60 } },
      });
      Object.assign(m.relationships, { f1: seq('f1', 'r1', 't1') });
      const r = laneToAgentModel(m, 'L');
      if (!r.ok) throw new Error('expected ok');
      const inputStates = Object.values(r.model.elements).filter(
        (e) => e.type === 'AgentState' && (e as { stereotype?: string }).stereotype === 'input',
      );
      expect(inputStates).toHaveLength(0);
    });

    it('Bug 2: single task entirely driven by an «input» flow → still one StateInitialNode', () => {
      const m = bpmn();
      Object.assign(m.elements, {
        L: lane('L'),
        R: {
          id: 'R',
          name: 'Caller',
          type: 'BPMNSwimlane',
          owner: null,
          isAgentic: false,
          bounds: { x: 0, y: 300, width: 400, height: 200 },
        },
        t1: { id: 't1', name: 'Handle', type: 'BPMNTask', owner: 'L', bounds: { x: 10, y: 0, width: 100, height: 60 } },
        r1: {
          id: 'r1',
          name: 'Trigger',
          type: 'BPMNTask',
          owner: 'R',
          bounds: { x: 10, y: 0, width: 100, height: 60 },
        },
      });
      Object.assign(m.relationships, { f1: seq('f1', 'r1', 't1') });
      const r = laneToAgentModel(m, 'L');
      if (!r.ok) throw new Error('expected ok');
      const inits = Object.values(r.model.elements).filter((e) => e.type === 'StateInitialNode');
      expect(inits).toHaveLength(1);
      const initTrans = Object.values(r.model.relationships).filter((e) => e.type === 'AgentStateTransitionInit');
      expect(initTrans).toHaveLength(1);
    });

    it('Bug 2: all state names are space-free even when guarantee-init fires on an input-fed task', () => {
      const m = bpmn();
      Object.assign(m.elements, {
        L: lane('L'),
        R: {
          id: 'R',
          name: 'External Agent',
          type: 'BPMNSwimlane',
          owner: null,
          isAgentic: false,
          bounds: { x: 0, y: 300, width: 400, height: 200 },
        },
        t1: {
          id: 't1',
          name: 'Process Request',
          type: 'BPMNTask',
          owner: 'L',
          bounds: { x: 10, y: 0, width: 100, height: 60 },
        },
        r1: { id: 'r1', name: 'X', type: 'BPMNTask', owner: 'R', bounds: { x: 10, y: 0, width: 100, height: 60 } },
      });
      Object.assign(m.relationships, { f1: seq('f1', 'r1', 't1') });
      const r = laneToAgentModel(m, 'L');
      if (!r.ok) throw new Error('expected ok');
      const allStateNames = Object.values(r.model.elements)
        .filter((e) => e.type === 'AgentState')
        .map((e) => e.name);
      expect(allStateNames.every((n) => !/\s/.test(n))).toBe(true);
    });
  });

  describe('36 — greeting-wrapper state (BAF-safe initial)', () => {
    it('emits a <Lane>_greet state and makes it the StateInitialNode target', () => {
      const m = bpmn();
      Object.assign(m.elements, { L: lane('L'), t1: task('t1', 'Respond', 10) });
      const r = laneToAgentModel(m, 'L');
      if (!r.ok) throw new Error('expected ok');
      // greeting state present and named from the lane
      const greetState = Object.values(r.model.elements).find(
        (e) => e.type === 'AgentState' && e.name === 'Coder_greet',
      );
      expect(greetState).toBeDefined();
      // StateInitialNode → greeting
      const initTrans = Object.values(r.model.relationships).filter((e) => e.type === 'AgentStateTransitionInit');
      expect(initTrans).toHaveLength(1);
      expect(initTrans[0].target.element).toBe(greetState!.id);
    });

    it('first task-state is NOT the AgentStateTransitionInit target; greeting wires to it via when_no_intent_matched', () => {
      const m = bpmn();
      Object.assign(m.elements, { L: lane('L'), t1: task('t1', 'LLM_reply', 10) });
      const r = laneToAgentModel(m, 'L');
      if (!r.ok) throw new Error('expected ok');
      const taskState = Object.values(r.model.elements).find((e) => e.type === 'AgentState' && r.elementMapping[e.id])!;
      const initTrans = Object.values(r.model.relationships).find((e) => e.type === 'AgentStateTransitionInit')!;
      // init does NOT go to the task
      expect(initTrans.target.element).not.toBe(taskState.id);
      // greeting → task via when_no_intent_matched
      const greetState = Object.values(r.model.elements).find((e) => e.name === 'Coder_greet')!;
      const noIntentTrans = Object.values(r.model.relationships).find(
        (e) =>
          e.type === 'AgentStateTransition' && e.source.element === greetState.id && e.target.element === taskState.id,
      );
      expect(noIntentTrans).toBeDefined();
      expect(
        (noIntentTrans as unknown as { predefined?: { predefinedType?: string } }).predefined?.predefinedType,
      ).toBe('when_no_intent_matched');
    });

    it('non-agentic input-fed entry: greeting wires DIRECTLY to the entry task (no boundary chaining)', () => {
      // Before the boundary-state removal: greeting → input-boundary → task.
      // After: boundary states gone; greeting → task directly.
      const m = bpmn();
      const laneB = (id: string, nm: string) => ({
        id,
        name: nm,
        type: 'BPMNSwimlane',
        owner: null,
        isAgentic: false,
        bounds: { x: 0, y: 300, width: 400, height: 200 },
      });
      const taskIn = (id: string, nm: string, owner: string, x: number) => ({
        id,
        name: nm,
        type: 'BPMNTask',
        owner,
        bounds: { x, y: 0, width: 100, height: 60 },
      });
      Object.assign(m.elements, {
        L: lane('L'),
        R: laneB('R', 'Caller'),
        t1: taskIn('t1', 'Handle', 'L', 10),
        r1: taskIn('r1', 'Trigger', 'R', 10),
      });
      Object.assign(m.relationships, { f1: seq('f1', 'r1', 't1') });
      const r = laneToAgentModel(m, 'L');
      if (!r.ok) throw new Error('expected ok');
      const greetState = Object.values(r.model.elements).find((e) => e.name === 'Coder_greet')!;
      const taskState = Object.values(r.model.elements).find(
        (e) => e.type === 'AgentState' && r.elementMapping[e.id] === 't1',
      )!;
      // 0 boundary states
      expect(
        Object.values(r.model.elements).filter(
          (e) =>
            e.type === 'AgentState' && ['input', 'output'].includes((e as { stereotype?: string }).stereotype ?? ''),
        ),
      ).toHaveLength(0);
      // greeting → task DIRECTLY (no intermediate boundary)
      const greetEdge = Object.values(r.model.relationships).find(
        (e) => e.type === 'AgentStateTransition' && e.source.element === greetState.id,
      )!;
      expect(greetEdge.target.element).toBe(taskState.id);
      expect((greetEdge as unknown as { predefined?: { predefinedType?: string } }).predefined?.predefinedType).toBe(
        'when_no_intent_matched',
      );
    });
  });

  describe('39 — reflection scaffolds (4c)', () => {
    const rtask = (id: string, name: string, x: number, mode: 'none' | 'self' | 'cross' | 'human') => ({
      ...task(id, name, x),
      reflectionMode: mode,
    });
    const findState = (m: UMLModel, name: string) =>
      Object.values(m.elements).find((e) => e.type === 'AgentState' && e.name === name);
    const transitions = (m: UMLModel) =>
      Object.values(m.relationships).filter((e) => e.type === 'AgentStateTransition');

    it("reflectionMode 'none' adds no reflection states", () => {
      const m = bpmn();
      Object.assign(m.elements, { L: lane('L'), t1: rtask('t1', 'Plan', 10, 'none'), t2: task('t2', 'Code', 200) });
      Object.assign(m.relationships, { f1: seq('f1', 't1', 't2') });
      const r = laneToAgentModel(m, 'L');
      if (!r.ok) throw new Error('expected ok');
      const names = Object.values(r.model.elements)
        .filter((e) => e.type === 'AgentState')
        .map((e) => e.name)
        .sort();
      expect(names).toEqual(['Code', 'Coder_greet', 'Plan']); // no *_reflect / review_ / feedback_
    });

    it("'self' inserts a <task>_reflect state with a self-loop and re-routes the forward edge", () => {
      const m = bpmn();
      Object.assign(m.elements, { L: lane('L'), t1: rtask('t1', 'Plan', 10, 'self'), t2: task('t2', 'Code', 200) });
      Object.assign(m.relationships, { f1: seq('f1', 't1', 't2') });
      const r = laneToAgentModel(m, 'L');
      if (!r.ok) throw new Error('expected ok');
      const reflect = findState(r.model, 'Plan_reflect');
      expect(reflect).toBeDefined();
      const plan = findState(r.model, 'Plan')!;
      const code = findState(r.model, 'Code')!;
      const ts = transitions(r.model);
      // original Plan → Code is re-routed (gone)
      expect(ts.some((e) => e.source.element === plan.id && e.target.element === code.id)).toBe(false);
      // Plan → reflect via when_no_intent_matched
      const entry = ts.find((e) => e.source.element === plan.id && e.target.element === reflect!.id)!;
      expect(entry).toBeDefined();
      expect((entry as unknown as { predefined?: { predefinedType?: string } }).predefined?.predefinedType).toBe(
        'when_no_intent_matched',
      );
      // self-loop on reflect
      expect(ts.some((e) => e.source.element === reflect!.id && e.target.element === reflect!.id)).toBe(true);
      // reflect → Code (forward / "approve")
      expect(ts.some((e) => e.source.element === reflect!.id && e.target.element === code.id)).toBe(true);
    });

    it("'self' re-homes downstream outbound A2A onto <task>_reflect (runtime carrier, not just icon position)", () => {
      const m = bpmn();
      Object.assign(m.elements, {
        L: {
          id: 'L',
          name: 'Coder',
          type: 'BPMNSwimlane',
          owner: null,
          isAgentic: true,
          role: 'solution',
          bounds: { x: 0, y: 0, width: 400, height: 200 },
        },
        P: {
          id: 'P',
          name: 'Reviewer',
          type: 'BPMNSwimlane',
          owner: null,
          isAgentic: true,
          role: 'supervision',
          agentDiagramRef: 'agent-reviewer',
          bounds: { x: 0, y: 250, width: 400, height: 200 },
        },
        t1: { ...task('t1', 'Plan', 10), reflectionMode: 'self' },
        g: gw('g', 180),
        p1: {
          id: 'p1',
          name: 'Review',
          type: 'BPMNTask',
          owner: 'P',
          bounds: { x: 10, y: 0, width: 100, height: 60 },
        },
      });
      Object.assign(m.relationships, {
        f1: seq('f1', 't1', 'g'),
        f2: seq('f2', 'g', 'p1'),
      });
      const r = laneToAgentModel(m, 'L');
      if (!r.ok) throw new Error('expected ok');

      const plan = findState(r.model, 'Plan')!;
      const reflect = findState(r.model, 'Plan_reflect')!;
      const ts = transitions(r.model);

      const planDesc = (plan as unknown as { description?: string }).description ?? '';
      const reflectDesc = (reflect as unknown as { description?: string }).description ?? '';

      // outbound A2A now executes from the post-reflection state.
      expect(planDesc).not.toContain('a2a:out;');
      expect(reflectDesc).toMatch(/a2a:out;peer=Reviewer;ref=agent-reviewer;flow=f2;order=1;kind=revises/);

      // Existing self-reflection topology is preserved in this pass.
      expect(ts.some((e) => e.source.element === plan.id && e.target.element === reflect.id)).toBe(true);
      expect(ts.some((e) => e.source.element === reflect.id && e.target.element === reflect.id)).toBe(true);
    });
    it("'cross' emits A2A (no wait state): a2a:out tag + greeting→next intent edge + AgentIntent", () => {
      // cross-reflection is inter-agent, so it is modelled as A2A metadata,
      // NOT a fabricated state. The old Plan_await_review wait state is gone.
      const m = bpmn();
      Object.assign(m.elements, { L: lane('L'), t1: rtask('t1', 'Plan', 10, 'cross'), t2: task('t2', 'Code', 200) });
      Object.assign(m.relationships, { f1: seq('f1', 't1', 't2') });
      const r = laneToAgentModel(m, 'L');
      if (!r.ok) throw new Error('expected ok');

      // no fabricated wait / boundary state
      expect(findState(r.model, 'Plan_await_review')).toBeUndefined();
      expect(findState(r.model, 'feedback_from_Plan')).toBeUndefined();

      const plan = findState(r.model, 'Plan')!;
      const code = findState(r.model, 'Code')!;
      const greet = findState(r.model, 'Coder_greet')!;
      const ts = transitions(r.model);

      // (a) outbound a2a:out tag on the producing (Plan) state's description
      expect((plan as unknown as { description?: string }).description).toMatch(
        /a2a:out;peer=reviewer;ref=;flow=reflect:t1;order=1;kind=revises/,
      );

      // Plan → Code direct edge is re-routed away (gone)
      expect(ts.some((e) => e.source.element === plan.id && e.target.element === code.id)).toBe(false);

      // (b) greeting → Code when_intent_matched, intentName recv_reviewer_Plan, a2a:in tag in name
      const inbound = ts.find((e) => e.source.element === greet.id && e.target.element === code.id)!;
      expect(inbound).toBeDefined();
      expect((inbound as unknown as { predefined?: { predefinedType?: string } }).predefined?.predefinedType).toBe(
        'when_intent_matched',
      );
      expect((inbound as unknown as { intentName?: string }).intentName).toBe('recv_reviewer_Plan');
      expect(inbound.name).toMatch(/^a2a:in;peer=reviewer;ref=;flow=reflect:t1;kind=revises$/);

      // (c) the AgentIntent scaffold
      const intent = Object.values(r.model.elements).find(
        (e) => e.type === 'AgentIntent' && e.name === 'recv_reviewer_Plan',
      );
      expect(intent).toBeDefined();
    });

    it("'cross' lineages the inbound feedback edge to the inducing task", () => {
      const m = bpmn();
      Object.assign(m.elements, { L: lane('L'), t1: rtask('t1', 'Plan', 10, 'cross'), t2: task('t2', 'Code', 200) });
      Object.assign(m.relationships, { f1: seq('f1', 't1', 't2') });
      const r = laneToAgentModel(m, 'L');
      if (!r.ok) throw new Error('expected ok');
      const greet = findState(r.model, 'Coder_greet')!;
      const code = findState(r.model, 'Code')!;
      const inbound = transitions(r.model).find((e) => e.source.element === greet.id && e.target.element === code.id)!;
      expect(r.elementMapping?.[inbound.id]).toBe('t1');
    });

    it("'cross' on a terminal task emits the a2a:out tag only (no intent edge, no AgentIntent)", () => {
      const m = bpmn();
      Object.assign(m.elements, { L: lane('L'), t1: rtask('t1', 'Plan', 10, 'cross') });
      const r = laneToAgentModel(m, 'L');
      if (!r.ok) throw new Error('expected ok');
      const plan = findState(r.model, 'Plan')!;
      expect((plan as unknown as { description?: string }).description).toMatch(/a2a:out;peer=reviewer;.*kind=revises/);
      // no inbound feedback intent / scaffold for a task with no forward next
      expect(Object.values(r.model.elements).some((e) => e.type === 'AgentIntent')).toBe(false);
      const greet = findState(r.model, 'Coder_greet')!;
      expect(transitions(r.model).some((e) => e.source.element === greet.id && e.target.element === plan.id)).toBe(
        // only the cold-start greeting→Plan (when_no_intent_matched) exists, no recv edge
        true,
      );
      const greetEdges = transitions(r.model).filter((e) => e.source.element === greet.id);
      expect(greetEdges).toHaveLength(1);
      expect(
        (greetEdges[0] as unknown as { predefined?: { predefinedType?: string } }).predefined?.predefinedType,
      ).toBe('when_no_intent_matched');
    });

    it("'cross' whose next is the entry state suppresses the cold-start (no double greeting edge)", () => {
      // cycle Plan ↔ Code, Code is cross-reflective and its forward `next` (Plan)
      // is the entry state → the reflection intent edge greeting→Plan must
      // suppress the cold-start greeting→Plan (intent-target union).
      const m = bpmn();
      Object.assign(m.elements, {
        L: lane('L'),
        t1: task('t1', 'Plan', 10),
        t2: rtask('t2', 'Code', 200, 'cross'),
      });
      Object.assign(m.relationships, { f1: seq('f1', 't1', 't2'), f2: seq('f2', 't2', 't1') });
      const r = laneToAgentModel(m, 'L');
      if (!r.ok) throw new Error('expected ok');
      const greet = findState(r.model, 'Coder_greet')!;
      const plan = findState(r.model, 'Plan')!;
      const greetToPlan = transitions(r.model).filter(
        (e) => e.source.element === greet.id && e.target.element === plan.id,
      );
      expect(greetToPlan).toHaveLength(1); // exactly one — the reflection intent edge, cold-start suppressed
      expect(
        (greetToPlan[0] as unknown as { predefined?: { predefinedType?: string } }).predefined?.predefinedType,
      ).toBe('when_intent_matched');
    });

    it("'human' inserts a <task>_human_review wait state with approve-forward + reject-loop", () => {
      const m = bpmn();
      Object.assign(m.elements, { L: lane('L'), t1: rtask('t1', 'Plan', 10, 'human'), t2: task('t2', 'Code', 200) });
      Object.assign(m.relationships, { f1: seq('f1', 't1', 't2') });
      const r = laneToAgentModel(m, 'L');
      if (!r.ok) throw new Error('expected ok');
      const human = findState(r.model, 'Plan_human_review');
      expect(human).toBeDefined();
      const plan = findState(r.model, 'Plan')!;
      const code = findState(r.model, 'Code')!;
      const ts = transitions(r.model);
      expect(ts.some((e) => e.source.element === plan.id && e.target.element === code.id)).toBe(false);
      // task → human_review via when_no_intent_matched
      const entry = ts.find((e) => e.source.element === plan.id && e.target.element === human!.id)!;
      expect((entry as unknown as { predefined?: { predefinedType?: string } }).predefined?.predefinedType).toBe(
        'when_no_intent_matched',
      );
      // approved → Code
      expect(ts.some((e) => e.source.element === human!.id && e.target.element === code.id)).toBe(true);
      // rejected → back to Plan
      expect(ts.some((e) => e.source.element === human!.id && e.target.element === plan.id)).toBe(true);
    });

    it("'cross' with named reviewer lane: peer=<laneName>, ref=<laneId>, intent recv_<laneName>_<task>", () => {
      const m = bpmn();
      Object.assign(m.elements, {
        L: lane('L'),
        L2: {
          id: 'L2',
          name: 'Supervisor',
          type: 'BPMNSwimlane',
          owner: null,
          isAgentic: true,
          bounds: { x: 0, y: 200, width: 400, height: 80 },
        },
        t1: { ...task('t1', 'Plan', 10), reflectionMode: 'cross', reflectionReviewerLaneId: 'L2' },
        t2: task('t2', 'Code', 200),
      });
      Object.assign(m.relationships, { f1: seq('f1', 't1', 't2') });
      const r = laneToAgentModel(m, 'L');
      if (!r.ok) throw new Error('expected ok');

      const plan = findState(r.model, 'Plan')!;
      const code = findState(r.model, 'Code')!;
      const greet = findState(r.model, 'Coder_greet')!;
      const ts = transitions(r.model);

      expect((plan as unknown as { description?: string }).description).toMatch(
        /a2a:out;peer=Supervisor;ref=L2;flow=reflect:t1;order=1;kind=revises/,
      );

      const inbound = ts.find((e) => e.source.element === greet.id && e.target.element === code.id)!;
      expect(inbound).toBeDefined();
      expect((inbound as unknown as { predefined?: { predefinedType?: string } }).predefined?.predefinedType).toBe(
        'when_intent_matched',
      );
      expect((inbound as unknown as { intentName?: string }).intentName).toBe('recv_Supervisor_Plan');
      expect(inbound.name).toMatch(/^a2a:in;peer=Supervisor;ref=L2;flow=reflect:t1;kind=revises$/);

      const intent = Object.values(r.model.elements).find(
        (e) => e.type === 'AgentIntent' && e.name === 'recv_Supervisor_Plan',
      );
      expect(intent).toBeDefined();
    });

    it("'cross' with no reviewer set still emits peer=reviewer placeholder", () => {
      const m = bpmn();
      Object.assign(m.elements, {
        L: lane('L'),
        L2: {
          id: 'L2',
          name: 'Supervisor',
          type: 'BPMNSwimlane',
          owner: null,
          isAgentic: true,
          bounds: { x: 0, y: 200, width: 400, height: 80 },
        },
        t1: { ...task('t1', 'Plan', 10), reflectionMode: 'cross' }, // no reflectionReviewerLaneId
        t2: task('t2', 'Code', 200),
      });
      Object.assign(m.relationships, { f1: seq('f1', 't1', 't2') });
      const r = laneToAgentModel(m, 'L');
      if (!r.ok) throw new Error('expected ok');
      const plan = findState(r.model, 'Plan')!;
      expect((plan as unknown as { description?: string }).description).toMatch(/peer=reviewer;ref=;/);
      expect(
        Object.values(r.model.elements).find((e) => e.type === 'AgentIntent' && e.name === 'recv_reviewer_Plan'),
      ).toBeDefined();
    });

    it("'cross' with dangling reviewer ID falls back to peer=reviewer but preserves ref=<id>", () => {
      const m = bpmn();
      Object.assign(m.elements, {
        L: lane('L'),
        t1: { ...task('t1', 'Plan', 10), reflectionMode: 'cross', reflectionReviewerLaneId: 'no-such-lane' },
        t2: task('t2', 'Code', 200),
      });
      Object.assign(m.relationships, { f1: seq('f1', 't1', 't2') });
      const r = laneToAgentModel(m, 'L');
      if (!r.ok) throw new Error('expected ok');
      const plan = findState(r.model, 'Plan')!;
      expect((plan as unknown as { description?: string }).description).toMatch(
        /a2a:out;peer=reviewer;ref=no-such-lane;flow=reflect:t1;/,
      );
      expect(
        Object.values(r.model.elements).find((e) => e.type === 'AgentIntent' && e.name === 'recv_reviewer_Plan'),
      ).toBeDefined();
    });
  });

  describe('45 — A2A cross-lane I/O', () => {
    const agLane = (id: string, name: string, role: string) => ({
      id,
      name,
      type: 'BPMNSwimlane',
      owner: null,
      isAgentic: true,
      role,
      bounds: { x: 0, y: 400, width: 400, height: 200 },
    });
    const agTask = (id: string, name: string, owner: string) => ({
      id,
      name,
      type: 'BPMNTask',
      owner,
      bounds: { x: 10, y: 0, width: 100, height: 60 },
    });

    it('A2A-1: zero stereotype states + no fabricated cross wait state; real + reflection intents coexist', () => {
      const m = bpmn();
      Object.assign(m.elements, {
        L: {
          id: 'L',
          name: 'Coder',
          type: 'BPMNSwimlane',
          owner: null,
          isAgentic: true,
          role: 'solution',
          bounds: { x: 0, y: 0, width: 400, height: 200 },
        },
        P: agLane('P', 'Supervisor', 'supervision'),
        t1: {
          id: 't1',
          name: 'Plan',
          type: 'BPMNTask',
          owner: 'L',
          bounds: { x: 10, y: 0, width: 100, height: 60 },
          reflectionMode: 'cross',
        },
        t2: task('t2', 'Code', 200),
        p1: agTask('p1', 'Assign', 'P'),
      });
      Object.assign(m.relationships, {
        f1: seq('f1', 'p1', 't1'), // agentic inbound (real cross-lane)
        f2: seq('f2', 't1', 't2'), // intra-lane
      });
      const r = laneToAgentModel(m, 'L');
      if (!r.ok) throw new Error('expected ok');

      const boundaryStates = Object.values(r.model.elements).filter(
        (e) => e.type === 'AgentState' && ['input', 'output'].includes((e as { stereotype?: string }).stereotype ?? ''),
      );
      expect(boundaryStates).toHaveLength(0);

      // cross reflection no longer fabricates a wait state
      expect(
        Object.values(r.model.elements).find((e) => e.type === 'AgentState' && e.name === 'Plan_await_review'),
      ).toBeUndefined();

      // two distinct intents on distinct rows: the real cross-lane inbound and the reflection feedback
      const intents = Object.values(r.model.elements).filter((e) => e.type === 'AgentIntent');
      const names = intents.map((e) => e.name).sort();
      expect(names).toEqual(['recv_Supervisor_Plan', 'recv_reviewer_Plan']);
      const ys = intents.map((e) => (e as unknown as { bounds: { y: number } }).bounds.y);
      expect(new Set(ys).size).toBe(2); // rows don't overlap
    });

    it('A2A-2: single agentic inbound → when_intent_matched edge + AgentIntent scaffold (diverge-merge fixture)', () => {
      // Derive lane-wkr (Coder, worker). Flow f2: gw-diver(lane-mgr) → task-repro(lane-wkr).
      // Expected: 1 AgentIntent recv_Reviewer_Reproduce_and_fix; 1 intent transition
      // greet→task; hidden a2a:in tag in name.
      const r = laneToAgentModel(divergeMerge as unknown as UMLModel, 'lane-wkr');
      if (!r.ok) throw new Error('expected ok');

      const intents = Object.values(r.model.elements).filter((e) => e.type === 'AgentIntent');
      expect(intents).toHaveLength(1);
      expect(intents[0].name).toBe('recv_Reviewer_Reproduce_and_fix');

      const greet = Object.values(r.model.elements).find((e) => e.type === 'AgentState' && e.name === 'Coder_greet')!;
      const intentTrans = Object.values(r.model.relationships).filter(
        (e) =>
          e.type === 'AgentStateTransition' &&
          e.source.element === greet.id &&
          (e as unknown as { predefined?: { predefinedType?: string } }).predefined?.predefinedType ===
            'when_intent_matched',
      );
      expect(intentTrans).toHaveLength(1);
      // intentName in predefined block (deserialize path)
      expect((intentTrans[0] as unknown as { predefined?: { intentName?: string } }).predefined?.intentName).toBe(
        'recv_Reviewer_Reproduce_and_fix',
      );
      // intentName also at top-level (constructor path — constructor-path fix)
      expect((intentTrans[0] as unknown as { intentName?: string }).intentName).toBe('recv_Reviewer_Reproduce_and_fix');
      const tag = (intentTrans[0] as unknown as { name?: string }).name ?? '';
      expect(tag).toBe('a2a:in;peer=Reviewer;ref=;flow=f2;kind=supervises');

      // Cold-start is suppressed when the entry task has an intent transition
      const coldStart = Object.values(r.model.relationships).filter(
        (e) =>
          e.type === 'AgentStateTransition' &&
          e.source.element === greet.id &&
          (e as unknown as { predefined?: { predefinedType?: string } }).predefined?.predefinedType ===
            'when_no_intent_matched',
      );
      expect(coldStart).toHaveLength(0);
    });

    it('A2A-3: multi-peer inbound → 3 greeting edges, 3 distinct recv_* intents, 3 distinct peer= tags', () => {
      const m = bpmn();
      Object.assign(m.elements, {
        L: {
          id: 'L',
          name: 'Coder',
          type: 'BPMNSwimlane',
          owner: null,
          isAgentic: true,
          role: 'solution',
          bounds: { x: 0, y: 0, width: 400, height: 200 },
        },
        X: agLane('X', 'PeerX', 'solution'),
        Y: agLane('Y', 'PeerY', 'solution'),
        Z: agLane('Z', 'PeerZ', 'supervision'),
        t1: task('t1', 'Work', 10),
        x1: agTask('x1', 'TX', 'X'),
        y1: agTask('y1', 'TY', 'Y'),
        z1: agTask('z1', 'TZ', 'Z'),
      });
      Object.assign(m.relationships, {
        f1: seq('f1', 'x1', 't1'),
        f2: seq('f2', 'y1', 't1'),
        f3: seq('f3', 'z1', 't1'),
      });
      const r = laneToAgentModel(m, 'L');
      if (!r.ok) throw new Error('expected ok');

      const intents = Object.values(r.model.elements).filter((e) => e.type === 'AgentIntent');
      expect(intents).toHaveLength(3);
      expect(intents.map((e) => e.name).sort()).toEqual(['recv_PeerX_Work', 'recv_PeerY_Work', 'recv_PeerZ_Work']);

      const greet = Object.values(r.model.elements).find((e) => e.type === 'AgentState' && e.name === 'Coder_greet')!;
      const intentEdges = Object.values(r.model.relationships).filter(
        (e) =>
          e.type === 'AgentStateTransition' &&
          e.source.element === greet.id &&
          (e as unknown as { predefined?: { predefinedType?: string } }).predefined?.predefinedType ===
            'when_intent_matched',
      );
      expect(intentEdges).toHaveLength(3);
      const peers = intentEdges
        .map((e) => {
          const match = ((e as unknown as { name?: string }).name ?? '').match(/peer=([^;]+)/);
          return match ? match[1] : '';
        })
        .sort();
      expect(peers).toEqual(['PeerX', 'PeerY', 'PeerZ']);
    });

    it('A2A-4: non-agentic / start-event inbound → cold-start only, no AgentIntent', () => {
      const m = bpmn();
      Object.assign(m.elements, {
        L: lane('L'),
        R: {
          id: 'R',
          name: 'Human',
          type: 'BPMNSwimlane',
          owner: null,
          isAgentic: false,
          bounds: { x: 0, y: 300, width: 400, height: 200 },
        },
        t1: task('t1', 'Work', 10),
        r1: {
          id: 'r1',
          name: 'Trigger',
          type: 'BPMNTask',
          owner: 'R',
          bounds: { x: 10, y: 0, width: 100, height: 60 },
        },
      });
      Object.assign(m.relationships, { f1: seq('f1', 'r1', 't1') });
      const r = laneToAgentModel(m, 'L');
      if (!r.ok) throw new Error('expected ok');
      expect(Object.values(r.model.elements).filter((e) => e.type === 'AgentIntent')).toHaveLength(0);
      const greet = Object.values(r.model.elements).find((e) => e.type === 'AgentState' && e.name === 'Coder_greet')!;
      const greetEdges = Object.values(r.model.relationships).filter(
        (e) => e.type === 'AgentStateTransition' && e.source.element === greet.id,
      );
      // only the cold-start when_no_intent_matched edge
      expect(greetEdges).toHaveLength(1);
      expect(
        (greetEdges[0] as unknown as { predefined?: { predefinedType?: string } }).predefined?.predefinedType,
      ).toBe('when_no_intent_matched');
    });

    it('A2A-5: agentic outbound → a2a:out tag on producing state description; ascending order for fan-out', () => {
      const m = bpmn();
      Object.assign(m.elements, {
        L: {
          id: 'L',
          name: 'Coder',
          type: 'BPMNSwimlane',
          owner: null,
          isAgentic: true,
          role: 'solution',
          bounds: { x: 0, y: 0, width: 400, height: 200 },
        },
        P1: agLane('P1', 'Reviewer', 'supervision'),
        P2: agLane('P2', 'Tester', 'solution'),
        t1: task('t1', 'Write', 10),
        p1t: agTask('p1t', 'Review', 'P1'),
        p2t: agTask('p2t', 'Test', 'P2'),
      });
      Object.assign(m.relationships, {
        f1: seq('f1', 't1', 'p1t'),
        f2: seq('f2', 't1', 'p2t'),
      });
      const r = laneToAgentModel(m, 'L');
      if (!r.ok) throw new Error('expected ok');

      const writeState = Object.values(r.model.elements).find(
        (e) => e.type === 'AgentState' && r.elementMapping[e.id] === 't1',
      )!;
      const desc = (writeState as unknown as { description?: string }).description ?? '';
      expect(desc).toContain('a2a:out;peer=Reviewer;');
      expect(desc).toContain('a2a:out;peer=Tester;');
      const order1 = Number(desc.match(/peer=Reviewer[^\n]*order=(\d+)/)?.[1]);
      const order2 = Number(desc.match(/peer=Tester[^\n]*order=(\d+)/)?.[1]);
      expect(order1).toBeLessThan(order2);
    });

    it('A2A-6: non-agentic outbound sink → a2a:out tag present, no kind= field', () => {
      const m = bpmn();
      Object.assign(m.elements, {
        L: lane('L'),
        E: {
          id: 'E',
          name: 'External',
          type: 'BPMNSwimlane',
          owner: null,
          isAgentic: false,
          bounds: { x: 0, y: 300, width: 400, height: 200 },
        },
        t1: task('t1', 'Work', 10),
        e1: { id: 'e1', name: 'Recv', type: 'BPMNTask', owner: 'E', bounds: { x: 10, y: 0, width: 100, height: 60 } },
      });
      Object.assign(m.relationships, { f1: seq('f1', 't1', 'e1') });
      const r = laneToAgentModel(m, 'L');
      if (!r.ok) throw new Error('expected ok');

      const workState = Object.values(r.model.elements).find(
        (e) => e.type === 'AgentState' && r.elementMapping[e.id] === 't1',
      )!;
      const desc = (workState as unknown as { description?: string }).description ?? '';
      expect(desc).toContain('a2a:out;peer=External;');
      expect(desc).toContain('order=1');
      expect(desc).not.toContain('kind=');
    });
  });

  describe('49 — governed merge states (W3/W4, BESSER-aligned binding)', () => {
    const govGw = (id: string, x: number) => ({
      id,
      name: '',
      type: 'BPMNGateway',
      owner: 'L',
      gatewayRole: 'merging',
      governanceDsl: 'Policy reviewVote { ... }', // non-empty = governed
      bounds: { x, y: 0, width: 40, height: 40 },
    });
    const seqNamed = (id: string, s: string, t: string, name: string) => ({ ...seq(id, s, t), name });
    const agProducerLane = (id: string, name: string) => ({
      id,
      name,
      type: 'BPMNSwimlane',
      owner: null,
      isAgentic: true,
      bounds: { x: 0, y: 300, width: 400, height: 200 },
    });
    const taskOwned = (id: string, name: string, owner: string, x: number) => ({
      id,
      name,
      type: 'BPMNTask',
      owner,
      bounds: { x, y: 0, width: 100, height: 60 },
    });
    const nameOf = (e: unknown) => (e as { name?: string }).name ?? '';

    it('M-1: cross-lane producers → a2a:in;flow=<gateway-id> edges INTO the merge state (the BESSER binding)', () => {
      // px(PeerX) ─┐
      // py(PeerY) ─┴► gM(governed merge, owner L) ─► Publish
      const m = bpmn();
      Object.assign(m.elements, {
        L: lane('L'), // owner 'Coder', agentic
        X: agProducerLane('X', 'PeerX'),
        Y: agProducerLane('Y', 'PeerY'),
        gM: govGw('gM', 200),
        t3: task('t3', 'Publish', 320),
        px: taskOwned('px', 'Draft X', 'X', 10),
        py: taskOwned('py', 'Draft Y', 'Y', 10),
      });
      Object.assign(m.relationships, {
        f1: seq('f1', 'px', 'gM'), // cross-lane producer → governed merge
        f2: seq('f2', 'py', 'gM'),
        f3: seq('f3', 'gM', 't3'),
      });
      const r = laneToAgentModel(m, 'L');
      if (!r.ok) throw new Error('expected ok');

      const merge = Object.values(r.model.elements).find(
        (e) => e.type === 'AgentState' && e.name === 'Address_merge_decision',
      )!;
      expect(merge).toBeDefined();
      expect(r.elementMapping[merge.id]).toBe('gM'); // lineage: merge state ← gateway

      // Two a2a:in binding edges into the merge state, each carrying flow=<gateway-id>.
      const inbound = Object.values(r.model.relationships).filter((e) => e.target.element === merge.id);
      expect(inbound).toHaveLength(2);
      for (const e of inbound) expect(nameOf(e)).toContain('flow=gM'); // the binding BESSER reads
      const peers = inbound.map((e) => (nameOf(e).match(/peer=([^;]+)/) || [])[1]).sort();
      expect(peers).toEqual(['PeerX', 'PeerY']);

      // The producer flow is NOT routed to the successor task (appendCrossLaneIO skipped it).
      const publish = Object.values(r.model.elements).find((e) => e.name === 'Publish')!;
      const a2aIntoPublish = Object.values(r.model.relationships).filter(
        (e) => e.target.element === publish.id && nameOf(e).includes('a2a:in'),
      );
      expect(a2aIntoPublish).toHaveLength(0);

      // An AgentIntent is scaffolded for each inbound binding.
      const intents = Object.values(r.model.elements)
        .filter((e) => e.type === 'AgentIntent')
        .map(nameOf);
      expect(intents).toContain('recv_PeerX_Address_merge_decision');
      expect(intents).toContain('recv_PeerY_Address_merge_decision');
    });

    it('M-2: in-lane producers → guards + a SYNTHETIC self-peer flow=<gateway-id> binding', () => {
      const m = bpmn();
      Object.assign(m.elements, {
        L: lane('L'),
        p1: task('p1', 'Draft A', 10),
        p2: task('p2', 'Draft B', 10),
        gM: govGw('gM', 200),
        t3: task('t3', 'Publish', 320),
      });
      Object.assign(m.relationships, {
        f1: seqNamed('f1', 'p1', 'gM', 'score >= 0.8'),
        f2: seqNamed('f2', 'p2', 'gM', 'needs_review'),
        f3: seq('f3', 'gM', 't3'),
      });
      const r = laneToAgentModel(m, 'L');
      if (!r.ok) throw new Error('expected ok');
      const merge = Object.values(r.model.elements).find((e) => e.name === 'Address_merge_decision')!;
      const greet = Object.values(r.model.elements).find((e) => e.name === 'Coder_greet')!;

      const inbound = Object.values(r.model.relationships).filter((e) => e.target.element === merge.id);
      // 2 in-lane guards + 1 synthetic self-peer binding
      expect(inbound).toHaveLength(3);

      const varOp = inbound.find(
        (e) =>
          (e as unknown as { predefined?: { predefinedType?: string } }).predefined?.predefinedType ===
          'when_variable_operation_matched',
      )!;
      expect((varOp as unknown as { predefined: { conditionValue: unknown } }).predefined.conditionValue).toEqual({
        variable: 'score',
        operator: '>=',
        targetValue: '0.8',
      });
      expect((varOp as unknown as { variable?: string }).variable).toBe('score'); // top-level constructor mirror

      const custom = inbound.find((e) => (e as unknown as { transitionType?: string }).transitionType === 'custom')!;
      expect((custom as unknown as { custom: { condition: string[] } }).custom.condition).toEqual(['needs_review']);

      // synthetic binding: greeting → merge, a2a:in flow=gM, peer=self lane, no kind
      const binding = inbound.find((e) => e.source.element === greet.id)!;
      expect(nameOf(binding)).toBe('a2a:in;peer=Coder;ref=;flow=gM');

      const outbound = Object.values(r.model.relationships).filter((e) => e.source.element === merge.id);
      expect(outbound).toHaveLength(1);
      expect((outbound[0] as unknown as { predefined?: { predefinedType?: string } }).predefined?.predefinedType).toBe(
        'when_no_intent_matched',
      );
    });

    it('M-3: empty condition label → when_no_intent_matched guard (+ synthetic binding)', () => {
      const m = bpmn();
      Object.assign(m.elements, {
        L: lane('L'),
        p1: task('p1', 'Draft', 10),
        gM: govGw('gM', 200),
        t3: task('t3', 'Publish', 320),
      });
      Object.assign(m.relationships, { f1: seq('f1', 'p1', 'gM'), f3: seq('f3', 'gM', 't3') });
      const r = laneToAgentModel(m, 'L');
      if (!r.ok) throw new Error('expected ok');
      const merge = Object.values(r.model.elements).find((e) => e.name === 'Address_merge_decision')!;
      const greet = Object.values(r.model.elements).find((e) => e.name === 'Coder_greet')!;
      const inbound = Object.values(r.model.relationships).filter((e) => e.target.element === merge.id);
      expect(inbound).toHaveLength(2); // 1 guard + 1 synthetic binding

      const guard = inbound.find((e) => e.source.element !== greet.id)!;
      expect((guard as unknown as { predefined?: { predefinedType?: string } }).predefined?.predefinedType).toBe(
        'when_no_intent_matched',
      );
      const binding = inbound.find((e) => e.source.element === greet.id)!;
      expect(nameOf(binding)).toContain('flow=gM');
    });

    it('M-4: two governed merges → distinct states, each bound to its OWN gateway id', () => {
      const m = bpmn();
      Object.assign(m.elements, {
        L: lane('L'),
        p1: task('p1', 'A', 10),
        gM1: govGw('gM1', 120),
        t2: task('t2', 'B', 240),
        p3: task('p3', 'C', 360),
        gM2: govGw('gM2', 480),
        t4: task('t4', 'D', 600),
      });
      Object.assign(m.relationships, {
        f1: seq('f1', 'p1', 'gM1'),
        f2: seq('f2', 'gM1', 't2'),
        f3: seq('f3', 'p3', 'gM2'),
        f4: seq('f4', 'gM2', 't4'),
      });
      const r = laneToAgentModel(m, 'L');
      if (!r.ok) throw new Error('expected ok');
      const mergeNames = Object.values(r.model.elements)
        .filter((e) => e.type === 'AgentState' && e.name.startsWith('Address_merge_decision'))
        .map(nameOf);
      expect(mergeNames).toHaveLength(2);
      expect(new Set(mergeNames).size).toBe(2); // distinct

      // each gateway has at least one a2a:in binding edge carrying its own flow=<id>
      const flows = Object.values(r.model.relationships)
        .map((e) => (nameOf(e).match(/flow=(\w+)/) || [])[1])
        .filter(Boolean);
      expect(flows).toContain('gM1');
      expect(flows).toContain('gM2');
    });

    it('M-5: legacy — a NON-governed merging gateway is still collapsed (no merge state)', () => {
      // diverge-merge fixture: gw-merge is merging but has NO governanceDsl.
      const r = laneToAgentModel(divergeMerge as unknown as UMLModel, 'lane-mgr');
      if (!r.ok) throw new Error('expected ok');
      expect(
        Object.values(r.model.elements).find(
          (e) => e.type === 'AgentState' && e.name.startsWith('Address_merge_decision'),
        ),
      ).toBeUndefined();
    });

    it('M-6: round-trip — the a2a:in;flow=<gateway-id> binding + guard fields are deep-clone stable', () => {
      const m = bpmn();
      Object.assign(m.elements, {
        L: lane('L'),
        p1: task('p1', 'Draft A', 10),
        p2: task('p2', 'Draft B', 10),
        gM: govGw('gM', 200),
        t3: task('t3', 'Publish', 320),
      });
      Object.assign(m.relationships, {
        f1: seqNamed('f1', 'p1', 'gM', 'score >= 0.8'),
        f2: seqNamed('f2', 'p2', 'gM', 'needs_review'),
        f3: seq('f3', 'gM', 't3'),
      });
      const r = laneToAgentModel(m, 'L');
      if (!r.ok) throw new Error('expected ok');

      // Project export/import is JSON serialization; the emitted shape must survive a
      // JSON clone with exactly the keys the AgentStateTransition deserializer reads
      // (Appendix A in the governed-merge implementation). The model classes aren't exported from @besser/wme,
      // so we assert the deserialize-input contract directly.
      const clone = JSON.parse(JSON.stringify(r.model)) as typeof r.model;
      const merge = Object.values(clone.elements).find((e) => e.name === 'Address_merge_decision')!;
      const inbound = Object.values(clone.relationships).filter((e) => e.target.element === merge.id);

      // the binding (a2a:in;flow=gM) survives
      const binding = inbound.find((e) => nameOf(e).includes('a2a:in'))!;
      expect(nameOf(binding)).toContain('flow=gM');

      // the guard payloads survive
      const varOp = inbound.find(
        (e) =>
          (e as unknown as { predefined?: { predefinedType?: string } }).predefined?.predefinedType ===
          'when_variable_operation_matched',
      )!;
      expect((varOp as unknown as { predefined: { conditionValue: unknown } }).predefined.conditionValue).toEqual({
        variable: 'score',
        operator: '>=',
        targetValue: '0.8',
      });
      const custom = inbound.find((e) => (e as unknown as { transitionType?: string }).transitionType === 'custom')!;
      expect((custom as unknown as { custom: { event: string; condition: string[] } }).custom).toEqual({
        event: 'None',
        condition: ['needs_review'],
      });
    });
  });
});
