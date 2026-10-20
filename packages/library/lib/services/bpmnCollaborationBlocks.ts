/**
 * Agentic BPMN collaboration blocks and the Governance DSL, expressed against
 * the v4 model.
 *
 * Port of develop's agentic helpers in `bpmn-flow/bpmn-flow-validator.ts` and
 * `bpmn/common/governance-dsl.ts`. SEAA'25 § 4.3: a collaboration block is
 * enclosed between an agentic diverging and an agentic merging gateway. The
 * agentic attributes live on `node.data` (`isAgentic`, `gatewayRole`, `role`,
 * `trustScore`); a node's lane is its `parentId`.
 */
import type { BesserNode } from "@/typings"
import type { BPMNGatewayType } from "@/types"
import { isSupervisorRole } from "@/types/bpmnAgentic"

// SEAA'25 § 4.3: collaboration constructs attach only to AgenticOR (inclusive)
// and AgenticAND (parallel) gateways.
export const AGENTIC_ELIGIBLE_GATEWAY_TYPES: ReadonlySet<BPMNGatewayType> =
  new Set<BPMNGatewayType>(["parallel", "inclusive"])

type AgenticData = {
  name?: string
  isAgentic?: boolean
  gatewayRole?: string
  role?: string
  trustScore?: number
}

/**
 * What the walkers read: a stored model or the live React Flow graph (whose
 * nodes have optional sizes), so the inspector passes its store as is.
 */
type FlowNode = {
  id: string
  type?: string
  parentId?: string
  data?: Record<string, unknown>
}
type FlowEdge = { source: string; target: string; type?: string }
export type CollaborationGraph<N extends FlowNode = BesserNode> = {
  nodes?: readonly N[]
  edges?: readonly FlowEdge[]
}

const dataOf = (node: FlowNode | undefined): AgenticData =>
  (node?.data ?? {}) as AgenticData

const isAgenticGateway = (node: FlowNode | undefined, role: string) =>
  node?.type === "bpmnGateway" &&
  dataOf(node).isAgentic === true &&
  dataOf(node).gatewayRole === role

const isSequenceFlow = (edge: FlowEdge) => edge.type === "BPMNSequenceFlow"

const nodeIndex = <N extends FlowNode>(model: CollaborationGraph<N>): Map<string, N> =>
  new Map((model.nodes ?? []).map((n) => [n.id, n]))

// Max BFS depth — guards against degenerate flow graphs. Typical BPMN
// diagrams stay well under this.
const MAX_COLLAB_WALK_DEPTH = 50

/**
 * Backward BFS from `elementId` via incoming sequence flows. Returns the id of
 * the nearest *enclosing* agentic diverging gateway, or undefined. Meeting an
 * agentic merging gateway recurses to its paired diverging gateway and resumes
 * from there, so an outer merging resolves to the outer diverging gateway.
 * `visited` is shared across the recursion; cycle-safe.
 */
function findUpstreamDivergingGatewayId(
  elementId: string,
  model: CollaborationGraph<FlowNode>,
  nodes: Map<string, FlowNode>,
  visited: Set<string> = new Set()
): string | undefined {
  let frontier: string[] = [elementId]
  for (
    let depth = 0;
    depth < MAX_COLLAB_WALK_DEPTH && frontier.length > 0;
    depth++
  ) {
    const next: string[] = []
    for (const id of frontier) {
      if (visited.has(id)) continue
      visited.add(id)
      for (const flow of model.edges ?? []) {
        if (!isSequenceFlow(flow) || flow.target !== id) continue
        const srcId = flow.source
        if (visited.has(srcId)) continue
        const src = nodes.get(srcId)
        if (isAgenticGateway(src, "diverging")) return srcId
        if (isAgenticGateway(src, "merging")) {
          // Inner block boundary — continue from its paired diverging gateway.
          const inner = findUpstreamDivergingGatewayId(
            srcId,
            model,
            nodes,
            visited
          )
          if (inner !== undefined && !visited.has(inner)) {
            next.push(inner)
            continue
          }
        }
        next.push(srcId)
      }
    }
    frontier = next
  }
  return undefined
}

/**
 * Forward BFS from a diverging gateway via outgoing sequence flows. Returns
 * the id of the paired agentic merging gateway, skipping nested blocks.
 */
