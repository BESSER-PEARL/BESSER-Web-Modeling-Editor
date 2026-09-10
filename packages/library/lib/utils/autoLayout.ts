import ELK from "elkjs/lib/elk.bundled.js"
import type { ElkExtendedEdge, ElkNode } from "elkjs/lib/elk.bundled.js"
import type { Edge, Node } from "@xyflow/react"
import { UMLDiagramType } from "@/types"
import type { BesserEdge, BesserNode, UMLModel } from "@/typings"

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

export type HandleSide = "top" | "bottom" | "left" | "right"

/**
 * The connectable handles on each side, ordered along the side's axis
 * (left→right for top/bottom, top→bottom for left/right). These are the three
 * visible handles per side (at 20% / 50% / 80%); spreading edges across them
 * stops multiple relationships from piling onto a single centre point.
 */
export const SIDE_HANDLES: Record<HandleSide, readonly string[]> = {
  top: ["top-left", "top", "top-right"],
  bottom: ["bottom-left", "bottom", "bottom-right"],
  left: ["left-top", "left", "left-bottom"],
  right: ["right-top", "right", "right-bottom"],
}

/**
 * Picks the facing side pair for an edge from the relative position of its two
 * endpoints, so a vertically stacked pair connects bottom→top (and a
 * side-by-side pair right→left) instead of wrapping around the boxes.
 */
export const chooseFacingSides = (
  sourceCenter: { x: number; y: number },
  targetCenter: { x: number; y: number },
): { sourceSide: HandleSide; targetSide: HandleSide } => {
  const dx = targetCenter.x - sourceCenter.x
  const dy = targetCenter.y - sourceCenter.y
  if (Math.abs(dy) >= Math.abs(dx)) {
    return dy >= 0
      ? { sourceSide: "bottom", targetSide: "top" }
      : { sourceSide: "top", targetSide: "bottom" }
  }
  return dx >= 0
    ? { sourceSide: "right", targetSide: "left" }
    : { sourceSide: "left", targetSide: "right" }
}

/**
 * Back-compat: the centre handle of each facing side. Used where a single
 * representative handle is enough (handle distribution refines this).
 */
export const chooseFacingHandles = (
  sourceCenter: { x: number; y: number },
  targetCenter: { x: number; y: number },
): { sourceHandle: string; targetHandle: string } => {
  const { sourceSide, targetSide } = chooseFacingSides(sourceCenter, targetCenter)
  return { sourceHandle: sourceSide, targetHandle: targetSide }
}

