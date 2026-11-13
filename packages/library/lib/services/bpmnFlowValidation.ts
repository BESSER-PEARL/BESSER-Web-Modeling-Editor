/**
 * BPMN flow rules, expressed against the v4 model.
 *
 * Port of develop's `bpmn-flow/bpmn-flow-semantics.ts` +
 * `bpmn-flow-validator.ts`. The v3 editor had a single `BPMNFlow`
 * relationship carrying a `flowType` discriminator; in v4 the flavour is
 * the React Flow edge `type` (`BPMNSequenceFlow` / `BPMNMessageFlow` /
 * `BPMNAssociationFlow` / `BPMNDataAssociationFlow`). The legality table
 * itself lives in `utils/edgeUtils.ts` (`getAllowedBpmnFlowEdgeTypes`,
 * shared with the canvas connection rules) — this module maps it back onto
 * develop's `BpmnFlowType` vocabulary so the XML importer / exporter and
 * the assistant can validate models with the same rules the canvas
 * enforces up-front.
 */
import type { BesserEdge, BesserNode, DiagramEdgeType, UMLModel } from "@/typings"
import { getAllowedBpmnFlowEdgeTypes } from "@/utils/edgeUtils"

/** BPMN 2.0 flow flavours, develop's vocabulary (also the XML exporter's). */
export type BpmnFlowType =
  | "sequence"
  | "message"
  | "association"
  | "data association"

/** v4 edge types that are BPMN flows. */
export const BPMN_FLOW_EDGE_TYPES: readonly DiagramEdgeType[] = [
  "BPMNSequenceFlow",
  "BPMNMessageFlow",
  "BPMNAssociationFlow",
  "BPMNDataAssociationFlow",
]

const EDGE_TYPE_TO_FLOW_TYPE: Record<string, BpmnFlowType> = {
  BPMNSequenceFlow: "sequence",
  BPMNMessageFlow: "message",
  BPMNAssociationFlow: "association",
  BPMNDataAssociationFlow: "data association",
}

const FLOW_TYPE_TO_EDGE_TYPE: Record<BpmnFlowType, DiagramEdgeType> = {
  sequence: "BPMNSequenceFlow",
  message: "BPMNMessageFlow",
  association: "BPMNAssociationFlow",
  "data association": "BPMNDataAssociationFlow",
}

/** `BPMNSequenceFlow` → `'sequence'`; `undefined` for non-BPMN edge types. */
export const bpmnEdgeTypeToFlowType = (
  edgeType: string | undefined
): BpmnFlowType | undefined =>
  edgeType ? EDGE_TYPE_TO_FLOW_TYPE[edgeType] : undefined

/** `'sequence'` → `BPMNSequenceFlow`. */
export const bpmnFlowTypeToEdgeType = (flowType: BpmnFlowType): DiagramEdgeType =>
  FLOW_TYPE_TO_EDGE_TYPE[flowType]

/** True when the edge is one of the four BPMN flow flavours. */
export const isBpmnFlowEdge = (edge: { type?: string } | undefined): boolean =>
  !!edge && edge.type !== undefined && edge.type in EDGE_TYPE_TO_FLOW_TYPE

/**
 * Every flow flavour legal between a source/target node-type pair
 * (v4 node types, e.g. `bpmnTask` → `bpmnGateway`). Empty when the pair
 * cannot be connected at all (e.g. data object ↔ data object).
 */
export function getAllowedBpmnFlowTypes(
  sourceType: string,
  targetType: string
): BpmnFlowType[] {
  return getAllowedBpmnFlowEdgeTypes(sourceType, targetType)
    .map((edgeType) => EDGE_TYPE_TO_FLOW_TYPE[edgeType])
    .filter((flowType): flowType is BpmnFlowType => flowType !== undefined)
}

/**
 * Deterministic pick among the legal flavours:
 * sequence > message > data association > association.
 */
export function getDefaultBpmnFlowType(allowed: BpmnFlowType[]): BpmnFlowType {
  if (allowed.includes("sequence")) return "sequence"
  if (allowed.includes("message")) return "message"
  if (allowed.includes("data association")) return "data association"
  return "association"
}

// BPMN 2.0.2 § 8.3.13, p. 98 + §§ 10.5.4 / 10.5.6: a default outgoing
// sequence flow may originate only from an Exclusive / Inclusive / Complex
// gateway or an Activity. Single source of truth for the edge popover, the
// XML exporter and the XML importer.
const DEFAULT_ELIGIBLE_ACTIVITY_TYPES: ReadonlySet<string> = new Set([
  "bpmnTask",
  "bpmnSubprocess",
  "bpmnTransaction",
  "bpmnCallActivity",
])
const DEFAULT_ELIGIBLE_GATEWAY_TYPES: ReadonlySet<string> = new Set([
  "exclusive",
  "inclusive",
  "complex",
])

