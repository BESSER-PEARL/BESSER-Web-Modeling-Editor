import type { UMLModel, UMLElement, UMLRelationship } from '@besser/wme';
import { UMLDiagramType, componentStereotypeForLaneRole, isSupervisorRole } from '@besser/wme';
import type { ElementLineageMap } from '../../shared/types/project';
import type { DerivationResult, DerivationWarning } from './types';

type LaneCrossingFlow = {
  flowId: string;
  srcLaneId: string;
  tgtLaneId: string;
  // Gateway-as-lane-proxy: the gateway that mediates this edge, if either
  // endpoint was a gateway. Consumed by resolveEdgeKind to detect a
  // role-cooperation merge → supervises.
  gatewayId?: string;
};

export type AgenticEdgeKind = 'delegates' | 'supervises' | 'revises' | 'collaborates';

export type DerivationOpts = {
  /** id → model for every AgentDiagram in the project. Omitted →
   *  capability traversal is skipped entirely (back-compatible). */
  agentDiagramsById?: Map<string, UMLModel>;
  /** Opt-in. When false/undefined, no tool/skill Components are emitted and
   *  the output is byte-for-byte the no-capability derivation. When true,
   *  each agent's tools/skills are pooled into shared "Skills"/"Tools"
   *  Subsystems, deduped globally by name, with one has/uses edge per
   *  (agent, capability). */
  includeCapabilities?: boolean;
  /** The source BPMN diagram's ProjectDiagram id. When set, each agentic
   *  lane-Component is stamped with `processModelRefs = [id]` (BESSER
   *  `AgenticComponent.process_model_refs`, diagram-grained). Omitted →
   *  no refs emitted (back-compatible). */
  sourceDiagramId?: string;
};

