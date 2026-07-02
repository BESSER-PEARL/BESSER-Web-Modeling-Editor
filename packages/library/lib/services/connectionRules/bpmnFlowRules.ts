/**
 * BPMNDiagram connection rules — up-front `isValidConnection` parity for
 * develop's post-hoc `illegal-flow-type` validation in
 * `bpmn/bpmn-flow/bpmn-flow-validator.ts`.
 *
 * Develop enumerates the legal flow subtypes for a source/target node
 * pair (`getAllowedBpmnFlowTypes` in bpmn-flow-semantics.ts) and, when a
 * drawn flow has no legal subtype, surfaces it as a validation warning.
 * The v4 port enforces the same legality *up-front* as a connection
 * rejection (React Flow's invalid-drag cursor), the same pattern
 * `nnDiagramRules.ts` uses for NN.
 *
 * Single source of truth: `getAllowedBpmnFlowEdgeTypes` in
 * `utils/edgeUtils.ts` (same relationship develop keeps between
 * bpmn-flow-validator.ts and bpmn-flow-semantics.ts). A pair with at
 * least one legal subtype passes; an empty allow-list is vetoed.
 *
 * Scoped by node type: only pairs where BOTH endpoints are `bpmn*` node
 * types are considered. Any pair touching a non-BPMN node (comment
 * tethering, cross-diagram) returns `undefined` (no opinion), so other
 * diagram families are never affected and no diagram-type threading is
 * needed.
 */
import { getAllowedBpmnFlowEdgeTypes } from "@/utils/edgeUtils"
import { registerConnectionRule, type DiagramConnectionRule } from "./registry"

const isBpmnNode = (t?: string): boolean => !!t && t.startsWith("bpmn")

/**
 * The BPMN flow-legality rule. Exported for direct unit testing;
 * registered once below.
 */
export const bpmnFlowConnectionRule: DiagramConnectionRule = ({
  sourceNode,
  targetNode,
}) => {
  const sourceType = sourceNode?.type
  const targetType = targetNode?.type
  if (!isBpmnNode(sourceType) || !isBpmnNode(targetType)) return undefined
  const allowed = getAllowedBpmnFlowEdgeTypes(sourceType, targetType)
  return allowed.length > 0 ? undefined : false
}

registerConnectionRule(bpmnFlowConnectionRule)
