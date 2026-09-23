import type { UMLModel, UMLElement, UMLRelationship } from '@besser/wme';
import { UMLDiagramType } from '@besser/wme';
import type { ElementLineageMap } from '../../shared/types/project';
import type { AgentDerivationResult, AgentDerivationWarning } from './types';
import { resolveEdgeKind, type AgenticEdgeKind } from './bpmn-to-component';

/**
 * BPMN agentic lane → Agent-diagram (state machine) derivation.
 *
 * Core: one `AgentState` per task in the lane; intra-lane sequence
 * flows → `AgentStateTransition` (gateways collapsed); entry tasks (no
 * intra-lane predecessor) → a `StateInitialNode` + `AgentStateTransitionInit`
 * (one per entry).
 *
 * Pure `model → model`; structured refusals/warnings (never throws on user
 * content). `elementMapping[stateId] = taskId` feeds the lineage sidecar.
 */
const STATE_W = 140;
const STATE_H = 40;
const INIT_SIZE = 45;
const V_GAP = 70; // vertical gap between stacked states
// scaffolded AgentIntent elements + the inbound-intent edges originate at a
// column left of the greeting/init node (the old INPUT_COL_X slot, now free since
// the «input» boundary states are gone).
const INTENT_COL_X = -340;
// reflection-scaffold column: extra states (self-eval / cross-review /
// human-approval) sit between the task column (x 0..140) and the right, so they
// don't overlap the task column.
const REFLECT_COL_X = 160;
// governed merge-decision states sit in a column to the RIGHT of the
// reflection column so producer→merge edges run rightward and don't overlap the
// task (x 0..140) or reflection (x 160) columns. recenterAgentModel re-centres at
// the end, so the absolute x only matters for relative layout.
const MERGE_COL_X = 360;

const newId = (): string => 'gen-' + Math.random().toString(36).slice(2, 11);

