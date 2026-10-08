/**
 * Pure decisions behind creating an edge by drag (`useConnect`): which
 * handle a drop on a node body lands on, BPMN flows across pools, object
 * link association preselection and why a connection is refused.
 */
import {
  chooseFacingSidesForRects,
  getSideHandles,
  sidePoint,
  type LayoutPoint,
  type LayoutRect,
} from "@/utils/autoLayoutHandles"
import { getAllowedBpmnFlowEdgeTypes } from "@/utils/edgeUtils"
import { isEnumerationClassNode } from "@/utils/bpmnConstraints"
import { diagramBridge } from "@/services/diagramBridge"

interface MinimalNode {
  id: string
  type?: string
  parentId?: string
  data?: object | null
}

interface MinimalEdge {
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
}

/** A drop this close to a node's border aims at that border's handle. */
export const BORDER_MARGIN = 12

export const isInteriorPoint = (
  point: LayoutPoint,
  rect: LayoutRect,
  margin = BORDER_MARGIN
) =>
  point.x > rect.x + margin &&
  point.x < rect.x + rect.width - margin &&
  point.y > rect.y + margin &&
  point.y < rect.y + rect.height - margin

/**
 * Target handle for a connection dropped inside a node's body: the side
 * facing the source, and on it the handle nearest the source that no other
 * edge end uses yet (so two edges from different nodes don't share a port).
 */
export const pickBodyDropHandle = ({
  nodeId,
  nodeType,
  rect,
  sourceRect,
  edges,
  centreOnly = false,
}: {
  nodeId: string
  nodeType?: string
  rect: LayoutRect
  sourceRect: LayoutRect
  edges: readonly MinimalEdge[]
  centreOnly?: boolean
}): string => {
  const { targetSide } = chooseFacingSidesForRects(sourceRect, rect)
  const all = getSideHandles(nodeType, targetSide)
  const handles = centreOnly ? all.filter((h) => h.id === targetSide) : all
  const candidates = handles.length > 0 ? handles : [{ id: targetSide, fraction: 0.5 }]
  const used = new Set<string>()
  for (const e of edges) {
    if (e.target === nodeId && e.targetHandle) used.add(e.targetHandle)
    if (e.source === nodeId && e.sourceHandle) used.add(e.sourceHandle)
  }
  const sourceCentre = {
    x: sourceRect.x + sourceRect.width / 2,
    y: sourceRect.y + sourceRect.height / 2,
  }
  const horizontalSide = targetSide === "top" || targetSide === "bottom"
  const offset = (fraction: number) => {
    const p = sidePoint(rect, targetSide, fraction)
    return horizontalSide
      ? Math.abs(p.x - sourceCentre.x)
      : Math.abs(p.y - sourceCentre.y)
  }
  const free = candidates.filter((h) => !used.has(h.id))
  const pool = free.length > 0 ? free : candidates
  return pool.reduce((best, h) =>
    offset(h.fraction) < offset(best.fraction) ? h : best
  ).id
}

/** The BPMN pool a node sits in (through lanes / sub-processes), if any. */
export const owningPoolId = (
  nodeId: string | null | undefined,
  nodes: readonly MinimalNode[]
): string | undefined => {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  let current = nodeId ? byId.get(nodeId) : undefined
  const seen = new Set<string>()
  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    if (current.type === "bpmnPool") return current.id
    current = current.parentId ? byId.get(current.parentId) : undefined
  }
  return undefined
}

const crossesPools = (
  nodes: readonly MinimalNode[],
  source: string | null | undefined,
  target: string | null | undefined
) => {
  const sourcePool = owningPoolId(source, nodes)
  const targetPool = owningPoolId(target, nodes)
  return !!sourcePool && !!targetPool && sourcePool !== targetPool
}

/**
 * Sequence flows stay inside one pool: across pools the flow becomes a
 * message flow, or is refused (`null`) when the pair can't exchange messages
 * (e.g. a gateway). A message flow is refused inside one pool.
 */
export const resolveCrossPoolFlowType = <T extends string>(
  resolvedType: T,
  nodes: readonly MinimalNode[],
  source: string,
  target: string
): T | "BPMNMessageFlow" | null => {
  if (resolvedType === "BPMNMessageFlow" && !crossesPools(nodes, source, target)) return null
  if (resolvedType !== "BPMNSequenceFlow") return resolvedType
  if (!crossesPools(nodes, source, target)) return resolvedType
  const sourceType = nodes.find((n) => n.id === source)?.type
  const targetType = nodes.find((n) => n.id === target)?.type
  return getAllowedBpmnFlowEdgeTypes(sourceType, targetType).includes("BPMNMessageFlow")
    ? "BPMNMessageFlow"
    : null
}

/** BPMN pair that can only be joined by a sequence flow, but sits in two pools. */
export const isRefusedCrossPoolFlow = (
  nodes: readonly MinimalNode[],
  source: string | null | undefined,
  target: string | null | undefined
): boolean => {
  if (!source || !target || !crossesPools(nodes, source, target)) return false
  const sourceType = nodes.find((n) => n.id === source)?.type
  const targetType = nodes.find((n) => n.id === target)?.type
  const allowed = getAllowedBpmnFlowEdgeTypes(sourceType, targetType)
  return allowed.length === 1 && allowed[0] === "BPMNSequenceFlow"
}

