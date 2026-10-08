import type { BesserNode, UMLModel, UMLModelComponent } from '@besser/wme';
import { NEW_TRANSITION_PREDEFINED_TYPE, UMLDiagramType, bpmnEdgeTypeToFlowType } from '@besser/wme';
import type { ElementLineageMap } from '../../shared/types/project';
import { uuid } from '../../shared/utils/uuid';
import { DiagramBuilder, ModelIndex, nodeName, type Box, type Side } from './diagram-builder';
import { ceilToGrid, estimateTextWidth } from './text-metrics';
import type { AgentDerivationResult, AgentDerivationWarning } from './types';
import {
  agentDiagramRefOf,
  flowsOfType,
  resolveEdgeKind,
  type AgenticEdgeKind,
  type LaneProfile,
} from './bpmn-to-component';

/**
 * BPMN agentic lane → Agent-diagram (state machine) derivation.
 *
 * Core: one `AgentState` per task in the lane; intra-lane sequence flows →
 * `AgentStateTransition`s (in-lane gateways collapsed). A greeting state is
 * the initial state (`data.initial`) and leads to the entry task (or receives
 * the inbound A2A intents). Reflection modes, governed merges and cross-lane
 * flows add scaffold states, intents and A2A tags on top. Scaffolded intents
 * are off-canvas agent components (`model.components`).
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
// Scaffolded intents keep a layout slot in a column left of the greeting, as
// in develop; it still counts toward the centring below.
const INTENT_COL_X = -340;
// Columns, left to right: tasks (and the greeting) at x = 0, then the
// reflection scaffolds (self-eval / human approval), then the governed
// merge-decision states, so producer→merge edges run rightward. Each column
// starts COL_GAP right of the widest state placed before it (nextColumnX).
// The derivation re-centres at the end, so absolute x only matters for
// relative layout.

// AgentState.render (editor) widens a state to its bold name + 60 px, on a
// 10 px grid, clamped to [80, 420], and never narrows it below the stored
// width. Sizing the state here with an over-estimate of the name keeps the
// rendered width equal to the derived one, so the columns cannot collide.
const AGENT_STATE_NAME_PAD = 60;
const AGENT_STATE_MAX_AUTO_WIDTH = 420;
const agentStateWidth = (name: string): number =>
  Math.max(STATE_W, Math.min(AGENT_STATE_MAX_AUTO_WIDTH, ceilToGrid(estimateTextWidth(name) + AGENT_STATE_NAME_PAD)));

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

/** The fields read from BPMN task / gateway node data. */
type TaskData = { reflectionMode?: string; reflectionReviewerLaneId?: string };
type GatewayData = { gatewayRole?: string; governanceDsl?: unknown };

const isTask = (node: BesserNode | undefined): node is BesserNode => node?.type === 'bpmnTask';
const isLane = (node: BesserNode | undefined): node is BesserNode => node?.type === 'bpmnSwimlane';
const isGateway = (node: BesserNode | undefined): node is BesserNode => node?.type === 'bpmnGateway';
const profileOf = (lane: BesserNode): LaneProfile => lane.data as LaneProfile;

/** The derived agent: canvas nodes and edges, plus the scaffolded intents. */
class AgentBuilder extends DiagramBuilder {
  readonly intents: Record<string, UMLModelComponent> = {};
  /** Layout slots of content that is not a canvas node (intents, entry marker). */
  readonly layoutOnly: Box[] = [];

  addState(name: string, position: { x: number; y: number }, extra: Record<string, unknown> = {}): string {
    return this.addNode(
      'AgentState',
      { ...position, width: agentStateWidth(name), height: STATE_H },
      { name, replyType: 'text', ...extra },
    );
  }

  stateName(id: string): string {
    return this.data(id).name as string;
  }

  intentCount(): number {
    return Object.keys(this.intents).length;
  }

  /** x of a new state column: COL_GAP right of every state placed so far. */
  nextColumnX(): number {
    return (
      this.nodeIds('AgentState').reduce((right, id) => Math.max(right, this.box(id).x + this.box(id).width), 0) +
      COL_GAP
    );
  }
}

