/**
 * Association-class link (`ClassLinkRel`) helpers.
 *
 * A `ClassLinkRel` edge attaches a class to the *middle of an
 * association* (UML association class). Its canonical v4 wire shape —
 * spoken by the companion backend in both directions — anchors one
 * endpoint on the association EDGE id instead of a node id:
 *
 * ```json
 * { "source": "<association edge id>", "sourceHandle": "Center",
 *   "target": "<class node id>",       "targetHandle": "Up",
 *   "type": "ClassLinkRel" }
 * ```
 *
 * React Flow cannot render an edge whose endpoint is not a node, so
 * edge-anchored links are (a) filtered out of the `<ReactFlow edges>`
 * prop and (b) drawn as a computed dashed overlay inside the
 * association's own edge renderer (`ClassDiagramEdge`). They stay in
 * `diagramStore.edges` (Yjs) untouched, so exports / round-trips see
 * the canonical shape. Plain node-to-node `ClassLinkRel` edges remain
 * legal and render through React Flow as before.
 *
 * Everything here is pure and structural-typed so the helpers stay
 * testable without dragging React Flow into the import graph (same
 * rationale as `bpmnConstraints.ts`).
 */

export interface LinkRelEdgeLike {
  id: string
  source: string
  target: string
  type?: string
}

export interface LinkRelNodeLike {
  id: string
  position: { x: number; y: number }
  parentId?: string
}

export interface LinkRelPoint {
  x: number
  y: number
}

/**
 * Association kinds that can carry an association class. Develop's
 * center-port whitelist was Bi/Uni
 * (`uml-relationship-port.ts:7-10`); Composition is included because
 * the companion backend emits `ClassLinkRel` on named composition
 * edges too (`class_diagram_converter.py`) — superset capability.
 */
export const ASSOCIATION_CLASS_CAPABLE_TYPES: ReadonlySet<string> = new Set([
  "ClassBidirectional",
  "ClassUnidirectional",
  "ClassComposition",
])

/**
 * `true` when the `ClassLinkRel` edge has at least one endpoint that is
 * NOT a node id (i.e. it is anchored on an association edge). Such
 * edges must not be handed to React Flow.
 */
export const isEdgeAnchoredLinkRel = (
  edge: LinkRelEdgeLike,
  nodeIds: ReadonlySet<string>
): boolean =>
  edge.type === "ClassLinkRel" &&
  (!nodeIds.has(edge.source) || !nodeIds.has(edge.target))

/**
 * First `ClassLinkRel` referencing the given association edge id on
 * either endpoint (the backend accepts both orientations; the backend
 * warns and uses the first when a class links multiple associations —
 * one association class per association).
 */
export const getLinkRelForAssociation = <E extends LinkRelEdgeLike>(
  edges: readonly E[],
  associationEdgeId: string
): E | undefined =>
  edges.find(
    (e) =>
      e.type === "ClassLinkRel" &&
      (e.source === associationEdgeId || e.target === associationEdgeId)
  )

/**
 * Whichever endpoint of the link IS a node id (the association-class
 * node). `undefined` when neither endpoint resolves — a dangling link.
 */
export const resolveLinkRelClassNodeId = (
  linkEdge: LinkRelEdgeLike,
  nodeIds: ReadonlySet<string>
): string | undefined => {
  if (nodeIds.has(linkEdge.source)) return linkEdge.source
  if (nodeIds.has(linkEdge.target)) return linkEdge.target
  return undefined
}

/**
 * Cascade-deletion pass: drop `ClassLinkRel` edges whose endpoints no
 * longer resolve to a live node or a live (non-link) edge. React Flow
 * auto-cascades only edges it renders; edge-anchored links live only in
 * the store, so the store must prune them itself when the association
 * edge or the class node disappears.
 *
 * Returns the input array by reference when nothing was pruned.
 */
export const pruneDanglingLinkRels = <E extends LinkRelEdgeLike>(
  edges: E[],
  nodeIds: ReadonlySet<string>
): E[] => {
  const anchorEdgeIds = new Set(
    edges.filter((e) => e.type !== "ClassLinkRel").map((e) => e.id)
  )
  const resolves = (endpoint: string): boolean =>
    nodeIds.has(endpoint) || anchorEdgeIds.has(endpoint)
  const kept = edges.filter(
    (e) =>
      e.type !== "ClassLinkRel" || (resolves(e.source) && resolves(e.target))
  )
  return kept.length === edges.length ? edges : kept
}

/**
 * Absolute canvas position of a node, walking the `parentId` chain
 * (class nodes can be nested inside packages — their `position` is
 * parent-relative). Cycle-guarded.
 */
export const getAbsoluteNodePosition = (
  node: LinkRelNodeLike,
  nodesById: ReadonlyMap<string, LinkRelNodeLike>
): LinkRelPoint => {
  let x = node.position.x
  let y = node.position.y
  const seen = new Set<string>([node.id])
  let parentId = node.parentId
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId)
    const parent = nodesById.get(parentId)
    if (!parent) break
    x += parent.position.x
    y += parent.position.y
    parentId = parent.parentId
  }
  return { x, y }
}

/**
 * Point on the node-rect boundary along the ray from the rect center
 * toward `fromPoint` — where the dashed association-class tether meets
 * the class node. Degenerate inputs (zero direction / zero-size rect)
 * fall back to the rect center.
 */
export const computeAnchorOnNodeBoundary = (
  nodePos: LinkRelPoint,
  nodeDims: { width: number; height: number },
  fromPoint: LinkRelPoint
): LinkRelPoint => {
  const halfW = nodeDims.width / 2
  const halfH = nodeDims.height / 2
  const cx = nodePos.x + halfW
  const cy = nodePos.y + halfH
  const dx = fromPoint.x - cx
  const dy = fromPoint.y - cy
  if (dx === 0 && dy === 0) return { x: cx, y: cy }
  const tx = dx !== 0 ? halfW / Math.abs(dx) : Number.POSITIVE_INFINITY
  const ty = dy !== 0 ? halfH / Math.abs(dy) : Number.POSITIVE_INFINITY
  const t = Math.min(tx, ty)
  if (!Number.isFinite(t)) return { x: cx, y: cy }
  return { x: cx + dx * t, y: cy + dy * t }
}
