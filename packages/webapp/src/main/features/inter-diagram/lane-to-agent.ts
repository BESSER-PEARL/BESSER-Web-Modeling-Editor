import type {
  AgentStateTransition,
  BPMNFlow,
  BPMNGateway,
  BPMNSwimlane,
  BPMNTask,
  UMLElement,
  UMLModel,
  UMLRelationship,
} from '@besser/wme';
import { Direction, NEW_TRANSITION_PREDEFINED_TYPE, UMLDiagramType } from '@besser/wme';
import type { ElementLineageMap } from '../../shared/types/project';
import { uuid } from '../../shared/utils/uuid';
import { recenterModelOnOrigin } from './recenter';
import { ceilToGrid, estimateTextWidth } from './text-metrics';
import type { AgentDerivationResult, AgentDerivationWarning } from './types';
import { resolveEdgeKind, type AgenticEdgeKind } from './bpmn-to-component';

/**
 * BPMN agentic lane → Agent-diagram (state machine) derivation.
 *
 * Core: one `AgentState` per task in the lane; intra-lane sequence flows →
 * `AgentStateTransition`s (in-lane gateways collapsed). A `StateInitialNode`
 * enters a greeting state, which leads to the entry task (or receives the
 * inbound A2A intents). Reflection modes, governed merges and cross-lane
 * flows add scaffold states, intents and A2A tags on top.
 *
 * Pure `model → model`; structured refusals/warnings (never throws on user
 * content). `elementMapping[stateId] = taskId` feeds the lineage sidecar.
 */
const STATE_W = 140; // minimum state width; longer names widen the state
const STATE_H = 40;
const INIT_SIZE = 45;
const V_GAP = 70; // vertical gap between stacked states
// Horizontal gap between state columns: room for a transition label such as
// "No intent" on the edge between two side-by-side states.
const COL_GAP = 100;
// Scaffolded AgentIntent elements and the inbound-intent edges originate in a
// column left of the greeting/init node.
const INTENT_COL_X = -340;
// Columns, left to right: tasks (and the greeting) at x = 0, then the
// reflection scaffolds (self-eval / human approval), then the governed
// merge-decision states, so producer→merge edges run rightward. Each column
// starts COL_GAP right of the widest state placed before it (nextColumnX).
// recenterModelOnOrigin re-centres at the end, so absolute x only matters for
// relative layout.

// AgentState.render (editor) widens a state to its bold name + 60 px, on a
// 10 px grid, clamped to [80, 420], and never narrows it below the stored
// width. Sizing the state here with an over-estimate of the name keeps the
// rendered width equal to the derived one, so the columns cannot collide.
const AGENT_STATE_NAME_PAD = 60;
const AGENT_STATE_MAX_AUTO_WIDTH = 420;
const agentStateWidth = (name: string): number =>
  Math.max(STATE_W, Math.min(AGENT_STATE_MAX_AUTO_WIDTH, ceilToGrid(estimateTextWidth(name) + AGENT_STATE_NAME_PAD)));

/** x of a new state column: COL_GAP right of every state placed so far. */
const nextColumnX = (out: UMLModel): number =>
  Object.values(out.elements)
    .filter((e) => e.type === 'AgentState')
    .reduce((right, e) => Math.max(right, e.bounds.x + e.bounds.width), 0) + COL_GAP;

/**
 * BAF / the BESSER agent converter reject state names with spaces ("Name
 * cannot contain spaces"). Collapse anything that is not a word character to
 * underscores so every derived name is an identifier-like token.
 */