/**
 * BPMN pair only a message flow could join (end event -> task, task -> start
 * event), but not across two pools: `resolveCrossPoolFlowType` drops it, so
 * the drag must already show it as refused.
 */
export const isRefusedSamePoolMessageFlow = (
  nodes: readonly MinimalNode[],
  source: string | null | undefined,
  target: string | null | undefined
): boolean => {
  if (!source || !target || crossesPools(nodes, source, target)) return false
  const sourceType = nodes.find((n) => n.id === source)?.type
  const targetType = nodes.find((n) => n.id === target)?.type
  if (!sourceType?.startsWith("bpmn") || !targetType?.startsWith("bpmn")) return false
  const allowed = getAllowedBpmnFlowEdgeTypes(sourceType, targetType)
  return allowed.includes("BPMNMessageFlow") && !allowed.includes("BPMNSequenceFlow")
}

const classIdOf = (node: MinimalNode | undefined): string | undefined => {
  const raw = (node?.data as { classId?: unknown } | null | undefined)?.classId
  return typeof raw === "string" && raw ? raw : undefined
}

/**
 * Initial data for a new object / user-model link: when exactly one
 * association joins the two instances' classes it is preselected (named like
 * the link panel names it).
 */
export const preselectLinkAssociation = (
  sourceNode: MinimalNode | undefined,
  targetNode: MinimalNode | undefined
): { associationId: string; name: string } | undefined => {
  const sourceClassId = classIdOf(sourceNode)
  const targetClassId = classIdOf(targetNode)
  if (!sourceClassId || !targetClassId) return undefined
  try {
    const associations = diagramBridge.getAvailableAssociations(
      sourceClassId,
      targetClassId
    )
    if (associations.length !== 1) return undefined
    const nameOf = (n: MinimalNode | undefined) =>
      ((n?.data as { name?: string } | undefined)?.name || "Object")
    return {
      associationId: associations[0].id,
      name: diagramBridge.getRelationshipDisplayName(
        associations[0],
        nameOf(sourceNode),
        nameOf(targetNode)
      ),
    }
  } catch {
    return undefined
  }
}

export type RefusalReason =
  | "enumeration"
  | "objectNoAssociation"
  | "nnEndpoint"
  | "nnConfigurationTaken"
  | "bpmnCrossPool"
  | "bpmnIllegalFlow"
  | "bpmnMessageSamePool"
  | "stateCodeBlock"
  | "stateFinalOutgoing"
  | "stateInitialIncoming"
  | "generic"

const isNNSpecial = (t?: string) =>
  t === "TrainingDataset" ||
  t === "TestDataset" ||
  t === "Configuration" ||
  t === "NNContainer"

/** Why a connection the rules vetoed was refused (for the user-facing notice). */
export const refusalReason = (
  nodes: readonly MinimalNode[],
  source: string | null | undefined,
  target: string | null | undefined
): RefusalReason => {
  const sourceNode = nodes.find((n) => n.id === source)
  const targetNode = nodes.find((n) => n.id === target)
  const s = sourceNode?.type
  const t = targetNode?.type
  if (isEnumerationClassNode(sourceNode) || isEnumerationClassNode(targetNode)) {
    return "enumeration"
  }
  if (t === "objectName" || t === "UserModelName") return "objectNoAssociation"
  if (isNNSpecial(s) || isNNSpecial(t)) {
    const configToContainer =
      (s === "Configuration" && t === "NNContainer") ||
      (t === "Configuration" && s === "NNContainer")
    return configToContainer ? "nnConfigurationTaken" : "nnEndpoint"
  }
  if (s?.startsWith("bpmn") && t?.startsWith("bpmn")) {
    if (isRefusedCrossPoolFlow(nodes, source, target)) return "bpmnCrossPool"
    return isRefusedSamePoolMessageFlow(nodes, source, target)
      ? "bpmnMessageSamePool"
      : "bpmnIllegalFlow"
  }
  if (s === "StateCodeBlock" || t === "StateCodeBlock") return "stateCodeBlock"
  if (s === "StateFinalNode") return "stateFinalOutgoing"
  if (t === "StateInitialNode") return "stateInitialIncoming"
  return "generic"
}

export const REFUSAL_MESSAGES: Record<RefusalReason, string> = {
  enumeration:
    "Enumerations can't be connected; use them as attribute types instead.",
  objectNoAssociation:
    "These objects' classes have no association in the class diagram.",
  nnEndpoint:
    "Datasets and configurations connect only to an NN container.",
  nnConfigurationTaken: "This NN container already has a configuration.",
  bpmnCrossPool:
    "Sequence flows can't cross pools, and this element can't send message flows.",
  bpmnIllegalFlow: "BPMN doesn't allow a flow between these elements.",
  bpmnMessageSamePool:
    "End events can't start a flow and start events can't receive one; message flows only connect different pools.",
  stateCodeBlock:
    "Code blocks aren't connected; reference them by name from a state body or a transition.",
  stateFinalOutgoing: "A final state ends the state machine; no transition leaves it.",
  stateInitialIncoming:
    "The initial state only starts the state machine; no transition enters it.",
  generic: "These elements can't be connected.",
}