/**
 * BAF / the BESSER agent converter reject state names with
 * spaces ("Name cannot contain spaces"). Collapse whitespace to underscores and
 * trim so every derived AgentState.name is a valid identifier-ish token. Boundary
 * states become `from_<Peer>` / `to_<Peer>` — the exact contract the
 * generator matches on (it re-applies `_safe_service_name` to the suffix, so case
 * and camelCase differences vs the service name are reconciled there).
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

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
type AnyEl = UMLElement & {
  isAgentic?: boolean;
  flowType?: string;
  // read on BPMN tasks to pick the reflection scaffold ('none' = skip).
  reflectionMode?: 'none' | 'self' | 'cross' | 'human';
  // reviewer lane UUID for cross-reflection (absent = placeholder).
  reflectionReviewerLaneId?: string;
  // read on BPMN gateways to detect a governed merge.
  gatewayRole?: 'diverging' | 'merging';
  governanceDsl?: string;
  // the lane's linked Agent diagram UUID (a2a `ref=`).
  agentDiagramRef?: string;
  bounds: Bounds;
};

export function laneToAgentModel(bpmn: UMLModel, laneId: string): AgentDerivationResult {
  const warnings: AgentDerivationWarning[] = [];

  if (bpmn.type !== UMLDiagramType.BPMN) return { ok: false, reason: 'not-a-bpmn-diagram', warnings };

  const lane = bpmn.elements[laneId] as AnyEl | undefined;
  if (!lane || lane.type !== 'BPMNSwimlane') return { ok: false, reason: 'lane-not-found', warnings };
  if (!lane.isAgentic) return { ok: false, reason: 'lane-not-agentic', warnings };

  // Tasks owned by this lane, in BPMN reading order (x then y).
  const tasks = (Object.values(bpmn.elements) as AnyEl[])
    .filter((e) => e.type === 'BPMNTask' && e.owner === laneId)
    .sort((a, b) => a.bounds.x - b.bounds.x || a.bounds.y - b.bounds.y);
  if (tasks.length === 0) return { ok: false, reason: 'no-tasks-in-lane', warnings };

  const out = emptyAgentModel(bpmn.size);
  const elementMapping: ElementLineageMap = {};

  // 1) one AgentState per task, stacked vertically.
  const stateIdByTask = new Map<string, string>();
  tasks.forEach((t, i) => {
    const id = newId();
    out.elements[id] = {
      id,
      name: sanitizeStateName(t.name || 'State'),
      type: 'AgentState',
      owner: null,
      bounds: { x: 0, y: i * (STATE_H + V_GAP), width: STATE_W, height: STATE_H },
      bodies: [],
      fallbackBodies: [],
    } as unknown as UMLElement;
    stateIdByTask.set(t.id, id);
    elementMapping[id] = t.id; // lineage: AgentState ← source task
  });
  // execution carrier for outbound A2A. Defaults to the base task-state and
  // may be overridden by reflection scaffolds (self → <task>_reflect). Inbound
  // A2A still targets the base task-state via stateIdByTask.
  const outboundCarrierStateIdByTask = new Map(stateIdByTask);

  // governed merging gateways OWNED by this lane: a BPMNGateway with
  // gatewayRole 'merging' carrying a non-empty governanceDsl. Each becomes a
  // dedicated "Address merge decision" AgentState (the bound merge state, merge-state materialization) with
  // GUARDED inbound transitions (the flags, guard derivation). They must NOT be collapsed by
  // collapseGatewayEdges, so collect their ids first and exclude them from the
  // gateway-collapse walk below.
  const taskIds = new Set(tasks.map((t) => t.id));
  const governedMerges = (Object.values(bpmn.elements) as AnyEl[]).filter(
    (e) =>
      e.type === 'BPMNGateway' &&
      e.owner === laneId &&
      e.gatewayRole === 'merging' &&
      typeof e.governanceDsl === 'string' &&
      e.governanceDsl.trim().length > 0,
  );
  const governedMergeIds = new Set(governedMerges.map((g) => g.id));

  // 2) intra-lane sequence flows → transitions (collapsing in-lane gateways,
  // EXCEPT governed merges which are materialized as merge states below).
  const edges = collapseGatewayEdges(bpmn, laneId, taskIds, governedMergeIds);
  const seen = new Set<string>();
  for (const { from, to } of edges) {
    const s = stateIdByTask.get(from);
    const t = stateIdByTask.get(to);
    if (!s || !t || s === t) continue;
    const key = `${s} ${t}`;
    if (seen.has(key)) continue;
    seen.add(key);
    emitTransition(out, s, t, 'AgentStateTransition', 'vertical');
  }

  // 3) entry tasks (no intra-lane predecessor).
  const hasPred = new Set(edges.map((e) => e.to));
  const entries = tasks.filter((t) => !hasPred.has(t.id));
  const entryTasks = entries.length > 0 ? entries : [tasks[0]]; // pure-cycle fallback

  const entryStateId = stateIdByTask.get(entryTasks[0].id)!;

  // BAF greeting wrapper: a thin initial state so the agent never enters an
  // LLM-body state on session start (session.event is None then → AttributeError
  // in reply_llm.predict). StateInitialNode → greeting → first-entry via
  // when_no_intent_matched.
  // created BEFORE the reflection pass: cross-reflection now hangs its
  // inbound a2a:in intent edge off `greetId` (like appendCrossLaneIO), so the
  // greeting must already exist. The reflection re-route only deletes
  // task-state→task-state edges, so init→greeting is never disturbed.
  const greetName = sanitizeStateName((lane.name || 'Agent') + '_greet');
  const greetId = newId();
  const greetY = -(STATE_H + V_GAP); // one layout-row above first task (y=0)
  out.elements[greetId] = {
    id: greetId,
    name: greetName,
    type: 'AgentState',
    owner: null,
    bounds: { x: 0, y: greetY, width: STATE_W, height: STATE_H },
    bodies: [],
    fallbackBodies: [],
  } as unknown as UMLElement;
  const initId = newId();
  out.elements[initId] = {
    id: initId,
    name: '',
    type: 'StateInitialNode',
    owner: null,
    bounds: { x: -110, y: greetY - 2, width: INIT_SIZE, height: INIT_SIZE },
  } as unknown as UMLElement;
  emitTransition(out, initId, greetId, 'AgentStateTransitionInit', 'horizontal');

  // reflection scaffolds. self/human splice intra-agent states
  // after the task-state. cross is inter-agent → A2A: no new state, an a2a:out
  // tag on the producing state + a greeting→next when_intent_matched edge
  // (intentName recv_reviewer_<task>) + an AgentIntent scaffold. Returns the
  // states it wired an intent edge into (unioned into the cold-start guard).
  const reflectIntentTargets = appendReflectionScaffolds(
    out,
    tasks,
    stateIdByTask,
    greetId,
    elementMapping,
    bpmn.elements,
    outboundCarrierStateIdByTask,
  );

  // materialize a dedicated "Address merge decision" AgentState per
  // governed merging gateway owned by this lane. The BINDING BESSER reads
  // (`_merge_state_for_gateway`) is an `a2a:in;…;flow=<gateway-id>` edge whose
  // target_state is the merge state — so each CROSS-lane producer flow feeding the
  // gateway becomes a greeting→S_G `when_intent_matched` edge with `flow=<G.id>`
  // (the binding + the flag). In-lane producers become intra-lane GUARDED
  // transitions (when_variable_operation_matched / custom). Runs BEFORE
  // appendCrossLaneIO (which must skip flows feeding a governed merge) and needs
  // greetId for the a2a:in edges.
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
  );

  // Cross-lane I/O. Inbound from an AGENTIC peer → a
  // when_intent_matched edge greeting → consuming task (intentName recv_<peer>,
  // hidden a2a:in tag in `name`) + a scaffolded AgentIntent. Inbound from a
  // non-agentic lane / start event → nothing.
  // Outbound follows outboundCarrierStateIdByTask, so self-reflective
  // tasks send from <task>_reflect while preserving the existing a2a:out grammar.
  // Runs BEFORE the cold-start so
  // we can suppress the cold-start when the entry task already has an intent
  // transition (prevents two visually-identical arrows from greeting → entry).
  // `governedMergeIds`: a cross-lane producer flow whose target is a governed
  // merge is owned by the merge wiring above, NOT routed to a consuming task here.
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

  // Cold-start is suppressed when the entry state already received an
  // agentic-inbound intent transition (from cross-lane I/O OR cross-reflection);
  // they would otherwise visually overlap. When no intents exist (non-swarm
  // agent), the cold-start is still needed so BAF can leave greeting on session
  // start (None event).
  const intentTargetStates = new Set<string>([...reflectIntentTargets, ...ioIntentTargets]);
  if (!intentTargetStates.has(entryStateId)) {
    emitTransition(out, greetId, entryStateId, 'AgentStateTransition', 'vertical', 'when_no_intent_matched');
  }

  // Final layout normalization: straddle the origin so the diagram
  // opens centered (mirrors bpmn-to-component recenterModelOnOrigin).
  recenterAgentModel(out);

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
  } as unknown as UMLModel;
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
  const seqFlows = (Object.values(bpmn.relationships) as Array<UMLRelationship & { flowType?: string }>).filter(
    (r) => r.type === 'BPMNFlow' && r.flowType === 'sequence',
  );
  // outgoing adjacency by source node id
  const outAdj = new Map<string, string[]>();
  for (const f of seqFlows) {
    const arr = outAdj.get(f.source.element) ?? [];
    arr.push(f.target.element);
    outAdj.set(f.source.element, arr);
  }
  const isLaneGateway = (id: string): boolean => {
    const el = bpmn.elements[id] as AnyEl | undefined;
    return !!el && el.type === 'BPMNGateway' && el.owner === laneId;
  };
  // walk forward from a node to the set of tasks-in-lane reachable through
  // lane gateways only (no cross-lane traversal).
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
      // a governed merge is a hard stop: do not expand through it, so the
      // producer→(through G)→downstream collapsed edge is NOT created (the merge
      // state owns that wiring). A non-governed gateway collapses as before.
      if (isLaneGateway(n) && !governedMergeIds.has(n)) for (const nxt of outAdj.get(n) ?? []) stack.push(nxt);
      // anything else (cross-lane node, event) is a dead end for v1 core.
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

function emitTransition(
  out: UMLModel,
  srcId: string,
  tgtId: string,
  type: 'AgentStateTransition' | 'AgentStateTransitionInit',
  orientation: 'vertical' | 'horizontal',
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
  const id = newId();
  const sb = (out.elements[srcId] as unknown as { bounds: Bounds }).bounds;
  const tb = (out.elements[tgtId] as unknown as { bounds: Bounds }).bounds;
  const p0 =
    orientation === 'vertical'
      ? { x: sb.x + sb.width / 2, y: sb.y + sb.height }
      : { x: sb.x + sb.width, y: sb.y + sb.height / 2 };
  const p1 = orientation === 'vertical' ? { x: tb.x + tb.width / 2, y: tb.y } : { x: tb.x, y: tb.y + tb.height / 2 };

  // A custom-condition guard takes precedence: it serializes as a `custom`
  // transition (transitionType 'custom' + custom.condition), not a predefined one.
  // A when_variable_operation_matched guard rides predefined.conditionValue (an
  // object) AND the top-level variable/operator/targetValue mirror (the
  // AgentStateTransition constructor reads the top-level fields on first load,
  // deserialize reads predefined.conditionValue — set both for
  // intentName).
  const isCustom = !!opts?.customConditions && opts.customConditions.length > 0;
  let typeFields: Record<string, unknown> = {};
  if (isCustom) {
    typeFields = {
      transitionType: 'custom' as const,
      predefined: { predefinedType: '' },
      custom: { event: 'None', condition: opts!.customConditions as string[] },
    };
  } else if (predefinedType !== undefined) {
    let predefined: Record<string, unknown>;
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
    // when_no_intent_matched (and other predefined types) need these fields
    // so the BESSER backend's AgentStateTransition deserializer reads the correct
    // predefinedType instead of falling back to 'when_intent_matched'.
    // intentName must also be at top-level for the constructor path.
    typeFields = {
      transitionType: 'predefined' as const,
      predefined,
      ...(opts?.intentName !== undefined ? { intentName: opts.intentName } : {}),
      ...(predefinedType === 'when_variable_operation_matched'
        ? { variable: opts?.variable ?? '', operator: opts?.operator ?? '', targetValue: opts?.targetValue ?? '' }
        : {}),
      custom: { condition: [] as string[] },
    };
  }

  out.relationships[id] = {
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
    source: { element: srcId, direction: orientation === 'vertical' ? 'Down' : 'Right' },
    target: { element: tgtId, direction: orientation === 'vertical' ? 'Up' : 'Left' },
    isManuallyLayouted: false,
    ...typeFields,
  } as unknown as UMLRelationship;
  return id;
}

// ── Cross-lane I/O (replaces boundary states) ──────────────────────

/**
 * For every flow crossing the lane boundary:
 *  - INPUT (target in lane, source external) from an AGENTIC peer lane → a
 *    `when_intent_matched` transition greeting → consuming task-state, with a
 *    visible `recv_<peer>` intent and a hidden `a2a:in` tag in `name`; plus a
 *    deduped `AgentIntent` scaffold. Non-agentic / start-event source → skip
 *    (the greeting cold-start is the channel).
 *  - OUTPUT (source in lane, target external) → append an `a2a:out` line to the
 *    producing outbound-carrier state's `description` (kind omitted for
 *    non-agentic peers).
 * Pure model mutation; lineage stamped for inbound transitions.
 * Returns the set of task-state IDs that received a when_intent_matched
 * transition from greetId (used to suppress the cold-start for those states).
 */
