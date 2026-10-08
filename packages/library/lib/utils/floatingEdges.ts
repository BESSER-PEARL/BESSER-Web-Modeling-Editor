/**
 * Diagram-level floating-edge layout: node rects from the store's nodes, port
 * geometry for every floating edge (`edgePorts`) and the end-label placement
 * (`edgeLabelPlacement`), in one pass shared by all edges of a snapshot.
 */
import type { Edge, Node } from "@xyflow/react"
import type { LayoutRect } from "./autoLayoutHandles"
import { computePortGeometry, CURVED_EDGE_TYPES, FLOATING_EDGE_TYPES, type PortGeometry } from "./edgePorts"
import {
  attachmentRect,
  isPlainRect,
  nodeShapeOf,
  ROUTE_TRANSPARENT_NODE_TYPES,
  type NodeShape,
} from "./nodeShapes"
import { placeEdgeLabels, estimateLabelWidth, type EdgeLabelLayout } from "./edgeLabelPlacement"
import { getEdgeMarkerStyles, endMarkerLength } from "./edgeUtils"
import { getAssociationMarkers } from "./uml-association-navigability"
import { toERCardinality } from "./multiplicity"

export { FLOATING_EDGE_TYPES }

/** Diagram types whose nodes use continuous ports instead of fixed handles. */
export const FLOATING_PORT_DIAGRAMS: ReadonlySet<string> = new Set([
  "ClassDiagram",
  "ObjectDiagram",
  "UserDiagram",
  "StateMachineDiagram",
  "AgentDiagram",
  "BPMNDiagram",
  "NNDiagram",
])

export interface FloatingEdgeLayout extends PortGeometry {
  labels: EdgeLabelLayout
}

const DEFAULT_W = 160
const DEFAULT_H = 100

/** Absolute rects of the visible nodes (parent chain resolved). */
export const nodeRects = (nodes: readonly Node[]): Map<string, LayoutRect> => {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const rects = new Map<string, LayoutRect>()
  for (const node of nodes) {
    if (node.hidden) continue
    let x = node.position.x
    let y = node.position.y
    let parent = node.parentId ? byId.get(node.parentId) : undefined
    const seen = new Set<string>()
    while (parent && !seen.has(parent.id)) {
      seen.add(parent.id)
      x += parent.position.x
      y += parent.position.y
      parent = parent.parentId ? byId.get(parent.parentId) : undefined
    }
    rects.set(node.id, {
      x,
      y,
      width: node.measured?.width ?? node.width ?? DEFAULT_W,
      height: node.measured?.height ?? node.height ?? DEFAULT_H,
    })
  }
  return rects
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : undefined)

/** Marker lengths of both ends, as `ClassDiagramEdge` draws them. */
const markerLengths = (edge: Edge, erNotation: boolean): [number, number] => {
  const styles = getEdgeMarkerStyles(edge.type ?? "")
  const assoc = getAssociationMarkers({ type: edge.type, data: edge.data })
  if (erNotation && assoc) return [0, 0]
  const start = assoc ? assoc.markerStart : styles.markerStart
  const end = assoc ? assoc.markerEnd : styles.markerEnd
  return [endMarkerLength(start), endMarkerLength(end, !!assoc?.arrowBeforeEndMarker)]
}

export const computeFloatingLayout = (
  nodes: readonly Node[],
  edges: readonly Edge[],
  options: {
    measure?: (text: string) => number
    erNotation?: boolean
    /** The last layout of the same diagram: end labels keep their sides. */
    previous?: ReadonlyMap<string, FloatingEdgeLayout>
  } = {}
): Map<string, FloatingEdgeLayout> => {
  const rects = nodeRects(nodes)
  const floating = edges.filter(
    (e) => FLOATING_EDGE_TYPES.has(e.type ?? "") && rects.has(e.source) && rects.has(e.target)
  )
  // Ends attach to each node's outline; routes avoid the full boxes of
  // every node except the containers edges cross (pools, lanes, groups).
  const ports = new Map<string, LayoutRect>()
  const shapes = new Map<string, NodeShape>()
  const obstacles: LayoutRect[] = []
  for (const node of nodes) {
    const rect = rects.get(node.id)
    if (!rect) continue
    const shape = nodeShapeOf(node.type)
    if (isPlainRect(shape)) {
      ports.set(node.id, rect)
    } else {
      ports.set(node.id, attachmentRect(shape, rect))
      shapes.set(node.id, shape)
    }
    if (!ROUTE_TRANSPARENT_NODE_TYPES.has(node.type ?? "")) obstacles.push(rect)
  }
  const geometry = computePortGeometry(
    ports,
    floating.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
      curved: CURVED_EDGE_TYPES.has(e.type ?? ""),
      // Message flows run between stacked pools: top / bottom, not sideways.
      preferVertical: e.type === "BPMNMessageFlow",
      data: e.data as never,
    })),
    obstacles,
    shapes
  )
  const er = !!options.erNotation
  const mult = (v: unknown) => {
    const s = str(v)
    return s && er ? toERCardinality(s) : s
  }
  const labels = placeEdgeLabels(
    floating
      .filter((e) => geometry.has(e.id))
      .map((e) => {
        const d = (e.data ?? {}) as Record<string, unknown>
        const [sourceMarkerLength, targetMarkerLength] = markerLengths(e, er)
        return {
          id: e.id,
          points: geometry.get(e.id)!.points,
          sourceRole: str(d.sourceRole),
          targetRole: str(d.targetRole),
          sourceMultiplicity: mult(d.sourceMultiplicity),
          targetMultiplicity: mult(d.targetMultiplicity),
          sourceMarkerLength,
          targetMarkerLength,
        }
      }),
    [...rects.values()],
    options.measure ?? estimateLabelWidth,
    options.previous
  )
  const out = new Map<string, FloatingEdgeLayout>()
  for (const [id, g] of geometry) {
    out.set(id, { ...g, labels: labels.get(id) ?? { source: {}, target: {} } })
  }
  return out
}
