/* eslint-disable */
import { generateUUID } from "@/utils"
import type { Node, Edge } from "@xyflow/react"
import { CANVAS } from "@/constants"

export interface ClipboardData {
  nodes: Node[]
  edges: Edge[]
  // Informational only; paste derives nesting from `parentId`. Optional so
  // clipboard JSON written by other builds still pastes.
  parentChildRelations?: Array<{
    parentId: string
    childId: string
    relativePosition: { x: number; y: number }
  }>
  timestamp?: number
}

export const calculateRelativePosition = (
  childNode: Node,
  parentNode: Node
) => {
  return {
    x: childNode.position.x - parentNode.position.x,
    y: childNode.position.y - parentNode.position.y,
  }
}

export const getAllDescendants = (
  nodeIds: string[],
  allNodes: Node[]
): Node[] => {
  const descendants: Node[] = []
  const visited = new Set<string>()

  const findChildren = (parentIds: string[]) => {
    const children = allNodes.filter(
      (node) =>
        node.parentId &&
        parentIds.includes(node.parentId) &&
        !visited.has(node.id)
    )

    children.forEach((child) => visited.add(child.id))
    descendants.push(...children)

    if (children.length > 0) {
      findChildren(children.map((child) => child.id))
    }
  }

  findChildren(nodeIds)
  return descendants
}

export const getAllNodesToInclude = (
  selectedElementIds: string[],
  allNodes: Node[]
) => {
  const selectedNodes = allNodes.filter((node) =>
    selectedElementIds.includes(node.id)
  )
  const descendants = getAllDescendants(selectedElementIds, allNodes)
  return [...selectedNodes, ...descendants]
}

/**
 * The edges a copy carries (upstream Apollon #817): those selected outright,
 * plus every edge running between two copied nodes. Box-select and
 * select-all mark connecting edges selected themselves, but clicking
 * elements one at a time selects nodes only -- without the second rule,
 * copying two clicked classes would drop the association between them.
 *
 * BESSER addition: an edge-anchored association-class link (`ClassLinkRel`
 * whose endpoint is an association EDGE id, see `associationClassLink.ts`)
 * is never rendered by React Flow, so it can never be selected; it travels
 * along when both of its endpoints (node or edge) are part of the copy.
 */
export const getRelevantEdges = (
  selectedElementIds: string[],
  allEdges: Edge[],
  copiedNodeIds: string[] = []
) => {
  const selected = new Set(selectedElementIds)
  const nodeIds = new Set(copiedNodeIds)
  const relevant = allEdges.filter(
    (edge) =>
      selected.has(edge.id) ||
      (nodeIds.has(edge.source) && nodeIds.has(edge.target))
  )
  const endpointIds = new Set([...nodeIds, ...relevant.map((e) => e.id)])
  const linkRels = allEdges.filter(
    (edge) =>
      edge.type === "ClassLinkRel" &&
      !relevant.includes(edge) &&
      endpointIds.has(edge.source) &&
      endpointIds.has(edge.target)
  )
  return [...relevant, ...linkRels]
}

export const buildParentChildRelations = (
  nodesToInclude: Node[],
  nodeIds: string[]
) => {
  const parentChildRelations: Array<{
    parentId: string
    childId: string
    relativePosition: { x: number; y: number }
  }> = []

  nodesToInclude.forEach((node) => {
    if (node.parentId && nodeIds.includes(node.parentId)) {
      const parentNode = nodesToInclude.find((n) => n.id === node.parentId)
      if (parentNode) {
        parentChildRelations.push({
          parentId: node.parentId,
          childId: node.id,
          relativePosition: calculateRelativePosition(node, parentNode),
        })
      }
    }
  })

  return parentChildRelations
}

export const getEdgesToRemove = (
  selectedElementIds: string[],
  expandedNodeIds: string[],
  allEdges: Edge[]
) => {
  const selectedEdges = allEdges.filter((edge) =>
    selectedElementIds.includes(edge.id)
  )
  const connectedEdges = allEdges.filter(
    (edge) =>
      expandedNodeIds.includes(edge.source) ||
      expandedNodeIds.includes(edge.target)
  )

  return new Set([
    ...selectedEdges.map((e) => e.id),
    ...connectedEdges.map((e) => e.id),
  ])
}

