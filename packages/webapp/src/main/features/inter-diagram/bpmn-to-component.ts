import type { BesserEdge, BesserNode, UMLModel } from '@besser/wme';
import {
  UMLDiagramType,
  bpmnEdgeTypeToFlowType,
  componentStereotypeForLaneRole,
  isSupervisorRole,
} from '@besser/wme';
import type { ElementLineageMap } from '../../shared/types/project';
import { DiagramBuilder, ModelIndex, nodeName, type Box, type Side } from './diagram-builder';
import { ceilToGrid, estimateTextWidth } from './text-metrics';
import type { DerivationResult, DerivationWarning } from './types';

type LaneCrossingFlow = {
  flowId: string;
  srcLaneId: string;
  tgtLaneId: string;
};

/** The agentic profile of a `bpmnSwimlane` node (its `data`). */
export type LaneProfile = { isAgentic?: boolean; role?: string };

const isLane = (node: BesserNode | undefined): node is BesserNode => node?.type === 'bpmnSwimlane';
const profileOf = (lane: BesserNode): LaneProfile => lane.data as LaneProfile;

/** `data.agentDiagramRef` of a BPMN lane or task, when set. */
export const agentDiagramRefOf = (node: BesserNode | undefined): string | undefined => {
  const ref = node?.data.agentDiagramRef;
  return typeof ref === 'string' && ref ? ref : undefined;
};

/** The BPMN flows of one kind, in model order. */
export const flowsOfType = (bpmn: UMLModel, flowType: 'sequence' | 'message'): BesserEdge[] =>
  (bpmn.edges ?? []).filter((e) => bpmnEdgeTypeToFlowType(e.type) === flowType);

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