function appendCrossLaneIO(
  out: UMLModel,
  bpmn: UMLModel,
  lane: AnyEl,
  laneId: string,
  taskIds: Set<string>,
  stateIdByTask: Map<string, string>,
  outboundCarrierStateIdByTask: Map<string, string>,
  greetId: string,
  elementMapping: ElementLineageMap,
  warnings: AgentDerivationWarning[],
  governedMergeIds: Set<string>, // flows feeding these are owned by the merge wiring
): Set<string> {
  const flows = (Object.values(bpmn.relationships) as Array<UMLRelationship & { flowType?: string }>).filter(
    (r) => r.type === 'BPMNFlow' && (r.flowType === 'sequence' || r.flowType === 'message'),
  );

  const intentIdByName = new Map<string, string>(); // dedup scaffolded AgentIntents
  // reflection scaffolds run first and may have placed AgentIntents in the
  // same INTENT_COL_X column; start below them so rows don't overlap.
  let intentRow = Object.values(out.elements).filter((e) => e.type === 'AgentIntent').length;
  const intentTargetStates = new Set<string>(); // states that received a when_intent_matched edge

  for (const f of flows) {
    const sourceIsInLane = isInLaneNode(bpmn, laneId, f.source.element);
    const targetIsInLane = isInLaneNode(bpmn, laneId, f.target.element);

    // INPUT: target in lane, source external.
    if (targetIsInLane && !sourceIsInLane) {
      // a cross-lane producer flow whose target IS a governed merge gateway
      // is wired into the merge state (with flow=<gateway-id>) by
      // appendGovernedMergeStates, not routed to a consuming task here.
      if (governedMergeIds.has(f.target.element)) continue;
      const peerLane = externalLaneElement(bpmn, f.source.element);
      // the non-agentic fallback path: only an AGENTIC peer lane becomes an A2A intent; everything else
      // (pool, start event, human/external lane) folds into the cold-start.
      if (!peerLane || peerLane.isAgentic !== true) continue;
      const peerName = externalName(bpmn, f.source.element);
      const consuming = inLaneTasks(bpmn, laneId, taskIds, f.target.element, 'forward');
      if (consuming.length === 0) {
        warnings.push({ kind: 'io-attached-to-entry', flowId: f.id });
        continue; // unresolved agentic input: cold-start covers the entry
      }
      const kind = resolveEdgeKind(peerLane as UMLElement, lane as UMLElement, undefined);
      const ref = peerLane.agentDiagramRef;
      const tag = a2aTag({ dir: 'in', peer: peerName, ref, flow: f.id, kind });
      // one intent per (peer, consuming task): recv_<peer>_<task>
      for (const taskId of consuming) {
        const sId = stateIdByTask.get(taskId)!;
        const taskName = sanitizeStateName((bpmn.elements[taskId] as AnyEl).name || 'Task');
        const intent = recvIntentName(peerName, taskName);
        if (!intentIdByName.has(intent)) {
          intentIdByName.set(intent, createIntentScaffold(out, intent, peerName, intentRow++));
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
      // outbound execution ownership is not always the base task-state.
      // Self-reflection upgrades the producing carrier to <task>_reflect; all
      // other tasks fall back to the base state.
      const states =
        producing.length > 0
          ? producing.map((t) => outboundCarrierStateIdByTask.get(t) || stateIdByTask.get(t)!)
          : [];
      if (states.length === 0) {
        warnings.push({ kind: 'io-attached-to-entry', flowId: f.id });
        continue;
      }
      const peerLane = externalLaneElement(bpmn, f.target.element);
      const peerName = externalName(bpmn, f.target.element);
      const kind =
        peerLane && peerLane.isAgentic === true
          ? resolveEdgeKind(lane as UMLElement, peerLane as UMLElement, undefined)
          : undefined; // non-agentic sink → plain channel, no kind
      const ref = peerLane?.agentDiagramRef;
      for (const sId of states) {
        const el = out.elements[sId] as unknown as { description?: string };
        const tag = a2aTag({ dir: 'out', peer: peerName, ref, flow: f.id, order: nextOutOrder(el.description), kind });
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
 * Name: "Address_merge_decision" (sanitized — BAF rejects spaces; the BESSER
 * design's literal "Address merge decision" maps to this token). When the lane
 * owns >1 governed merge, suffix `__<gateway label|short id>` so names stay
 * DISTINCT (BAF state names are the identity key).
 *
 * BINDING (the contract BESSER's `_merge_state_for_gateway` reads): an
 * `a2a:in;peer=<producer>;ref=<…|>;flow=<G.id>;[kind=…]` transition whose
 * target_state is S_G. The `flow` is the GATEWAY id (NOT a sequence-flow id), so
 * BESSER resolves gateway → state by marker. These edges are produced from the
 * gateway's incoming flows:
 *  - CROSS-lane producer (source resolves to another agentic lane) → a
 *    greeting→S_G `when_intent_matched` edge carrying the `a2a:in;flow=<G.id>`
 *    tag + a deduped AgentIntent. This is simultaneously the binding AND a
 *    when_intent_matched guard (the flag).
 *  - IN-lane producer → an intra-lane GUARDED transition producer-state→S_G
 *    (when_variable_operation_matched / custom / when_no_intent_matched, from the
 *    flow's condition label). These are flags but NOT the binding.
 * If no cross-lane producer emitted an `a2a:in;flow=<G.id>` edge (in-lane-only or
 * producerless merge), synthesize ONE self-peer `a2a:in;…;flow=<G.id>` marker
 * edge so the binding still resolves.
 *
 * Outbound: for each flow OUT of G, S_G → in-lane successor(s) (when_no_intent_matched).
 * Lineage: S_G ← G; each inbound ← its inducing flow (the self-peer marker ← G).
 * No-op when the lane owns no governed merge (legacy diagrams unchanged).
 */
function appendGovernedMergeStates(
  out: UMLModel,
  bpmn: UMLModel,
  lane: AnyEl,
  laneId: string,
  taskIds: Set<string>,
  governedMerges: AnyEl[],
  stateIdByTask: Map<string, string>,
  greetId: string,
  elementMapping: ElementLineageMap,
  warnings: AgentDerivationWarning[],
): void {
  if (governedMerges.length === 0) return;
  const multiple = governedMerges.length > 1;
  const usedNames = new Set<string>(
    (Object.values(out.elements) as AnyEl[]).filter((e) => e.type === 'AgentState').map((e) => e.name),
  );
  const seqFlows = (Object.values(bpmn.relationships) as Array<UMLRelationship & { flowType?: string }>).filter(
    (r) => r.type === 'BPMNFlow' && r.flowType === 'sequence',
  );
  const intentIdByName = new Map<string, string>(); // dedup scaffolded AgentIntents
  let intentRow = Object.values(out.elements).filter((e) => e.type === 'AgentIntent').length;

  governedMerges.forEach((g, idx) => {
    // distinct, sanitized name
    let name = 'Address_merge_decision';
    if (multiple) name = `${name}__${sanitizeStateName(g.name || g.id.slice(-6))}`;
    let bump = 0;
    while (usedNames.has(name)) name = `Address_merge_decision__${sanitizeStateName(g.id.slice(-6))}_${bump++}`;
    usedNames.add(name);

    const mergeId = newId();
    out.elements[mergeId] = {
      id: mergeId,
      name,
      type: 'AgentState',
      owner: null,
      bounds: { x: MERGE_COL_X, y: idx * (STATE_H + V_GAP), width: STATE_W, height: STATE_H },
      bodies: [],
      fallbackBodies: [],
    } as unknown as UMLElement;
    elementMapping[mergeId] = g.id; // lineage: merge state ← gateway

    // helper: scaffold (deduped) an AgentIntent for an a2a:in edge into S_G.
    const ensureIntent = (intent: string, peerName: string): string => {
      if (!intentIdByName.has(intent)) {
        intentIdByName.set(intent, createIntentScaffold(out, intent, peerName, intentRow++));
      }
      return intent;
    };

    // Inbound: producers feeding the gateway. Cross-lane → a2a:in;flow=<G.id>
    // (the binding + flag); in-lane → intra-lane guarded transition.
    let producerCount = 0;
    let boundViaA2aIn = false;
    for (const f of seqFlows.filter((r) => r.target.element === g.id)) {
      const inLaneProducers = inLaneTasks(bpmn, laneId, taskIds, f.source.element, 'backward');
      if (inLaneProducers.length > 0) {
        // IN-lane producer(s) → intra-lane GUARDED transition (flag, not binding).
        const guard = deriveGuard((f as UMLRelationship & { name?: string }).name);
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
      // CROSS-lane producer → a2a:in greeting→S_G with flow=<G.id> (the BINDING).
      const peerLane = externalLaneElement(bpmn, f.source.element);
      const peerName = externalName(bpmn, f.source.element);
      const kind =
        peerLane && peerLane.isAgentic === true
          ? resolveEdgeKind(peerLane as UMLElement, lane as UMLElement, undefined)
          : undefined; // non-agentic producer → plain channel, no kind
      const ref = peerLane?.agentDiagramRef;
      const tag = a2aTag({ dir: 'in', peer: peerName, ref, flow: g.id, kind });
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

    // Binding guarantee: if no cross-lane a2a:in edge carries flow=<G.id> (in-lane
    // -only or producerless merge), synthesize one self-peer marker so BESSER's
    // _merge_state_for_gateway still resolves gateway → S_G.
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

    // unguarded outbound — successors of the gateway.
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

/**
 * a scaffolded `AgentIntent` element (intent binding) so `when_intent_matched` binds
 * to a declared intent. Placeholder description; user adds training phrases.
 * Laid out in a column left of the greeting/init node.
 */
function createIntentScaffold(out: UMLModel, intentName: string, peerName: string, row: number): string {
  const id = newId();
  out.elements[id] = {
    id,
    name: intentName,
    type: 'AgentIntent',
    owner: null,
    bounds: { x: INTENT_COL_X, y: row * (STATE_H + V_GAP), width: STATE_W, height: STATE_H },
    bodies: [],
    intent_description: `Incoming message from ${peerName} (auto-scaffolded; add training phrases).`,
  } as unknown as UMLElement;
  return id;
}

/**
 * True iff the node belongs to the lane. Membership is by OWNERSHIP, not element
 * type: a lane owns its flow nodes — tasks, gateways AND events (start/end/
 * intermediate). the event-intermediate case — the pre-fix test recognized only tasks/gateways, so a
 * lane's own `BPMNStartEvent` read as *external*; the intra-lane `StartEvent →
 * entryTask` flow was then misclassified as a cross-lane INPUT and produced a
 * self-referential `from_<thisLane>` boundary (e.g. `from_supervisor` in the
 * Supervisor's own diagram). Owner-based membership makes a same-lane flow never a
 * crossing, so no `from_<self>` (or `to_<self>` for an in-lane end event) is emitted.
 * A flow node owned by ANOTHER lane (incl. that lane's start event) is still
 * external, so a genuine cross-lane `from_<OtherLane>` is unaffected.
 */
function isInLaneNode(bpmn: UMLModel, laneId: string, nodeId: string): boolean {
  const el = bpmn.elements[nodeId] as (UMLElement & { owner?: string }) | undefined;
  return !!el && el.owner === laneId;
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
  const el = bpmn.elements[nodeId] as (UMLElement & { owner?: string }) | undefined;
  if (!el || el.type !== 'BPMNGateway' || el.owner !== laneId) return [];
  const flows = (Object.values(bpmn.relationships) as Array<UMLRelationship & { flowType?: string }>).filter(
    (r) => r.type === 'BPMNFlow' && r.flowType === 'sequence',
  );
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
      const nel = bpmn.elements[nx] as (UMLElement & { owner?: string }) | undefined;
      if (taskIds.has(nx)) found.add(nx);
      else if (nel?.type === 'BPMNGateway' && nel.owner === laneId) stack.push(nx);
    }
  }
  return [...found];
}

/**
 * Human-readable name for an external endpoint, lane-first: the
 * swimlane it belongs to (the *other agent*), else its pool, else the element's
 * own name, else 'External'. Walks the full owner chain (task→lane→pool
 * or task→pool) instead of only the direct owner, so a nested endpoint still
 * resolves to its lane. NOTE: when the external node isn't linked to a lane at
 * all (e.g. a free-floating task, owner unset), this correctly falls through to
 * the node's own name — that is why IO-1 ("from <task>") and IO-6 ("from <lane>")
 * can differ: it reflects what the crossing flow was actually drawn to.
 */
function externalName(bpmn: UMLModel, nodeId: string): string {
  const el = bpmn.elements[nodeId] as (UMLElement & { owner?: string }) | undefined;
  if (!el) return 'External';
  if (el.type === 'BPMNSwimlane') return el.name || 'External';
  if (el.type === 'BPMNPool') return el.name || 'External';
  let firstPool: (UMLElement & { owner?: string }) | undefined;
  const guard = new Set<string>();
  let cur = el.owner ? (bpmn.elements[el.owner] as (UMLElement & { owner?: string }) | undefined) : undefined;
  while (cur && !guard.has(cur.id)) {
    guard.add(cur.id);
    if (cur.type === 'BPMNSwimlane') return cur.name || 'External'; // the other agent
    if (cur.type === 'BPMNPool' && !firstPool) firstPool = cur;
    cur = cur.owner ? (bpmn.elements[cur.owner] as (UMLElement & { owner?: string }) | undefined) : undefined;
  }
  if (firstPool) return firstPool.name || 'External';
  return el.name || 'External';
}

/**
 * The external endpoint's owning agentic *lane* element (a BPMNSwimlane),
 * walking the full owner chain like externalName. Returns undefined when the
 * endpoint resolves to a pool / start event / unlinked node — those are NOT
 * agentic peers, so inbound falls back to cold-start. The agentic check is the
 * caller's (resolveEdgeKind already returns 'delegates' for non-agentic, but we
 * gate inbound on isAgentic so a human/external lane stays a cold-start).
 */
function externalLaneElement(
  bpmn: UMLModel,
  nodeId: string,
): (UMLElement & { isAgentic?: boolean; role?: unknown; agentDiagramRef?: string }) | undefined {
  const el = bpmn.elements[nodeId] as (UMLElement & { owner?: string }) | undefined;
  if (!el) return undefined;
  if (el.type === 'BPMNSwimlane') return el as never;
  const guard = new Set<string>();
  let cur = el.owner ? (bpmn.elements[el.owner] as (UMLElement & { owner?: string }) | undefined) : undefined;
  while (cur && !guard.has(cur.id)) {
    guard.add(cur.id);
    if (cur.type === 'BPMNSwimlane') return cur as never;
    cur = cur.owner ? (bpmn.elements[cur.owner] as (UMLElement & { owner?: string }) | undefined) : undefined;
  }
  return undefined;
}

/**
 * Synthetic visible intent name: `recv_<peer>_<task>` so a peer
 * feeding two different task-states yields two unambiguous intents.
 * Sanitized to BAF's identifier charset.
 */
function recvIntentName(peerName: string, taskName: string): string {
  return sanitizeStateName('recv_' + peerName + '_' + taskName);
}

/** WME→BESSER A2A wire tag. Empty fields are omitted. */
function a2aTag(parts: {
  dir: 'in' | 'out';
  peer: string;
  ref?: string;
  flow: string;
  order?: number;
  kind?: AgenticEdgeKind;
}): string {
  const seg = [`a2a:${parts.dir}`, `peer=${parts.peer}`, `ref=${parts.ref ?? ''}`, `flow=${parts.flow}`];
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

/**
 * Translate the whole model so its bounding-box midpoint sits on the
 * origin. The editor sizes the canvas symmetrically around (0,0) and the scroll
 * container opens at top-left (uml-diagram.ts), so off-origin content opens
 * scrolled into empty space. Mirrors bpmn-to-component's recenterModelOnOrigin:
 * translates element bounds + relationship bounds/path by the same delta so
 * edges stay attached. No-op for already-origin-centered output.
 */
function recenterAgentModel(out: UMLModel): void {
  const els = Object.values(out.elements);
  if (els.length === 0) return;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const e of els) {
    const b = (e as unknown as { bounds: Bounds }).bounds;
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }
  const dx = -(minX + maxX) / 2;
  const dy = -(minY + maxY) / 2;
  if (dx === 0 && dy === 0) return;
  for (const e of els) {
    const b = (e as unknown as { bounds: Bounds }).bounds;
    b.x += dx;
    b.y += dy;
  }
  for (const r of Object.values(out.relationships)) {
    const rel = r as unknown as { bounds: { x: number; y: number }; path?: Array<{ x: number; y: number }> };
    rel.bounds.x += dx;
    rel.bounds.y += dy;
    if (rel.path)
      for (const p of rel.path) {
        p.x += dx;
        p.y += dy;
      }
  }
}

// ── 39 (4c): reflection scaffolds ───────────────────────────────────

/**
 * a self-loop transition on `stateId` (source === target). `emitTransition`
 * can't draw a loop — its two-point path would collapse to a line over the
 * element — so this routes a small loop out the right edge and back. Generic
 * `when_intent_matched` (no `predefinedType`) → the user names the intent (e.g.
 * "revise"). `isManuallyLayouted: true` so the loop path is preserved on first
 * open.
 */
function emitSelfLoop(out: UMLModel, stateId: string): void {
  const id = newId();
  const b = (out.elements[stateId] as unknown as { bounds: Bounds }).bounds;
  // Exit from the BOTTOM center and re-enter at the RIGHT center, tracing an
  // L-shape below-then-right of the state. Using asymmetric source/target
  // directions means the path clears the agent-robot icon at the top-right
  // corner and is immediately draggable.
  const bottom = b.y + b.height;
  const right = b.x + b.width;
  const midX = b.x + b.width / 2;
  const midY = b.y + b.height / 2;
  const loop = 30;
  const path = [
    { x: midX, y: bottom }, // exit bottom-center
    { x: midX, y: bottom + loop }, // go down
    { x: right + loop, y: bottom + loop }, // go right past the edge
    { x: right + loop, y: midY }, // go up to mid-height
    { x: right, y: midY }, // arrive at right-center
  ];
  out.relationships[id] = {
    id,
    name: '',
    type: 'AgentStateTransition',
    owner: null,
    bounds: { x: midX, y: midY, width: b.width / 2 + loop, height: b.height / 2 + loop },
    path,
    source: { element: stateId, direction: 'Down' },
    target: { element: stateId, direction: 'Right' },
    isManuallyLayouted: true,
  } as unknown as UMLRelationship;
}

/**
 * Activate the SEAA'25 `reflectionMode` field as a live consumer of the
 * lane→Agent derivation. For each
 * task with `reflectionMode !== 'none'`, splice reflection states AFTER the task's
 * state, re-routing the task's forward transition(s) through them:
 *
 *  - 'self'  → a `<task>_reflect` self-evaluation state. task → reflect
 *             (when_no_intent_matched), a self-loop on reflect ("revise"), and
 *             reflect → next ("approve"). User adds the LLM body + intent names.
 *  - 'cross' → inter-agent A2A (no new state). The producing state's
 *             `description` gets an a2a:out;peer=reviewer;…;kind=revises tag, and
 *             each forward `next` gets a greeting→next when_intent_matched edge
 *             (intentName recv_reviewer_<task>, hidden a2a:in tag in `name`) plus
 *             a deduped AgentIntent scaffold. Terminal cross task → outbound tag
 *             only. Returns the set of states wired an inbound intent edge.
 *  - 'human' → a `<task>_human_review` wait state. task → human_review
 *             (when_no_intent_matched), human_review → next ("approved"), and
 *             human_review → task ("rejected", loops back for revision).
 *
 * Re-route = delete the task's existing forward edges to OTHER task-states and
 * re-emit them off the reflection exit (no double path). Boundary edges (target
 * not a task-state) and the task's incoming edges are left intact. self/human
 * states are synthetic → no `elementMapping` entry; the cross
 * inbound intent edge IS lineaged to its inducing task.
 */
function appendReflectionScaffolds(
  out: UMLModel,
  tasks: AnyEl[],
  stateIdByTask: Map<string, string>,
  greetId: string,
  elementMapping: ElementLineageMap,
  bpmnElements: UMLModel['elements'],
  outboundCarrierStateIdByTask: Map<string, string>,
): Set<string> {
  const taskStateIds = new Set(stateIdByTask.values());
  // States that received a greeting→next when_intent_matched edge from a
  // cross-reflection (unioned into the cold-start guard by the caller).
  const reflectIntentTargets = new Set<string>();
  // Deduplicate AgentIntent scaffolds per intentName across all cross tasks; the
  // map size also drives the intent-column row for new scaffolds.
  const reflectIntentIds = new Map<string, string>();
  for (const t of tasks) {
    const mode = t.reflectionMode ?? 'none';
    if (mode === 'none') continue;
    const sT = stateIdByTask.get(t.id);
    if (!sT) continue;
    const taskName = sanitizeStateName(t.name || 'Task');
    const sb = (out.elements[sT] as unknown as { bounds: Bounds }).bounds;

    // Capture + remove the task-state's forward transitions to OTHER task-states
    // (re-routed through the reflection states below). Object.entries snapshots,
    // so deleting during the loop is safe. Boundary/self edges are skipped.
    const nexts: string[] = [];
    for (const [rid, rel] of Object.entries(out.relationships)) {
      const r = rel as unknown as UMLRelationship;
      if (r.type !== 'AgentStateTransition') continue;
      if (r.source.element !== sT || r.target.element === sT) continue;
      if (!taskStateIds.has(r.target.element)) continue;
      nexts.push(r.target.element);
      delete out.relationships[rid];
    }

    if (mode === 'self') {
      const reflectId = newId();
      out.elements[reflectId] = {
        id: reflectId,
        name: `${taskName}_reflect`,
        type: 'AgentState',
        owner: null,
        bounds: { x: REFLECT_COL_X, y: sb.y, width: STATE_W, height: STATE_H },
        bodies: [],
        fallbackBodies: [],
      } as unknown as UMLElement;
      // self-reflection is the post-task approval/revision gate. Downstream
      // outbound A2A must execute from <task>_reflect, not from the base
      // task-state, so hand off the outbound carrier here.
      outboundCarrierStateIdByTask.set(t.id, reflectId);
      emitTransition(out, sT, reflectId, 'AgentStateTransition', 'horizontal', 'when_no_intent_matched');
      emitSelfLoop(out, reflectId); // generic intent — user names it "revise"
      for (const n of nexts) emitTransition(out, reflectId, n, 'AgentStateTransition', 'vertical'); // generic — "approve"
    } else if (mode === 'human') {
      const humanId = newId();
      out.elements[humanId] = {
        id: humanId,
        name: `${taskName}_human_review`,
        type: 'AgentState',
        owner: null,
        bounds: { x: REFLECT_COL_X, y: sb.y, width: STATE_W, height: STATE_H },
        bodies: [],
        fallbackBodies: [],
      } as unknown as UMLElement;
      emitTransition(out, sT, humanId, 'AgentStateTransition', 'horizontal', 'when_no_intent_matched');
      for (const n of nexts) emitTransition(out, humanId, n, 'AgentStateTransition', 'vertical'); // generic — "approved"
      emitTransition(out, humanId, sT, 'AgentStateTransition', 'horizontal'); // generic — "rejected" loop back
    } else if (mode === 'cross') {
      // resolve the chosen reviewer lane (if set); fall back to placeholder.
      const reviewerLaneId = t.reflectionReviewerLaneId;
      const reviewerEl = reviewerLaneId ? (bpmnElements[reviewerLaneId] as AnyEl | undefined) : undefined;
      const reviewerName = reviewerEl ? sanitizeStateName(reviewerEl.name || 'reviewer') : 'reviewer';
      const reviewerRef = reviewerLaneId;

      // A2A round-trip (no new state):
      //  (a) a2a:out tag on the producing state; peer=<reviewer lane name> or
      //      peer=reviewer (placeholder), ref=<laneId or empty>.
      //  (b) for each forward `next`: greeting→next when_intent_matched edge +
      //      deduped AgentIntent scaffold. Terminal cross task → (a) only.
      //      The inbound edge is lineaged to the inducing task.
      const outEl = out.elements[sT] as unknown as { description?: string };
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
        const intent = recvIntentName(reviewerName, taskName);
        if (!reflectIntentIds.has(intent)) {
          reflectIntentIds.set(intent, createIntentScaffold(out, intent, reviewerName, reflectIntentIds.size));
        }
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