export const createClipboardData = (
  selectedElementIds: string[],
  allNodes: Node[],
  allEdges: Edge[]
): ClipboardData => {
  const allNodesToCopy = getAllNodesToInclude(selectedElementIds, allNodes)
  const allNodeIds = allNodesToCopy.map((node) => node.id)
  const allRelevantEdges = getRelevantEdges(
    selectedElementIds,
    allEdges,
    allNodeIds
  )
  const parentChildRelations = buildParentChildRelations(
    allNodesToCopy,
    allNodeIds
  )

  return {
    nodes: allNodesToCopy,
    edges: allRelevantEdges,
    parentChildRelations,
    timestamp: Date.now(),
  }
}

const hasStringId = (value: unknown): value is { id: string } =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  typeof (value as { id?: unknown }).id === "string"

/**
 * Row-level fields that point at a sibling row id of the copied model and
 * must follow a re-mint (an OCL pre/post row's `targetMethodId` names a
 * method row of its class). Cross-diagram links (`attributeId`, `classId`,
 * `stateMachineId`, ...) deliberately stay untouched -- the pasted copy
 * still refers to the same external element.
 */
const ROW_REFERENCE_KEYS = ["targetMethodId"] as const

/**
 * Node-level data fields that point at another canvas node id (the NN
 * container's `entryLayerId` names one of its child layers).
 */
const NODE_REFERENCE_KEYS = ["entryLayerId"] as const

/**
 * Re-mint the id of every item in EVERY id-bearing list of `data`
 * (upstream Apollon `remintNestedChildIds`, #826), recursing into the items
 * so nested lists are covered too. Row ids become top-level v3 element ids
 * on export and key inline editing, so a paste must never duplicate one.
 * Covers every BESSER list without naming it: class `attributes` /
 * `methods` (+ method `parameters`), `oclConstraints`, object / user-model
 * `attributes`, AgentState `bodies` / `fallbackBodies`, AgentIntent
 * `training_phrases` / `entity_slots`, State `bodies` / `fallbackBodies`,
 * SFC `actionRows`, communication-edge `messages`, ... Non-list shapes (the
 * NN layer `attributes` slug->value dict) have no ids and stay as they are.
 *
 * Old -> new ids are recorded in `idMap` so references can be remapped
 * afterwards (`remapRowReferences`). Pure: `data` is never mutated.
 */
export function remintNestedChildIds<T>(
  data: T,
  idMap: Map<string, string> = new Map()
): T {
  if (!data || typeof data !== "object" || Array.isArray(data)) return data
  const result: Record<string, unknown> = { ...(data as object) }
  for (const [key, value] of Object.entries(data as object)) {
    if (Array.isArray(value) && value.some(hasStringId)) {
      result[key] = value.map((item) => {
        if (!hasStringId(item)) return item
        const newId = generateUUID()
        idMap.set(item.id, newId)
        return { ...remintNestedChildIds(item, idMap), id: newId }
      })
    }
  }
  return result as T
}

/** Point row references (`ROW_REFERENCE_KEYS`) at their re-minted rows. */
export function remapRowReferences<T>(data: T, idMap: Map<string, string>): T {
  if (!data || typeof data !== "object") return data
  if (Array.isArray(data)) {
    return data.map((item) => remapRowReferences(item, idMap)) as T
  }
  let changed = false
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data as object)) {
    let next: unknown = value
    if (
      (ROW_REFERENCE_KEYS as readonly string[]).includes(key) &&
      typeof value === "string" &&
      idMap.has(value)
    ) {
      next = idMap.get(value)
    } else if (value && typeof value === "object") {
      next = remapRowReferences(value, idMap)
    }
    if (next !== value) changed = true
    result[key] = next
  }
  return (changed ? result : data) as T
}

