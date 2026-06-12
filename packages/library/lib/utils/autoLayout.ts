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

/**
 * Computes new positions for every node using ELK's layered algorithm.
 * Edge-anchored edges (e.g. ClassLinkRel pointing at an association edge id)
 * are excluded from the graph — ELK only understands node endpoints.
 * Returns a NEW nodes array; data, dimensions and everything else preserved.
 */
export const computeAutoLayout = async (
  nodes: Node[],
  edges: Edge[],
  diagramType: string,
): Promise<Node[]> => {
  if (nodes.length === 0) return nodes

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

  return nodes.map((node) => {
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
}

const findElkNode = (root: ElkNode, id: string): ElkNode | undefined => {
  for (const child of root.children ?? []) {
    if (child.id === id) return child
    const nested = findElkNode(child, id)
    if (nested) return nested
  }
  return undefined
}