/** Even, centred slot index into an N-handle side for the i-th of `count` edges. */
const slotIndex = (i: number, count: number, slots: number): number => {
  if (count <= 1) return Math.floor((slots - 1) / 2) // single edge → centre
  const idx = Math.round((i * (slots - 1)) / (count - 1))
  return Math.min(slots - 1, Math.max(0, idx))
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

  // Reassign each node-to-node edge to the facing handles of the new layout,
  // distributing edges that share a side across that side's handles so they
  // don't pile onto a single centre point.
  const layoutedById = new Map(layoutedNodes.map((n) => [n.id, n]))
  const centerById = new Map(
    layoutedNodes.map((n) => [n.id, absoluteCenter(n, layoutedById)]),
  )

  // Collect, per (node, side), the edge ends that land there, with the
  // coordinate of the opposite endpoint along the side's axis (x for
  // top/bottom, y for left/right) used to order them and avoid crossings.
  type EndRef = { edgeId: string; end: "source" | "target"; along: number }
  const groups = new Map<string, EndRef[]>()
  const sideByEdgeEnd = new Map<string, { sourceSide: HandleSide; targetSide: HandleSide }>()

  for (const edge of edges) {
    const source = layoutedById.get(edge.source)
    const target = layoutedById.get(edge.target)
    if (!source || !target) continue // edge-anchored / dangling — leave as-is
    const sc = centerById.get(source.id)!
    const tc = centerById.get(target.id)!
    const { sourceSide, targetSide } = chooseFacingSides(sc, tc)
    sideByEdgeEnd.set(edge.id, { sourceSide, targetSide })

    const sKey = `${source.id}|${sourceSide}`
    const tKey = `${target.id}|${targetSide}`
    const sAlong = sourceSide === "top" || sourceSide === "bottom" ? tc.x : tc.y
    const tAlong = targetSide === "top" || targetSide === "bottom" ? sc.x : sc.y
    ;(groups.get(sKey) ?? groups.set(sKey, []).get(sKey)!).push({ edgeId: edge.id, end: "source", along: sAlong })
    ;(groups.get(tKey) ?? groups.set(tKey, []).get(tKey)!).push({ edgeId: edge.id, end: "target", along: tAlong })
  }

  // Assign a concrete handle id to every edge end.
  const assigned = new Map<string, { sourceHandle?: string; targetHandle?: string }>()
  for (const [key, ends] of groups) {
    const side = key.slice(key.indexOf("|") + 1) as HandleSide
    const handles = SIDE_HANDLES[side]
    ends.sort((a, b) => a.along - b.along)
    ends.forEach((ref, i) => {
      const handle = handles[slotIndex(i, ends.length, handles.length)]
      const slot = assigned.get(ref.edgeId) ?? {}
      if (ref.end === "source") slot.sourceHandle = handle
      else slot.targetHandle = handle
      assigned.set(ref.edgeId, slot)
    })
  }

  const layoutedEdges = edges.map((edge) => {
    const a = assigned.get(edge.id)
    if (!a) return edge
    if (edge.sourceHandle === a.sourceHandle && edge.targetHandle === a.targetHandle) {
      return edge
    }
    return { ...edge, sourceHandle: a.sourceHandle, targetHandle: a.targetHandle }
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

/**
 * Lays out a v4 `UMLModel` with ELK and returns a NEW model whose nodes are
 * repositioned accordingly. Pure and fully awaitable — no editor instance,
 * no React Flow, no DOM — so it can run under node / jsdom for headless
 * uses such as the server's SVG export route.
 *
 * Runs the same `computeAutoLayout` the in-canvas button uses (parentId
 * hierarchy respected, containers grown to fit, edge handles reassigned to
 * facing sides). Two headless-specific touches on top:
 *  - the result is recentered onto the model's current bounding-box centre
 *    so a re-laid-out diagram does not jump toward the origin;
 *  - node-to-node edges lose their stored manual waypoints (`data.points`)
 *    — those are relative to the old geometry and the renderer prefers them
 *    over its computed route, so keeping them would draw stale paths.
 * Edge-anchored / dangling edges are left untouched.
 */
export const layoutModel = async (model: UMLModel): Promise<UMLModel> => {
  const nodes = (model.nodes ?? []) as unknown as Node[]
  const edges = (model.edges ?? []) as unknown as Edge[]
  if (nodes.length === 0) return model

  const layouted = await computeAutoLayout(nodes, edges, model.type)
  if (layouted.nodes === nodes) return model

  // Recenter top-level nodes (children ride along with their parent).
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const roots = (list: Node[]) => list.filter((n) => !n.parentId || !byId.has(n.parentId))
  const bbox = (list: Node[]) => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const n of list) {
      const { width, height } = nodeSize(n)
      minX = Math.min(minX, n.position.x)
      minY = Math.min(minY, n.position.y)
      maxX = Math.max(maxX, n.position.x + width)
      maxY = Math.max(maxY, n.position.y + height)
    }
    return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 }
  }
  const before = bbox(roots(nodes))
  const after = bbox(roots(layouted.nodes))
  const offset = {
    x: Number.isFinite(before.cx) && Number.isFinite(after.cx) ? before.cx - after.cx : 0,
    y: Number.isFinite(before.cy) && Number.isFinite(after.cy) ? before.cy - after.cy : 0,
  }
  const recentered = layouted.nodes.map((n) =>
    n.parentId && byId.has(n.parentId)
      ? n
      : { ...n, position: { x: n.position.x + offset.x, y: n.position.y + offset.y } },
  )

  const nodeIds = new Set(nodes.map((n) => n.id))
  const routedEdges = layouted.edges.map((e) => {
    if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) return e
    const data = (e.data ?? {}) as Record<string, unknown>
    if (!Array.isArray(data.points) || data.points.length === 0) return e
    return { ...e, data: { ...data, points: [] } }
  })

  return {
    ...model,
    nodes: recentered as unknown as BesserNode[],
    edges: routedEdges as unknown as BesserEdge[],
  }
}