export function bpmnModelToComponentModel(model: UMLModel, opts?: DerivationOpts): DerivationResult {
  const warnings: DerivationWarning[] = [];
  // Diagram-grained ref carrier; stamped onto agentic lane-Components.
  const sourceDiagramId = opts?.sourceDiagramId;

  if (model.type !== UMLDiagramType.BPMN) {
    return { ok: false, reason: 'not-a-bpmn-diagram', warnings };
  }
  const bpmn = new ModelIndex(model);

  const pools = bpmn.nodes('bpmnPool');
  if (pools.length === 0) {
    return { ok: false, reason: 'no-pools', warnings };
  }

  const lanesByPool = collectLanesByPool(bpmn, pools);
  const hasAnyLane = Array.from(lanesByPool.values()).some((ls) => ls.length > 0);
  if (!hasAnyLane) {
    return { ok: false, reason: 'no-lanes-in-any-pool', warnings };
  }

  const out = new DiagramBuilder();
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
    const agenticLanes = lanes.filter((l) => profileOf(l).isAgentic === true);
    for (const lane of lanes) {
      if (profileOf(lane).isAgentic === true) continue;
      for (const t of tasksInLane(bpmn, lane.id)) {
        warnings.push({
          kind: 'dropped-task-in-non-agentic-lane',
          taskId: t.id,
          taskName: nodeName(t),
          laneName: nodeName(lane),
        });
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
    const srcLane = bpmn.get(crossing.srcLaneId);
    const tgtLane = bpmn.get(crossing.tgtLaneId);
    if (!isLane(srcLane) || !isLane(tgtLane)) continue;
    const kind = resolveEdgeKind(profileOf(srcLane), profileOf(tgtLane));

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
    const el = bpmn.get(elementId);
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
    const pool = bpmn.get(poolId);
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
    const srcTarget = resolveMessageEndpoint(mf.source);
    if (!srcTarget) continue;
    const tgtTarget = resolveMessageEndpoint(mf.target);
    if (!tgtTarget) continue;
    dedup.add(srcTarget, tgtTarget, 'delegates', mf.id);
  }

  const laneComponentIds = new Set(componentIdByLaneId.values());
  for (const e of dedup.entries()) {
    const handles = laneEdgeHandles(out, laneComponentIds, e.srcCompId, e.tgtCompId);
    const edgeId = emitComponentDependency(out, e.srcCompId, e.tgtCompId, e.kind, handles);
    elementMapping[edgeId] = e.sourceFlowId; // ComponentDependency ← source BPMN flow
  }

  // Grouped zones and widened Subsystems break the origin-centered layout;
  // re-center so the diagram opens on-screen. Otherwise the output is left
  // exactly as laid out.
  if ((opts?.includeCapabilities && collectedCaps.length > 0) || layout.columnWidth > SUBSYSTEM_MIN_WIDTH) {
    out.recenter();
  }

  return { ok: true, model: out.build(UMLDiagramType.ComponentDiagram), warnings, elementMapping };
}

// ── Collection helpers ──────────────────────────────────────────────

function collectLanesByPool(bpmn: ModelIndex, pools: BesserNode[]): Map<string, BesserNode[]> {
  const out = new Map<string, BesserNode[]>();
  const poolIds = new Set(pools.map((p) => p.id));
  for (const lane of bpmn.nodes('bpmnSwimlane')) {
    if (!lane.parentId || !poolIds.has(lane.parentId)) continue;
    const arr = out.get(lane.parentId) ?? [];
    arr.push(lane);
    out.set(lane.parentId, arr);
  }
  // Lanes of one pool share their parent, so the relative y orders them.
  for (const arr of out.values()) {
    arr.sort((a, b) => a.position.y - b.position.y);
  }
  return out;
}

function tasksInLane(bpmn: ModelIndex, laneId: string): BesserNode[] {
  return bpmn.nodes('bpmnTask').filter((t) => t.parentId === laneId);
}

function laneForElement(bpmn: ModelIndex, elementId: string): BesserNode | null {
  const el = bpmn.get(elementId);
  if (!el) return null;
  // If the element IS a lane (e.g. a message flow drawn directly to the
  // lane shape), return it.
  if (isLane(el)) return el;
  const parent = bpmn.parent(el);
  if (isLane(parent)) return parent;
  return null;
}

// Resolve a sequence-flow endpoint to the tracked lane that "owns" it. A
// task or gateway resolves to its own lane, so a flow into or out of a gateway
// is attributed to the gateway's lane rather than routed through to a
// downstream task (a gateway→gateway chain still resolves per hop). Returns
// null for endpoints that don't resolve to a tracked lane (events,
// free-floating shapes, a gateway owned by a pool).
function laneIdForEndpoint(bpmn: ModelIndex, elementId: string, trackedLanes: Set<string>): string | null {
  const el = bpmn.get(elementId);
  if (!el || (el.type !== 'bpmnTask' && el.type !== 'bpmnGateway')) return null;
  return el.parentId && trackedLanes.has(el.parentId) ? el.parentId : null;
}

function collectLaneCrossingFlows(bpmn: ModelIndex, lanesByPool: Map<string, BesserNode[]>): LaneCrossingFlow[] {
  const trackedLanes = new Set<string>();
  for (const arr of lanesByPool.values()) for (const l of arr) trackedLanes.add(l.id);

  const out: LaneCrossingFlow[] = [];
  for (const f of flowsOfType(bpmn.model, 'sequence')) {
    const srcLaneId = laneIdForEndpoint(bpmn, f.source, trackedLanes);
    const tgtLaneId = laneIdForEndpoint(bpmn, f.target, trackedLanes);
    if (!srcLaneId || !tgtLaneId) continue; // an endpoint isn't a tracked task/gateway
    if (srcLaneId === tgtLaneId) continue; // intra-lane: process detail
    out.push({ flowId: f.id, srcLaneId, tgtLaneId });
  }
  return out;
}

function collectInterPoolMessageFlows(bpmn: ModelIndex): BesserEdge[] {
  return flowsOfType(bpmn.model, 'message').filter((flow) => {
    const src = bpmn.get(flow.source);
    const tgt = bpmn.get(flow.target);
    if (!src || !tgt) return false;
    const srcPool = poolFor(bpmn, src);
    const tgtPool = poolFor(bpmn, tgt);
    return Boolean(srcPool && tgtPool && srcPool !== tgtPool);
  });
}

function poolFor(bpmn: ModelIndex, el: BesserNode): string | null {
  // When the element IS a pool (e.g. a message flow drawn to the pool
  // shape itself, treating the pool as a black-box participant per
  // BPMN 2.0.2 § 9.2.1), return its id instead of walking up to a
  // non-existent parent.
  if (el.type === 'bpmnPool') return el.id;
  return bpmn.ancestors(el).find((a) => a.type === 'bpmnPool')?.id ?? null;
}

// ── Edge-kind heuristic (profile-keyed) ──
//
// The two preset profiles have explicit relationship semantics. Custom role text
// remains a valid Component stereotype, but uses the generic edge fallback.
type LaneRole = 'solution' | 'supervision' | 'supervisor';

const LANE_ROLES: ReadonlySet<string> = new Set<LaneRole>(['solution', 'supervisor', 'supervision']);

const isLaneRole = (r: unknown): r is LaneRole => typeof r === 'string' && LANE_ROLES.has(r);

export function resolveEdgeKind(srcLane: LaneProfile, tgtLane: LaneProfile): AgenticEdgeKind {
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
// Canvas tool / skill nodes and AgentState reply bodies also provide resources.
type CapStereo = 'tool' | 'skill' | 'llm' | 'db' | 'rag';

// Canvas node type → Component stereotype.
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

function capabilityNodes(agentModel: UMLModel): BesserNode[] {
  return (agentModel.nodes ?? []).filter((n) => CAPABILITY_STEREOTYPE[n.type] !== undefined);
}

function configuredComponents(agentModel: UMLModel): Array<{ stereo: CapStereo; name: string }> {
  return Object.values(agentModel.components ?? {}).flatMap((component) => {
    const stereo = COMPONENT_STEREOTYPE[component.type];
    const name = (component.name ?? '').trim();
    return stereo && name ? [{ stereo, name }] : [];
  });
}

// AgentState body / fallback-body reply types also describe resources.
// `text` and `code` do not map to Component resources.
const REPLY_TYPE_STEREOTYPE: Record<string, 'llm' | 'db' | 'rag'> = {
  llm: 'llm',
  db_reply: 'db',
  rag: 'rag',
};

/** The resource fields of an AgentState body row. */
export type AgentBodyRow = { replyType?: string; llm_name?: string; ragDatabaseName?: string; dbCustomName?: string };

/** Every body and fallback-body row, state by state. */
function agentBodyRows(agentModel: UMLModel): AgentBodyRow[] {
  return (agentModel.nodes ?? [])
    .filter((n) => n.type === 'AgentState')
    .flatMap((n) => {
      const data = n.data as { bodies?: AgentBodyRow[]; fallbackBodies?: AgentBodyRow[] };
      return [...(data.bodies ?? []), ...(data.fallbackBodies ?? [])];
    });
}

// Resolve blank action references the same way as the runtime's default LLM.
export function resolveBodyLlmName(
  agentModel: UMLModel,
  body: Pick<AgentBodyRow, 'llm_name'>,
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
  body: AgentBodyRow,
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
  for (const row of agentBodyRows(agentModel)) {
    const stereo = row.replyType ? REPLY_TYPE_STEREOTYPE[row.replyType] : undefined;
    if (!stereo) continue;
    out.push({ stereo, name: resourceName(stereo, row, agentModel, defaultLlmName) });
  }
  return out;
}

// One agent's reference to a capability, gathered in the collection pass and
// drained by emitGroupedCapabilities. `agentCompId` is the lane Component
// that has/uses it; `taskId` is the linking BPMN lane or task (lineage).
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
  bpmn: ModelIndex,
  lane: BesserNode,
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
  for (const source of [lane, ...tasksInLane(bpmn, lane.id)]) {
    const ref = agentDiagramRefOf(source);
    if (ref) sources.push({ ref, sourceId: source.id, label: nodeName(source) });
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
    for (const cap of capabilityNodes(agentModel)) {
      const stereo = CAPABILITY_STEREOTYPE[cap.type];
      const name = nodeName(cap).trim();
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
    warnings.push({ kind: 'capability-heavy-agent', laneId: lane.id, laneName: nodeName(lane), count: seen.size });
  }
}

// Grouped-capability layout. Pool every collected capability into
// up to two shared Subsystems ("Skills" / "Tools"), deduped GLOBALLY by
// name within its kind, then draw one edge per (agent, capability).
// Agents on the left, capability zones on the right, has/uses edges crossing in.
function emitGroupedCapabilities(
  out: DiagramBuilder,
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
      const capId = out.addNode(
        'component',
        { x: zoneX + PAD, y: topY + HEADER + i * (CAP_H + CAP_GAP), width: CAP_W, height: CAP_H },
        { name: entry.name, isComponentHeaderShown: true, stereotype: stereo },
        zoneId,
      );
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
    const handles: [Side, Side] = LEFT_ZONE[c.stereo] ? ['left', 'right'] : ['right', 'left'];
    const edgeId = emitComponentDependency(out, c.agentCompId, capId, CAPABILITY_EDGE[c.stereo], handles);
    elementMapping[edgeId] = c.taskId;
  }
}

// ── Emit helpers ────────────────────────────────────────────────────

// A pool Subsystem is at least this large; it grows wider to fit its lanes.
const SUBSYSTEM_MIN_WIDTH = 640;
const SUBSYSTEM_MIN_HEIGHT = 400;
const LANE_COMPONENT_W = 160;
const LANE_COMPONENT_H = 80;
// Lane Components sit in one row, this far below the Subsystem's top edge so
// the «subsystem» stereotype and the name stay readable above them.
const LANE_CONTENT_TOP = 70;
// Left/right padding between the Subsystem border and its lane Components.
const LANE_SUBSYSTEM_PAD_X = 40;
// Horizontal gap between neighbouring lane Components: the widest agentic
// edge label («collaborates», drawn at 85 % of the bold font) plus margin, so
// the label of an edge between neighbours fits between them.
const LANE_COMPONENT_GAP = ceilToGrid(estimateTextWidth('«collaborates»', { scale: 0.85 }) + 40);

interface LayoutCursor {
  subsystemX: number;
  subsystemY: number;
  laneInSubsystemX: number;
  /** Right edge of the last lane Component in the current Subsystem. */
  laneRowRight: number;
  externalRowY: number;
  externalX: number;
  /** Width of the widest pool Subsystem; capability zones sit right of it. */
  columnWidth: number;
  /** Box of the Subsystem being filled; endSubsystem() widens it in place. */
  currentSubsystemBounds: Box | null;
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
    laneRowRight: 0,
    externalRowY: 0,
    externalX: -SUBSYSTEM_MIN_WIDTH / 2,
    columnWidth: SUBSYSTEM_MIN_WIDTH,
    currentSubsystemBounds: null,
    endSubsystem(this: LayoutCursor) {
      const bounds = this.currentSubsystemBounds;
      if (bounds) {
        // Grow the Subsystem so every lane Component fits inside it.
        bounds.width = Math.max(bounds.width, this.laneRowRight + LANE_SUBSYSTEM_PAD_X - bounds.x);
        this.columnWidth = Math.max(this.columnWidth, bounds.width);
        this.subsystemY = bounds.y + bounds.height + 40;
        this.externalRowY = this.subsystemY;
      }
      this.currentSubsystemBounds = null;
    },
  };
}

