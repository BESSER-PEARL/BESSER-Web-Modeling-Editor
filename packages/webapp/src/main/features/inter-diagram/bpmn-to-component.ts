import type {
  AgentModelElement,
  BPMNFlow,
  BPMNSwimlane,
  BPMNTask,
  UMLComponentComponent,
  UMLComponentDependency,
  UMLComponentSubsystem,
  UMLElement,
  UMLModel,
  UMLRelationship,
} from '@besser/wme';
import { Direction, UMLDiagramType, componentStereotypeForLaneRole, isSupervisorRole } from '@besser/wme';
import type { ElementLineageMap } from '../../shared/types/project';
import { uuid } from '../../shared/utils/uuid';
import type { DerivationResult, DerivationWarning } from './types';

type LaneCrossingFlow = {
  flowId: string;
  srcLaneId: string;
  tgtLaneId: string;
};

const isLane = (el: UMLElement | undefined): el is BPMNSwimlane => el?.type === 'BPMNSwimlane';
const isTask = (el: UMLElement | undefined): el is BPMNTask => el?.type === 'BPMNTask';
const isFlow = (rel: UMLRelationship): rel is BPMNFlow => rel.type === 'BPMNFlow';

export type AgenticEdgeKind = 'delegates' | 'supervises' | 'revises' | 'collaborates';

export type DerivationOpts = {
  /** id → model for every AgentDiagram in the project. Omitted →
   *  capability traversal is skipped entirely (back-compatible). */
  agentDiagramsById?: Map<string, UMLModel>;
  /** SQL databases are stored on the Agent diagram's config form, outside its model. */
  sqlDatabasesByAgentId?: Map<string, Array<{ name?: string }>>;
  /** Default LLM names are stored outside the Agent model. */
  defaultLlmNamesByAgentId?: Map<string, string>;
  /** Opt-in. When false/undefined, no resource Components are emitted.
   *  When true, linked Agent resources are grouped by kind and deduped
   *  globally by name, with one has/uses edge per (agent, resource). */
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
    const agenticLanes = lanes.filter((l) => l.isAgentic === true);
    for (const lane of lanes) {
      if (lane.isAgentic === true) continue;
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
        // An agentic lane = one agent. Collect its linked Agent resources;
        // the grouping pass below places them in shared zones.
        collectLaneCapabilities(
          bpmn,
          lane,
          laneCompId,
          opts.agentDiagramsById,
          collectedCaps,
          warnings,
          opts.sqlDatabasesByAgentId,
          opts.defaultLlmNamesByAgentId,
        );
      }
    }
    layout.endSubsystem();
  }

  // Grouped-capability layout pools every agent's resources into shared
  // Subsystems, deduped globally by name.
  if (opts?.includeCapabilities) {
    emitGroupedCapabilities(out, collectedCaps, layout, elementMapping, capabilitiesTopY, warnings);
  }

  // Lane-crossing sequence flows → ComponentDependency.
  const laneCrossings = collectLaneCrossingFlows(bpmn, lanesByPool);
  const dedup = new EdgeDedup();
  for (const crossing of laneCrossings) {
    const srcLane = bpmn.elements[crossing.srcLaneId];
    const tgtLane = bpmn.elements[crossing.tgtLaneId];
    if (!isLane(srcLane) || !isLane(tgtLane)) continue;
    const kind = resolveEdgeKind(srcLane, tgtLane);

    const srcComp = componentIdByLaneId.get(crossing.srcLaneId);
    const tgtComp = componentIdByLaneId.get(crossing.tgtLaneId);
    if (!srcComp || !tgtComp) continue;
    dedup.add(srcComp, tgtComp, kind, crossing.flowId);
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

  // Several message flows between the same two endpoints (or a message flow
  // parallel to a lane crossing) collapse into one dependency.
  const messageFlows = collectInterPoolMessageFlows(bpmn);
  for (const mf of messageFlows) {
    const srcTarget = resolveMessageEndpoint(mf.source.element);
    if (!srcTarget) continue;
    const tgtTarget = resolveMessageEndpoint(mf.target.element);
    if (!tgtTarget) continue;
    dedup.add(srcTarget, tgtTarget, 'delegates', mf.id);
  }

  for (const e of dedup.entries()) {
    const edgeId = emitComponentDependency(out, e.srcCompId, e.tgtCompId, e.kind);
    elementMapping[edgeId] = e.sourceFlowId; // ComponentDependency ← source BPMNFlow
  }

  // Grouped zones and widened Subsystems break the origin-centered layout;
  // re-center so the diagram opens on-screen. Otherwise the output is left
  // exactly as laid out.
  if ((opts?.includeCapabilities && collectedCaps.length > 0) || layout.columnWidth > SUBSYSTEM_MIN_WIDTH) {
    recenterModelOnOrigin(out);
  }

  return { ok: true, model: out, warnings, elementMapping };
}

