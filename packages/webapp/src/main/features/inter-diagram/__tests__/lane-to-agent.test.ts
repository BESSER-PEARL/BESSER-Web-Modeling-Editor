import { describe, it, expect } from 'vitest';
import type { BesserEdge, BesserNode, UMLModel } from '@besser/wme';
import { laneToAgentModel } from '../lane-to-agent';
import { makeEdge, makeModel, makeNode, nodesOfType } from './v4-helpers';
import divergeMerge from './fixtures/diverge-merge.json';

// ── BPMN input builders (v4: containment is `parentId`, positions relative to it) ──

// UMLDiagramType.BPMN's wire value is 'BPMNDiagram' — the transform guards on
// the enum, so the fixture must use the wire value.
const bpmn = (nodes: BesserNode[] = [], edges: BesserEdge[] = []): UMLModel => makeModel('BPMNDiagram', nodes, edges);
/** A lane outside any pool; `y` is its vertical position. */
const swimlane = (id: string, name: string, data: Record<string, unknown> = {}, y = 0) =>
  makeNode(id, 'bpmnSwimlane', { name, ...data }, { x: 0, y, width: 400, height: 200 });
const lane = (id: string, agentic = true) => swimlane(id, 'Coder', { isAgentic: agentic });
const task = (id: string, name: string, x: number, parentId = 'L', data: Record<string, unknown> = {}) =>
  makeNode(id, 'bpmnTask', { name, ...data }, { x, y: 0, width: 100, height: 60 }, parentId);
const gw = (id: string, x: number, data: Record<string, unknown> = {}) =>
  makeNode(id, 'bpmnGateway', { name: '', ...data }, { x, y: 0, width: 40, height: 40 }, 'L');
const seq = (id: string, s: string, t: string, name?: string) =>
  makeEdge(id, 'BPMNSequenceFlow', s, t, name === undefined ? {} : { name });

// ── Agent output queries ──

type Predefined = { predefinedType?: string; intentName?: string; conditionValue?: unknown };
const states = (m: UMLModel) => nodesOfType(m, 'AgentState');
const stateNamed = (m: UMLModel, name: string) => states(m).find((n) => n.data.name === name);
const stateName = (n: BesserNode) => String(n.data.name);
const transitions = (m: UMLModel) => m.edges.filter((e) => e.type === 'AgentStateTransition');
const intents = (m: UMLModel) => Object.values(m.components ?? {}).filter((c) => c.type === 'AgentIntent');
const predefinedOf = (e: BesserEdge | undefined) => e?.data.predefined as Predefined | undefined;
const descriptionOf = (n: BesserNode | undefined) => (n?.data.description as string | undefined) ?? '';
const tagOf = (e: BesserEdge | undefined) => (e?.data.name as string | undefined) ?? '';
const stereotypeOf = (n: BesserNode) => (n.data.stereotype as string | undefined) ?? '';
const boundaryStates = (m: UMLModel) => states(m).filter((n) => ['input', 'output'].includes(stereotypeOf(n)));

/**
 * The agent has exactly one initial state, the greeting: the one initial
 * node is wired to it by the one init edge.
 */
function expectSingleInitialGreeting(m: UMLModel, greetName = 'Coder_greet'): BesserNode {
  const markers = m.nodes.filter((n) => n.type === 'StateInitialNode');
  const initEdges = m.edges.filter((e) => e.type === 'AgentStateTransitionInit');
  expect(markers).toHaveLength(1);
  expect(initEdges).toHaveLength(1);
  expect(initEdges[0].source).toBe(markers[0].id);
  const initial = states(m).find((n) => n.id === initEdges[0].target)!;
  expect(stateName(initial)).toBe(greetName);
  return initial;
}