export function bpmnModelToComponentModel(bpmn: UMLModel, opts?: DerivationOpts): DerivationResult {
  const warnings: DerivationWarning[] = [];
  // Diagram-grained ref carrier; stamped onto agentic lane-Components.
  const sourceDiagramId = opts?.sourceDiagramId;

  if (bpmn.type !== UMLDiagramType.BPMN) {
    return { ok: false, reason: 'not-a-bpmn-diagram', warnings };
  }

  const pools = collectPools(bpmn);
  if (pools.length === 0) {
    return { ok: false, reason: 'no-pools', warnings };
  }

  const lanesByPool = collectLanesByPool(bpmn, pools);
  const hasAnyLane = Array.from(lanesByPool.values()).some((ls) => ls.length > 0);
  if (!hasAnyLane) {
    return { ok: false, reason: 'no-lanes-in-any-pool', warnings };
  }

  const out = emptyComponentModel(bpmn.size);
  const layout = makeLayoutCursor();
  // derivedElementId → source BPMN element id. Synthetic external
  // Components leave no entry.
  const elementMapping: ElementLineageMap = {};

  // Subsystems + lane-Components.
  // Tasks are not represented in the Component diagram; only lane-to-lane
  // swarm structure matters.
  const componentIdByLaneId = new Map<string, string>();
  // Subsystem id per pool, so a message flow that lands on the
  // pool-as-whole resolves to the Subsystem (the swarm boundary) rather
  // than an inner lane Component.
  const subsystemIdByPoolId = new Map<string, string>();
  // Grouped mode defers capability emission: this pass fills the list, the
  // grouping pass drains it. Stays empty in per-agent mode.
  // `capabilitiesTopY` captures the first Subsystem's y NOW (before the
  // cursor advances) so the grouped zones can top-align with the swarm.
  const collectedCaps: CollectedCapability[] = [];
  const capabilitiesTopY = layout.subsystemY;
  for (const pool of pools) {
    const lanes = lanesByPool.get(pool.id) ?? [];
    if (lanes.length === 0) continue;

    // Only agentic lanes are agents → only they become Components.
    // Non-agentic lanes (humans, external actors) are skipped entirely.
    // Their tasks were never represented anyway — keep the advisory so the
    // user sees they were dropped.
    const agenticLanes = lanes.filter((l) => (l as unknown as { isAgentic?: boolean }).isAgentic === true);
    for (const lane of lanes) {
      if ((lane as unknown as { isAgentic?: boolean }).isAgentic === true) continue;
      for (const t of tasksInLane(bpmn, lane.id)) {
        warnings.push({ kind: 'dropped-task-in-non-agentic-lane', taskId: t.id });
      }
    }
    // A pool with no agentic lane is not part of the swarm view — emit no
    // Subsystem. A message flow that lands on one of its (skipped) lanes is
    // dropped; only a flow to a laneless black-box pool synthesises an
    // external Subsystem (see the message-flow pass below).
    if (agenticLanes.length === 0) continue;

    const subsystemId = emitSubsystem(out, pool, layout);
    elementMapping[subsystemId] = pool.id; // Subsystem ← source Pool
    subsystemIdByPoolId.set(pool.id, subsystemId);
    for (const lane of agenticLanes) {
      const laneCompId = emitLaneComponent(out, lane, subsystemId, layout, sourceDiagramId);
      componentIdByLaneId.set(lane.id, laneCompId);
      elementMapping[laneCompId] = lane.id; // Component ← source Lane

      if (opts?.includeCapabilities && opts.agentDiagramsById) {
        // An agentic lane = one agent. Collect its tasks' linked
        // Agent-diagram tools/skills (pooled in the grouping pass below).
        collectLaneCapabilities(bpmn, lane, laneCompId, opts.agentDiagramsById, collectedCaps, warnings);
      }
    }
    layout.endSubsystem();
  }

  // Grouped-capability layout — pool every agent's collected tools/skills
  // into shared "Skills"/"Tools" Subsystems (global dedup by name), placed
  // to the right of the swarm.
  if (opts?.includeCapabilities) {
    emitGroupedCapabilities(out, collectedCaps, layout, elementMapping, capabilitiesTopY, warnings);
  }

  // Lane-crossing sequence flows → ComponentDependency.
  const laneCrossings = collectLaneCrossingFlows(bpmn, lanesByPool);
  const dedup = new EdgeDedup();
  for (const crossing of laneCrossings) {
    const srcLane = bpmn.elements[crossing.srcLaneId];
    const tgtLane = bpmn.elements[crossing.tgtLaneId];
    const gateway = crossing.gatewayId ? bpmn.elements[crossing.gatewayId] : undefined;

    if (!srcLane || !tgtLane) continue;
    const kind = resolveEdgeKind(srcLane, tgtLane, gateway);

    const srcComp = componentIdByLaneId.get(crossing.srcLaneId);
    const tgtComp = componentIdByLaneId.get(crossing.tgtLaneId);
    if (!srcComp || !tgtComp) continue;
    dedup.add(srcComp, tgtComp, kind, crossing.flowId);
  }
  for (const e of dedup.entries()) {
    const edgeId = emitComponentDependency(out, e.srcCompId, e.tgtCompId, e.kind);
    elementMapping[edgeId] = e.sourceFlowId; // ComponentDependency ← source BPMNFlow
  }

  // Inter-pool message flows → ComponentDependency.
  // An endpoint that lands on a specific lane → that lane's Component; an
  // endpoint on a LANELESS black-box pool (header / black-box participant,
  // BPMN 2.0.2 § 9.2.1, or a shape in a laneless pool) → that pool's
  // synthesised Subsystem (the swarm boundary), emitted once.
  const resolveMessageEndpoint = (elementId: string): string | undefined => {
    const lane = laneForElement(bpmn, elementId);
    // If the endpoint is inside a lane, use that lane's Component. A skipped
    // non-agentic lane has no entry here → returns undefined → the caller
    // drops the flow (a non-agentic pool is never resurrected by a message
    // flow).
    if (lane) return componentIdByLaneId.get(lane.id);
    const el = bpmn.elements[elementId];
    const poolId = el ? poolFor(bpmn, el) : null;
    if (!poolId) return undefined;
    const existing = subsystemIdByPoolId.get(poolId);
    if (existing) return existing;
    // A pool reaches here only if it has NO agentic lane (else it already
    // owns a Subsystem above). Synthesise an external Subsystem ONLY when the
    // pool is a genuine laneless black-box participant. A pool that HAS lanes
    // but none agentic was deliberately skipped — a message flow to it (or to
    // its header/pool-as-whole) must NOT resurrect it as a Subsystem.
    if ((lanesByPool.get(poolId)?.length ?? 0) > 0) return undefined;
    const pool = bpmn.elements[poolId];
    if (!pool) return undefined;
    const subId = emitExternalSubsystem(out, pool, layout);
    subsystemIdByPoolId.set(poolId, subId); // dedupe further flows to this pool
    elementMapping[subId] = poolId; // Subsystem ← source Pool (a real element)
    return subId;
  };

  const messageFlows = collectInterPoolMessageFlows(bpmn);
  for (const mf of messageFlows) {
    const srcTarget = resolveMessageEndpoint(mf.source.element);
    if (!srcTarget) continue;
    const tgtTarget = resolveMessageEndpoint(mf.target.element);
    if (!tgtTarget) continue;
    const edgeId = emitComponentDependency(out, srcTarget, tgtTarget, 'delegates');
    elementMapping[edgeId] = mf.id; // ComponentDependency ← source BPMNFlow (message)
  }

  // Grouped zones break the origin-centered layout; re-center so the diagram
  // opens on-screen. Gated: plain output stays byte-for-byte.
  if (opts?.includeCapabilities && collectedCaps.length > 0) {
    recenterModelOnOrigin(out);
  }

  return { ok: true, model: out, warnings, elementMapping };
}