// ── Collection helpers ──────────────────────────────────────────────

function collectPools(bpmn: UMLModel): UMLElement[] {
  return Object.values(bpmn.elements).filter((e) => e.type === 'BPMNPool');
}

function collectLanesByPool(bpmn: UMLModel, pools: UMLElement[]): Map<string, BPMNSwimlane[]> {
  const out = new Map<string, BPMNSwimlane[]>();
  const poolIds = new Set(pools.map((p) => p.id));
  for (const el of Object.values(bpmn.elements)) {
    if (!isLane(el)) continue;
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

function tasksInLane(bpmn: UMLModel, laneId: string): BPMNTask[] {
  return Object.values(bpmn.elements)
    .filter(isTask)
    .filter((e) => e.owner === laneId);
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

// Resolve a sequence-flow endpoint to the tracked lane that "owns" it. A
// task or gateway resolves to its own lane, so a flow into or out of a gateway
// is attributed to the gateway's lane rather than routed through to a
// downstream task (a gateway→gateway chain still resolves per hop). Returns
// null for endpoints that don't resolve to a tracked lane (events,
// free-floating shapes, a gateway owned by a pool).
function laneIdForEndpoint(bpmn: UMLModel, elementId: string, trackedLanes: Set<string>): string | null {
  const el = bpmn.elements[elementId];
  if (!el || (el.type !== 'BPMNTask' && el.type !== 'BPMNGateway')) return null;
  return el.owner && trackedLanes.has(el.owner) ? el.owner : null;
}

function collectLaneCrossingFlows(bpmn: UMLModel, lanesByPool: Map<string, BPMNSwimlane[]>): LaneCrossingFlow[] {
  const trackedLanes = new Set<string>();
  for (const arr of lanesByPool.values()) for (const l of arr) trackedLanes.add(l.id);

  const sequenceFlows = Object.values(bpmn.relationships)
    .filter(isFlow)
    .filter((f) => f.flowType === 'sequence');

  const out: LaneCrossingFlow[] = [];
  for (const f of sequenceFlows) {
    const srcLaneId = laneIdForEndpoint(bpmn, f.source.element, trackedLanes);
    const tgtLaneId = laneIdForEndpoint(bpmn, f.target.element, trackedLanes);
    if (!srcLaneId || !tgtLaneId) continue; // an endpoint isn't a tracked task/gateway
    if (srcLaneId === tgtLaneId) continue; // intra-lane: process detail
    out.push({ flowId: f.id, srcLaneId, tgtLaneId });
  }
  return out;
}

function collectInterPoolMessageFlows(bpmn: UMLModel): BPMNFlow[] {
  return Object.values(bpmn.relationships)
    .filter(isFlow)
    .filter((r) => {
      if (r.flowType !== 'message') return false;
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

export function resolveEdgeKind(srcLane: BPMNSwimlane, tgtLane: BPMNSwimlane): AgenticEdgeKind {
  if (srcLane.isAgentic !== true || tgtLane.isAgentic !== true) return 'delegates';

  const srcRole = srcLane.role;
  const tgtRole = tgtLane.role;
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
// Subsystem titles use two lines (stereotype and name); leave both visible
// before placing a child Component.
const SUBSYSTEM_CONTENT_TOP = 50;

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

// The full capability stereotype set. Off-canvas Agent components provide
// tools, skills, LLMs and RAGs; SQL databases live in the Agent config form.
// Legacy Agent models can also provide tools/skills and reply-body resources.
type CapStereo = 'tool' | 'skill' | 'llm' | 'db' | 'rag';

// Legacy canvas element type → Component stereotype.
const CAPABILITY_STEREOTYPE: Record<string, 'tool' | 'skill'> = {
  AgentTool: 'tool',
  AgentSkill: 'skill',
};

const COMPONENT_STEREOTYPE: Record<string, 'tool' | 'skill' | 'llm' | 'rag'> = {
  AgentTool: 'tool',
  AgentSkill: 'skill',
  AgentLLM: 'llm',
  AgentRagElement: 'rag',
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

function configuredComponents(agentModel: UMLModel): Array<{ stereo: CapStereo; name: string }> {
  return Object.values(agentModel.components ?? {}).flatMap((component) => {
    const stereo = COMPONENT_STEREOTYPE[component.type];
    const name = (component.name ?? '').trim();
    return stereo && name ? [{ stereo, name }] : [];
  });
}

// Legacy AgentStateBody / AgentStateFallbackBody reply types also describe
// resources. `text` and `code` do not map to Component resources.
const REPLY_TYPE_STEREOTYPE: Record<string, 'llm' | 'db' | 'rag'> = {
  llm: 'llm',
  db_reply: 'db',
  rag: 'rag',
};
const BODY_TYPES = new Set(['AgentStateBody', 'AgentStateFallbackBody']);
const isBody = (e: UMLElement): e is UMLElement & AgentModelElement => BODY_TYPES.has(e.type);

// Resolve blank action references the same way as the runtime's default LLM.
export function resolveBodyLlmName(
  agentModel: UMLModel,
  body: Pick<AgentModelElement, 'llm_name'>,
  defaultLlmName?: string,
): string {
  const explicit = body.llm_name?.trim();
  if (explicit) return explicit;

  const registered = configuredComponents(agentModel)
    .filter((resource) => resource.stereo === 'llm')
    .map((resource) => resource.name);
  const configuredDefault = defaultLlmName?.trim();
  if (configuredDefault && registered.includes(configuredDefault)) return configuredDefault;
  return registered[0] ?? 'LLM';
}

function resourceName(
  stereo: 'llm' | 'db' | 'rag',
  body: AgentModelElement,
  agentModel: UMLModel,
  defaultLlmName?: string,
): string {
  if (stereo === 'rag') return (body.ragDatabaseName ?? '').trim() || 'RAG';
  if (stereo === 'db') return (body.dbCustomName ?? '').trim() || 'Database';
  return resolveBodyLlmName(agentModel, body, defaultLlmName);
}

// Every resource body (main OR fallback) in the agent diagram,
// as {stereo, name}. Always-named (resourceName never returns empty), so the
// caller needs no empty-name guard.
function resourceBodies(
  agentModel: UMLModel,
  defaultLlmName?: string,
): Array<{ stereo: 'llm' | 'db' | 'rag'; name: string }> {
  const out: Array<{ stereo: 'llm' | 'db' | 'rag'; name: string }> = [];
  for (const e of Object.values(agentModel.elements)) {
    if (!isBody(e)) continue;
    const stereo = e.replyType ? REPLY_TYPE_STEREOTYPE[e.replyType] : undefined;
    if (!stereo) continue;
    out.push({ stereo, name: resourceName(stereo, e, agentModel, defaultLlmName) });
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
  lane: BPMNSwimlane,
  agentCompId: string,
  agentDiagramsById: Map<string, UMLModel>,
  out: CollectedCapability[],
  warnings: DerivationWarning[],
  sqlDatabasesByAgentId?: Map<string, Array<{ name?: string }>>,
  defaultLlmNamesByAgentId?: Map<string, string>,
): void {
  const seen = new Set<string>();

  // The lane's own ref first, then every task's ref. `sourceId`
  // is the BPMN element a capability hangs off for lineage (the lane for a
  // lane-level agent, the task for a per-task agent); `label` names it in a
  // dangling-ref warning.
  const sources: Array<{ ref: string; sourceId: string; label: string }> = [];
  if (lane.agentDiagramRef) sources.push({ ref: lane.agentDiagramRef, sourceId: lane.id, label: lane.name ?? '' });
  for (const task of tasksInLane(bpmn, lane.id)) {
    if (task.agentDiagramRef) sources.push({ ref: task.agentDiagramRef, sourceId: task.id, label: task.name ?? '' });
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
    for (const configured of configuredComponents(agentModel)) {
      const key = `${configured.stereo}::${configured.name.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ agentCompId, ...configured, taskId: sourceId });
    }
    for (const db of sqlDatabasesByAgentId?.get(ref) ?? []) {
      const name = (db.name ?? '').trim();
      if (!name) continue;
      const key = `db::${name.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ agentCompId, stereo: 'db', name, taskId: sourceId });
    }
    // LLM/DB/RAG resources from the linked Agent diagram's body reply-types —
    // same per-agent dedup (`seen`) and pipeline as tools/skills. A duplicate
    // LLM/db-name/rag-name collapses to one node.
    for (const res of resourceBodies(agentModel, defaultLlmNamesByAgentId?.get(ref))) {
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
  const HEADER = SUBSYSTEM_CONTENT_TOP;
  const boxW = CAP_W + 2 * PAD;
  // Skills/Tools to the RIGHT of the pool column; the LLM/DB/RAG
  // resource zones to the LEFT so agent→resource `uses` edges fan left
  // rather than crowding every has/uses edge onto the right.
  let rightX = layout.subsystemX + layout.columnWidth + 80; // clears the pool column
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
    const zoneId = addSubsystem(out, title, { x: zoneX, y: topY, width: boxW, height: boxH });
    list.forEach((entry, i) => {
      const capId = uuid();
      const capability: UMLComponentComponent = {
        id: capId,
        name: entry.name,
        type: 'Component',
        owner: zoneId,
        bounds: { x: zoneX + PAD, y: topY + HEADER + i * (CAP_H + CAP_GAP), width: CAP_W, height: CAP_H },
        stereotype: stereo,
        displayStereotype: true,
      };
      out.elements[capId] = capability;
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
      left ? Direction.Left : Direction.Right,
      left ? Direction.Right : Direction.Left,
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

// A pool Subsystem is at least this large; it grows wider to fit its lanes.
const SUBSYSTEM_MIN_WIDTH = 640;
const SUBSYSTEM_MIN_HEIGHT = 400;
const LANE_COMPONENT_W = 160;
const LANE_COMPONENT_H = 80;
const LANE_COMPONENT_GAP = 24;

interface LayoutCursor {
  subsystemX: number;
  subsystemY: number;
  laneInSubsystemX: number;
  externalRowY: number;
  externalX: number;
  /** Width of the widest pool Subsystem; capability zones sit right of it. */
  columnWidth: number;
  currentSubsystemBounds: { x: number; y: number; width: number; height: number } | null;
  endSubsystem(): void;
}

// Canvas origin is (0, 0); putting the first Subsystem at (-320, -200)
// centers a 640x400 Subsystem on the viewport. Subsequent Subsystems
// stack below.
function makeLayoutCursor(): LayoutCursor {
  return {
    subsystemX: -SUBSYSTEM_MIN_WIDTH / 2,
    subsystemY: -SUBSYSTEM_MIN_HEIGHT / 2,
    laneInSubsystemX: 0,
    externalRowY: 0,
    externalX: -SUBSYSTEM_MIN_WIDTH / 2,
    columnWidth: SUBSYSTEM_MIN_WIDTH,
    currentSubsystemBounds: null,
    endSubsystem(this: LayoutCursor) {
      const bounds = this.currentSubsystemBounds;
      if (bounds) {
        // Grow the Subsystem so every lane Component fits inside it.
        bounds.width = Math.max(bounds.width, this.laneInSubsystemX - bounds.x);
        this.columnWidth = Math.max(this.columnWidth, bounds.width);
        this.subsystemY = bounds.y + bounds.height + 40;
        this.externalRowY = this.subsystemY;
      }
      this.currentSubsystemBounds = null;
    },
  };
}

function addSubsystem(
  out: UMLModel,
  name: string,
  bounds: { x: number; y: number; width: number; height: number },
): string {
  const id = uuid();
  const subsystem: UMLComponentSubsystem = {
    id,
    name,
    type: 'Subsystem',
    owner: null,
    bounds,
    stereotype: 'subsystem',
    displayStereotype: true,
  };
  out.elements[id] = subsystem;
  return id;
}

function emitSubsystem(out: UMLModel, pool: UMLElement, layout: LayoutCursor): string {
  const bounds = { x: layout.subsystemX, y: layout.subsystemY, width: SUBSYSTEM_MIN_WIDTH, height: SUBSYSTEM_MIN_HEIGHT };
  layout.currentSubsystemBounds = bounds;
  layout.laneInSubsystemX = bounds.x + LANE_COMPONENT_GAP;
  return addSubsystem(out, pool.name || 'Swarm', bounds);
}

function emitLaneComponent(
  out: UMLModel,
  lane: BPMNSwimlane,
  subsystemId: string,
  layout: LayoutCursor,
  sourceDiagramId?: string,
): string {
  // Only ever called for agentic lanes. The lane's role (solution/supervision
  // or a custom role) maps directly to the Component stereotype.
  const id = uuid();
  const bounds = {
    x: layout.laneInSubsystemX,
    y: (layout.currentSubsystemBounds?.y ?? 0) + SUBSYSTEM_CONTENT_TOP,
    width: LANE_COMPONENT_W,
    height: LANE_COMPONENT_H,
  };
  layout.laneInSubsystemX += bounds.width + LANE_COMPONENT_GAP;
  const component: UMLComponentComponent = {
    id,
    name: lane.name || 'Agent',
    type: 'Component',
    owner: subsystemId,
    bounds,
    stereotype: componentStereotypeForLaneRole(lane.role),
    displayStereotype: true,
    // BESSER `AgenticComponent.process_model_refs` (diagram-grained):
    // the source BPMN diagram this agent participates in.
    ...(sourceDiagramId ? { processModelRefs: [sourceDiagramId] } : {}),
    // The lane's Agent diagram (1:1), carried down to the Deployment Artifact
    // by Component→Deployment; absent when the lane was never linked.
    ...(lane.agentDiagramRef ? { agentModelRef: lane.agentDiagramRef } : {}),
  };
  out.elements[id] = component;
  return id;
}

// A black-box external pool (no lanes) is still a swarm boundary
// → a Subsystem, not a Component. Placed in the external row below the
// tracked Subsystems. Named after the source pool.
function emitExternalSubsystem(out: UMLModel, pool: UMLElement, layout: LayoutCursor): string {
  const bounds = { x: layout.externalX, y: layout.externalRowY, width: 320, height: 160 };
  layout.externalX += bounds.width + 24;
  return addSubsystem(out, pool.name || 'External swarm', bounds);
}

function emitComponentDependency(
  out: UMLModel,
  sourceId: string,
  targetId: string,
  stereotype: string,
  srcDir: Direction = Direction.Right,
  tgtDir: Direction = Direction.Left,
): string {
  const id = uuid();
  const src = out.elements[sourceId].bounds;
  const tgt = out.elements[targetId].bounds;
  const dependency: UMLComponentDependency = {
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
  };
  out.relationships[id] = dependency;
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
  for (const { bounds: b } of els) {
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }
  const dx = -(minX + maxX) / 2;
  const dy = -(minY + maxY) / 2;
  if (dx === 0 && dy === 0) return;
  for (const { bounds: b } of els) {
    b.x += dx;
    b.y += dy;
  }
  for (const rel of Object.values(out.relationships)) {
    rel.bounds.x += dx;
    rel.bounds.y += dy;
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