function addSubsystem(out: DiagramBuilder, name: string, bounds: Box): string {
  return out.addNode('componentSubsystem', bounds, {
    name,
    isComponentSubsystemHeaderShown: true,
    stereotype: 'subsystem',
  });
}

function emitSubsystem(out: DiagramBuilder, pool: BesserNode, layout: LayoutCursor): string {
  const bounds = { x: layout.subsystemX, y: layout.subsystemY, width: SUBSYSTEM_MIN_WIDTH, height: SUBSYSTEM_MIN_HEIGHT };
  layout.currentSubsystemBounds = bounds;
  layout.laneInSubsystemX = bounds.x + LANE_SUBSYSTEM_PAD_X;
  layout.laneRowRight = bounds.x;
  return addSubsystem(out, nodeName(pool) || 'Swarm', bounds);
}

function emitLaneComponent(
  out: DiagramBuilder,
  lane: BesserNode,
  subsystemId: string,
  layout: LayoutCursor,
  sourceDiagramId?: string,
): string {
  // Only ever called for agentic lanes. The lane's role (solution/supervision
  // or a custom role) maps directly to the Component stereotype.
  const bounds = {
    x: layout.laneInSubsystemX,
    y: (layout.currentSubsystemBounds?.y ?? 0) + LANE_CONTENT_TOP,
    width: LANE_COMPONENT_W,
    height: LANE_COMPONENT_H,
  };
  layout.laneRowRight = bounds.x + bounds.width;
  layout.laneInSubsystemX += bounds.width + LANE_COMPONENT_GAP;
  const agentModelRef = agentDiagramRefOf(lane);
  return out.addNode(
    'component',
    bounds,
    {
      name: nodeName(lane) || 'Agent',
      isComponentHeaderShown: true,
      stereotype: componentStereotypeForLaneRole(profileOf(lane).role),
      // BESSER `AgenticComponent.process_model_refs` (diagram-grained):
      // the source BPMN diagram this agent participates in.
      ...(sourceDiagramId ? { processModelRefs: [sourceDiagramId] } : {}),
      // The lane's Agent diagram (1:1), carried down to the Deployment Artifact
      // by Component→Deployment; absent when the lane was never linked.
      ...(agentModelRef ? { agentModelRef } : {}),
    },
    subsystemId,
  );
}