// ── Collection helpers ──────────────────────────────────────────────

function collectPools(bpmn: UMLModel): UMLElement[] {
  return Object.values(bpmn.elements).filter((e) => e.type === 'BPMNPool');
}

function collectLanesByPool(bpmn: UMLModel, pools: UMLElement[]): Map<string, UMLElement[]> {
  const out = new Map<string, UMLElement[]>();
  const poolIds = new Set(pools.map((p) => p.id));
  for (const el of Object.values(bpmn.elements)) {
    if (el.type !== 'BPMNSwimlane') continue;
    if (!el.owner || !poolIds.has(el.owner)) continue;
    const arr = out.get(el.owner) ?? [];
    arr.push(el);
    out.set(el.owner, arr);
  }
  for (const arr of out.values()) {
    arr.sort((a, b) => a.bounds.y - b.bounds.y);
  }
  return out;
}

function tasksInLane(bpmn: UMLModel, laneId: string): UMLElement[] {
  return Object.values(bpmn.elements).filter((e) => e.type === 'BPMNTask' && e.owner === laneId);
}

function laneForElement(bpmn: UMLModel, elementId: string): UMLElement | null {
  const el = bpmn.elements[elementId];
  if (!el) return null;
  // If the element IS a lane (e.g. a message flow drawn directly to the
  // lane shape), return it.
  if (el.type === 'BPMNSwimlane') return el;
  const parent = el.owner ? bpmn.elements[el.owner] : null;
  if (parent && parent.type === 'BPMNSwimlane') return parent;
  return null;
}

// Resolve a sequence-flow endpoint to the tracked lane that "owns" it
// (gateway-as-lane-proxy). A task resolves to its lane; a gateway resolves
// to the lane that owns it, so a flow into or out of a gateway is
// attributed to the gateway's OWN lane rather than routed through to a
// downstream task. Returns null for endpoints that
// don't resolve to a tracked lane (events, free-floating shapes, or a
// gateway owned by a pool) — those are not lane bridges in v1, matching
// the prior scope (events were never traced).
function laneIdForEndpoint(
  bpmn: UMLModel,
  elementId: string,
  trackedLanes: Set<string>,
): { laneId: string; gatewayId?: string } | null {
  const el = bpmn.elements[elementId];
  if (!el) return null;
  if (el.type === 'BPMNTask') {
    const laneId = el.owner;
    return laneId && trackedLanes.has(laneId) ? { laneId } : null;
  }
  if (el.type === 'BPMNGateway') {
    const laneId = el.owner;
    return laneId && trackedLanes.has(laneId) ? { laneId, gatewayId: el.id } : null;
  }
  return null;
}

function collectLaneCrossingFlows(bpmn: UMLModel, lanesByPool: Map<string, UMLElement[]>): LaneCrossingFlow[] {
  const trackedLanes = new Set<string>();
  for (const arr of lanesByPool.values()) for (const l of arr) trackedLanes.add(l.id);

  const sequenceFlows = Object.values(bpmn.relationships).filter(
    (r) => r.type === 'BPMNFlow' && (r as unknown as { flowType?: string }).flowType === 'sequence',
  );

  const out: LaneCrossingFlow[] = [];
  for (const f of sequenceFlows) {
    const src = laneIdForEndpoint(bpmn, f.source.element, trackedLanes);
    const tgt = laneIdForEndpoint(bpmn, f.target.element, trackedLanes);
    if (!src || !tgt) continue; // an endpoint isn't a tracked task/gateway
    if (src.laneId === tgt.laneId) continue; // intra-lane — process detail

    out.push({
      flowId: f.id,
      srcLaneId: src.laneId,
      tgtLaneId: tgt.laneId,
      // The gateway endpoint (if any) mediates the edge. When BOTH ends
      // are gateways (gateway→gateway chain), the source side wins — the
      // chain still resolves to the correct cross-lane edge per hop, so
      // the old `multi-hop-gateway` warning is no longer needed.
      gatewayId: src.gatewayId ?? tgt.gatewayId,
    });
  }
  return out;
}

