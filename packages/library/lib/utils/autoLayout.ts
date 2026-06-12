import ELK from "elkjs/lib/elk.bundled.js"
import type { ElkExtendedEdge, ElkNode } from "elkjs/lib/elk.bundled.js"
import type { Edge, Node } from "@xyflow/react"
import { UMLDiagramType } from "@/types"

const DEFAULT_NODE_WIDTH = 160
const DEFAULT_NODE_HEIGHT = 100

// Diagrams that read left-to-right (flows) lay out RIGHT; structural diagrams lay out DOWN.
const HORIZONTAL_DIAGRAMS: ReadonlySet<string> = new Set([
  UMLDiagramType.StateMachineDiagram,
  UMLDiagramType.AgentDiagram,
  UMLDiagramType.Flowchart,
  UMLDiagramType.BPMN,
  UMLDiagramType.NNDiagram,
])

export const getLayoutDirection = (diagramType: string): "DOWN" | "RIGHT" =>
  HORIZONTAL_DIAGRAMS.has(diagramType) ? "RIGHT" : "DOWN"

const nodeSize = (node: Node): { width: number; height: number } => ({
  width: node.measured?.width ?? node.width ?? DEFAULT_NODE_WIDTH,
  height: node.measured?.height ?? node.height ?? DEFAULT_NODE_HEIGHT,
})

/**
 * Builds the ELK graph mirroring React Flow's parentId hierarchy so compound
 * containers (e.g. NNContainer) are laid out with their children inside.
 */
const buildElkHierarchy = (nodes: Node[]): ElkNode[] => {
  const elkById = new Map<string, ElkNode>()
  for (const node of nodes) {
    const { width, height } = nodeSize(node)
    elkById.set(node.id, { id: node.id, width, height })
  }
  const roots: ElkNode[] = []
  for (const node of nodes) {
    const elkNode = elkById.get(node.id)!
    const parent = node.parentId ? elkById.get(node.parentId) : undefined
    if (parent) {
      parent.children = parent.children ?? []
      parent.children.push(elkNode)
    } else {
      roots.push(elkNode)
    }
  }
  return roots
}

/** Absolute centre of a node, accounting for parentId nesting. */
const absoluteCenter = (
  node: Node,
  byId: ReadonlyMap<string, Node>,
): { x: number; y: number } => {
  let x = node.position.x
  let y = node.position.y
  const seen = new Set<string>([node.id])
  let parentId = node.parentId
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId)
    const parent = byId.get(parentId)
    if (!parent) break
    x += parent.position.x
    y += parent.position.y
    parentId = parent.parentId
  }
  const { width, height } = nodeSize(node)
  return { x: x + width / 2, y: y + height / 2 }
}

/**
 * Picks the facing handle pair for an edge from the relative position of its
 * two endpoints, so a vertically stacked pair connects bottom→top (and a
 * side-by-side pair connects right→left) instead of wrapping around the boxes.
 * Returns the centre handle ids ("top"/"right"/"bottom"/"left").
 */
export const chooseFacingHandles = (
  sourceCenter: { x: number; y: number },
  targetCenter: { x: number; y: number },
): { sourceHandle: string; targetHandle: string } => {
  const dx = targetCenter.x - sourceCenter.x
  const dy = targetCenter.y - sourceCenter.y
  if (Math.abs(dy) >= Math.abs(dx)) {
    return dy >= 0
      ? { sourceHandle: "bottom", targetHandle: "top" }
      : { sourceHandle: "top", targetHandle: "bottom" }
  }
  return dx >= 0
    ? { sourceHandle: "right", targetHandle: "left" }
    : { sourceHandle: "left", targetHandle: "right" }
}

/**
 * Computes new positions for every node using ELK's layered algorithm, and
 * reassigns each edge's source/target handle to the facing sides of the
 * laid-out nodes. Edge-anchored edges (e.g. ClassLinkRel pointing at an
 * association edge id) are excluded from the graph — ELK only understands
 * node endpoints — and their handles are left untouched.
 * Returns NEW nodes and edges arrays; all other data is preserved.
 */
export const computeAutoLayout = async (
  nodes: Node[],
  edges: Edge[],
  diagramType: string,
): Promise<{ nodes: Node[]; edges: Edge[] }> => {
  if (nodes.length === 0) return { nodes, edges }

  const nodeIds = new Set(nodes.map((n) => n.id))
  const elkEdges: ElkExtendedEdge[] = edges
    .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
    .map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] }))

  const direction = getLayoutDirection(diagramType)
  const graph: ElkNode = {
    id: "besser-auto-layout-root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": direction,
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.spacing.nodeNode": "60",
      "elk.layered.spacing.nodeNodeBetweenLayers": "90",
      "elk.hierarchyHandling": "INCLUDE_CHILDREN",
      "elk.padding": "[top=50,left=30,bottom=30,right=30]",
    },
    children: buildElkHierarchy(nodes),
    edges: elkEdges,
  }

  const elk = new ELK()
  const layouted = await elk.layout(graph)

  // ELK child coordinates are relative to their parent — exactly what
  // React Flow expects for nodes with parentId.
  const positionById = new Map<string, { x: number; y: number }>()
  const collect = (elkNode: ElkNode) => {
    for (const child of elkNode.children ?? []) {
      positionById.set(child.id, { x: child.x ?? 0, y: child.y ?? 0 })
      collect(child)
    }
  }
  collect(layouted)

  const layoutedNodes = nodes.map((node) => {
    const position = positionById.get(node.id)
    if (!position) return node
    const size = nodeSize(node)
    // Containers grow to fit their laid-out children.
    const elkNode = findElkNode(layouted, node.id)
    const resized =
      elkNode && (elkNode.children?.length ?? 0) > 0
        ? { width: elkNode.width ?? size.width, height: elkNode.height ?? size.height }
        : {}
    return { ...node, position, ...resized }
  })

  // Reassign each node-to-node edge to the facing handles of the new layout.
  const layoutedById = new Map(layoutedNodes.map((n) => [n.id, n]))
  const layoutedEdges = edges.map((edge) => {
    const source = layoutedById.get(edge.source)
    const target = layoutedById.get(edge.target)
    if (!source || !target) return edge // edge-anchored / dangling — leave as-is
    const { sourceHandle, targetHandle } = chooseFacingHandles(
      absoluteCenter(source, layoutedById),
      absoluteCenter(target, layoutedById),
    )
    if (edge.sourceHandle === sourceHandle && edge.targetHandle === targetHandle) {
      return edge
    }
    return { ...edge, sourceHandle, targetHandle }
  })

  return { nodes: layoutedNodes, edges: layoutedEdges }
}

const findElkNode = (root: ElkNode, id: string): ElkNode | undefined => {
  for (const child of root.children ?? []) {
    if (child.id === id) return child
    const nested = findElkNode(child, id)
    if (nested) return nested
  }
  return undefined
}