// A black-box external pool (no lanes) is still a swarm boundary
// → a Subsystem, not a Component. Placed in the external row below the
// tracked Subsystems. Named after the source pool.
function emitExternalSubsystem(out: DiagramBuilder, pool: BesserNode, layout: LayoutCursor): string {
  const bounds = { x: layout.externalX, y: layout.externalRowY, width: 320, height: 160 };
  layout.externalX += bounds.width + 24;
  return addSubsystem(out, nodeName(pool) || 'External swarm', bounds);
}

/**
 * Handles for an agent → agent dependency. The editor routes the edge from
 * them and puts the «stereotype» label at the path midpoint.
 *
 * Lane Components of one Subsystem share a row. An edge from a Component to
 * its right-hand neighbour runs straight across the gap between them (wide
 * enough for the label). Any other edge in the row — backwards, or skipping a
 * Component — loops underneath the row (bottom → bottom), so neither the line
 * nor its label crosses a Component or the Subsystem header above the row.
 * Other edges keep the default right → left.
 */
function laneEdgeHandles(
  out: DiagramBuilder,
  laneComponentIds: Set<string>,
  srcId: string,
  tgtId: string,
): [Side, Side] {
  const src = out.box(srcId);
  const tgt = out.box(tgtId);
  const parentId = out.parentId(srcId);
  const sameRow =
    laneComponentIds.has(srcId) && laneComponentIds.has(tgtId) && parentId === out.parentId(tgtId) && src.y === tgt.y;
  if (!sameRow) return ['right', 'left'];
  const between = [...laneComponentIds].some((id) => {
    const b = out.box(id);
    return out.parentId(id) === parentId && b.x > src.x && b.x < tgt.x;
  });
  if (src.x < tgt.x && !between) return ['right', 'left'];
  return ['bottom', 'bottom'];
}

function emitComponentDependency(
  out: DiagramBuilder,
  sourceId: string,
  targetId: string,
  stereotype: string,
  handles: [Side, Side] = ['right', 'left'],
): string {
  return out.addEdge('ComponentDependency', sourceId, targetId, handles, { stereotype });
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