function collectInterPoolMessageFlows(bpmn: UMLModel): UMLRelationship[] {
  return Object.values(bpmn.relationships).filter((r) => {
    if (r.type !== 'BPMNFlow') return false;
    if ((r as unknown as { flowType?: string }).flowType !== 'message') return false;
    const src = bpmn.elements[r.source.element];
    const tgt = bpmn.elements[r.target.element];
    if (!src || !tgt) return false;
    const srcPool = poolFor(bpmn, src);
    const tgtPool = poolFor(bpmn, tgt);
    return Boolean(srcPool && tgtPool && srcPool !== tgtPool);
  });
}

function poolFor(bpmn: UMLModel, el: UMLElement): string | null {
  // When the element IS a pool (e.g. a message flow drawn to the pool
  // shape itself, treating the pool as a black-box participant per
  // BPMN 2.0.2 § 9.2.1), return its id instead of walking up to a
  // non-existent parent.
  if (el.type === 'BPMNPool') return el.id;
  let cur: UMLElement | null = el;
  while (cur && cur.owner) {
    const parent: UMLElement | undefined = bpmn.elements[cur.owner];
    if (!parent) return null;
    if (parent.type === 'BPMNPool') return parent.id;
    cur = parent;
  }
  return null;
}

// ── Edge-kind heuristic (profile-keyed) ──
//
// The two preset profiles have explicit relationship semantics. Custom role text
// remains a valid Component stereotype, but uses the generic edge fallback.
type LaneRole = 'solution' | 'supervision' | 'supervisor';

const LANE_ROLES: ReadonlySet<string> = new Set<LaneRole>(['solution', 'supervisor', 'supervision']);

const isLaneRole = (r: unknown): r is LaneRole => typeof r === 'string' && LANE_ROLES.has(r);

// `_gateway` is retained in the signature for call-site stability and a possible
// future gateway-aware heuristic; the profile-keyed rule reads nothing off it.
export function resolveEdgeKind(
  srcLane: UMLElement,
  tgtLane: UMLElement,
  _gateway: UMLElement | undefined,
): AgenticEdgeKind {
  const srcAgentic = (srcLane as unknown as { isAgentic?: boolean }).isAgentic === true;
  const tgtAgentic = (tgtLane as unknown as { isAgentic?: boolean }).isAgentic === true;

  if (!srcAgentic || !tgtAgentic) return 'delegates';

  const srcRole = (srcLane as unknown as { role?: unknown }).role;
  const tgtRole = (tgtLane as unknown as { role?: unknown }).role;
  if (!isLaneRole(srcRole) || !isLaneRole(tgtRole)) return 'delegates';

  const srcSupervises = isSupervisorRole(srcRole);
  const tgtSupervises = isSupervisorRole(tgtRole);
  if (srcSupervises && !tgtSupervises) return 'supervises';
  if (!srcSupervises && tgtSupervises) return 'revises';
  if (!srcSupervises && !tgtSupervises) return 'collaborates';
  return 'delegates'; // supervision → supervision: ambiguous → generic delegation
}

// ── Capability traversal ────────────────────────────────────────────

// Capability box geometry, used by emitGroupedCapabilities for the
// Skills/Tools zone sizing and the stacked-component layout inside them.
const CAP_W = 140; // capability Component width
const CAP_H = 70; // capability Component height
const CAP_GAP = 16; // vertical gap between stacked capabilities

// An agentic lane wired to MORE than this many distinct capabilities (tools +
// skills, deduped) trips a `capability-heavy-agent` advisory: its has/uses
// edges fan out and the grouped diagram reads busy. Warn-only — nothing is
// truncated.
const CAPABILITY_WARN_THRESHOLD = 10;

// A grouped Skills/Tools zone holding MORE than this many unique boxes trips a
// `capability-heavy-zone` advisory: the zone is crowded even when no single
// agent crosses the per-agent threshold (the "several moderate agents" case).
// Warn-only.
const CAPABILITY_ZONE_WARN_THRESHOLD = 12;

// The full capability stereotype set. `tool`/`skill` come from agent-diagram
// element TYPES (AgentTool/AgentSkill); `llm`/`db`/`rag` come from body REPLY-TYPES.
type CapStereo = 'tool' | 'skill' | 'llm' | 'db' | 'rag';

// Agent-diagram element type → Component stereotype (BESSER `agentic.py` Skill /
// Tool capability tokens).
const CAPABILITY_STEREOTYPE: Record<string, 'tool' | 'skill'> = {
  AgentTool: 'tool',
  AgentSkill: 'skill',
};

// agent → capability edge kind. tool→uses / skill→has locked by BESSER
// `agentic.py` AgenticEdgeKind (USES→Tool, HAS→Skill). llm/db/rag → `uses`
// for all three (resource-like, not skills).
const CAPABILITY_EDGE: Record<CapStereo, 'uses' | 'has'> = {
  tool: 'uses',
  skill: 'has',
  llm: 'uses',
  db: 'uses',
  rag: 'uses',
};