describe('laneToAgentModel', () => {
  it('emits task→task transitions as Auto so the agent can move on', () => {
    const m = bpmn([lane('L'), task('t1', 'Plan', 10), task('t2', 'Code', 200)], [seq('f1', 't1', 't2')]);
    const r = laneToAgentModel(m, 'L');
    if (!r.ok) throw new Error('expected ok');
    const stateId = (name: string) => stateNamed(r.model, name)!.id;
    const forward = r.model.edges.find((e) => e.source === stateId('Plan') && e.target === stateId('Code'))!;
    expect(forward.data).toMatchObject({ transitionType: 'predefined', predefined: { predefinedType: 'auto' } });
  });

  it('gives tasks whose names sanitize to the same token distinct state names', () => {
    const m = bpmn([lane('L'), task('t1', 'Review draft', 10), task('t2', 'Review-draft', 200)]);
    const r = laneToAgentModel(m, 'L');
    if (!r.ok) throw new Error('expected ok');
    const names = states(r.model).map(stateName);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual(expect.arrayContaining(['Review_draft', 'Review_draft_2']));
  });

  it('keeps separators and line breaks out of A2A tag values', () => {
    const m = bpmn(
      [
        lane('L'),
        makeNode('P', 'bpmnSwimlane', { name: 'Peer;evil\nkind=x', isAgentic: true }, { x: 0, y: 200, width: 400, height: 80 }),
        task('t1', 'Plan', 10),
        task('p1', 'Send', 10, 'P'),
      ],
      [seq('f1', 't1', 'p1')],
    );
    const r = laneToAgentModel(m, 'L');
    if (!r.ok) throw new Error('expected ok');
    const description = descriptionOf(stateNamed(r.model, 'Plan'));
    expect(description.split('\n')).toHaveLength(1);
    expect(description).toMatch(/^a2a:out;peer=Peer evil kind=x;ref=;flow=f1;order=1;kind=delegates$/);
  });

  it('refuses a non-BPMN model', () => {
    const m = bpmn();
    (m as unknown as { type: string }).type = 'ComponentDiagram';
    const r = laneToAgentModel(m, 'L');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not-a-bpmn-diagram');
  });

  it('refuses a non-agentic lane', () => {
    const m = bpmn([lane('L', false), task('t1', 'A', 10)]);
    const r = laneToAgentModel(m, 'L');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('lane-not-agentic');
  });

  it('emits one AgentState per task, a chained transition, and one init', () => {
    const m = bpmn([lane('L'), task('t1', 'Plan', 10), task('t2', 'Code', 200)], [seq('f1', 't1', 't2')]);
    const r = laneToAgentModel(m, 'L');
    if (!r.ok) throw new Error('expected ok');
    expect(states(r.model).map(stateName).sort()).toEqual(['Code', 'Coder_greet', 'Plan']); // greeting state added
    expectSingleInitialGreeting(r.model); // one init → greeting
    expect(transitions(r.model)).toHaveLength(2); // +1 greeting→Plan
    // lineage maps state → task
    const planState = stateNamed(r.model, 'Plan')!;
    expect(r.elementMapping[planState.id]).toBe('t1');
  });

  it('collapses an in-lane gateway between two tasks', () => {
    const m = bpmn(
      [lane('L'), task('t1', 'A', 10), gw('g', 120), task('t2', 'B', 240)],
      [seq('f1', 't1', 'g'), seq('f2', 'g', 't2')],
    );
    const r = laneToAgentModel(m, 'L');
    if (!r.ok) throw new Error('expected ok');
    expect(transitions(r.model)).toHaveLength(2); // Coder_greet → A + A → B (gateway collapsed)
    expectSingleInitialGreeting(r.model); // → greeting
  });

  describe('cross-lane I/O (A2A tags and cold start)', () => {
    const laneB = (id: string, name: string) => swimlane(id, name, { isAgentic: false }, 300);

    it('non-agentic inbound → no boundary state; cold-start greeting → entry task', () => {
      // Before the boundary-state removal: a from_Reviewer «input» state was emitted.
      // After: non-agentic peer folds into the cold-start (the non-agentic fallback path).
      const m = bpmn(
        [lane('L'), laneB('R', 'Reviewer'), task('t1', 'Work', 10), task('r1', 'Review', 10, 'R')],
        [seq('f1', 'r1', 't1')], // Reviewer → worker
      );
      const res = laneToAgentModel(m, 'L');
      if (!res.ok) throw new Error('expected ok');
      expect(boundaryStates(res.model)).toHaveLength(0);
      // greeting → Work directly via when_no_intent_matched
      const greet = stateNamed(res.model, 'Coder_greet')!;
      const greetEdge = transitions(res.model).find((e) => e.source === greet.id)!;
      expect(greetEdge).toBeDefined();
      expect(predefinedOf(greetEdge)?.predefinedType).toBe('when_no_intent_matched');
    });

    it('non-agentic outbound → a2a:out description tag on producing states; no boundary state', () => {
      // Before the boundary-state removal: a single to_Reviewer «output» state was emitted (deduped).
      // After: an a2a:out tag is appended to each producing task-state's description.
      const m = bpmn(
        [lane('L'), laneB('R', 'Reviewer'), task('t1', 'A', 10), task('t2', 'B', 200), task('r1', 'X', 10, 'R')],
        // two outgoing flows from L to the SAME external lane R
        [seq('f1', 't1', 'r1'), seq('f2', 't2', 'r1')],
      );
      const res = laneToAgentModel(m, 'L');
      if (!res.ok) throw new Error('expected ok');
      expect(boundaryStates(res.model)).toHaveLength(0);
      // both A and B task-states carry an a2a:out tag (no kind for non-agentic)
      expect(descriptionOf(stateNamed(res.model, 'A'))).toContain('a2a:out;peer=Reviewer;');
      expect(descriptionOf(stateNamed(res.model, 'B'))).toContain('a2a:out;peer=Reviewer;');
    });

    it('does not emit boundaries for a self-contained lane', () => {
      const m = bpmn([lane('L'), task('t1', 'A', 10), task('t2', 'B', 200)], [seq('f1', 't1', 't2')]);
      const res = laneToAgentModel(m, 'L');
      if (!res.ok) throw new Error('expected ok');
      expect(boundaryStates(res.model)).toHaveLength(0);
    });

    // With no boundary states the entry always gets
    // the init via greeting — no double-start risk.
    it('non-agentic sources → 0 boundary states; 1 initial state (greeting)', () => {
      const m = bpmn(
        [lane('L'), laneB('R', 'Reviewer'), task('t1', 'A', 10), task('t2', 'B', 200), task('r1', 'X', 10, 'R')],
        [seq('f1', 'r1', 't1'), seq('f2', 'r1', 't2')],
      );
      const res = laneToAgentModel(m, 'L');
      if (!res.ok) throw new Error('expected ok');
      expect(boundaryStates(res.model)).toHaveLength(0);
      expectSingleInitialGreeting(res.model);
    });

    // A non-agentic gateway-mediated cross-lane flow →
    // no boundary state; greeting wires directly to the first entry task.
    it('non-agentic gateway-mediated input → 0 boundary states; greeting → first entry', () => {
      const m = bpmn(
        [
          lane('L'),
          laneB('R', 'Reviewer'),
          task('impl', 'Implement', 10),
          task('tnew', 'Downstream', 200),
          gw('g', 120),
          task('r1', 'X', 10, 'R'),
        ],
        [seq('f1', 'r1', 'g'), seq('f2', 'g', 'tnew')],
      );
      const res = laneToAgentModel(m, 'L');
      if (!res.ok) throw new Error('expected ok');
      expect(states(res.model).filter((n) => stereotypeOf(n) === 'input')).toHaveLength(0);
      expectSingleInitialGreeting(res.model);
      const greetState = stateNamed(res.model, 'Coder_greet')!;
      const greetToEntry = transitions(res.model).find((e) => e.source === greetState.id);
      expect(greetToEntry).toBeDefined();
      expect(greetToEntry!.target).toBe(stateNamed(res.model, 'Implement')!.id);
    });

    it('item 22 — a lane-owned start event does NOT produce a from_<self> boundary', () => {
      const m = bpmn(
        [
          lane('L'), // agentic lane, name 'Coder'
          // start event inside lane L
          makeNode('s1', 'bpmnStartEvent', { name: '' }, { x: -80, y: 0, width: 30, height: 30 }, 'L'),
          task('t1', 'coordinate_work', 10),
        ],
        // intra-lane: start event (inside L) → the lane's entry task
        [seq('f1', 's1', 't1')],
      );
      const res = laneToAgentModel(m, 'L');
      if (!res.ok) throw new Error('expected ok');
      expect(boundaryStates(res.model)).toHaveLength(0); // no from_L / to_L
      // and exactly one cold-start (initial) state
      expectSingleInitialGreeting(res.model);
    });
  });

  describe('item 17 — BUML validity: state-name sanitization + guaranteed init', () => {
    it('Bug 1a: task name with spaces → underscored state name, no whitespace in output', () => {
      const m = bpmn([lane('L'), task('t1', 'Plan Code', 10)]);
      const r = laneToAgentModel(m, 'L');
      if (!r.ok) throw new Error('expected ok');
      const all = states(r.model);
      expect(all.every((n) => !/\s/.test(stateName(n)))).toBe(true);
      const taskState = all.find((n) => !stereotypeOf(n));
      expect(taskState && stateName(taskState)).toBe('Plan_Code');
    });

    it('Bug 1b: task name with hyphens/dots → underscored, no non-word chars', () => {
      const m = bpmn([lane('L'), task('t1', 'Foo-Bar.Baz', 10)]);
      const r = laneToAgentModel(m, 'L');
      if (!r.ok) throw new Error('expected ok');
      // greeting state also has no stereotype; isolate task-derived states
      // via elementMapping (greeting is synthetic and has no mapping entry).
      const taskStates = states(r.model).filter((n) => r.elementMapping[n.id]);
      expect(taskStates).toHaveLength(1);
      expect(stateName(taskStates[0])).toBe('Foo_Bar_Baz');
      expect(/[^\w]/.test(stateName(taskStates[0]))).toBe(false);
    });

    it('Bug 1c: non-agentic external lane → no boundary state emitted (DQ-3)', () => {
      // Before the boundary-state removal: a from_Code_Reviewer «input» state with sanitized name
      // was emitted. After: non-agentic peer folds into cold-start; no state.
      const m = bpmn(
        [
          lane('L'),
          swimlane('R', 'Code Reviewer', { isAgentic: false }, 300),
          task('t1', 'Work', 10),
          task('r1', 'Review', 10, 'R'),
        ],
        [seq('f1', 'r1', 't1')],
      );
      const r = laneToAgentModel(m, 'L');
      if (!r.ok) throw new Error('expected ok');
      expect(states(r.model).filter((n) => stereotypeOf(n) === 'input')).toHaveLength(0);
    });

    it('Bug 2: single task entirely driven by an «input» flow → still one initial state', () => {
      const m = bpmn(
        [
          lane('L'),
          swimlane('R', 'Caller', { isAgentic: false }, 300),
          task('t1', 'Handle', 10),
          task('r1', 'Trigger', 10, 'R'),
        ],
        [seq('f1', 'r1', 't1')],
      );
      const r = laneToAgentModel(m, 'L');
      if (!r.ok) throw new Error('expected ok');
      // one initial state, no marker / init edge
      expectSingleInitialGreeting(r.model);
    });

    it('Bug 2: all state names are space-free even when guarantee-init fires on an input-fed task', () => {
      const m = bpmn(
        [
          lane('L'),
          swimlane('R', 'External Agent', { isAgentic: false }, 300),
          task('t1', 'Process Request', 10),
          task('r1', 'X', 10, 'R'),
        ],
        [seq('f1', 'r1', 't1')],
      );
      const r = laneToAgentModel(m, 'L');
      if (!r.ok) throw new Error('expected ok');
      expect(states(r.model).every((n) => !/\s/.test(stateName(n)))).toBe(true);
    });
  });

  describe('36 — greeting-wrapper state (BAF-safe initial)', () => {
    it('emits a <Lane>_greet state and makes it the initial state', () => {
      const m = bpmn([lane('L'), task('t1', 'Respond', 10)]);
      const r = laneToAgentModel(m, 'L');
      if (!r.ok) throw new Error('expected ok');
      // greeting state present and named from the lane
      const greetState = stateNamed(r.model, 'Coder_greet');
      expect(greetState).toBeDefined();
      // the greeting is the (only) initial state
      expect(expectSingleInitialGreeting(r.model).id).toBe(greetState!.id);
    });

    it('first task-state is NOT the initial state; greeting wires to it via when_no_intent_matched', () => {
      const m = bpmn([lane('L'), task('t1', 'LLM_reply', 10)]);
      const r = laneToAgentModel(m, 'L');
      if (!r.ok) throw new Error('expected ok');
      const taskState = states(r.model).find((n) => r.elementMapping[n.id])!;
      // the initial state is NOT the task
      expect(expectSingleInitialGreeting(r.model).id).not.toBe(taskState.id);
      expect(taskState.data.initial).toBeUndefined();
      // greeting → task via when_no_intent_matched
      const greetState = stateNamed(r.model, 'Coder_greet')!;
      const noIntentTrans = transitions(r.model).find((e) => e.source === greetState.id && e.target === taskState.id);
      expect(noIntentTrans).toBeDefined();
      expect(predefinedOf(noIntentTrans)?.predefinedType).toBe('when_no_intent_matched');
    });

    it('non-agentic input-fed entry: greeting wires DIRECTLY to the entry task (no boundary chaining)', () => {
      // Before the boundary-state removal: greeting → input-boundary → task.
      // After: boundary states gone; greeting → task directly.
      const m = bpmn(
        [
          lane('L'),
          swimlane('R', 'Caller', { isAgentic: false }, 300),
          task('t1', 'Handle', 10),
          task('r1', 'Trigger', 10, 'R'),
        ],
        [seq('f1', 'r1', 't1')],
      );
      const r = laneToAgentModel(m, 'L');
      if (!r.ok) throw new Error('expected ok');
      const greetState = stateNamed(r.model, 'Coder_greet')!;
      const taskState = states(r.model).find((n) => r.elementMapping[n.id] === 't1')!;
      // 0 boundary states
      expect(boundaryStates(r.model)).toHaveLength(0);
      // greeting → task DIRECTLY (no intermediate boundary)
      const greetEdge = transitions(r.model).find((e) => e.source === greetState.id)!;
      expect(greetEdge.target).toBe(taskState.id);
      expect(predefinedOf(greetEdge)?.predefinedType).toBe('when_no_intent_matched');
    });
  });

  describe('reflection scaffolds', () => {
    const rtask = (id: string, name: string, x: number, mode: 'none' | 'self' | 'cross' | 'human') =>
      task(id, name, x, 'L', { reflectionMode: mode });

    it("reflectionMode 'none' adds no reflection states", () => {
      const m = bpmn([lane('L'), rtask('t1', 'Plan', 10, 'none'), task('t2', 'Code', 200)], [seq('f1', 't1', 't2')]);
      const r = laneToAgentModel(m, 'L');
      if (!r.ok) throw new Error('expected ok');
      expect(states(r.model).map(stateName).sort()).toEqual(['Code', 'Coder_greet', 'Plan']); // no *_reflect / review_ / feedback_
    });

    it("'self' inserts one reflection pass with Auto transitions and re-routes the forward edge", () => {
      const m = bpmn([lane('L'), rtask('t1', 'Plan', 10, 'self'), task('t2', 'Code', 200)], [seq('f1', 't1', 't2')]);
      const r = laneToAgentModel(m, 'L');
      if (!r.ok) throw new Error('expected ok');
      const reflect = stateNamed(r.model, 'Plan_reflect');
      expect(reflect).toBeDefined();
      const plan = stateNamed(r.model, 'Plan')!;
      const code = stateNamed(r.model, 'Code')!;
      const ts = transitions(r.model);
      // original Plan → Code is re-routed (gone)
      expect(ts.some((e) => e.source === plan.id && e.target === code.id)).toBe(false);
      // Plan → reflect runs without another message.
      const entry = ts.find((e) => e.source === plan.id && e.target === reflect!.id)!;
      expect(entry).toBeDefined();
      expect(predefinedOf(entry)?.predefinedType).toBe('auto');
      expect(ts.some((e) => e.source === reflect!.id && e.target === reflect!.id)).toBe(false);
      const forward = ts.find((e) => e.source === reflect!.id && e.target === code.id)!;
      expect(forward).toBeDefined();
      expect(predefinedOf(forward)?.predefinedType).toBe('auto');
    });

    it("'self' re-homes downstream outbound A2A onto <task>_reflect (runtime carrier, not just icon position)", () => {
      const m = bpmn(
        [
          swimlane('L', 'Coder', { isAgentic: true, role: 'solution' }),
          swimlane('P', 'Reviewer', { isAgentic: true, role: 'supervision', agentDiagramRef: 'agent-reviewer' }, 250),
          task('t1', 'Plan', 10, 'L', { reflectionMode: 'self' }),
          gw('g', 180),
          task('p1', 'Review', 10, 'P'),
        ],
        [seq('f1', 't1', 'g'), seq('f2', 'g', 'p1')],
      );
      const r = laneToAgentModel(m, 'L');
      if (!r.ok) throw new Error('expected ok');

      const plan = stateNamed(r.model, 'Plan')!;
      const reflect = stateNamed(r.model, 'Plan_reflect')!;
      const ts = transitions(r.model);

      // outbound A2A now executes from the post-reflection state.
      expect(descriptionOf(plan)).not.toContain('a2a:out;');
      expect(descriptionOf(reflect)).toMatch(/a2a:out;peer=Reviewer;ref=agent-reviewer;flow=f2;order=1;kind=revises/);

      // Reflection remains a single pass while carrying the outbound binding.
      expect(ts.some((e) => e.source === plan.id && e.target === reflect.id)).toBe(true);
      expect(ts.some((e) => e.source === reflect.id && e.target === reflect.id)).toBe(false);
    });
    it("'cross' emits A2A (no wait state): a2a:out tag + greeting→next intent edge + AgentIntent", () => {
      // cross-reflection is inter-agent, so it is modelled as A2A metadata,
      // NOT a fabricated state. The old Plan_await_review wait state is gone.
      const m = bpmn([lane('L'), rtask('t1', 'Plan', 10, 'cross'), task('t2', 'Code', 200)], [seq('f1', 't1', 't2')]);
      const r = laneToAgentModel(m, 'L');
      if (!r.ok) throw new Error('expected ok');

      // no fabricated wait / boundary state
      expect(stateNamed(r.model, 'Plan_await_review')).toBeUndefined();
      expect(stateNamed(r.model, 'feedback_from_Plan')).toBeUndefined();

      const plan = stateNamed(r.model, 'Plan')!;
      const code = stateNamed(r.model, 'Code')!;
      const greet = stateNamed(r.model, 'Coder_greet')!;
      const ts = transitions(r.model);

      // (a) outbound a2a:out tag on the producing (Plan) state's description
      expect(descriptionOf(plan)).toMatch(/a2a:out;peer=reviewer;ref=;flow=reflect:t1;order=1;kind=revises/);

      // Plan → Code direct edge is re-routed away (gone)
      expect(ts.some((e) => e.source === plan.id && e.target === code.id)).toBe(false);

      // (b) greeting → Code when_intent_matched, intentName recv_reviewer_Plan, a2a:in tag in name
      const inbound = ts.find((e) => e.source === greet.id && e.target === code.id)!;
      expect(inbound).toBeDefined();
      expect(predefinedOf(inbound)?.predefinedType).toBe('when_intent_matched');
      expect(predefinedOf(inbound)?.intentName).toBe('recv_reviewer_Plan');
      expect(tagOf(inbound)).toMatch(/^a2a:in;peer=reviewer;ref=;flow=reflect:t1;kind=revises$/);

      // (c) the AgentIntent scaffold
      expect(intents(r.model).find((c) => c.name === 'recv_reviewer_Plan')).toBeDefined();
    });

    it("'cross' lineages the inbound feedback edge to the inducing task", () => {
      const m = bpmn([lane('L'), rtask('t1', 'Plan', 10, 'cross'), task('t2', 'Code', 200)], [seq('f1', 't1', 't2')]);
      const r = laneToAgentModel(m, 'L');
      if (!r.ok) throw new Error('expected ok');
      const greet = stateNamed(r.model, 'Coder_greet')!;
      const code = stateNamed(r.model, 'Code')!;
      const inbound = transitions(r.model).find((e) => e.source === greet.id && e.target === code.id)!;
      expect(r.elementMapping?.[inbound.id]).toBe('t1');
    });

    it("'cross' on a terminal task emits the a2a:out tag only (no intent edge, no AgentIntent)", () => {
      const m = bpmn([lane('L'), rtask('t1', 'Plan', 10, 'cross')]);
      const r = laneToAgentModel(m, 'L');
      if (!r.ok) throw new Error('expected ok');
      const plan = stateNamed(r.model, 'Plan')!;
      expect(descriptionOf(plan)).toMatch(/a2a:out;peer=reviewer;.*kind=revises/);
      // no inbound feedback intent / scaffold for a task with no forward next
      expect(intents(r.model).length > 0).toBe(false);
      const greet = stateNamed(r.model, 'Coder_greet')!;
      expect(transitions(r.model).some((e) => e.source === greet.id && e.target === plan.id)).toBe(
        // only the cold-start greeting→Plan (when_no_intent_matched) exists, no recv edge
        true,
      );
      const greetEdges = transitions(r.model).filter((e) => e.source === greet.id);
      expect(greetEdges).toHaveLength(1);
      expect(predefinedOf(greetEdges[0])?.predefinedType).toBe('when_no_intent_matched');
    });

    it("'cross' whose next is the entry state suppresses the cold-start (no double greeting edge)", () => {
      // cycle Plan ↔ Code, Code is cross-reflective and its forward `next` (Plan)
      // is the entry state → the reflection intent edge greeting→Plan must
      // suppress the cold-start greeting→Plan (intent-target union).
      const m = bpmn(
        [lane('L'), task('t1', 'Plan', 10), rtask('t2', 'Code', 200, 'cross')],
        [seq('f1', 't1', 't2'), seq('f2', 't2', 't1')],
      );
      const r = laneToAgentModel(m, 'L');
      if (!r.ok) throw new Error('expected ok');
      const greet = stateNamed(r.model, 'Coder_greet')!;
      const plan = stateNamed(r.model, 'Plan')!;
      const greetToPlan = transitions(r.model).filter((e) => e.source === greet.id && e.target === plan.id);
      expect(greetToPlan).toHaveLength(1); // exactly one — the reflection intent edge, cold-start suppressed
      expect(predefinedOf(greetToPlan[0])?.predefinedType).toBe('when_intent_matched');
    });

    it("'human' inserts a <task>_human_review wait state with approve-forward + reject-loop", () => {
      const m = bpmn([lane('L'), rtask('t1', 'Plan', 10, 'human'), task('t2', 'Code', 200)], [seq('f1', 't1', 't2')]);
      const r = laneToAgentModel(m, 'L');
      if (!r.ok) throw new Error('expected ok');
      const human = stateNamed(r.model, 'Plan_human_review');
      expect(human).toBeDefined();
      const plan = stateNamed(r.model, 'Plan')!;
      const code = stateNamed(r.model, 'Code')!;
      const ts = transitions(r.model);
      expect(ts.some((e) => e.source === plan.id && e.target === code.id)).toBe(false);
      // task → human_review via when_no_intent_matched
      const entry = ts.find((e) => e.source === plan.id && e.target === human!.id)!;
      expect(predefinedOf(entry)?.predefinedType).toBe('when_no_intent_matched');
      // approved → Code
      const approve = ts.find((e) => e.source === human!.id && e.target === code.id)!;
      expect(predefinedOf(approve)).toMatchObject({
        predefinedType: 'when_intent_matched',
        intentName: 'Plan_approved',
      });
      // rejected → back to Plan
      const reject = ts.find((e) => e.source === human!.id && e.target === plan.id)!;
      expect(predefinedOf(reject)).toMatchObject({
        predefinedType: 'when_intent_matched',
        intentName: 'Plan_rejected',
      });
      expect(intents(r.model).map((c) => c.name).sort()).toEqual(['Plan_approved', 'Plan_rejected']);
    });

    it("'cross' with named reviewer lane: peer=<laneName>, ref=<lane's Agent diagram>, intent recv_<laneName>_<task>", () => {
      const m = bpmn(
        [
          lane('L'),
          makeNode(
            'L2',
            'bpmnSwimlane',
            { name: 'Supervisor', isAgentic: true, agentDiagramRef: 'agent-supervisor' },
            { x: 0, y: 200, width: 400, height: 80 },
          ),
          task('t1', 'Plan', 10, 'L', { reflectionMode: 'cross', reflectionReviewerLaneId: 'L2' }),
          task('t2', 'Code', 200),
        ],
        [seq('f1', 't1', 't2')],
      );
      const r = laneToAgentModel(m, 'L');
      if (!r.ok) throw new Error('expected ok');

      const plan = stateNamed(r.model, 'Plan')!;
      const code = stateNamed(r.model, 'Code')!;
      const greet = stateNamed(r.model, 'Coder_greet')!;
      const ts = transitions(r.model);

      expect(descriptionOf(plan)).toMatch(
        /a2a:out;peer=Supervisor;ref=agent-supervisor;flow=reflect:t1;order=1;kind=revises/,
      );

      const inbound = ts.find((e) => e.source === greet.id && e.target === code.id)!;
      expect(inbound).toBeDefined();
      expect(predefinedOf(inbound)?.predefinedType).toBe('when_intent_matched');
      expect(predefinedOf(inbound)?.intentName).toBe('recv_Supervisor_Plan');
      expect(tagOf(inbound)).toMatch(/^a2a:in;peer=Supervisor;ref=agent-supervisor;flow=reflect:t1;kind=revises$/);

      expect(intents(r.model).find((c) => c.name === 'recv_Supervisor_Plan')).toBeDefined();
    });

    it("'cross' with no reviewer set still emits peer=reviewer placeholder", () => {
      const m = bpmn(
        [
          lane('L'),
          makeNode('L2', 'bpmnSwimlane', { name: 'Supervisor', isAgentic: true }, { x: 0, y: 200, width: 400, height: 80 }),
          task('t1', 'Plan', 10, 'L', { reflectionMode: 'cross' }), // no reflectionReviewerLaneId
          task('t2', 'Code', 200),
        ],
        [seq('f1', 't1', 't2')],
      );
      const r = laneToAgentModel(m, 'L');
      if (!r.ok) throw new Error('expected ok');
      expect(descriptionOf(stateNamed(r.model, 'Plan'))).toMatch(/peer=reviewer;ref=;/);
      expect(intents(r.model).find((c) => c.name === 'recv_reviewer_Plan')).toBeDefined();
    });

    it("'cross' with dangling reviewer ID falls back to peer=reviewer with an empty ref", () => {
      const m = bpmn(
        [
          lane('L'),
          task('t1', 'Plan', 10, 'L', { reflectionMode: 'cross', reflectionReviewerLaneId: 'no-such-lane' }),
          task('t2', 'Code', 200),
        ],
        [seq('f1', 't1', 't2')],
      );
      const r = laneToAgentModel(m, 'L');
      if (!r.ok) throw new Error('expected ok');
      expect(descriptionOf(stateNamed(r.model, 'Plan'))).toMatch(/a2a:out;peer=reviewer;ref=;flow=reflect:t1;/);
      expect(intents(r.model).find((c) => c.name === 'recv_reviewer_Plan')).toBeDefined();
    });
  });

  describe('A2A cross-lane I/O', () => {
    const agLane = (id: string, name: string, role: string) => swimlane(id, name, { isAgentic: true, role }, 400);
    const agTask = (id: string, name: string, parentId: string) => task(id, name, 10, parentId);
    const coder = () => swimlane('L', 'Coder', { isAgentic: true, role: 'solution' });

    it('A2A-1: zero stereotype states + no fabricated cross wait state; real + reflection intents coexist', () => {
      const m = bpmn(
        [
          coder(),
          agLane('P', 'Supervisor', 'supervision'),
          task('t1', 'Plan', 10, 'L', { reflectionMode: 'cross' }),
          task('t2', 'Code', 200),
          agTask('p1', 'Assign', 'P'),
        ],
        [
          seq('f1', 'p1', 't1'), // agentic inbound (real cross-lane)
          seq('f2', 't1', 't2'), // intra-lane
        ],
      );
      const r = laneToAgentModel(m, 'L');
      if (!r.ok) throw new Error('expected ok');

      expect(boundaryStates(r.model)).toHaveLength(0);

      // cross reflection no longer fabricates a wait state
      expect(stateNamed(r.model, 'Plan_await_review')).toBeUndefined();

      // two distinct intents: the real cross-lane inbound and the reflection
      // feedback (intents are off-canvas components, so they have no rows to
      // compare; distinct ids and names are the v4 equivalent)
      const all = intents(r.model);
      expect(all.map((c) => c.name).sort()).toEqual(['recv_Supervisor_Plan', 'recv_reviewer_Plan']);
      expect(new Set(all.map((c) => c.id)).size).toBe(2);
    });

    it('A2A-2: single agentic inbound → when_intent_matched edge + AgentIntent scaffold (diverge-merge fixture)', () => {
      // Derive lane-wkr (Coder, worker). Flow f2: gw-diver(lane-mgr) → task-repro(lane-wkr).
      // Expected: 1 AgentIntent recv_Reviewer_Reproduce_and_fix; 1 intent transition
      // greet→task; hidden a2a:in tag in name.
      const r = laneToAgentModel(divergeMerge as unknown as UMLModel, 'lane-wkr');
      if (!r.ok) throw new Error('expected ok');

      const all = intents(r.model);
      expect(all).toHaveLength(1);
      expect(all[0].name).toBe('recv_Reviewer_Reproduce_and_fix');

      const greet = stateNamed(r.model, 'Coder_greet')!;
      const intentTrans = transitions(r.model).filter(
        (e) => e.source === greet.id && predefinedOf(e)?.predefinedType === 'when_intent_matched',
      );
      expect(intentTrans).toHaveLength(1);
      // intentName in the predefined block (the only place v4 keeps it)
      expect(predefinedOf(intentTrans[0])?.intentName).toBe('recv_Reviewer_Reproduce_and_fix');
      expect(intentTrans[0].data).toMatchObject({
        transitionType: 'predefined',
        predefined: { predefinedType: 'when_intent_matched', intentName: 'recv_Reviewer_Reproduce_and_fix' },
      });
      expect(tagOf(intentTrans[0])).toBe('a2a:in;peer=Reviewer;ref=;flow=f2;kind=supervises');

      // Cold-start is suppressed when the entry task has an intent transition
      const coldStart = transitions(r.model).filter(
        (e) => e.source === greet.id && predefinedOf(e)?.predefinedType === 'when_no_intent_matched',
      );
      expect(coldStart).toHaveLength(0);
    });

    it('A2A-3: multi-peer inbound → 3 greeting edges, 3 distinct recv_* intents, 3 distinct peer= tags', () => {
      const m = bpmn(
        [
          coder(),
          agLane('X', 'PeerX', 'solution'),
          agLane('Y', 'PeerY', 'solution'),
          agLane('Z', 'PeerZ', 'supervision'),
          task('t1', 'Work', 10),
          agTask('x1', 'TX', 'X'),
          agTask('y1', 'TY', 'Y'),
          agTask('z1', 'TZ', 'Z'),
        ],
        [seq('f1', 'x1', 't1'), seq('f2', 'y1', 't1'), seq('f3', 'z1', 't1')],
      );
      const r = laneToAgentModel(m, 'L');
      if (!r.ok) throw new Error('expected ok');

      const all = intents(r.model);
      expect(all).toHaveLength(3);
      expect(all.map((c) => c.name).sort()).toEqual(['recv_PeerX_Work', 'recv_PeerY_Work', 'recv_PeerZ_Work']);

      const greet = stateNamed(r.model, 'Coder_greet')!;
      const intentEdges = transitions(r.model).filter(
        (e) => e.source === greet.id && predefinedOf(e)?.predefinedType === 'when_intent_matched',
      );
      expect(intentEdges).toHaveLength(3);
      const peers = intentEdges
        .map((e) => {
          const match = tagOf(e).match(/peer=([^;]+)/);
          return match ? match[1] : '';
        })
        .sort();
      expect(peers).toEqual(['PeerX', 'PeerY', 'PeerZ']);
    });

    it('A2A-4: non-agentic / start-event inbound → cold-start only, no AgentIntent', () => {
      const m = bpmn(
        [
          lane('L'),
          swimlane('R', 'Human', { isAgentic: false }, 300),
          task('t1', 'Work', 10),
          task('r1', 'Trigger', 10, 'R'),
        ],
        [seq('f1', 'r1', 't1')],
      );
      const r = laneToAgentModel(m, 'L');
      if (!r.ok) throw new Error('expected ok');
      expect(intents(r.model)).toHaveLength(0);
      const greet = stateNamed(r.model, 'Coder_greet')!;
      const greetEdges = transitions(r.model).filter((e) => e.source === greet.id);
      // only the cold-start when_no_intent_matched edge
      expect(greetEdges).toHaveLength(1);
      expect(predefinedOf(greetEdges[0])?.predefinedType).toBe('when_no_intent_matched');
    });

    it('A2A-5: agentic outbound → a2a:out tag on producing state description; ascending order for fan-out', () => {
      const m = bpmn(
        [
          coder(),
          agLane('P1', 'Reviewer', 'supervision'),
          agLane('P2', 'Tester', 'solution'),
          task('t1', 'Write', 10),
          agTask('p1t', 'Review', 'P1'),
          agTask('p2t', 'Test', 'P2'),
        ],
        [seq('f1', 't1', 'p1t'), seq('f2', 't1', 'p2t')],
      );
      const r = laneToAgentModel(m, 'L');
      if (!r.ok) throw new Error('expected ok');

      const desc = descriptionOf(states(r.model).find((n) => r.elementMapping[n.id] === 't1'));
      expect(desc).toContain('a2a:out;peer=Reviewer;');
      expect(desc).toContain('a2a:out;peer=Tester;');
      const order1 = Number(desc.match(/peer=Reviewer[^\n]*order=(\d+)/)?.[1]);
      const order2 = Number(desc.match(/peer=Tester[^\n]*order=(\d+)/)?.[1]);
      expect(order1).toBeLessThan(order2);
    });

    it('A2A-6: non-agentic outbound sink → a2a:out tag present, no kind= field', () => {
      const m = bpmn(
        [
          lane('L'),
          swimlane('E', 'External', { isAgentic: false }, 300),
          task('t1', 'Work', 10),
          task('e1', 'Recv', 10, 'E'),
        ],
        [seq('f1', 't1', 'e1')],
      );
      const r = laneToAgentModel(m, 'L');
      if (!r.ok) throw new Error('expected ok');

      const desc = descriptionOf(states(r.model).find((n) => r.elementMapping[n.id] === 't1'));
      expect(desc).toContain('a2a:out;peer=External;');
      expect(desc).toContain('order=1');
      expect(desc).not.toContain('kind=');
    });
  });

  describe('49 — governed merge states (W3/W4, BESSER-aligned binding)', () => {
    const govGw = (id: string, x: number) =>
      gw(id, x, {
        gatewayRole: 'merging',
        governanceDsl: 'Policy reviewVote { ... }', // non-empty = governed
      });
    const agProducerLane = (id: string, name: string) => swimlane(id, name, { isAgentic: true }, 300);
    const mergeState = (m: UMLModel) => stateNamed(m, 'Address_merge_decision')!;

    it('M-1: cross-lane producers → a2a:in;flow=<gateway-id> edges INTO the merge state (the BESSER binding)', () => {
      // px(PeerX) ─┐
      // py(PeerY) ─┴► gM(governed merge, in L) ─► Publish
      const m = bpmn(
        [
          lane('L'), // 'Coder', agentic
          agProducerLane('X', 'PeerX'),
          agProducerLane('Y', 'PeerY'),
          govGw('gM', 200),
          task('t3', 'Publish', 320),
          task('px', 'Draft X', 10, 'X'),
          task('py', 'Draft Y', 10, 'Y'),
        ],
        [
          seq('f1', 'px', 'gM'), // cross-lane producer → governed merge
          seq('f2', 'py', 'gM'),
          seq('f3', 'gM', 't3'),
        ],
      );
      const r = laneToAgentModel(m, 'L');
      if (!r.ok) throw new Error('expected ok');

      const merge = mergeState(r.model);
      expect(merge).toBeDefined();
      expect(r.elementMapping[merge.id]).toBe('gM'); // lineage: merge state ← gateway

      // Two a2a:in binding edges into the merge state, each carrying flow=<gateway-id>.
      const inbound = r.model.edges.filter((e) => e.target === merge.id);
      expect(inbound).toHaveLength(2);
      for (const e of inbound) expect(tagOf(e)).toContain('flow=gM'); // the binding BESSER reads
      const peers = inbound.map((e) => (tagOf(e).match(/peer=([^;]+)/) || [])[1]).sort();
      expect(peers).toEqual(['PeerX', 'PeerY']);

      // The producer flow is NOT routed to the successor task (appendCrossLaneIO skipped it).
      const publish = stateNamed(r.model, 'Publish')!;
      const a2aIntoPublish = r.model.edges.filter((e) => e.target === publish.id && tagOf(e).includes('a2a:in'));
      expect(a2aIntoPublish).toHaveLength(0);

      // An AgentIntent is scaffolded for each inbound binding.
      const intentNames = intents(r.model).map((c) => c.name);
      expect(intentNames).toContain('recv_PeerX_Address_merge_decision');
      expect(intentNames).toContain('recv_PeerY_Address_merge_decision');
    });

    it('M-2: in-lane producers → guards + a SYNTHETIC self-peer flow=<gateway-id> binding', () => {
      const m = bpmn(
        [lane('L'), task('p1', 'Draft A', 10), task('p2', 'Draft B', 10), govGw('gM', 200), task('t3', 'Publish', 320)],
        [seq('f1', 'p1', 'gM', 'score >= 0.8'), seq('f2', 'p2', 'gM', 'needs_review'), seq('f3', 'gM', 't3')],
      );
      const r = laneToAgentModel(m, 'L');
      if (!r.ok) throw new Error('expected ok');
      const merge = mergeState(r.model);
      const greet = stateNamed(r.model, 'Coder_greet')!;

      const inbound = r.model.edges.filter((e) => e.target === merge.id);
      // 2 in-lane guards + 1 synthetic self-peer binding
      expect(inbound).toHaveLength(3);

      const varOp = inbound.find((e) => predefinedOf(e)?.predefinedType === 'when_variable_operation_matched')!;
      expect(predefinedOf(varOp)?.conditionValue).toEqual({
        variable: 'score',
        operator: '>=',
        targetValue: '0.8',
      });
      expect((predefinedOf(varOp)?.conditionValue as { variable?: string }).variable).toBe('score');

      const custom = inbound.find((e) => e.data.transitionType === 'custom')!;
      expect((custom.data.custom as { condition: string[] }).condition).toEqual(['needs_review']);

      // synthetic binding: greeting → merge, a2a:in flow=gM, peer=self lane, no kind
      const binding = inbound.find((e) => e.source === greet.id)!;
      expect(tagOf(binding)).toBe('a2a:in;peer=Coder;ref=;flow=gM');

      const outbound = r.model.edges.filter((e) => e.source === merge.id);
      expect(outbound).toHaveLength(1);
      expect(predefinedOf(outbound[0])?.predefinedType).toBe('when_no_intent_matched');
    });

    it('M-3: empty condition label → when_no_intent_matched guard (+ synthetic binding)', () => {
      const m = bpmn(
        [lane('L'), task('p1', 'Draft', 10), govGw('gM', 200), task('t3', 'Publish', 320)],
        [seq('f1', 'p1', 'gM'), seq('f3', 'gM', 't3')],
      );
      const r = laneToAgentModel(m, 'L');
      if (!r.ok) throw new Error('expected ok');
      const merge = mergeState(r.model);
      const greet = stateNamed(r.model, 'Coder_greet')!;
      const inbound = r.model.edges.filter((e) => e.target === merge.id);
      expect(inbound).toHaveLength(2); // 1 guard + 1 synthetic binding

      const guard = inbound.find((e) => e.source !== greet.id)!;
      expect(predefinedOf(guard)?.predefinedType).toBe('when_no_intent_matched');
      const binding = inbound.find((e) => e.source === greet.id)!;
      expect(tagOf(binding)).toContain('flow=gM');
    });

    it('M-4: two governed merges → distinct states, each bound to its OWN gateway id', () => {
      const m = bpmn(
        [
          lane('L'),
          task('p1', 'A', 10),
          govGw('gM1', 120),
          task('t2', 'B', 240),
          task('p3', 'C', 360),
          govGw('gM2', 480),
          task('t4', 'D', 600),
        ],
        [seq('f1', 'p1', 'gM1'), seq('f2', 'gM1', 't2'), seq('f3', 'p3', 'gM2'), seq('f4', 'gM2', 't4')],
      );
      const r = laneToAgentModel(m, 'L');
      if (!r.ok) throw new Error('expected ok');
      const mergeNames = states(r.model)
        .map(stateName)
        .filter((n) => n.startsWith('Address_merge_decision'));
      expect(mergeNames).toHaveLength(2);
      expect(new Set(mergeNames).size).toBe(2); // distinct

      // each gateway has at least one a2a:in binding edge carrying its own flow=<id>
      const flows = r.model.edges.map((e) => (tagOf(e).match(/flow=(\w+)/) || [])[1]).filter(Boolean);
      expect(flows).toContain('gM1');
      expect(flows).toContain('gM2');
    });

    it('M-5: legacy — a NON-governed merging gateway is still collapsed (no merge state)', () => {
      // diverge-merge fixture: gw-merge is merging but has NO governanceDsl.
      const r = laneToAgentModel(divergeMerge as unknown as UMLModel, 'lane-mgr');
      if (!r.ok) throw new Error('expected ok');
      expect(states(r.model).find((n) => stateName(n).startsWith('Address_merge_decision'))).toBeUndefined();
    });

    it('M-6: round-trip — the a2a:in;flow=<gateway-id> binding + guard fields are deep-clone stable', () => {
      const m = bpmn(
        [lane('L'), task('p1', 'Draft A', 10), task('p2', 'Draft B', 10), govGw('gM', 200), task('t3', 'Publish', 320)],
        [seq('f1', 'p1', 'gM', 'score >= 0.8'), seq('f2', 'p2', 'gM', 'needs_review'), seq('f3', 'gM', 't3')],
      );
      const r = laneToAgentModel(m, 'L');
      if (!r.ok) throw new Error('expected ok');

      // Project export/import is JSON serialization; the emitted shape must survive a
      // JSON clone with exactly the keys the AgentStateTransition edge data carries
      // (Appendix A in the governed-merge implementation). The model classes aren't exported from @besser/wme,
      // so we assert the stored-data contract directly.
      const clone = JSON.parse(JSON.stringify(r.model)) as typeof r.model;
      const merge = mergeState(clone);
      const inbound = clone.edges.filter((e) => e.target === merge.id);

      // the binding (a2a:in;flow=gM) survives
      const binding = inbound.find((e) => tagOf(e).includes('a2a:in'))!;
      expect(tagOf(binding)).toContain('flow=gM');

      // the guard payloads survive
      const varOp = inbound.find((e) => predefinedOf(e)?.predefinedType === 'when_variable_operation_matched')!;
      expect(predefinedOf(varOp)?.conditionValue).toEqual({
        variable: 'score',
        operator: '>=',
        targetValue: '0.8',
      });
      const custom = inbound.find((e) => e.data.transitionType === 'custom')!;
      expect(custom.data.custom).toEqual({
        event: 'None',
        condition: ['needs_review'],
      });
    });
  });
});