export function laneToAgentModel(model: UMLModel, laneId: string): AgentDerivationResult {
  const warnings: AgentDerivationWarning[] = [];

  if (model.type !== UMLDiagramType.BPMN) return { ok: false, reason: 'not-a-bpmn-diagram', warnings };
  const bpmn = new ModelIndex(model);

  const lane = bpmn.get(laneId);
  if (!isLane(lane)) return { ok: false, reason: 'lane-not-found', warnings };
  if (!profileOf(lane).isAgentic) return { ok: false, reason: 'lane-not-agentic', warnings };

  // Tasks owned by this lane, in BPMN reading order (x then y). They share
  // the lane as parent, so their relative positions order them.
  const tasks = bpmn
    .nodes('bpmnTask')
    .filter((t) => t.parentId === laneId)
    .sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y);
  if (tasks.length === 0) return { ok: false, reason: 'no-tasks-in-lane', warnings };

  const out = new AgentBuilder();
  const elementMapping: ElementLineageMap = {};
  const names = new StateNameAllocator();

  // 1) one AgentState per task, stacked vertically.
  const stateIdByTask = new Map<string, string>();
  tasks.forEach((t, i) => {
    const id = out.addState(names.allocate(sanitizeStateName(nodeName(t) || 'State')), {
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
  const governedMerges = bpmn.nodes('bpmnGateway').filter((g) => {
    const data = g.data as GatewayData;
    return (
      g.parentId === laneId &&
      data.gatewayRole === 'merging' &&
      typeof data.governanceDsl === 'string' &&
      data.governanceDsl.trim().length > 0
    );
  });
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
    emitTransition(out, s, t, 'vertical', NEW_TRANSITION_PREDEFINED_TYPE);
  }

  // 3) entry tasks (no intra-lane predecessor).
  const hasPred = new Set(edges.map((e) => e.to));
  const entries = tasks.filter((t) => !hasPred.has(t.id));
  const entryTasks = entries.length > 0 ? entries : [tasks[0]]; // pure-cycle fallback
  const entryStateId = stateIdByTask.get(entryTasks[0].id)!;

  // BAF greeting wrapper: a thin initial state so the agent never enters an
  // LLM-body state on session start (session.event is None then, which breaks
  // reply_llm.predict). The greeting is the initial state and leads to the
  // first entry via when_no_intent_matched. Created before the reflection pass,
  // which hangs the cross-reflection inbound intent edges off the greeting.
  const greetY = -(STATE_H + V_GAP); // one layout row above the first task (y=0)
  const greetId = out.addState(
    names.allocate(sanitizeStateName((nodeName(lane) || 'Agent') + '_greet')),
    { x: 0, y: greetY },
    { initial: true },
  );
  // Layout slot of develop's initial-state marker, left of the greeting.
  out.layoutOnly.push({ x: -110, y: greetY - 2, width: INIT_SIZE, height: INIT_SIZE });

  // Reflection scaffolds. self/human splice intra-agent states after the
  // task-state; cross is an A2A round trip with the reviewer agent. Returns the
  // states that received an inbound intent edge (for the cold-start guard).
  const reflectIntentTargets = appendReflectionScaffolds(
    out,
    bpmn,
    tasks,
    stateIdByTask,
    greetId,
    elementMapping,
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
    emitTransition(out, greetId, entryStateId, 'vertical', 'when_no_intent_matched');
  }

  // Straddle the origin so the diagram opens centred.
  out.recenter(out.layoutOnly);

  const intents = out.intentCount() > 0 ? { components: out.intents } : {};
  return { ok: true, model: out.build(UMLDiagramType.AgentDiagram, intents), warnings, elementMapping };
}

// ── helpers ─────────────────────────────────────────────────────────

/**
 * Build task→task edges from intra-lane sequence flows, collapsing in-lane
 * gateways: a flow task→gateway→…→task yields a direct task→task edge.
 * Flows leaving the lane are ignored here; cross-lane I/O is handled separately.
 */
function collapseGatewayEdges(
  bpmn: ModelIndex,
  laneId: string,
  taskIds: Set<string>,
  governedMergeIds: Set<string>, // stop the walk here (materialized as merge states)
): Array<{ from: string; to: string }> {
  const seqFlows = flowsOfType(bpmn.model, 'sequence');
  // outgoing adjacency by source node id
  const outAdj = new Map<string, string[]>();
  for (const f of seqFlows) {
    const arr = outAdj.get(f.source) ?? [];
    arr.push(f.target);
    outAdj.set(f.source, arr);
  }
  const isLaneGateway = (id: string): boolean => {
    const el = bpmn.get(id);
    return isGateway(el) && el.parentId === laneId;
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
    if (!taskIds.has(f.source)) continue; // edges start at a task in the lane
    for (const tgt of forwardTasks(f.target)) edges.push({ from: f.source, to: tgt });
  }
  return edges;
}

/**
 * Add an `AgentStateTransition`.
 *
 * `orientation` picks the handles: vertical = bottom → top; horizontal = the
 * facing sides of two side-by-side states; below = bottom → bottom, a loop
 * under both states (a back edge between side-by-side states that would
 * otherwise run on top of the forward edge). The editor routes the edge from
 * them; a horizontal edge whose handles faced away from each other would be
 * routed around both states.
 */
function emitTransition(
  out: AgentBuilder,
  srcId: string,
  tgtId: string,
  orientation: 'vertical' | 'horizontal' | 'below',
  predefinedType: string,
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
  let handles: [Side, Side];
  if (orientation === 'vertical') handles = ['bottom', 'top'];
  else if (orientation === 'below') handles = ['bottom', 'bottom'];
  else {
    const sb = out.box(srcId);
    const tb = out.box(tgtId);
    handles = sb.x + sb.width / 2 <= tb.x + tb.width / 2 ? ['right', 'left'] : ['left', 'right'];
  }

  // A custom-condition guard takes precedence: it is a `custom` transition
  // (event None + the conditions), not a predefined one. A
  // when_variable_operation_matched guard rides predefined.conditionValue.
  let trigger: Record<string, unknown>;
  if (opts?.customConditions && opts.customConditions.length > 0) {
    trigger = { transitionType: 'custom', custom: { event: 'None', condition: opts.customConditions } };
  } else if (opts?.intentName !== undefined) {
    trigger = { transitionType: 'predefined', predefined: { predefinedType, intentName: opts.intentName } };
  } else if (predefinedType === 'when_variable_operation_matched') {
    const conditionValue = {
      variable: opts?.variable ?? '',
      operator: opts?.operator ?? '',
      targetValue: opts?.targetValue ?? '',
    };
    trigger = { transitionType: 'predefined', predefined: { predefinedType, conditionValue } };
  } else {
    trigger = { transitionType: 'predefined', predefined: { predefinedType, conditionValue: '' } };
  }

  const name = opts?.name;
  return out.addEdge('AgentStateTransition', srcId, tgtId, handles, {
    ...(name ? { name, label: name } : {}),
    ...trigger,
  });
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
  out: AgentBuilder,
  bpmn: ModelIndex,
  lane: BesserNode,
  laneId: string,
  taskIds: Set<string>,
  stateIdByTask: Map<string, string>,
  outboundCarrierStateIdByTask: Map<string, string>,
  greetId: string,
  elementMapping: ElementLineageMap,
  warnings: AgentDerivationWarning[],
  governedMergeIds: Set<string>, // flows feeding these are owned by the merge wiring
): Set<string> {
  const flows = (bpmn.model.edges ?? []).filter((e) => {
    const flowType = bpmnEdgeTypeToFlowType(e.type);
    return flowType === 'sequence' || flowType === 'message';
  });

  const intentIdByName = new Map<string, string>(); // dedup scaffolded AgentIntents
  // Earlier passes may already have placed AgentIntents in the intent column;
  // start below them so rows don't overlap.
  let intentRow = out.intentCount();
  const intentTargetStates = new Set<string>();

  for (const f of flows) {
    const sourceIsInLane = isInLaneNode(bpmn, laneId, f.source);
    const targetIsInLane = isInLaneNode(bpmn, laneId, f.target);

    // INPUT: target in lane, source external.
    if (targetIsInLane && !sourceIsInLane) {
      // A producer flow into a governed merge is wired by appendGovernedMergeStates.
      if (governedMergeIds.has(f.target)) continue;
      const peerLane = externalLane(bpmn, f.source);
      // Only an agentic peer lane becomes an A2A intent; a pool, start event or
      // human lane folds into the cold start.
      if (!peerLane || profileOf(peerLane).isAgentic !== true) continue;
      const peerName = externalName(bpmn, f.source);
      const consuming = inLaneTasks(bpmn, laneId, taskIds, f.target, 'forward');
      if (consuming.length === 0) {
        warnings.push({ kind: 'io-attached-to-entry', flowId: f.id, direction: 'in', peerName });
        continue; // unresolved agentic input: the cold start covers the entry
      }
      const kind = resolveEdgeKind(profileOf(peerLane), profileOf(lane));
      const tag = a2aTag({ dir: 'in', peer: peerName, ref: agentDiagramRefOf(peerLane), flow: f.id, kind });
      // one intent per (peer, consuming task): recv_<peer>_<task>
      for (const taskId of consuming) {
        const sId = stateIdByTask.get(taskId)!;
        const intent = recvIntentName(peerName, out.stateName(sId));
        if (!intentIdByName.has(intent)) {
          intentIdByName.set(intent, createIntentScaffold(out, intent, incomingMessageDescription(peerName), intentRow++));
        }
        const tId = emitTransition(out, greetId, sId, 'vertical', 'when_intent_matched', {
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
      const producing = inLaneTasks(bpmn, laneId, taskIds, f.source, 'backward');
      // A self-reflective task sends from its <task>_reflect state.
      const states = producing.map((t) => outboundCarrierStateIdByTask.get(t) || stateIdByTask.get(t)!);
      const peerLane = externalLane(bpmn, f.target);
      const peerName = externalName(bpmn, f.target);
      if (states.length === 0) {
        warnings.push({ kind: 'io-attached-to-entry', flowId: f.id, direction: 'out', peerName });
        continue;
      }
      // A non-agentic sink is a plain channel without a kind.
      const kind = peerLane && profileOf(peerLane).isAgentic === true ? resolveEdgeKind(profileOf(lane), profileOf(peerLane)) : undefined;
      for (const sId of states) {
        appendOutTag(out, sId, { peer: peerName, ref: agentDiagramRefOf(peerLane), flow: f.id, kind });
      }
    }
  }
  return intentTargetStates;
}

/** Append an `a2a:out` line to a state's `description`, numbered after the existing ones. */
function appendOutTag(
  out: AgentBuilder,
  stateId: string,
  parts: { peer: string; ref?: string; flow: string; kind?: AgenticEdgeKind },
): void {
  const data = out.data(stateId);
  const description = typeof data.description === 'string' ? data.description : undefined;
  const tag = a2aTag({ dir: 'out', ...parts, order: nextOutOrder(description) });
  data.description = description ? `${description}\n${tag}` : tag;
}

// ── Governed merge-decision states + guarded derivation ─────────────

/**
 * Derive a guard for a producer→merge transition from a BPMN
 * sequence-flow condition label (the flow's `name`):
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

/** The condition label of a BPMN flow: `data.name`, else `data.label`. */
function flowLabel(data: Record<string, unknown> | undefined): string {
  if (typeof data?.name === 'string') return data.name;
  return typeof data?.label === 'string' ? data.label : '';
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
  out: AgentBuilder,
  bpmn: ModelIndex,
  lane: BesserNode,
  laneId: string,
  taskIds: Set<string>,
  governedMerges: BesserNode[],
  stateIdByTask: Map<string, string>,
  greetId: string,
  elementMapping: ElementLineageMap,
  warnings: AgentDerivationWarning[],
  names: StateNameAllocator,
): void {
  if (governedMerges.length === 0) return;
  const multiple = governedMerges.length > 1;
  const seqFlows = flowsOfType(bpmn.model, 'sequence');
  const intentIdByName = new Map<string, string>(); // dedup scaffolded AgentIntents
  let intentRow = out.intentCount();
  // One column right of the task and reflection columns.
  const mergeColX = out.nextColumnX();

  governedMerges.forEach((g, idx) => {
    const baseName = 'Address_merge_decision';
    const name = names.allocate(
      multiple ? `${baseName}__${sanitizeStateName(nodeName(g) || g.id.slice(-6))}` : baseName,
    );
    const mergeId = out.addState(name, { x: mergeColX, y: idx * (STATE_H + V_GAP) });
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
    for (const f of seqFlows.filter((r) => r.target === g.id)) {
      const inLaneProducers = inLaneTasks(bpmn, laneId, taskIds, f.source, 'backward');
      if (inLaneProducers.length > 0) {
        const guard = deriveGuard(flowLabel(f.data));
        for (const producerTask of inLaneProducers) {
          const pState = stateIdByTask.get(producerTask);
          if (!pState) continue;
          const tId = emitTransition(out, pState, mergeId, 'horizontal', guard.predefinedType, {
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
      const peerLane = externalLane(bpmn, f.source);
      const peerName = externalName(bpmn, f.source);
      // A non-agentic producer is a plain channel without a kind.
      const kind = peerLane && profileOf(peerLane).isAgentic === true ? resolveEdgeKind(profileOf(peerLane), profileOf(lane)) : undefined;
      const tag = a2aTag({ dir: 'in', peer: peerName, ref: agentDiagramRefOf(peerLane), flow: g.id, kind });
      const intent = ensureIntent(recvIntentName(peerName, name), peerName);
      const tId = emitTransition(out, greetId, mergeId, 'vertical', 'when_intent_matched', {
        intentName: intent,
        name: tag,
      });
      elementMapping[tId] = f.id; // lineage: inbound binding ← inducing flow
      producerCount++;
      boundViaA2aIn = true;
    }
    if (producerCount === 0) warnings.push({ kind: 'merge-no-producers', gatewayId: g.id, gatewayName: nodeName(g) });

    if (!boundViaA2aIn) {
      const selfPeer = nodeName(lane) || 'self';
      const tag = a2aTag({ dir: 'in', peer: selfPeer, ref: agentDiagramRefOf(lane), flow: g.id });
      const intent = ensureIntent(recvIntentName(selfPeer, name), selfPeer);
      const tId = emitTransition(out, greetId, mergeId, 'vertical', 'when_intent_matched', {
        intentName: intent,
        name: tag,
      });
      elementMapping[tId] = g.id; // lineage: synthetic binding ← gateway
    }

    // Unguarded outbound to the gateway's successors.
    let successorCount = 0;
    for (const f of seqFlows.filter((r) => r.source === g.id)) {
      for (const succTask of inLaneTasks(bpmn, laneId, taskIds, f.target, 'forward')) {
        const sState = stateIdByTask.get(succTask);
        if (!sState) continue;
        emitTransition(out, mergeId, sState, 'vertical', 'when_no_intent_matched');
        successorCount++;
      }
    }
    if (successorCount === 0) {
      warnings.push({ kind: 'merge-no-successors', gatewayId: g.id, gatewayName: nodeName(g) });
    }
  });
}

const incomingMessageDescription = (peerName: string): string =>
  `Incoming message from ${peerName} (auto-scaffolded; add training phrases).`;

/**
 * A scaffolded `AgentIntent` component so a `when_intent_matched` transition
 * binds to a declared intent. The user adds the training phrases. Intents are
 * off-canvas; `row` is the intent's layout slot in the column left of the
 * greeting.
 */
function createIntentScaffold(out: AgentBuilder, intentName: string, description: string, row: number): string {
  const id = uuid();
  out.intents[id] = {
    id,
    name: intentName,
    type: 'AgentIntent',
    owner: null,
    bodies: [],
    intent_description: description,
  } as UMLModelComponent;
  out.layoutOnly.push({ x: INTENT_COL_X, y: row * (STATE_H + V_GAP), width: STATE_W, height: STATE_H });
  return id;
}

/**
 * True iff the node belongs to the lane. Membership is by containment, not
 * node type: a lane holds its tasks, gateways and events, so a flow from the
 * lane's own start event is never a crossing (no `from_<self>` boundary), while
 * a node inside another lane stays external.
 */
function isInLaneNode(bpmn: ModelIndex, laneId: string, nodeId: string): boolean {
  return bpmn.get(nodeId)?.parentId === laneId;
}

/**
 * Resolve an in-lane endpoint to the concrete in-lane task(s) it represents:
 * a task → itself; an in-lane gateway → tasks reachable through in-lane
 * gateways (`forward` follows outgoing flows, `backward` incoming). Returns
 * [] for a non-lane node.
 */
function inLaneTasks(
  bpmn: ModelIndex,
  laneId: string,
  taskIds: Set<string>,
  nodeId: string,
  dir: 'forward' | 'backward',
): string[] {
  if (taskIds.has(nodeId)) return [nodeId];
  const el = bpmn.get(nodeId);
  if (!isGateway(el) || el.parentId !== laneId) return [];
  const flows = flowsOfType(bpmn.model, 'sequence');
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
      .filter((f) => (dir === 'forward' ? f.source === n : f.target === n))
      .map((f) => (dir === 'forward' ? f.target : f.source));
    for (const nx of nextIds) {
      const nel = bpmn.get(nx);
      if (taskIds.has(nx)) found.add(nx);
      else if (isGateway(nel) && nel.parentId === laneId) stack.push(nx);
    }
  }
  return [...found];
}

/**
 * Human-readable name for an external endpoint, lane-first: the swimlane it
 * belongs to (the other agent), else its pool, else the element's own name,
 * else 'External'. Walks the full parent chain, so a nested endpoint still
 * resolves to its lane; a free-floating node falls through to its own name.
 */
function externalName(bpmn: ModelIndex, nodeId: string): string {
  const el = bpmn.get(nodeId);
  if (!el) return 'External';
  if (el.type === 'bpmnSwimlane' || el.type === 'bpmnPool') return nodeName(el) || 'External';
  const chain = bpmn.ancestors(el);
  const owningLane = chain.find(isLane);
  if (owningLane) return nodeName(owningLane) || 'External';
  const firstPool = chain.find((e) => e.type === 'bpmnPool');
  if (firstPool) return nodeName(firstPool) || 'External';
  return nodeName(el) || 'External';
}

/**
 * The external endpoint's lane, walking the full parent chain like
 * externalName. Undefined for a pool / start event / unlinked node — those are
 * not agent peers. Callers check `isAgentic` themselves.
 */
function externalLane(bpmn: ModelIndex, nodeId: string): BesserNode | undefined {
  const el = bpmn.get(nodeId);
  if (!el) return undefined;
  if (isLane(el)) return el;
  return bpmn.ancestors(el).find(isLane);
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
  out: AgentBuilder,
  bpmn: ModelIndex,
  tasks: BesserNode[],
  stateIdByTask: Map<string, string>,
  greetId: string,
  elementMapping: ElementLineageMap,
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
  const reflectColX = out.nextColumnX();

  for (const t of tasks) {
    const { reflectionMode, reflectionReviewerLaneId } = t.data as TaskData;
    const mode = reflectionMode ?? 'none';
    if (mode === 'none') continue;
    const sT = stateIdByTask.get(t.id);
    if (!sT) continue;
    const taskName = out.stateName(sT);
    const sb = out.box(sT);

    // Capture and remove the task-state's forward transitions to other
    // task-states (re-routed below). Iterates a snapshot, so removing during
    // the loop is safe.
    const nexts: string[] = [];
    for (const e of [...out.edges]) {
      if (e.type !== 'AgentStateTransition') continue;
      if (e.source !== sT || e.target === sT) continue;
      if (!taskStateIds.has(e.target)) continue;
      nexts.push(e.target);
      out.removeEdge(e.id);
    }

    if (mode === 'self') {
      const reflectId = out.addState(names.allocate(`${taskName}_reflect`), { x: reflectColX, y: sb.y });
      // Run one reflection pass before continuing or sending outbound A2A.
      outboundCarrierStateIdByTask.set(t.id, reflectId);
      emitTransition(out, sT, reflectId, 'horizontal', 'auto');
      for (const n of nexts) emitTransition(out, reflectId, n, 'vertical', 'auto');
    } else if (mode === 'human') {
      const humanId = out.addState(names.allocate(`${taskName}_human_review`), { x: reflectColX, y: sb.y });
      emitTransition(out, sT, humanId, 'horizontal', 'when_no_intent_matched');
      const approved = ensureIntent(
        sanitizeStateName(`${taskName}_approved`),
        `The reviewer approves the result of ${taskName} (auto-scaffolded; add training phrases).`,
      );
      const rejected = ensureIntent(
        sanitizeStateName(`${taskName}_rejected`),
        `The reviewer rejects the result of ${taskName} (auto-scaffolded; add training phrases).`,
      );
      for (const n of nexts) {
        emitTransition(out, humanId, n, 'vertical', 'when_intent_matched', { intentName: approved });
      }
      // Loop back under both states so it does not run on top of task → human.
      emitTransition(out, humanId, sT, 'below', 'when_intent_matched', { intentName: rejected });
    } else if (mode === 'cross') {
      const reviewerEl = reflectionReviewerLaneId ? bpmn.get(reflectionReviewerLaneId) : undefined;
      const reviewerLane = isLane(reviewerEl) ? reviewerEl : undefined;
      const reviewerName = reviewerLane ? sanitizeStateName(nodeName(reviewerLane) || 'reviewer') : 'reviewer';
      // `ref` names the reviewer's Agent diagram, like every other A2A tag.
      const reviewerRef = agentDiagramRefOf(reviewerLane);

      //  (a) a2a:out tag on the producing state.
      //  (b) for each forward `next`: greeting→next when_intent_matched edge +
      //      deduped AgentIntent scaffold. A terminal cross task gets (a) only.
      appendOutTag(out, sT, { peer: reviewerName, ref: reviewerRef, flow: `reflect:${t.id}`, kind: 'revises' });
      for (const n of nexts) {
        const intent = ensureIntent(recvIntentName(reviewerName, taskName), incomingMessageDescription(reviewerName));
        const tId = emitTransition(out, greetId, n, 'vertical', 'when_intent_matched', {
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