export const createNewNodeDataWithNewIds = (
  originalNodeData: any,
  idMap: Map<string, string> = new Map()
) => {
  if (!originalNodeData) return originalNodeData
  return remapRowReferences(
    remintNestedChildIds(originalNodeData, idMap),
    idMap
  )
}

export interface MaterializedClipboard {
  nodes: Node[]
  edges: Edge[]
  /** Ids of every materialized node and edge, for selecting them afterwards. */
  newElementIds: string[]
}

/**
 * Turn `ClipboardData` into insert-ready nodes/edges (upstream Apollon
 * #817 `materializeClipboardData`): fresh element ids, fresh ids in every
 * nested id-bearing list, parent / edge-endpoint / in-data references
 * remapped onto the new ids, and every TOP-LEVEL position shifted by
 * `PASTE_OFFSET_PX x offsetMultiplier` so repeated pastes cascade. A
 * child whose parent is part of the paste keeps its relative position --
 * the parent already carries the whole offset, so moving the child too
 * would drift it inside its own frame (the old double offset).
 */
export const materializeClipboardData = (
  clipboardData: ClipboardData,
  offsetMultiplier: number
): MaterializedClipboard => {
  const nodeIdMap = new Map<string, string>()
  const edgeIdMap = new Map<string, string>()
  const rowIdMap = new Map<string, string>()
  const newElementIds: string[] = []
  const progressiveOffset = CANVAS.PASTE_OFFSET_PX * offsetMultiplier

  clipboardData.nodes.forEach((node) => {
    const newId = generateUUID()
    nodeIdMap.set(node.id, newId)
    newElementIds.push(newId)
  })
  clipboardData.edges.forEach((edge) => {
    edgeIdMap.set(edge.id, generateUUID())
  })

  // Re-mint every node's rows first so cross-node row references (a
  // free-standing OCL constraint's `targetMethodId` on a copied class)
  // resolve against the complete map.
  const reminted = clipboardData.nodes.map((node) =>
    remintNestedChildIds(node.data, rowIdMap)
  )

  const materializedNodes = clipboardData.nodes.map((node, index) => {
    let data = remapRowReferences(reminted[index], rowIdMap) as Node["data"]
    for (const key of NODE_REFERENCE_KEYS) {
      const ref = data?.[key]
      if (typeof ref === "string" && nodeIdMap.has(ref)) {
        data = { ...data, [key]: nodeIdMap.get(ref)! }
      }
    }
    const materialized: Node = {
      ...node,
      id: nodeIdMap.get(node.id)!,
      selected: true,
      data,
    }

    if (node.parentId && nodeIdMap.has(node.parentId)) {
      return { ...materialized, parentId: nodeIdMap.get(node.parentId)! }
    }

    return {
      ...materialized,
      position: {
        x: node.position.x + progressiveOffset,
        y: node.position.y + progressiveOffset,
      },
    }
  })

  const resolveEndpoint = (id: string) => nodeIdMap.get(id) ?? edgeIdMap.get(id)

  const materializedEdges = clipboardData.edges
    .filter(
      (edge) =>
        resolveEndpoint(edge.source) !== undefined &&
        resolveEndpoint(edge.target) !== undefined
    )
    .map((edge) => {
      const newId = edgeIdMap.get(edge.id)!
      newElementIds.push(newId)
      const data = edge.data
        ? (createNewNodeDataWithNewIds(edge.data, rowIdMap) as Edge["data"])
        : edge.data
      return {
        ...edge,
        id: newId,
        source: resolveEndpoint(edge.source)!,
        target: resolveEndpoint(edge.target)!,
        selected: true,
        data: {
          ...data,
          points: Array.isArray(edge.data?.points)
            ? (edge.data.points as Array<{ x: number; y: number }>).map(
                (point) => ({
                  x: point.x + progressiveOffset,
                  y: point.y + progressiveOffset,
                })
              )
            : undefined,
        },
      } as Edge
    })

  return {
    nodes: materializedNodes,
    edges: materializedEdges,
    newElementIds,
  }
}