function capabilityElements(agentModel: UMLModel): UMLElement[] {
  return Object.values(agentModel.elements).filter((e) => CAPABILITY_STEREOTYPE[e.type] !== undefined);
}

// LLM/DB/RAG are not element types — they are the `replyType`
// of an AgentStateBody / AgentStateFallbackBody (agent-state-member.ts). Map
// the three resource reply-types to a stereotype; `text` (plain reply) and
// `code` (Python — deferred) are intentionally absent.
const REPLY_TYPE_STEREOTYPE: Record<string, 'llm' | 'db' | 'rag'> = {
  llm: 'llm',
  db_reply: 'db',
  rag: 'rag',
};
const BODY_TYPES = new Set(['AgentStateBody', 'AgentStateFallbackBody']);

// A body has no meaningful element name (its `name` is reply content), so
// name the Component per kind — a single shared "LLM" node (no model id in
// WME), the RAG database name, or the custom DB name, each with a generic
// fallback.
function resourceName(stereo: 'llm' | 'db' | 'rag', body: UMLElement): string {
  const b = body as unknown as { ragDatabaseName?: string; dbCustomName?: string };
  if (stereo === 'rag') return (b.ragDatabaseName ?? '').trim() || 'RAG';
  if (stereo === 'db') return (b.dbCustomName ?? '').trim() || 'Database';
  return 'LLM';
}

// Every resource body (main OR fallback) in the agent diagram,
// as {stereo, name}. Always-named (resourceName never returns empty), so the
// caller needs no empty-name guard.
function resourceBodies(agentModel: UMLModel): Array<{ stereo: 'llm' | 'db' | 'rag'; name: string }> {
  const out: Array<{ stereo: 'llm' | 'db' | 'rag'; name: string }> = [];
  for (const e of Object.values(agentModel.elements)) {
    if (!BODY_TYPES.has(e.type)) continue;
    const replyType = (e as unknown as { replyType?: string }).replyType;
    const stereo = replyType ? REPLY_TYPE_STEREOTYPE[replyType] : undefined;
    if (!stereo) continue;
    out.push({ stereo, name: resourceName(stereo, e) });
  }
  return out;
}

// One agent's reference to a capability, gathered in the collection pass and
// drained by emitGroupedCapabilities. `agentCompId` is the lane Component
// that has/uses it; `taskId` is the linking BPMNTask (lineage).
type CollectedCapability = {
  agentCompId: string;
  stereo: CapStereo;
  name: string;
  taskId: string;
};