const sanitizeStateName = (raw: string): string => {
  const s = (raw || '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^\w]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return s || 'State';
};

/**
 * Hands out state names that are unique within one derived agent: BAF state
 * names are the identity key, and "Review draft" / "Review-draft" both sanitize
 * to `Review_draft`. Takes an already sanitized name; later duplicates get
 * `_2`, `_3`, ...
 */
class StateNameAllocator {
  private readonly used = new Set<string>();

  allocate(base: string): string {
    let name = base;
    for (let i = 2; this.used.has(name); i++) name = `${base}_${i}`;
    this.used.add(name);
    return name;
  }
}

type AgentStateElement = UMLElement & { bodies: string[]; fallbackBodies: string[] };
type AgentIntentElement = UMLElement & { bodies: string[]; intent_description: string };

const isTask = (el: UMLElement | undefined): el is BPMNTask => el?.type === 'BPMNTask';
const isLane = (el: UMLElement | undefined): el is BPMNSwimlane => el?.type === 'BPMNSwimlane';
const isGateway = (el: UMLElement | undefined): el is BPMNGateway => el?.type === 'BPMNGateway';
const isFlow = (rel: UMLRelationship): rel is BPMNFlow => rel.type === 'BPMNFlow';

const sequenceFlows = (bpmn: UMLModel): BPMNFlow[] =>
  Object.values(bpmn.relationships).filter(isFlow).filter((f) => f.flowType === 'sequence');

function addAgentState(out: UMLModel, name: string, position: { x: number; y: number }): string {
  const id = uuid();
  const state: AgentStateElement = {
    id,
    name,
    type: 'AgentState',
    owner: null,
    bounds: { ...position, width: agentStateWidth(name), height: STATE_H },
    bodies: [],
    fallbackBodies: [],
  };
  out.elements[id] = state;
  return id;
}

export function laneToAgentModel(bpmn: UMLModel, laneId: string): AgentDerivationResult {
  const warnings: AgentDerivationWarning[] = [];

  if (bpmn.type !== UMLDiagramType.BPMN) return { ok: false, reason: 'not-a-bpmn-diagram', warnings };

  const lane = bpmn.elements[laneId];
  if (!isLane(lane)) return { ok: false, reason: 'lane-not-found', warnings };
  if (!lane.isAgentic) return { ok: false, reason: 'lane-not-agentic', warnings };

  // Tasks owned by this lane, in BPMN reading order (x then y).
  const tasks = Object.values(bpmn.elements)
    .filter(isTask)
    .filter((e) => e.owner === laneId)
    .sort((a, b) => a.bounds.x - b.bounds.x || a.bounds.y - b.bounds.y);
  if (tasks.length === 0) return { ok: false, reason: 'no-tasks-in-lane', warnings };

  const out = emptyAgentModel(bpmn.size);
  const elementMapping: ElementLineageMap = {};
  const names = new StateNameAllocator();

  // 1) one AgentState per task, stacked vertically.
  const stateIdByTask = new Map<string, string>();
  tasks.forEach((t, i) => {
    const id = addAgentState(out, names.allocate(sanitizeStateName(t.name || 'State')), {
      x: 0,
      y: i * (STATE_H + V_GAP),
    });
    stateIdByTask.set(t.id, id);
    elementMapping[id] = t.id; // lineage: AgentState ← source task
  });
  // Execution carrier for outbound A2A. Defaults to the task-state; a
  // self-reflection scaffold overrides it with <task>_reflect. Inbound A2A
  // still targets the task-state via stateIdByTask.
  const outboundCarrierStateIdByTask = new Map(stateIdByTask);

  // Governed merging gateways owned by this lane (gatewayRole 'merging' with a
  // non-empty governanceDsl) become dedicated merge-decision states with guarded
  // inbound transitions, so they must not be collapsed below.
  const taskIds = new Set(tasks.map((t) => t.id));
  const governedMerges = Object.values(bpmn.elements)
    .filter(isGateway)
    .filter(
      (e) =>
        e.owner === laneId &&
        e.gatewayRole === 'merging' &&
        typeof e.governanceDsl === 'string' &&
        e.governanceDsl.trim().length > 0,
    );
  const governedMergeIds = new Set(governedMerges.map((g) => g.id));

  // 2) intra-lane sequence flows → transitions (collapsing in-lane gateways,
  // except governed merges, which become merge states below).
  const edges = collapseGatewayEdges(bpmn, laneId, taskIds, governedMergeIds);
  const seen = new Set<string>();
  for (const { from, to } of edges) {
    const s = stateIdByTask.get(from);
    const t = stateIdByTask.get(to);
    if (!s || !t || s === t) continue;
    const key = `${s} ${t}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // Same default as a transition drawn in the editor: an empty
    // when_intent_matched would never fire, and the agent would stay put.
    emitTransition(out, s, t, 'AgentStateTransition', 'vertical', NEW_TRANSITION_PREDEFINED_TYPE);
  }

  // 3) entry tasks (no intra-lane predecessor).
  const hasPred = new Set(edges.map((e) => e.to));
  const entries = tasks.filter((t) => !hasPred.has(t.id));
  const entryTasks = entries.length > 0 ? entries : [tasks[0]]; // pure-cycle fallback
  const entryStateId = stateIdByTask.get(entryTasks[0].id)!;

  // BAF greeting wrapper: a thin initial state so the agent never enters an
  // LLM-body state on session start (session.event is None then, which breaks
  // reply_llm.predict). StateInitialNode → greeting → first entry via
  // when_no_intent_matched. Created before the reflection pass, which hangs the
  // cross-reflection inbound intent edges off the greeting.
  const greetY = -(STATE_H + V_GAP); // one layout row above the first task (y=0)
  const greetId = addAgentState(out, names.allocate(sanitizeStateName((lane.name || 'Agent') + '_greet')), {
    x: 0,
    y: greetY,
  });
  const initId = uuid();
  out.elements[initId] = {
    id: initId,
    name: '',
    type: 'StateInitialNode',
    owner: null,
    bounds: { x: -110, y: greetY - 2, width: INIT_SIZE, height: INIT_SIZE },
  };
  emitTransition(out, initId, greetId, 'AgentStateTransitionInit', 'horizontal');

  // Reflection scaffolds. self/human splice intra-agent states after the
  // task-state; cross is an A2A round trip with the reviewer agent. Returns the
  // states that received an inbound intent edge (for the cold-start guard).
  const reflectIntentTargets = appendReflectionScaffolds(
    out,
    tasks,
    stateIdByTask,
    greetId,
    elementMapping,
    bpmn.elements,
    outboundCarrierStateIdByTask,
    names,
  );

  // One merge-decision state per governed merging gateway owned by this lane.
  // Runs before appendCrossLaneIO, which skips flows feeding a governed merge.
  appendGovernedMergeStates(
    out,
    bpmn,
    lane,
    laneId,
    taskIds,
    governedMerges,
    stateIdByTask,
    greetId,
    elementMapping,
    warnings,
    names,
  );

  // Cross-lane I/O. Inbound from an agentic peer → greeting → consuming task
  // when_intent_matched edge with a hidden a2a:in tag and a scaffolded intent;
  // inbound from a non-agentic lane / start event → nothing. Outbound → an
  // a2a:out tag on the producing carrier state.
  const ioIntentTargets = appendCrossLaneIO(
    out,
    bpmn,
    lane,
    laneId,
    taskIds,
    stateIdByTask,
    outboundCarrierStateIdByTask,
    greetId,
    elementMapping,
    warnings,
    governedMergeIds,
  );

  // The cold start is skipped when the entry state already receives an inbound
  // intent edge (the two arrows would overlap). Without intents (a non-swarm
  // agent) BAF still needs it to leave the greeting on session start.
  const intentTargetStates = new Set<string>([...reflectIntentTargets, ...ioIntentTargets]);
  if (!intentTargetStates.has(entryStateId)) {
    emitTransition(out, greetId, entryStateId, 'AgentStateTransition', 'vertical', 'when_no_intent_matched');
  }

  // Straddle the origin so the diagram opens centred.
  recenterModelOnOrigin(out);

  return { ok: true, model: out, warnings, elementMapping };
}

// ── helpers ─────────────────────────────────────────────────────────

function emptyAgentModel(size: { width: number; height: number }): UMLModel {
  return {
    version: '3.0.0',
    type: UMLDiagramType.AgentDiagram,
    size,
    elements: {},
    interactive: { elements: {}, relationships: {} },
    relationships: {},
    assessments: {},
  };
}

/**
 * Build task→task edges from intra-lane sequence flows, collapsing in-lane
 * gateways: a flow task→gateway→…→task yields a direct task→task edge.
 * Flows leaving the lane are ignored here; cross-lane I/O is handled separately.
 */
function collapseGatewayEdges(
  bpmn: UMLModel,
  laneId: string,
  taskIds: Set<string>,
  governedMergeIds: Set<string>, // stop the walk here (materialized as merge states)
): Array<{ from: string; to: string }> {
  const seqFlows = sequenceFlows(bpmn);
  // outgoing adjacency by source node id
  const outAdj = new Map<string, string[]>();
  for (const f of seqFlows) {
    const arr = outAdj.get(f.source.element) ?? [];
    arr.push(f.target.element);
    outAdj.set(f.source.element, arr);
  }
  const isLaneGateway = (id: string): boolean => {
    const el = bpmn.elements[id];
    return isGateway(el) && el.owner === laneId;
  };
  // Walk forward from a node to the tasks in the lane reachable through lane
  // gateways only (no cross-lane traversal).
  const forwardTasks = (startNodeId: string): string[] => {
    const found = new Set<string>();
    const stack = [startNodeId];
    const visited = new Set<string>();
    while (stack.length) {
      const n = stack.pop()!;
      if (visited.has(n)) continue;
      visited.add(n);
      if (taskIds.has(n)) {
        found.add(n);
        continue;
      }
      // A governed merge is a hard stop: the merge state owns that wiring. A
      // plain gateway collapses; anything else (cross-lane node, event) is a
      // dead end.
      if (isLaneGateway(n) && !governedMergeIds.has(n)) for (const nxt of outAdj.get(n) ?? []) stack.push(nxt);
    }
    return [...found];
  };

  const edges: Array<{ from: string; to: string }> = [];
  for (const f of seqFlows) {
    if (!taskIds.has(f.source.element)) continue; // edges start at a task in the lane
    for (const tgt of forwardTasks(f.target.element)) edges.push({ from: f.source.element, to: tgt });
  }
  return edges;
}

/** Centre of the side of `b` that a port with direction `dir` sits on. */
function portPoint(b: UMLElement['bounds'], dir: Direction): { x: number; y: number } {
  if (dir === Direction.Down) return { x: b.x + b.width / 2, y: b.y + b.height };
  if (dir === Direction.Up) return { x: b.x + b.width / 2, y: b.y };
  if (dir === Direction.Right) return { x: b.x + b.width, y: b.y + b.height / 2 };
  return { x: b.x, y: b.y + b.height / 2 };
}

function emitTransition(
  out: UMLModel,
  srcId: string,
  tgtId: string,
  type: 'AgentStateTransition' | 'AgentStateTransitionInit',
  // vertical: bottom → top. horizontal: the facing sides of two side-by-side
  // states. below: bottom → bottom, a loop under both states (a back edge
  // between side-by-side states that would otherwise run on top of the
  // forward edge).
  orientation: 'vertical' | 'horizontal' | 'below',
  predefinedType?: string,
  opts?: {
    intentName?: string;
    name?: string; // A2A intent + hidden tag
    // guard payloads for a merge-decision inbound transition.
    variable?: string;
    operator?: string;
    targetValue?: string;
    customConditions?: string[];
  },
): string {
  const id = uuid();
  const sb = out.elements[srcId].bounds;
  const tb = out.elements[tgtId].bounds;
  // The editor re-routes the edge from these port directions on load (the
  // path below only seeds the model); a horizontal edge whose ports faced away
  // from each other would be routed around both states.
  let srcDir: Direction;
  let tgtDir: Direction;
  if (orientation === 'vertical') [srcDir, tgtDir] = [Direction.Down, Direction.Up];
  else if (orientation === 'below') [srcDir, tgtDir] = [Direction.Down, Direction.Down];
  else if (sb.x + sb.width / 2 <= tb.x + tb.width / 2) [srcDir, tgtDir] = [Direction.Right, Direction.Left];
  else [srcDir, tgtDir] = [Direction.Left, Direction.Right];
  const p0 = portPoint(sb, srcDir);
  const p1 = portPoint(tb, tgtDir);

  // A custom-condition guard takes precedence: it serializes as a `custom`
  // transition (transitionType 'custom' + custom.condition), not a predefined one.
  // A when_variable_operation_matched guard rides predefined.conditionValue (an
  // object) AND the top-level variable/operator/targetValue mirror (the
  // AgentStateTransition constructor reads the top-level fields on first load,
  // deserialize reads predefined.conditionValue — set both, as for intentName).
  let typeFields: Partial<AgentStateTransition> = {};
  if (opts?.customConditions && opts.customConditions.length > 0) {
    typeFields = {
      transitionType: 'custom',
      predefined: { predefinedType: '' },
      custom: { event: 'None', condition: opts.customConditions },
    };
  } else if (predefinedType !== undefined) {
    let predefined: AgentStateTransition['predefined'];
    if (opts?.intentName !== undefined) {
      predefined = { predefinedType, intentName: opts.intentName };
    } else if (predefinedType === 'when_variable_operation_matched') {
      predefined = {
        predefinedType,
        conditionValue: {
          variable: opts?.variable ?? '',
          operator: opts?.operator ?? '',
          targetValue: opts?.targetValue ?? '',
        },
      };
    } else {
      predefined = { predefinedType, conditionValue: '' };
    }
    // The BESSER backend's deserializer needs these fields to read the correct
    // predefinedType instead of falling back to 'when_intent_matched';
    // intentName must also be at top level for the constructor path.
    typeFields = {
      transitionType: 'predefined',
      predefined,
      ...(opts?.intentName !== undefined ? { intentName: opts.intentName } : {}),
      ...(predefinedType === 'when_variable_operation_matched'
        ? { variable: opts?.variable ?? '', operator: opts?.operator ?? '', targetValue: opts?.targetValue ?? '' }
        : {}),
      custom: { condition: [] },
    };
  }

  const transition: AgentStateTransition = {
    id,
    name: opts?.name ?? '',
    type,
    owner: null,
    bounds: {
      x: Math.min(p0.x, p1.x),
      y: Math.min(p0.y, p1.y),
      width: Math.max(1, Math.abs(p1.x - p0.x)),
      height: Math.max(1, Math.abs(p1.y - p0.y)),
    },
    path: [p0, p1],
    source: { element: srcId, direction: srcDir },
    target: { element: tgtId, direction: tgtDir },
    isManuallyLayouted: false,
    ...typeFields,
  };
  out.relationships[id] = transition;
  return id;
}

// ── Cross-lane I/O ──────────────────────────────────────────────────

/**
 * For every flow crossing the lane boundary:
 *  - INPUT (target in lane, source external) from an AGENTIC peer lane → a
 *    `when_intent_matched` transition greeting → consuming task-state, with a
 *    visible `recv_<peer>_<task>` intent and a hidden `a2a:in` tag in `name`;
 *    plus a deduped `AgentIntent` scaffold. Non-agentic / start-event source →
 *    skip (the greeting cold start is the channel).
 *  - OUTPUT (source in lane, target external) → append an `a2a:out` line to the
 *    producing outbound-carrier state's `description` (kind omitted for
 *    non-agentic peers).
 * Lineage is stamped for inbound transitions. Returns the task-state ids that
 * received a when_intent_matched transition from the greeting.
 */
function appendCrossLaneIO(
  out: UMLModel,
  bpmn: UMLModel,
  lane: BPMNSwimlane,
  laneId: string,
  taskIds: Set<string>,
  stateIdByTask: Map<string, string>,
  outboundCarrierStateIdByTask: Map<string, string>,
  greetId: string,
  elementMapping: ElementLineageMap,
  warnings: AgentDerivationWarning[],
  governedMergeIds: Set<string>, // flows feeding these are owned by the merge wiring
): Set<string> {
  const flows = Object.values(bpmn.relationships)
    .filter(isFlow)
    .filter((r) => r.flowType === 'sequence' || r.flowType === 'message');

  const intentIdByName = new Map<string, string>(); // dedup scaffolded AgentIntents
  // Earlier passes may already have placed AgentIntents in the intent column;
  // start below them so rows don't overlap.
  let intentRow = Object.values(out.elements).filter((e) => e.type === 'AgentIntent').length;
  const intentTargetStates = new Set<string>();

  for (const f of flows) {
    const sourceIsInLane = isInLaneNode(bpmn, laneId, f.source.element);
    const targetIsInLane = isInLaneNode(bpmn, laneId, f.target.element);

    // INPUT: target in lane, source external.
    if (targetIsInLane && !sourceIsInLane) {
      // A producer flow into a governed merge is wired by appendGovernedMergeStates.
      if (governedMergeIds.has(f.target.element)) continue;
      const peerLane = externalLaneElement(bpmn, f.source.element);
      // Only an agentic peer lane becomes an A2A intent; a pool, start event or
      // human lane folds into the cold start.
      if (!peerLane || peerLane.isAgentic !== true) continue;
      const peerName = externalName(bpmn, f.source.element);
      const consuming = inLaneTasks(bpmn, laneId, taskIds, f.target.element, 'forward');
      if (consuming.length === 0) {
        warnings.push({ kind: 'io-attached-to-entry', flowId: f.id });
        continue; // unresolved agentic input: the cold start covers the entry
      }
      const kind = resolveEdgeKind(peerLane, lane);
      const tag = a2aTag({ dir: 'in', peer: peerName, ref: peerLane.agentDiagramRef, flow: f.id, kind });
      // one intent per (peer, consuming task): recv_<peer>_<task>
      for (const taskId of consuming) {
        const sId = stateIdByTask.get(taskId)!;
        const intent = recvIntentName(peerName, out.elements[sId].name);
        if (!intentIdByName.has(intent)) {
          intentIdByName.set(intent, createIntentScaffold(out, intent, incomingMessageDescription(peerName), intentRow++));
        }
        const tId = emitTransition(out, greetId, sId, 'AgentStateTransition', 'vertical', 'when_intent_matched', {
          intentName: intent,
          name: tag,
        });
        intentTargetStates.add(sId);
        elementMapping[tId] = f.id; // lineage: inbound intent ← inducing flow
      }
      continue;
    }

    // OUTPUT: source in lane, target external.
    if (sourceIsInLane && !targetIsInLane) {
      const producing = inLaneTasks(bpmn, laneId, taskIds, f.source.element, 'backward');
      // A self-reflective task sends from its <task>_reflect state.
      const states = producing.map((t) => outboundCarrierStateIdByTask.get(t) || stateIdByTask.get(t)!);
      if (states.length === 0) {
        warnings.push({ kind: 'io-attached-to-entry', flowId: f.id });
        continue;
      }
      const peerLane = externalLaneElement(bpmn, f.target.element);
      const peerName = externalName(bpmn, f.target.element);
      // A non-agentic sink is a plain channel without a kind.
      const kind = peerLane && peerLane.isAgentic === true ? resolveEdgeKind(lane, peerLane) : undefined;
      for (const sId of states) {
        const el = out.elements[sId];
        const tag = a2aTag({
          dir: 'out',
          peer: peerName,
          ref: peerLane?.agentDiagramRef,
          flow: f.id,
          order: nextOutOrder(el.description),
          kind,
        });
        el.description = el.description ? `${el.description}\n${tag}` : tag;
      }
    }
  }
  return intentTargetStates;
}

// ── Governed merge-decision states + guarded derivation ─────────────

/**
 * Derive a guard for a producer→merge transition from a BPMN
 * sequence-flow condition label (`BPMNFlow.name`):
 *   "X <op> Y"  → when_variable_operation_matched {variable, operator, targetValue}
 *   other non-empty → a custom transition with that label as its single condition
 *   empty       → when_no_intent_matched (unconditional arrival at the merge)
 * Operators recognised: == != <= >= < >. (Intent-triggered branches are already
 * covered by the cross-lane A2A inbound path and are not re-derived here.)
 */
function deriveGuard(label: string | undefined): {
  predefinedType: string;
  variable?: string;
  operator?: string;
  targetValue?: string;
  customConditions?: string[];
} {
  const t = (label || '').trim();
  if (!t) return { predefinedType: 'when_no_intent_matched' };
  const m = t.match(/^(.+?)\s*(==|!=|<=|>=|<|>)\s*(.+)$/);
  if (m) {
    return {
      predefinedType: 'when_variable_operation_matched',
      variable: m[1].trim(),
      operator: m[2],
      targetValue: m[3].trim(),
    };
  }
  return { predefinedType: 'custom', customConditions: [t] };
}

/**
 * For each governed merging gateway G owned by the lane, insert a
 * dedicated merge-decision AgentState S_G and wire it so BESSER can bind
 * governance to it.
 *
 * Name: "Address_merge_decision" (sanitized — BAF rejects spaces). When the lane
 * owns more than one governed merge, the gateway label (or short id) is
 * appended; the shared allocator keeps every state name distinct.
 *
 * BINDING (the contract BESSER's `_merge_state_for_gateway` reads): an
 * `a2a:in;peer=<producer>;ref=<…|>;flow=<G.id>;[kind=…]` transition whose
 * target_state is S_G. The `flow` is the GATEWAY id (not a sequence-flow id), so
 * BESSER resolves gateway → state by marker. These edges come from the
 * gateway's incoming flows:
 *  - cross-lane producer (source in another agentic lane) → a greeting→S_G
 *    `when_intent_matched` edge carrying the `a2a:in;flow=<G.id>` tag + a deduped
 *    AgentIntent. This is both the binding and a when_intent_matched guard.
 *  - in-lane producer → an intra-lane guarded transition producer-state→S_G
 *    (when_variable_operation_matched / custom / when_no_intent_matched, from the
 *    flow's condition label). These guard but do not bind.
 * If no cross-lane producer emitted an `a2a:in;flow=<G.id>` edge (in-lane-only or
 * producerless merge), one self-peer `a2a:in;…;flow=<G.id>` marker edge is
 * synthesized so the binding still resolves.
 *
 * Outbound: for each flow out of G, S_G → in-lane successor(s) (when_no_intent_matched).
 * Lineage: S_G ← G; each inbound ← its inducing flow (the self-peer marker ← G).
 */
function appendGovernedMergeStates(
  out: UMLModel,
  bpmn: UMLModel,
  lane: BPMNSwimlane,
  laneId: string,
  taskIds: Set<string>,
  governedMerges: BPMNGateway[],
  stateIdByTask: Map<string, string>,
  greetId: string,
  elementMapping: ElementLineageMap,
  warnings: AgentDerivationWarning[],
  names: StateNameAllocator,
): void {
  if (governedMerges.length === 0) return;
  const multiple = governedMerges.length > 1;
  const seqFlows = sequenceFlows(bpmn);
  const intentIdByName = new Map<string, string>(); // dedup scaffolded AgentIntents
  let intentRow = Object.values(out.elements).filter((e) => e.type === 'AgentIntent').length;
  // One column right of the task and reflection columns.
  const mergeColX = nextColumnX(out);

  governedMerges.forEach((g, idx) => {
    const baseName = 'Address_merge_decision';
    const name = names.allocate(
      multiple ? `${baseName}__${sanitizeStateName(g.name || g.id.slice(-6))}` : baseName,
    );
    const mergeId = addAgentState(out, name, { x: mergeColX, y: idx * (STATE_H + V_GAP) });
    elementMapping[mergeId] = g.id; // lineage: merge state ← gateway

    const ensureIntent = (intent: string, peerName: string): string => {
      if (!intentIdByName.has(intent)) {
        intentIdByName.set(intent, createIntentScaffold(out, intent, incomingMessageDescription(peerName), intentRow++));
      }
      return intent;
    };

    // Inbound: producers feeding the gateway. Cross-lane → a2a:in;flow=<G.id>
    // (binding + guard); in-lane → intra-lane guarded transition.
    let producerCount = 0;
    let boundViaA2aIn = false;
    for (const f of seqFlows.filter((r) => r.target.element === g.id)) {
      const inLaneProducers = inLaneTasks(bpmn, laneId, taskIds, f.source.element, 'backward');
      if (inLaneProducers.length > 0) {
        const guard = deriveGuard(f.name);
        for (const producerTask of inLaneProducers) {
          const pState = stateIdByTask.get(producerTask);
          if (!pState) continue;
          const tId = emitTransition(out, pState, mergeId, 'AgentStateTransition', 'horizontal', guard.predefinedType, {
            variable: guard.variable,
            operator: guard.operator,
            targetValue: guard.targetValue,
            customConditions: guard.customConditions,
          });
          elementMapping[tId] = f.id; // lineage: guard ← inducing flow
          producerCount++;
        }
        continue;
      }
      const peerLane = externalLaneElement(bpmn, f.source.element);
      const peerName = externalName(bpmn, f.source.element);
      // A non-agentic producer is a plain channel without a kind.
      const kind = peerLane && peerLane.isAgentic === true ? resolveEdgeKind(peerLane, lane) : undefined;
      const tag = a2aTag({ dir: 'in', peer: peerName, ref: peerLane?.agentDiagramRef, flow: g.id, kind });
      const intent = ensureIntent(recvIntentName(peerName, name), peerName);
      const tId = emitTransition(out, greetId, mergeId, 'AgentStateTransition', 'vertical', 'when_intent_matched', {
        intentName: intent,
        name: tag,
      });
      elementMapping[tId] = f.id; // lineage: inbound binding ← inducing flow
      producerCount++;
      boundViaA2aIn = true;
    }
    if (producerCount === 0) warnings.push({ kind: 'merge-no-producers', gatewayId: g.id });

    if (!boundViaA2aIn) {
      const selfPeer = lane.name || 'self';
      const tag = a2aTag({ dir: 'in', peer: selfPeer, ref: lane.agentDiagramRef, flow: g.id });
      const intent = ensureIntent(recvIntentName(selfPeer, name), selfPeer);
      const tId = emitTransition(out, greetId, mergeId, 'AgentStateTransition', 'vertical', 'when_intent_matched', {
        intentName: intent,
        name: tag,
      });
      elementMapping[tId] = g.id; // lineage: synthetic binding ← gateway
    }

    // Unguarded outbound to the gateway's successors.
    let successorCount = 0;
    for (const f of seqFlows.filter((r) => r.source.element === g.id)) {
      for (const succTask of inLaneTasks(bpmn, laneId, taskIds, f.target.element, 'forward')) {
        const sState = stateIdByTask.get(succTask);
        if (!sState) continue;
        emitTransition(out, mergeId, sState, 'AgentStateTransition', 'vertical', 'when_no_intent_matched');
        successorCount++;
      }
    }
    if (successorCount === 0) warnings.push({ kind: 'merge-no-successors', gatewayId: g.id });
  });
}

const incomingMessageDescription = (peerName: string): string =>
  `Incoming message from ${peerName} (auto-scaffolded; add training phrases).`;

/**
 * A scaffolded `AgentIntent` element so a `when_intent_matched` transition
 * binds to a declared intent. The user adds the training phrases. Laid out in
 * a column left of the greeting/init node.
 */
function createIntentScaffold(out: UMLModel, intentName: string, description: string, row: number): string {
  const id = uuid();
  const intent: AgentIntentElement = {
    id,
    name: intentName,
    type: 'AgentIntent',
    owner: null,
    bounds: { x: INTENT_COL_X, y: row * (STATE_H + V_GAP), width: STATE_W, height: STATE_H },
    bodies: [],
    intent_description: description,
  };
  out.elements[id] = intent;
  return id;
}

/**
 * True iff the node belongs to the lane. Membership is by ownership, not
 * element type: a lane owns its tasks, gateways and events, so a flow from the
 * lane's own start event is never a crossing (no `from_<self>` boundary), while
 * a node owned by another lane stays external.
 */
function isInLaneNode(bpmn: UMLModel, laneId: string, nodeId: string): boolean {
  return bpmn.elements[nodeId]?.owner === laneId;
}

/**
 * Resolve an in-lane endpoint to the concrete in-lane task(s) it represents:
 * a task → itself; an in-lane gateway → tasks reachable through in-lane
 * gateways (`forward` follows outgoing flows, `backward` incoming). Returns
 * [] for a non-lane node.
 */
function inLaneTasks(
  bpmn: UMLModel,
  laneId: string,
  taskIds: Set<string>,
  nodeId: string,
  dir: 'forward' | 'backward',
): string[] {
  if (taskIds.has(nodeId)) return [nodeId];
  const el = bpmn.elements[nodeId];
  if (!isGateway(el) || el.owner !== laneId) return [];
  const flows = sequenceFlows(bpmn);
  const found = new Set<string>();
  const stack = [nodeId];
  const visited = new Set<string>();
  while (stack.length) {
    const n = stack.pop()!;
    if (visited.has(n)) continue;
    visited.add(n);
    if (n !== nodeId && taskIds.has(n)) {
      found.add(n);
      continue;
    }
    const nextIds = flows
      .filter((f) => (dir === 'forward' ? f.source.element === n : f.target.element === n))
      .map((f) => (dir === 'forward' ? f.target.element : f.source.element));
    for (const nx of nextIds) {
      const nel = bpmn.elements[nx];
      if (taskIds.has(nx)) found.add(nx);
      else if (isGateway(nel) && nel.owner === laneId) stack.push(nx);
    }
  }
  return [...found];
}

/** The owner chain of a node, nearest first (cycle-safe). */
function ownerChain(bpmn: UMLModel, nodeId: string): UMLElement[] {
  const chain: UMLElement[] = [];
  const guard = new Set<string>();
  const start = bpmn.elements[nodeId]?.owner;
  let cur = start ? bpmn.elements[start] : undefined;
  while (cur && !guard.has(cur.id)) {
    guard.add(cur.id);
    chain.push(cur);
    cur = cur.owner ? bpmn.elements[cur.owner] : undefined;
  }
  return chain;
}

/**
 * Human-readable name for an external endpoint, lane-first: the swimlane it
 * belongs to (the other agent), else its pool, else the element's own name,
 * else 'External'. Walks the full owner chain, so a nested endpoint still
 * resolves to its lane; a free-floating node falls through to its own name.
 */
function externalName(bpmn: UMLModel, nodeId: string): string {
  const el = bpmn.elements[nodeId];
  if (!el) return 'External';
  if (el.type === 'BPMNSwimlane' || el.type === 'BPMNPool') return el.name || 'External';
  const chain = ownerChain(bpmn, nodeId);
  const owningLane = chain.find(isLane);
  if (owningLane) return owningLane.name || 'External';
  const firstPool = chain.find((e) => e.type === 'BPMNPool');
  if (firstPool) return firstPool.name || 'External';
  return el.name || 'External';
}

/**
 * The external endpoint's owning lane, walking the full owner chain like
 * externalName. Undefined for a pool / start event / unlinked node — those are
 * not agent peers. Callers check `isAgentic` themselves.
 */
function externalLaneElement(bpmn: UMLModel, nodeId: string): BPMNSwimlane | undefined {
  const el = bpmn.elements[nodeId];
  if (!el) return undefined;
  if (isLane(el)) return el;
  return ownerChain(bpmn, nodeId).find(isLane);
}

/**
 * Synthetic visible intent name: `recv_<peer>_<task>` so a peer feeding two
 * different task-states yields two unambiguous intents. Sanitized to BAF's
 * identifier charset.
 */
function recvIntentName(peerName: string, taskName: string): string {
  return sanitizeStateName('recv_' + peerName + '_' + taskName);
}

/** A tag value must not break the `;`-separated, line-based A2A grammar. */
const tagValue = (value: string): string => value.replace(/[;\r\n]+/g, ' ').trim();

/** WME→BESSER A2A wire tag. Empty fields are omitted. */
function a2aTag(parts: {
  dir: 'in' | 'out';
  peer: string;
  ref?: string;
  flow: string;
  order?: number;
  kind?: AgenticEdgeKind;
}): string {
  const seg = [
    `a2a:${parts.dir}`,
    `peer=${tagValue(parts.peer)}`,
    `ref=${tagValue(parts.ref ?? '')}`,
    `flow=${tagValue(parts.flow)}`,
  ];
  if (parts.dir === 'out') seg.push(`order=${parts.order ?? 1}`);
  if (parts.kind) seg.push(`kind=${parts.kind}`);
  return seg.join(';');
}

/**
 * Next 1-based `order` for an outbound A2A tag on a state's description.
 * Counts existing `a2a:out;` lines so the reflection pass and the cross-lane I/O
 * pass don't both emit `order=1` when they tag the same producing state.
 */
function nextOutOrder(description?: string): number {
  if (!description) return 1;
  const m = description.match(/(^|\n)a2a:out;/g);
  return (m ? m.length : 0) + 1;
}

// ── reflection scaffolds ───────────────────────────────────────────

/**
 * For each task with `reflectionMode !== 'none'`, splice reflection after the
 * task's state, re-routing the task's forward transition(s):
 *
 *  - 'self'  → a `<task>_reflect` self-evaluation state; task → reflect → next
 *             use Auto transitions. The user supplies the reflection body.
 *  - 'cross' → inter-agent A2A (no new state). The producing state's
 *             `description` gets an a2a:out;peer=<reviewer>;…;kind=revises tag,
 *             and each forward `next` gets a greeting→next when_intent_matched
 *             edge (intent recv_<reviewer>_<task>, hidden a2a:in tag in `name`)
 *             plus a deduped AgentIntent scaffold. `ref` is the reviewer lane's
 *             Agent diagram, empty when no (linked) reviewer lane is set.
 *  - 'human' → a `<task>_human_review` wait state: task → human_review
 *             (when_no_intent_matched), human_review → next on the
 *             `<task>_approved` intent and human_review → task on the
 *             `<task>_rejected` intent (loop back for revision). Both intents
 *             are scaffolded for the user to train.
 *
 * Re-route = delete the task's existing forward edges to other task-states and
 * re-emit them off the reflection exit. self/human states are synthetic (no
 * lineage entry); the cross inbound intent edge is lineaged to its task.
 * Returns the states that received a cross-reflection inbound intent edge.
 */
function appendReflectionScaffolds(
  out: UMLModel,
  tasks: BPMNTask[],
  stateIdByTask: Map<string, string>,
  greetId: string,
  elementMapping: ElementLineageMap,
  bpmnElements: UMLModel['elements'],
  outboundCarrierStateIdByTask: Map<string, string>,
  names: StateNameAllocator,
): Set<string> {
  const taskStateIds = new Set(stateIdByTask.values());
  const reflectIntentTargets = new Set<string>();
  // Deduplicate AgentIntent scaffolds per intent name; the map size also
  // drives the intent-column row for new scaffolds.
  const intentIds = new Map<string, string>();
  const ensureIntent = (intent: string, description: string): string => {
    if (!intentIds.has(intent)) intentIds.set(intent, createIntentScaffold(out, intent, description, intentIds.size));
    return intent;
  };
  // One column right of the task column (every task-state and the greeting
  // exist by now), shared by all self/human scaffolds; each sits on its task's
  // row.
  const reflectColX = nextColumnX(out);

  for (const t of tasks) {
    const mode = t.reflectionMode ?? 'none';
    if (mode === 'none') continue;
    const sT = stateIdByTask.get(t.id);
    if (!sT) continue;
    const taskName = out.elements[sT].name;
    const sb = out.elements[sT].bounds;

    // Capture and remove the task-state's forward transitions to other
    // task-states (re-routed below). Object.entries snapshots, so deleting
    // during the loop is safe.
    const nexts: string[] = [];
    for (const [rid, r] of Object.entries(out.relationships)) {
      if (r.type !== 'AgentStateTransition') continue;
      if (r.source.element !== sT || r.target.element === sT) continue;
      if (!taskStateIds.has(r.target.element)) continue;
      nexts.push(r.target.element);
      delete out.relationships[rid];
    }

    if (mode === 'self') {
      const reflectId = addAgentState(out, names.allocate(`${taskName}_reflect`), { x: reflectColX, y: sb.y });
      // Run one reflection pass before continuing or sending outbound A2A.
      outboundCarrierStateIdByTask.set(t.id, reflectId);
      emitTransition(out, sT, reflectId, 'AgentStateTransition', 'horizontal', 'auto');
      for (const n of nexts) emitTransition(out, reflectId, n, 'AgentStateTransition', 'vertical', 'auto');
    } else if (mode === 'human') {
      const humanId = addAgentState(out, names.allocate(`${taskName}_human_review`), { x: reflectColX, y: sb.y });
      emitTransition(out, sT, humanId, 'AgentStateTransition', 'horizontal', 'when_no_intent_matched');
      const approved = ensureIntent(
        sanitizeStateName(`${taskName}_approved`),
        `The reviewer approves the result of ${taskName} (auto-scaffolded; add training phrases).`,
      );
      const rejected = ensureIntent(
        sanitizeStateName(`${taskName}_rejected`),
        `The reviewer rejects the result of ${taskName} (auto-scaffolded; add training phrases).`,
      );
      for (const n of nexts) {
        emitTransition(out, humanId, n, 'AgentStateTransition', 'vertical', 'when_intent_matched', {
          intentName: approved,
        });
      }
      // Loop back under both states so it does not run on top of task → human.
      emitTransition(out, humanId, sT, 'AgentStateTransition', 'below', 'when_intent_matched', {
        intentName: rejected,
      });
    } else if (mode === 'cross') {
      const reviewerEl = t.reflectionReviewerLaneId ? bpmnElements[t.reflectionReviewerLaneId] : undefined;
      const reviewerLane = isLane(reviewerEl) ? reviewerEl : undefined;
      const reviewerName = reviewerLane ? sanitizeStateName(reviewerLane.name || 'reviewer') : 'reviewer';
      // `ref` names the reviewer's Agent diagram, like every other A2A tag.
      const reviewerRef = reviewerLane?.agentDiagramRef;

      //  (a) a2a:out tag on the producing state.
      //  (b) for each forward `next`: greeting→next when_intent_matched edge +
      //      deduped AgentIntent scaffold. A terminal cross task gets (a) only.
      const outEl = out.elements[sT];
      const outTag = a2aTag({
        dir: 'out',
        peer: reviewerName,
        ref: reviewerRef,
        flow: `reflect:${t.id}`,
        order: nextOutOrder(outEl.description),
        kind: 'revises',
      });
      outEl.description = outEl.description ? `${outEl.description}\n${outTag}` : outTag;
      for (const n of nexts) {
        const intent = ensureIntent(recvIntentName(reviewerName, taskName), incomingMessageDescription(reviewerName));
        const tId = emitTransition(out, greetId, n, 'AgentStateTransition', 'vertical', 'when_intent_matched', {
          intentName: intent,
          name: a2aTag({ dir: 'in', peer: reviewerName, ref: reviewerRef, flow: `reflect:${t.id}`, kind: 'revises' }),
        });
        reflectIntentTargets.add(n);
        elementMapping[tId] = t.id; // lineage: inbound feedback intent ← inducing task
      }
    }
  }
  return reflectIntentTargets;
}