function findPairedMergingGatewayId(
  divergingGatewayId: string,
  model: CollaborationGraph<FlowNode>,
  nodes: Map<string, FlowNode>,
  visited: Set<string> = new Set()
): string | undefined {
  let frontier: string[] = [divergingGatewayId]
  for (
    let depth = 0;
    depth < MAX_COLLAB_WALK_DEPTH && frontier.length > 0;
    depth++
  ) {
    const next: string[] = []
    for (const id of frontier) {
      if (visited.has(id)) continue
      visited.add(id)
      for (const flow of model.edges ?? []) {
        if (!isSequenceFlow(flow) || flow.source !== id) continue
        const tgtId = flow.target
        if (visited.has(tgtId)) continue
        const tgt = nodes.get(tgtId)
        if (isAgenticGateway(tgt, "merging")) return tgtId
        if (isAgenticGateway(tgt, "diverging")) {
          const inner = findPairedMergingGatewayId(tgtId, model, nodes, visited)
          if (inner !== undefined && !visited.has(inner)) {
            next.push(inner)
            continue
          }
        }
        next.push(tgtId)
      }
    }
    frontier = next
  }
  return undefined
}

/**
 * The nearest *enclosing* agentic diverging gateway of `elementId`, walking
 * back via incoming sequence flows; handles nested collaboration blocks.
 */
export function resolveUpstreamDivergingGateway<N extends FlowNode>(
  elementId: string,
  model: CollaborationGraph<N>
): N | undefined {
  const nodes = nodeIndex(model)
  const id = findUpstreamDivergingGatewayId(elementId, model, nodes)
  return id === undefined ? undefined : nodes.get(id)
}

/**
 * Every agentic task and merging gateway *within* the collaboration block
 * opened by `divergingGatewayId`: nested blocks are skipped via their paired
 * merging gateway, and the walk stops at this block's merging gateway. Used to
 * propagate a diverging gateway's `gatewayType` to its merging gateways.
 */
export function findDownstreamAgenticConstructs(
  divergingGatewayId: string,
  model: CollaborationGraph<FlowNode>
): { taskIds: string[]; mergingGatewayIds: string[] } {
  const nodes = nodeIndex(model)
  const visited = new Set<string>([divergingGatewayId])
  const queue: string[] = [divergingGatewayId]
  const taskIds: string[] = []
  const mergingGatewayIds: string[] = []
  while (queue.length > 0) {
    const current = queue.shift()!
    for (const flow of model.edges ?? []) {
      if (!isSequenceFlow(flow) || flow.source !== current) continue
      const tgtId = flow.target
      if (visited.has(tgtId)) continue
      visited.add(tgtId)
      const tgt = nodes.get(tgtId)
      if (!tgt) continue
      // Nested block: jump past it via its paired merging gateway.
      if (isAgenticGateway(tgt, "diverging")) {
        const inner = findPairedMergingGatewayId(tgtId, model, nodes)
        if (inner !== undefined && !visited.has(inner)) {
          visited.add(inner)
          queue.push(inner)
        }
        continue
      }
      // Paired merging (end of THIS block): record and stop descending.
      if (isAgenticGateway(tgt, "merging")) {
        mergingGatewayIds.push(tgtId)
        continue
      }
      if (tgt.type === "bpmnTask" && dataOf(tgt).isAgentic === true) {
        taskIds.push(tgtId)
      }
      queue.push(tgtId)
    }
  }
  return { taskIds, mergingGatewayIds }
}

/** Ids of agentic merging gateways that have no upstream diverging gateway. */
export function findOrphanedMergingGateways(
  model: CollaborationGraph<FlowNode>
): string[] {
  return (model.nodes ?? [])
    .filter((node) => isAgenticGateway(node, "merging"))
    .filter((node) => resolveUpstreamDivergingGateway(node.id, model) === undefined)
    .map((node) => node.id)
}

// ─── Governance DSL ──────────────────────────────────────────────────────────

// govdsl FLOAT requires a decimal point ([0-9]+ '.' [0-9]+) — always emit 2 dp.
const float2 = (n: number): string => n.toFixed(2)

// govdsl ID = [a-zA-Z_][a-zA-Z0-9_/-]*  (spec §4.5). BPMN names allow spaces /
// punctuation; collapse the rest to '_', prefix '_' if it can't lead an ID.
function sanitizeId(raw: string | undefined, fallback: string): string {
  const base = (raw ?? "").trim()
  if (!base) return fallback
  const s = base.replace(/[^a-zA-Z0-9_/-]/g, "_")
  return /^[a-zA-Z_]/.test(s) ? s : "_" + s
}

// A name written into a `//` comment must stay on that comment's line.
const commentText = (raw: string): string => raw.replace(/[\r\n]+/g, " ")

// The governance policies offered on an agentic merging gateway
// (LazyConsensus / Composed stay manual-only). The values are the govdsl
// PolicyType keywords.
export type GovPolicyType =
  | "MajorityPolicy"
  | "AbsoluteMajorityPolicy"
  | "LeaderDrivenPolicy"
  | "ConsensusPolicy"

export const GOV_POLICY_TYPES: readonly GovPolicyType[] = [
  "MajorityPolicy",
  "AbsoluteMajorityPolicy",
  "LeaderDrivenPolicy",
  "ConsensusPolicy",
]