/**
 * Duck-typed source node: a full `BesserNode`, a React Flow node, or any
 * `{ type, data?: { gatewayType? } }` object. `gatewayType` only exists on
 * `bpmnGateway` (`BPMNGatewayProps`); a gateway without one is treated as
 * the palette default (`exclusive`), matching the node's rendering.
 */
export interface DefaultFlowSource {
  type?: string
  data?: { gatewayType?: unknown; [key: string]: unknown }
}

/** BPMN 2.0.2 § 8.3.13 — can this node be the source of a default sequence flow? */
export function canSourceCarryDefault(
  source: BesserNode | DefaultFlowSource | undefined
): boolean {
  if (!source || typeof source.type !== "string") return false
  if (DEFAULT_ELIGIBLE_ACTIVITY_TYPES.has(source.type)) return true
  if (source.type !== "bpmnGateway") return false
  const gatewayType = source.data?.gatewayType
  const resolved =
    typeof gatewayType === "string" && gatewayType.length > 0
      ? gatewayType
      : "exclusive"
  return DEFAULT_ELIGIBLE_GATEWAY_TYPES.has(resolved)
}

export type BPMNFlowValidationCode =
  | "missing-endpoint"
  | "illegal-flow-type"
  | "default-flow-illegal-source"

export interface BPMNFlowValidationWarning {
  code: BPMNFlowValidationCode
  flowId: string
  flowName?: string
  sourceId?: string
  targetId?: string
  message: string
}

const flowName = (edge: BesserEdge): string | undefined => {
  const data = edge.data as { name?: unknown; label?: unknown } | undefined
  const name =
    typeof data?.name === "string" && data.name.length > 0
      ? data.name
      : typeof data?.label === "string" && data.label.length > 0
        ? data.label
        : undefined
  return name
}

/**
 * Validate a single BPMN flow edge against its endpoints. Returns zero or
 * more warnings; never throws. Non-BPMN edge types yield no warnings.
 */
export function validateBpmnFlow(
  edge: BesserEdge,
  nodesById: Record<string, BesserNode>
): BPMNFlowValidationWarning[] {
  const warnings: BPMNFlowValidationWarning[] = []
  const flowType = bpmnEdgeTypeToFlowType(edge.type)
  if (!flowType) return warnings

  const name = flowName(edge)
  const source = nodesById[edge.source]
  const target = nodesById[edge.target]

  if (!source || !target) {
    warnings.push({
      code: "missing-endpoint",
      flowId: edge.id,
      ...(name !== undefined && { flowName: name }),
      sourceId: edge.source,
      targetId: edge.target,
      message: `Flow ${edge.id} references a missing ${
        !source ? "source" : "target"
      } element.`,
    })
    return warnings // can't check the rest without endpoints
  }

  const allowed = getAllowedBpmnFlowTypes(source.type, target.type)
  if (!allowed.includes(flowType)) {
    warnings.push({
      code: "illegal-flow-type",
      flowId: edge.id,
      ...(name !== undefined && { flowName: name }),
      sourceId: source.id,
      targetId: target.id,
      message: `Illegal flow type "${flowType}" for ${source.type} → ${
        target.type
      } (allowed: ${allowed.join(", ") || "none"}).`,
    })
  }

  const isDefault = (edge.data as { isDefault?: unknown } | undefined)?.isDefault === true
  if (isDefault && (flowType !== "sequence" || !canSourceCarryDefault(source))) {
    warnings.push({
      code: "default-flow-illegal-source",
      flowId: edge.id,
      ...(name !== undefined && { flowName: name }),
      sourceId: source.id,
      targetId: target.id,
      message: `Flow ${edge.id} is marked default but its source ${
        source.type
      } cannot carry a default sequence flow.`,
    })
  }

  return warnings
}

/** Validate every BPMN flow edge in a v4 model. */
export function validateAllBpmnFlows(model: UMLModel): BPMNFlowValidationWarning[] {
  const nodesById: Record<string, BesserNode> = {}
  for (const node of model.nodes ?? []) {
    nodesById[node.id] = node
  }
  const out: BPMNFlowValidationWarning[] = []
  for (const edge of model.edges ?? []) {
    if (!isBpmnFlowEdge(edge)) continue
    out.push(...validateBpmnFlow(edge, nodesById))
  }
  return out
}