// One agentic lane's capabilities — union over the lane's linked Agent
// diagrams, deduped per agent by stereotype+name. Pushes descriptors for the
// grouping pass instead of emitting (zone box height needs the global count).
// A dangling ref (deleted Agent diagram) is skipped — the popup already
// surfaces dangling refs.
// The agent can be linked at the LANE level (popup "Define agent behavior" on
// the lane — the canonical link) OR per-TASK. Collect the union over BOTH so a
// lane-level agent's tools / skills / LLM-DB-RAG resources are not missed.
// `sources` pairs each linked Agent model with the BPMN element it hangs off
// (the lineage source id).
// `seen.size` after the walk is the agent's deduped capability total — which is
// exactly its has/uses edge count into the zones. If it exceeds
// CAPABILITY_WARN_THRESHOLD, push an advisory `capability-heavy-agent` warning
// (nothing is dropped).
function collectLaneCapabilities(
  bpmn: UMLModel,
  lane: UMLElement,
  agentCompId: string,
  agentDiagramsById: Map<string, UMLModel>,
  out: CollectedCapability[],
  warnings: DerivationWarning[],
): void {
  const seen = new Set<string>();

  // The lane's own ref first, then every task's ref. `sourceId`
  // is the BPMN element a capability hangs off for lineage (the lane for a
  // lane-level agent, the task for a per-task agent); `label` names it in a
  // dangling-ref warning.
  const sources: Array<{ ref: string; sourceId: string; label: string }> = [];
  const laneRef = (lane as unknown as { agentDiagramRef?: string }).agentDiagramRef;
  if (laneRef) sources.push({ ref: laneRef, sourceId: lane.id, label: lane.name ?? '' });
  for (const task of tasksInLane(bpmn, lane.id)) {
    const ref = (task as unknown as { agentDiagramRef?: string }).agentDiagramRef;
    if (ref) sources.push({ ref, sourceId: task.id, label: task.name ?? '' });
  }

  for (const { ref, sourceId, label } of sources) {
    const agentModel = agentDiagramsById.get(ref);
    if (!agentModel) {
      // The source links an Agent diagram that is no longer in the project
      // (deleted, or a cross-project paste). The skip is still silent for the
      // model; surface a warning (carrying the source NAME — the dead ref UUID
      // is useless to the user) so they learn why these capabilities didn't
      // appear. Warn-only.
      warnings.push({ kind: 'dangling-agent-ref', taskId: sourceId, taskName: label });
      continue; // dangling ref → skip (behaviour unchanged)
    }
    for (const cap of capabilityElements(agentModel)) {
      const stereo = CAPABILITY_STEREOTYPE[cap.type];
      const name = (cap.name ?? '').trim();
      if (!name) continue;
      const key = `${stereo}::${name.toLowerCase()}`;
      if (seen.has(key)) continue; // per-agent dedup
      seen.add(key);
      out.push({ agentCompId, stereo, name, taskId: sourceId });
    }
    // LLM/DB/RAG resources from the linked Agent diagram's body reply-types —
    // same per-agent dedup (`seen`) and pipeline as tools/skills. A duplicate
    // LLM/db-name/rag-name collapses to one node.
    for (const res of resourceBodies(agentModel)) {
      const key = `${res.stereo}::${res.name.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ agentCompId, stereo: res.stereo, name: res.name, taskId: sourceId });
    }
  }
  if (seen.size > CAPABILITY_WARN_THRESHOLD) {
    warnings.push({ kind: 'capability-heavy-agent', laneId: lane.id, count: seen.size });
  }
}

// Grouped-capability layout. Pool every collected capability into
// up to two shared Subsystems ("Skills" / "Tools"), deduped GLOBALLY by
// name within its kind, then draw one edge per (agent, capability).
// Agents on the left, capability zones on the right, has/uses edges crossing in.
function emitGroupedCapabilities(
  out: UMLModel,
  collected: CollectedCapability[],
  layout: LayoutCursor,
  elementMapping: ElementLineageMap,
  topY: number,
  warnings: DerivationWarning[],
): void {
  if (collected.length === 0) return;

  // Ordered unique names per kind + the first task that contributed each
  // (first-wins lineage — mirrors EdgeDedup's representative rule).
  const uniqueByKind: Record<CapStereo, Array<{ name: string; taskId: string }>> = {
    tool: [],
    skill: [],
    llm: [],
    db: [],
    rag: [],
  };
  for (const c of collected) {
    const list = uniqueByKind[c.stereo];
    if (list.some((u) => u.name.toLowerCase() === c.name.toLowerCase())) continue;
    list.push({ name: c.name, taskId: c.taskId });
  }

  // Geometry: zones to the RIGHT of the fixed-width pool column,
  // top-aligned with the first Subsystem.
  const PAD = 20;
  const HEADER = 40;
  const boxW = CAP_W + 2 * PAD;
  // Skills/Tools to the RIGHT of the pool column; the LLM/DB/RAG
  // resource zones to the LEFT so agent→resource `uses` edges fan left
  // rather than crowding every has/uses edge onto the right.
  let rightX = layout.subsystemX + 640 + 80; // clears the 640-wide pool column
  let leftX = layout.subsystemX - 80 - boxW; // first left zone, just left of the pool column

  const capIdByKey = new Map<string, string>();
  const emitZone = (stereo: CapStereo, title: string, side: 'left' | 'right' = 'right'): void => {
    const list = uniqueByKind[stereo];
    if (list.length === 0) return; // absent kinds show no (empty) zone
    if (list.length > CAPABILITY_ZONE_WARN_THRESHOLD) {
      warnings.push({ kind: 'capability-heavy-zone', zone: title, count: list.length });
    }
    const boxH = HEADER + list.length * (CAP_H + CAP_GAP) - CAP_GAP + PAD;
    const zoneX = side === 'right' ? rightX : leftX;
    const zoneId = newId();
    out.elements[zoneId] = {
      id: zoneId,
      name: title,
      type: 'Subsystem',
      owner: null,
      bounds: { x: zoneX, y: topY, width: boxW, height: boxH },
      stereotype: 'subsystem',
      displayStereotype: true,
    } as unknown as UMLElement;
    list.forEach((entry, i) => {
      const capId = newId();
      out.elements[capId] = {
        id: capId,
        name: entry.name,
        type: 'Component',
        owner: zoneId,
        bounds: { x: zoneX + PAD, y: topY + HEADER + i * (CAP_H + CAP_GAP), width: CAP_W, height: CAP_H },
        stereotype: stereo,
        displayStereotype: true,
      } as unknown as UMLElement;
      capIdByKey.set(`${stereo}::${entry.name.toLowerCase()}`, capId);
      elementMapping[capId] = entry.taskId; // first-wins
    });
    if (side === 'right') rightX += boxW + 40;
    else leftX -= boxW + 40; // stack further left
  };
  emitZone('skill', 'Skills');
  emitZone('tool', 'Tools');
  // Resource zones on the LEFT, closest-to-pool first: Models, RAG, Databases.
  emitZone('llm', 'Models', 'left');
  emitZone('rag', 'RAG', 'left');
  emitZone('db', 'Databases', 'left');

  // One edge per (agent, capability). `collected` is already per-agent
  // deduped, so (agentCompId, capId) pairs are unique — no extra dedup.
  // Resource edges (left zones) exit the agent's LEFT and enter the zone's
  // RIGHT so they don't wrap around the agent box.
  const LEFT_ZONE: Record<CapStereo, boolean> = { skill: false, tool: false, llm: true, db: true, rag: true };
  for (const c of collected) {
    const capId = capIdByKey.get(`${c.stereo}::${c.name.toLowerCase()}`);
    if (!capId) continue;
    const left = LEFT_ZONE[c.stereo];
    const edgeId = emitComponentDependency(
      out,
      c.agentCompId,
      capId,
      CAPABILITY_EDGE[c.stereo],
      left ? 'Left' : 'Right',
      left ? 'Right' : 'Left',
    );
    elementMapping[edgeId] = c.taskId;
  }
}

// ── Emit helpers ────────────────────────────────────────────────────

function emptyComponentModel(size: { width: number; height: number }): UMLModel {
  return {
    version: '3.0.0',
    type: UMLDiagramType.ComponentDiagram,
    size,
    elements: {},
    interactive: { elements: {}, relationships: {} },
    relationships: {},
    assessments: {},
  };
}

interface LayoutCursor {
  subsystemX: number;
  subsystemY: number;
  laneInSubsystemX: number;
  skillRightOfLaneY: number;
  externalRowY: number;
  externalX: number;
  currentSubsystemBounds: { x: number; y: number; width: number; height: number } | null;
  endSubsystem(): void;
}

// Canvas origin is (0, 0); putting the first Subsystem at (-320, -200)
// centers a 640x400 Subsystem on the viewport. Subsequent Subsystems
// stack below.
function makeLayoutCursor(): LayoutCursor {
  return {
    subsystemX: -320,
    subsystemY: -200,
    laneInSubsystemX: 0,
    skillRightOfLaneY: 0,
    externalRowY: 0,
    externalX: -320,
    currentSubsystemBounds: null,
    endSubsystem(this: LayoutCursor) {
      if (this.currentSubsystemBounds) {
        this.subsystemY = this.currentSubsystemBounds.y + this.currentSubsystemBounds.height + 40;
        this.externalRowY = this.subsystemY;
      }
      this.currentSubsystemBounds = null;
    },
  };
}

const newId = (): string => 'gen-' + Math.random().toString(36).slice(2, 11);

function emitSubsystem(out: UMLModel, pool: UMLElement, layout: LayoutCursor): string {
  const id = newId();
  const bounds = { x: layout.subsystemX, y: layout.subsystemY, width: 640, height: 400 };
  layout.currentSubsystemBounds = bounds;
  layout.laneInSubsystemX = bounds.x + 24;
  layout.skillRightOfLaneY = bounds.y + 40;
  out.elements[id] = {
    id,
    name: pool.name || 'Swarm',
    type: 'Subsystem',
    owner: null,
    bounds,
    stereotype: 'subsystem',
    displayStereotype: true,
  } as unknown as UMLElement;
  return id;
}

function emitLaneComponent(
  out: UMLModel,
  lane: UMLElement,
  subsystemId: string,
  layout: LayoutCursor,
  sourceDiagramId?: string,
): string {
  // Only ever called for agentic lanes. The lane's role
  // (solution/supervision or a custom role) maps directly to the
  // Component stereotype, aligning the BPMN process view with the Component
  // vocabulary.
  const id = newId();
  const bounds = {
    x: layout.laneInSubsystemX,
    y: (layout.currentSubsystemBounds?.y ?? 0) + 40,
    width: 160,
    height: 80,
  };
  layout.laneInSubsystemX += bounds.width + 24;
  // The agentic lane's link to its Agent diagram (1:1). Thread the UUID onto
  // the agent-Component so Component→Deployment can carry it down to the
  // Artifact. Only the BESSER deployment generator consumes it; absent when the
  // lane was never linked.
  const agentDiagramRef = (lane as unknown as { agentDiagramRef?: string }).agentDiagramRef;
  const laneRole = (lane as unknown as { role?: string }).role;
  out.elements[id] = {
    id,
    name: lane.name || 'Agent',
    type: 'Component',
    owner: subsystemId,
    bounds,
    stereotype: componentStereotypeForLaneRole(laneRole),
    displayStereotype: true,
    // BESSER `AgenticComponent.process_model_refs` (diagram-grained):
    // the source BPMN diagram this agent participates in.
    ...(sourceDiagramId ? { processModelRefs: [sourceDiagramId] } : {}),
    // Agent-diagram UUID this agent is defined by.
    ...(agentDiagramRef ? { agentModelRef: agentDiagramRef } : {}),
  } as unknown as UMLElement;
  return id;
}

// A black-box external pool (no lanes) is still a swarm boundary
// → a Subsystem, not a Component. Placed in the external row below the
// tracked Subsystems. Named after the source pool.
function emitExternalSubsystem(out: UMLModel, pool: UMLElement, layout: LayoutCursor): string {
  const id = newId();
  const bounds = { x: layout.externalX, y: layout.externalRowY, width: 320, height: 160 };
  layout.externalX += bounds.width + 24;
  out.elements[id] = {
    id,
    name: pool.name || 'External swarm',
    type: 'Subsystem',
    owner: null,
    bounds,
    stereotype: 'subsystem',
    displayStereotype: true,
  } as unknown as UMLElement;
  return id;
}

function emitComponentDependency(
  out: UMLModel,
  sourceId: string,
  targetId: string,
  stereotype: string,
  srcDir: 'Left' | 'Right' = 'Right',
  tgtDir: 'Left' | 'Right' = 'Left',
): string {
  const id = newId();
  const src = (out.elements[sourceId] as unknown as { bounds: { x: number; y: number; width: number; height: number } })
    .bounds;
  const tgt = (out.elements[targetId] as unknown as { bounds: { x: number; y: number; width: number; height: number } })
    .bounds;
  out.relationships[id] = {
    id,
    name: '',
    type: 'ComponentDependency',
    owner: null,
    bounds: {
      x: Math.min(src.x, tgt.x),
      y: Math.min(src.y, tgt.y),
      width: Math.abs(src.x - tgt.x) + Math.max(src.width, tgt.width),
      height: Math.abs(src.y - tgt.y) + Math.max(src.height, tgt.height),
    },
    path: [
      { x: src.x + src.width / 2, y: src.y + src.height / 2 },
      { x: tgt.x + tgt.width / 2, y: tgt.y + tgt.height / 2 },
    ],
    source: { element: sourceId, direction: srcDir },
    target: { element: targetId, direction: tgtDir },
    stereotype,
  } as unknown as UMLRelationship;
  return id;
}

// Scroll fix: the editor sizes the canvas symmetrically around
// the origin (uml-diagram.ts) and the scroll container opens at top-left, so
// emitted content must straddle (0,0) or the diagram opens scrolled into empty
// space. A tall grouped Skills/Tools zone pushes the content bbox far below
// origin; translate the whole model so its bbox midpoint is (0,0), restoring
// the makeLayoutCursor design intent. Idempotent for already-centered content
// (single-pool swarm → dx=dy=0). Translates relationships (bounds + path) by
// the same delta so edges stay attached.
function recenterModelOnOrigin(out: UMLModel): void {
  const els = Object.values(out.elements);
  if (els.length === 0) return;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const e of els) {
    const b = (e as unknown as { bounds: { x: number; y: number; width: number; height: number } }).bounds;
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }
  const dx = -(minX + maxX) / 2;
  const dy = -(minY + maxY) / 2;
  if (dx === 0 && dy === 0) return;
  for (const e of els) {
    const b = (e as unknown as { bounds: { x: number; y: number } }).bounds;
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

// ── Edge de-duplication ─────────────────────────────────────────────

class EdgeDedup {
  private seen = new Set<string>();
  private out: Array<{ srcCompId: string; tgtCompId: string; kind: AgenticEdgeKind; sourceFlowId: string }> = [];

  // Accepts a representative `sourceFlowId` for the lineage
  // map. When multiple flows collapse into one edge, the first
  // occurrence wins (the others are functionally identical).
  add(srcCompId: string, tgtCompId: string, kind: AgenticEdgeKind, sourceFlowId: string): void {
    const k = `${srcCompId}::${tgtCompId}::${kind}`;
    if (this.seen.has(k)) return;
    this.seen.add(k);
    this.out.push({ srcCompId, tgtCompId, kind, sourceFlowId });
  }

  entries(): Array<{ srcCompId: string; tgtCompId: string; kind: AgenticEdgeKind; sourceFlowId: string }> {
    return this.out;
  }
}