// The voting family takes a FIXED default ratio (never trustScore-derived);
// the leader-driven and consensus skeletons omit Parameters.
const policyRatio = (policyType: GovPolicyType): number | undefined =>
  policyType === "MajorityPolicy" || policyType === "AbsoluteMajorityPolicy"
    ? 0.5
    : undefined

/**
 * Generate a starter Governance-DSL (.gov) instance for an agentic *merging*
 * gateway. Pure; the caller stores it on the gateway's `governanceDsl`.
 */
export function generateGovernanceDsl(
  mergingGatewayId: string,
  model: CollaborationGraph<FlowNode>,
  policyType: GovPolicyType
): string {
  const nodes = nodeIndex(model)
  const gw = nodes.get(mergingGatewayId)
  const gwData = dataOf(gw)
  const trust = typeof gwData.trustScore === "number" ? gwData.trustScore : 0
  const ratio = policyRatio(policyType)

  // Scope = the merging gateway itself (the one-per-block anchor).
  const scopeId = sanitizeId(
    gwData.name,
    `MergeDecision_${mergingGatewayId.slice(0, 8)}`
  )
  const policyId = `${scopeId}Policy`

  // Participants = the agentic lanes of the block. Lane-level isAgentic is
  // what counts: a plain task inside an agentic lane is a valid participant.
  const lanes = new Map<string, FlowNode>()
  const addLaneOf = (node: FlowNode | undefined) => {
    const lane = node?.parentId ? nodes.get(node.parentId) : undefined
    if (lane && dataOf(lane).isAgentic) lanes.set(lane.id, lane)
  }
  const diverging = resolveUpstreamDivergingGateway(mergingGatewayId, model)
  if (diverging) {
    // The gateways may be the only elements of the manager lane; neither is
    // collected by the walk below, so seed both owners explicitly.
    addLaneOf(diverging)
    addLaneOf(gw)

    const visited = new Set<string>([diverging.id])
    const queue: string[] = [diverging.id]
    while (queue.length > 0) {
      const cur = queue.shift()!
      for (const flow of model.edges ?? []) {
        if (!isSequenceFlow(flow) || flow.source !== cur) continue
        const tgtId = flow.target
        if (visited.has(tgtId)) continue
        visited.add(tgtId)
        const tgt = nodes.get(tgtId)
        if (!tgt) continue
        // Stop at the paired agentic merging gateway (block boundary).
        if (isAgenticGateway(tgt, "merging")) continue
        addLaneOf(tgt)
        queue.push(tgtId)
      }
    }
  }

  // LeaderDrivenPolicy: the supervision lanes decide, when there are any.
  const allLanes = Array.from(lanes.values())
  const supervisionLanes = allLanes.filter((l) =>
    isSupervisorRole(dataOf(l).role)
  )
  const participantLanes =
    policyType === "LeaderDrivenPolicy" && supervisionLanes.length > 0
      ? supervisionLanes
      : allLanes

  // Participant ids must be unique: lanes with the same name get _2, _3, ...
  const agents: { id: string; confidence: string }[] = []
  const usedIds = new Set<string>()
  for (const lane of participantLanes) {
    const laneData = dataOf(lane)
    const base = sanitizeId(laneData.name, `Agent_${lane.id.slice(0, 8)}`)
    let id = base
    for (let i = 2; usedIds.has(id); i++) id = `${base}_${i}`
    usedIds.add(id)
    agents.push({
      id,
      confidence: float2(
        (typeof laneData.trustScore === "number" ? laneData.trustScore : 0) /
          100
      ),
    })
  }
  if (agents.length === 0) {
    // govdsl requires a non-empty participant set (spec §4.2).
    agents.push({ id: "Participant", confidence: float2(0) })
  }

  const L: string[] = []
  L.push(
    `// Generated from agentic merging gateway "${commentText(
      gwData.name ?? mergingGatewayId
    )}"`
  )
  L.push(`// policyType=${policyType}, trustScore=${trust}`)
  L.push("Scopes:")
  L.push("    Tasks:")
  L.push(`        ${scopeId}`)
  L.push("Participants:")
  if (participantLanes.length === 0) {
    L.push(
      "    // No agentic lanes were found in the block: replace the placeholder agent."
    )
  }
  L.push("    Individuals :")
  agents.forEach((a, i) => {
    L.push(
      `        (Agent) ${a.id} { confidence : ${a.confidence} }${
        i < agents.length - 1 ? "," : ""
      }`
    )
  })
  L.push(`${policyType} ${policyId} {`)
  L.push(`    Scope: ${scopeId}`)
  L.push("    DecisionType as BooleanDecision")
  L.push(`    Participant list : ${agents.map((a) => a.id).join(", ")}`)
  if (ratio !== undefined) {
    L.push("    Parameters:")
    L.push(`        ratio : ${ratio}`)
  }
  L.push("}")
  return L.join("\n")
}
