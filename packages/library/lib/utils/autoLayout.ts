/**
 * Auto-layout for every diagram type (canvas button, `BesserEditor.autoLayout()`,
 * the assistant's post-injection layout and the server's headless SVG export).
 *
 * Built on ELK with one *profile* per diagram family instead of a single
 * generic configuration:
 *
 *  - Structural diagrams (class / object / user / communication / component /
 *    deployment) — ELK `layered` DOWN. Generalization / realization edges are
 *    fed to ELK reversed (parent → child) with a high direction priority so
 *    parents sit ABOVE their children; composition / aggregation mildly prefer
 *    "whole above part"; plain associations and dependencies get no direction
 *    priority so they don't force artificial levels. Disconnected elements
 *    (enumerations, notes) are packed as separate components. A "compact"
 *    strategy (ELK `stress` + overlap removal + orthogonal routing) is
 *    available for association-heavy graphs.
 *  - Flow diagrams (state machine / agent / flowchart / activity / petri net /
 *    SFC / reachability) — ELK `layered` in flow order; initial nodes are
 *    forced into the first layer and final nodes into the last one.
 *  - BPMN — every pool is laid out left-to-right on its own; lanes keep their
 *    order and are stacked inside their pool (their height grows to fit their
 *    content, the header strips stay clear); pools are stacked vertically;
 *    message flows don't take part in layering and are routed afterwards;
 *    boundary events stay attached to their host activity.
 *  - NN — layered RIGHT inside the containers (NNNext order).
 *  - Syntax tree — ELK `mrtree` DOWN.
 *
 * Node handles are modelled as ELK ports, so ELK routes every edge to a real
 * attachment point; the ELK port of each edge end is then snapped to the
 * nearest of the node's handles (3 per side, see `SIDE_HANDLES`) and mapped
 * back to `sourceHandle` / `targetHandle`. ELK's orthogonal bend points are
 * stored as the edge's waypoints (`edge.data.points`, absolute flow
 * coordinates — the representation the step-path edge renderer draws) for
 * the edge types that honour stored waypoints; straight / bézier edge types
 * only get their handles updated.
 *
 * Everything here is pure (no DOM, no React Flow instance) so it runs in the
 * browser and headless (`layoutModel`).
 */
import ELK from "elkjs/lib/elk.bundled.js"
import type {
  ElkExtendedEdge,
  ElkLabel,
  ElkNode,
  ElkPort,
  LayoutOptions,
} from "elkjs/lib/elk.bundled.js"
import type { Edge, Node } from "@xyflow/react"
import { UMLDiagramType } from "@/types"
import type { BesserEdge, BesserNode, UMLModel } from "@/typings"
import {
  alongSide,
  assignEndsToHandles,
  chooseFacingSides,
  chooseFacingSidesForRects,
  getSideHandles,
  SIDE_HANDLES,
  sidePoint,
  type HandleSide,
  type LayoutPoint,
  type LayoutRect,
} from "./autoLayoutHandles"
import {
  routeOrthogonalEdges,
  simplifyOrthogonal,
  type RouteRequest,
  type RouterRect,
} from "./orthogonalRouter"

export { SIDE_HANDLES, chooseFacingSides } from "./autoLayoutHandles"
export type { HandleSide } from "./autoLayoutHandles"

const DEFAULT_NODE_WIDTH = 160
const DEFAULT_NODE_HEIGHT = 100

/** Mirrors `POOL_HEADER_WIDTH` in `hooks/useSwimlaneLayout.ts` (kept local: that module pulls in React). */
export const BPMN_POOL_HEADER_WIDTH = 40
/** Mirrors `LANE_HEADER_WIDTH` in `utils/bpmnConstraints.ts`. */
export const BPMN_LANE_HEADER_WIDTH = 30
/** Mirrors `SWIMLANE_MIN_HEIGHT` in `hooks/useSwimlaneLayout.ts`. */
export const BPMN_LANE_MIN_HEIGHT = 80

// ---------------------------------------------------------------------------
// Public types / strategy catalogue
// ---------------------------------------------------------------------------

/**
 * Layout strategies. Each diagram type offers a subset
 * (`getAutoLayoutStrategies`); the first one is its default.
 *  - `hierarchical`: layered, parents above children (structural diagrams).
 *  - `compact`: force/stress placement + orthogonal routing — denser, no levels.
 *  - `horizontal` / `vertical`: layered flow left-to-right / top-to-bottom.
 */
export type AutoLayoutStrategy = "hierarchical" | "compact" | "horizontal" | "vertical"

export interface AutoLayoutOptions {
  strategy?: AutoLayoutStrategy
}

type Family =
  | "structural"
  | "flow"
  | "bpmn"
  | "nn"
  | "tree"
  | "usecase"

const familyOf = (diagramType: string): Family => {
  switch (diagramType) {
    case UMLDiagramType.StateMachineDiagram:
    case UMLDiagramType.AgentDiagram:
    case UMLDiagramType.Flowchart:
    case UMLDiagramType.ActivityDiagram:
    case UMLDiagramType.PetriNet:
    case UMLDiagramType.Sfc:
    case UMLDiagramType.ReachabilityGraph:
      return "flow"
    case UMLDiagramType.BPMN:
      return "bpmn"
    case UMLDiagramType.NNDiagram:
      return "nn"
    case UMLDiagramType.SyntaxTree:
      return "tree"
    case UMLDiagramType.UseCaseDiagram:
      return "usecase"
    default:
      return "structural"
  }
}

/** Flow diagrams whose conventional reading direction is top-to-bottom. */
const VERTICAL_FLOW_DIAGRAMS: ReadonlySet<string> = new Set([
  UMLDiagramType.Sfc,
  UMLDiagramType.ReachabilityGraph,
])

/** The strategies offered for a diagram type; the first entry is the default. */
export const getAutoLayoutStrategies = (diagramType: string): AutoLayoutStrategy[] => {
  switch (familyOf(diagramType)) {
    case "structural":
      return ["hierarchical", "compact"]
    case "flow":
      return VERTICAL_FLOW_DIAGRAMS.has(diagramType)
        ? ["vertical", "horizontal"]
        : ["horizontal", "vertical"]
    default:
      return [getLayoutDirection(diagramType) === "RIGHT" ? "horizontal" : "vertical"]
  }
}

/** Default layout direction of a diagram type (layered strategies). */
export const getLayoutDirection = (diagramType: string): "DOWN" | "RIGHT" => {
  switch (familyOf(diagramType)) {
    case "flow":
      return VERTICAL_FLOW_DIAGRAMS.has(diagramType) ? "DOWN" : "RIGHT"
    case "bpmn":
    case "nn":
    case "usecase":
      return "RIGHT"
    default:
      return "DOWN"
  }
}

/**
 * Back-compat: the centre handle of each facing side. Used where a single
 * representative handle is enough (handle distribution refines this).
 */
export const chooseFacingHandles = (
  sourceCenter: { x: number; y: number },
  targetCenter: { x: number; y: number }
): { sourceHandle: string; targetHandle: string } => {
  const { sourceSide, targetSide } = chooseFacingSides(sourceCenter, targetCenter)
  return { sourceHandle: sourceSide, targetHandle: targetSide }
}

// ---------------------------------------------------------------------------
// Node / edge classification
// ---------------------------------------------------------------------------

/** Node types that render nothing on the canvas (data-only). Left untouched. */
const NON_VISUAL_NODE_TYPES: ReadonlySet<string> = new Set(["AgentLLM"])

const INHERITANCE_EDGE_TYPES: ReadonlySet<string> = new Set([
  "ClassInheritance",
  "ClassRealization",
  "UseCaseGeneralization",
])
/** Diamond (whole) on the target end. */
const WHOLE_PART_EDGE_TYPES: ReadonlySet<string> = new Set(["ClassComposition", "ClassAggregation"])
/** Edges that attach a note-like element to the element it annotates. */
const ATTACHMENT_EDGE_TYPES: ReadonlySet<string> = new Set([
  "ClassOCLLink",
  "CommentLink",
  "BPMNAssociationFlow",
  "BPMNDataAssociationFlow",
])
const NOTE_NODE_TYPES: ReadonlySet<string> = new Set([
  "ClassOCLConstraint",
  "comment",
  "bpmnAnnotation",
  "bpmnDataObject",
  "bpmnDataStore",
  "StateCodeBlock",
])

type RenderKind = "step" | "straight" | "bezier"

/**
 * How the renderer draws an edge type: `step` edges (useStepPathEdge) honour
 * stored waypoints, straight and bézier edges ignore them.
 */
const renderKindOf = (type: string | undefined): RenderKind => {
  if (!type) return "step"
  if (/^(UseCase|PetriNet|SyntaxTree)/.test(type)) return "straight"
  if (/^AgentStateTransition/.test(type)) return "bezier"
  return "step"
}

interface EdgeRole {
  /** Feed the edge to ELK target → source. */
  reverse: boolean
  direction: number
  shortness: number
  straightness: number
}

const nodeSize = (node: Node): { width: number; height: number } => ({
  width: node.measured?.width ?? node.width ?? DEFAULT_NODE_WIDTH,
  height: node.measured?.height ?? node.height ?? DEFAULT_NODE_HEIGHT,
})

interface GraphInfo {
  byId: Map<string, Node>
  indeg: Map<string, number>
  outdeg: Map<string, number>
}

const structuralEdgeRole = (edge: Edge, info: GraphInfo): EdgeRole => {
  const type = edge.type ?? ""
  if (INHERITANCE_EDGE_TYPES.has(type)) {
    return { reverse: true, direction: 20, shortness: 4, straightness: 4 }
  }
  if (WHOLE_PART_EDGE_TYPES.has(type)) {
    return { reverse: true, direction: 2, shortness: 2, straightness: 1 }
  }
  if (ATTACHMENT_EDGE_TYPES.has(type)) {
    // Annotated element above its note.
    const sourceIsNote = NOTE_NODE_TYPES.has(info.byId.get(edge.source)?.type ?? "")
    return { reverse: sourceIsNote, direction: 1, shortness: 6, straightness: 0 }
  }
  return { reverse: false, direction: 0, shortness: 1, straightness: 0 }
}

const flowEdgeRole = (edge: Edge, info: GraphInfo): EdgeRole => {
  const type = edge.type ?? ""
  if (ATTACHMENT_EDGE_TYPES.has(type)) {
    const sourceIsNote = NOTE_NODE_TYPES.has(info.byId.get(edge.source)?.type ?? "")
    return { reverse: sourceIsNote, direction: 0, shortness: 6, straightness: 0 }
  }
  if (INHERITANCE_EDGE_TYPES.has(type)) {
    return { reverse: true, direction: 10, shortness: 2, straightness: 2 }
  }
  return { reverse: false, direction: 5, shortness: 1, straightness: 1 }
}

type LayerConstraint = "FIRST" | "LAST" | undefined

const layerConstraintOf = (diagramType: string, node: Node, info: GraphInfo): LayerConstraint => {
  const data = (node.data ?? {}) as Record<string, unknown>
  const indeg = info.indeg.get(node.id) ?? 0
  const outdeg = info.outdeg.get(node.id) ?? 0
  switch (node.type) {
    case "StateInitialNode":
    case "activityInitialNode":
    case "sfcStart":
    case "useCaseActor":
      return outdeg > 0 || indeg > 0 ? "FIRST" : undefined
    case "bpmnStartEvent":
      return indeg === 0 && outdeg > 0 ? "FIRST" : undefined
    case "StateFinalNode":
    case "activityFinalNode":
      return indeg > 0 ? "LAST" : undefined
    case "bpmnEndEvent":
      return outdeg === 0 && indeg > 0 ? "LAST" : undefined
    case "flowchartTerminal":
      if (indeg === 0 && outdeg > 0) return "FIRST"
      if (outdeg === 0 && indeg > 0) return "LAST"
      return undefined
    case "AgentState":
      return diagramType === UMLDiagramType.AgentDiagram && data.initial === true ? "FIRST" : undefined
    case "reachabilityGraphMarking":
      return data.isInitialMarking === true ? "FIRST" : undefined
    default:
      return undefined
  }
}

/** ELK padding for compound nodes (keeps name tabs / headers clear). */
const containerPadding = (type: string | undefined): string => {
  switch (type) {
    case "NNContainer":
      return "[top=56,left=30,bottom=30,right=30]"
    case "package":
      return "[top=50,left=25,bottom=25,right=25]"
    case "bpmnSubprocess":
    case "bpmnTransaction":
    case "bpmnGroup":
      return "[top=40,left=25,bottom=25,right=25]"
    default:
      return "[top=50,left=30,bottom=30,right=30]"
  }
}

// ---------------------------------------------------------------------------
// ELK option sets
// ---------------------------------------------------------------------------

const layeredOptions = (
  direction: "DOWN" | "RIGHT",
  family: Family
): LayoutOptions => {
  const structural = family === "structural"
  return {
    "elk.algorithm": "layered",
    "elk.direction": direction,
    "elk.edgeRouting": "ORTHOGONAL",
    "elk.hierarchyHandling": "INCLUDE_CHILDREN",
    "elk.json.edgeCoords": "ROOT",
    "elk.portConstraints": "FREE",
    "elk.spacing.nodeNode": structural ? "60" : "50",
    "elk.layered.spacing.nodeNodeBetweenLayers": structural ? "90" : "70",
    "elk.spacing.edgeNode": "25",
    "elk.layered.spacing.edgeNodeBetweenLayers": "25",
    "elk.spacing.edgeEdge": "15",
    "elk.layered.spacing.edgeEdgeBetweenLayers": "15",
    "elk.spacing.portPort": "12",
    "elk.spacing.componentComponent": "80",
    "elk.spacing.edgeLabel": "4",
    "elk.spacing.labelNode": "6",
    "elk.separateConnectedComponents": "true",
    "elk.aspectRatio": "1.6",
    "elk.layered.cycleBreaking.strategy": structural ? "GREEDY" : "MODEL_ORDER",
    "elk.layered.layering.strategy": "NETWORK_SIMPLEX",
    "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
    "elk.layered.thoroughness": "30",
    "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
    "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
    "elk.layered.edgeRouting.selfLoopDistribution": "EQUALLY",
    "elk.layered.edgeRouting.selfLoopOrdering": "STACKED",
    "elk.layered.mergeEdges": "false",
    "elk.layered.unnecessaryBendpoints": "false",
    "elk.edgeLabels.inline": "false",
    "elk.padding": "[top=20,left=20,bottom=20,right=20]",
  }
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

/** Absolute (flow) rectangles of every node, following the parentId chain. */
const absoluteRects = (nodes: Node[]): Map<string, LayoutRect> => {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const out = new Map<string, LayoutRect>()
  const resolve = (node: Node, seen: Set<string>): LayoutRect => {
    const cached = out.get(node.id)
    if (cached) return cached
    const { width, height } = nodeSize(node)
    let x = node.position.x
    let y = node.position.y
    const parent = node.parentId ? byId.get(node.parentId) : undefined
    if (parent && !seen.has(parent.id)) {
      seen.add(node.id)
      const p = resolve(parent, seen)
      x += p.x
      y += p.y
    }
    const rect = { x, y, width, height }
    out.set(node.id, rect)
    return rect
  }
  for (const node of nodes) resolve(node, new Set([node.id]))
  return out
}

const centerOf = (r: LayoutRect): LayoutPoint => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 })

const containsPoint = (r: LayoutRect, p: LayoutPoint): boolean =>
  p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height

const roundPoint = (p: LayoutPoint): LayoutPoint => ({ x: Math.round(p.x), y: Math.round(p.y) })

/** Side of `rect` an endpoint lies on (closest border; direction breaks corner ties). */
const sideOfEndpoint = (
  rect: LayoutRect,
  end: LayoutPoint,
  next: LayoutPoint | undefined
): HandleSide => {
  const d = {
    top: Math.abs(end.y - rect.y),
    bottom: Math.abs(end.y - (rect.y + rect.height)),
    left: Math.abs(end.x - rect.x),
    right: Math.abs(end.x - (rect.x + rect.width)),
  }
  const sorted = (Object.keys(d) as HandleSide[]).sort((a, b) => d[a] - d[b])
  if (next && d[sorted[1]] - d[sorted[0]] < 1.5) {
    // Corner: use the direction of the first segment (away from the node).
    const dx = next.x - end.x
    const dy = next.y - end.y
    const inside = containsPoint(rect, next)
    const candidates = sorted.slice(0, 2)
    for (const side of candidates) {
      const outward =
        side === "top" ? -dy : side === "bottom" ? dy : side === "left" ? -dx : dx
      if ((inside ? -outward : outward) > 0.1) return side
    }
  }
  return sorted[0]
}

/**
 * Moves one end of an orthogonal route to `point` (on `side`), keeping the
 * route orthogonal: the neighbouring bend follows along the side's axis.
 */
const moveRouteEnd = (
  route: LayoutPoint[],
  atStart: boolean,
  point: LayoutPoint,
  side: HandleSide
): LayoutPoint[] => {
  const pts = route.map((p) => ({ ...p }))
  const n = pts.length
  const idx = atStart ? 0 : n - 1
  const nb = atStart ? 1 : n - 2
  const horizontalSide = side === "top" || side === "bottom"
  pts[idx] = { ...point }
  if (n >= 3) {
    if (horizontalSide) pts[nb].x = point.x
    else pts[nb].y = point.y
  }
  return pts
}

const sameRect = (a: LayoutRect, b: LayoutRect | undefined): boolean =>
  !!b && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height

const segmentHitsRect = (a: LayoutPoint, b: LayoutPoint, r: LayoutRect): boolean => {
  const m = 2
  const x0 = r.x + m
  const y0 = r.y + m
  const x1 = r.x + r.width - m
  const y1 = r.y + r.height - m
  if (x1 <= x0 || y1 <= y0) return false
  const minX = Math.min(a.x, b.x)
  const maxX = Math.max(a.x, b.x)
  const minY = Math.min(a.y, b.y)
  const maxY = Math.max(a.y, b.y)
  // Orthogonal segments only: bounding-box overlap test is exact.
  return maxX > x0 && minX < x1 && maxY > y0 && minY < y1
}

/**
 * Snaps one end of an ELK route onto the chosen handle. Prefers sliding the
 * neighbouring bend along the side's axis (no extra bends); if that would
 * push a segment through another node, inserts a short dog-leg right next to
 * the node instead, leaving ELK's route untouched beyond it.
 */
const snapRouteEnd = (
  route: LayoutPoint[],
  atStart: boolean,
  point: LayoutPoint,
  side: HandleSide,
  obstacles: LayoutRect[]
): LayoutPoint[] => {
  const n = route.length
  const end = atStart ? route[0] : route[n - 1]
  const horizontalSide = side === "top" || side === "bottom"
  const delta = horizontalSide ? point.x - end.x : point.y - end.y
  if (Math.abs(delta) < 0.5 || n < 3) return moveRouteEnd(route, atStart, point, side)
  const slid = moveRouteEnd(route, atStart, point, side)
  const idx = atStart ? [0, 1, 2] : [n - 1, n - 2, n - 3]
  const segs: [LayoutPoint, LayoutPoint][] = [[slid[idx[0]], slid[idx[1]]]]
  if (idx[2] >= 0 && idx[2] < n) segs.push([slid[idx[1]], slid[idx[2]]])
  const blocked = segs.some(([a, b]) => obstacles.some((r) => segmentHitsRect(a, b, r)))
  if (!blocked) return slid
  const next = atStart ? route[1] : route[n - 2]
  const out = { x: Math.sign(next.x - end.x), y: Math.sign(next.y - end.y) }
  const firstLen = Math.abs(next.x - end.x) + Math.abs(next.y - end.y)
  const d = Math.max(2, Math.min(12, firstLen / 2))
  const q1 = { x: point.x + out.x * d, y: point.y + out.y * d }
  const q2 = { x: end.x + out.x * d, y: end.y + out.y * d }
  const pts = route.map((p) => ({ ...p }))
  if (atStart) return [{ ...point }, q1, q2, ...pts.slice(1)]
  return [...pts.slice(0, n - 1), q2, q1, { ...point }]
}

/** Makes a 2-point route orthogonal again after its ends moved independently. */
const fixStraightRoute = (
  route: LayoutPoint[],
  sourceSide: HandleSide,
  targetSide: HandleSide
): LayoutPoint[] => {
  if (route.length !== 2) return route
  const [s, t] = route
  if (Math.abs(s.x - t.x) < 0.5 || Math.abs(s.y - t.y) < 0.5) return route
  const sourceVertical = sourceSide === "top" || sourceSide === "bottom"
  const targetVertical = targetSide === "top" || targetSide === "bottom"
  if (sourceVertical && targetVertical) {
    const midY = Math.round((s.y + t.y) / 2)
    return [s, { x: s.x, y: midY }, { x: t.x, y: midY }, t]
  }
  if (!sourceVertical && !targetVertical) {
    const midX = Math.round((s.x + t.x) / 2)
    return [s, { x: midX, y: s.y }, { x: midX, y: t.y }, t]
  }
  return sourceVertical ? [s, { x: s.x, y: t.y }, t] : [s, { x: t.x, y: s.y }, t]
}

// ---------------------------------------------------------------------------
// Handle assignment + route finalisation (shared by every pipeline)
// ---------------------------------------------------------------------------

interface EndRef {
  edgeId: string
  end: "source" | "target"
  nodeId: string
  side: HandleSide
  desired: number
}

interface RoutedEdge {
  edge: Edge
  /** Route in the edge's own orientation (source → target), absolute coords. */
  route?: LayoutPoint[]
  sourceSide: HandleSide
  targetSide: HandleSide
}

/**
 * Spreads the edge ends that land on the same node side over that side's
 * handles (keeping their order along the side) and returns, per edge, the
 * chosen handle ids and absolute attachment points.
 */
const assignHandles = (
  routed: RoutedEdge[],
  rects: Map<string, LayoutRect>,
  typeOf: (id: string) => string | undefined
): Map<string, { sourceHandle: string; targetHandle: string; sourcePoint: LayoutPoint; targetPoint: LayoutPoint }> => {
  const groups = new Map<string, EndRef[]>()
  const push = (ref: EndRef) => {
    const key = `${ref.nodeId}|${ref.side}`
    const list = groups.get(key)
    if (list) list.push(ref)
    else groups.set(key, [ref])
  }
  for (const r of routed) {
    const sRect = rects.get(r.edge.source)!
    const tRect = rects.get(r.edge.target)!
    const sDesired = r.route
      ? alongSide(r.sourceSide, r.route[0])
      : alongSide(r.sourceSide, centerOf(tRect))
    const tDesired = r.route
      ? alongSide(r.targetSide, r.route[r.route.length - 1])
      : alongSide(r.targetSide, centerOf(sRect))
    push({ edgeId: r.edge.id, end: "source", nodeId: r.edge.source, side: r.sourceSide, desired: sDesired })
    push({ edgeId: r.edge.id, end: "target", nodeId: r.edge.target, side: r.targetSide, desired: tDesired })
  }
  const out = new Map<string, { sourceHandle: string; targetHandle: string; sourcePoint: LayoutPoint; targetPoint: LayoutPoint }>()
  for (const [key, ends] of groups) {
    const sep = key.lastIndexOf("|")
    const nodeId = key.slice(0, sep)
    const side = key.slice(sep + 1) as HandleSide
    const rect = rects.get(nodeId)!
    const handles = getSideHandles(typeOf(nodeId), side, ends.length > SIDE_HANDLES[side].length)
    const positions = handles.map((h) => alongSide(side, sidePoint(rect, side, h.fraction)))
    // Stable order: by desired coordinate, then edge id.
    ends.sort((a, b) => a.desired - b.desired || a.edgeId.localeCompare(b.edgeId))
    const chosen = assignEndsToHandles(
      ends.map((e) => e.desired),
      positions
    )
    ends.forEach((ref, i) => {
      const h = handles[Math.max(0, chosen[i])]
      const point = roundPoint(sidePoint(rect, side, h.fraction))
      const slot = out.get(ref.edgeId) ?? {
        sourceHandle: "",
        targetHandle: "",
        sourcePoint: point,
        targetPoint: point,
      }
      if (ref.end === "source") {
        slot.sourceHandle = h.id
        slot.sourcePoint = point
      } else {
        slot.targetHandle = h.id
        slot.targetPoint = point
      }
      out.set(ref.edgeId, slot)
    })
  }
  return out
}

/**
 * Writes handles (and, for step edges, waypoints) back onto the edges.
 * `unrouted` step edges are routed with the orthogonal router around `obstacles`.
 */
const finaliseEdges = (
  edges: Edge[],
  routed: RoutedEdge[],
  rects: Map<string, LayoutRect>,
  typeOf: (id: string) => string | undefined,
  obstacles: RouterRect[]
): Edge[] => {
  if (routed.length === 0) return edges
  const handles = assignHandles(routed, rects, typeOf)
  const finalRoutes = new Map<string, LayoutPoint[]>()
  const toRoute: RouteRequest[] = []
  for (const r of routed) {
    const h = handles.get(r.edge.id)
    if (!h || renderKindOf(r.edge.type) !== "step") continue
    if (r.route && r.route.length >= 2) {
      let route = simplifyOrthogonal(r.route)
      if (route.length < 2) route = r.route
      const sRect = rects.get(r.edge.source)
      const tRect = rects.get(r.edge.target)
      const others = obstacles.filter((o) => !sameRect(o, sRect) && !sameRect(o, tRect))
      route = snapRouteEnd(route, true, h.sourcePoint, r.sourceSide, others)
      route = snapRouteEnd(route, false, h.targetPoint, r.targetSide, others)
      route = fixStraightRoute(route, r.sourceSide, r.targetSide)
      finalRoutes.set(r.edge.id, simplifyOrthogonal(route.map(roundPoint)))
    } else {
      toRoute.push({
        id: r.edge.id,
        source: { point: h.sourcePoint, side: r.sourceSide },
        target: { point: h.targetPoint, side: r.targetSide },
      })
    }
  }
  if (toRoute.length > 0) {
    const extra = routeOrthogonalEdges(obstacles, toRoute)
    for (const [id, pts] of extra) finalRoutes.set(id, pts.map(roundPoint))
  }
  const byId = new Map(routed.map((r) => [r.edge.id, r]))
  return edges.map((edge) => {
    const r = byId.get(edge.id)
    const h = handles.get(edge.id)
    if (!r || !h) return edge
    const data = { ...((edge.data ?? {}) as Record<string, unknown>) }
    const route = finalRoutes.get(edge.id)
    if (route && route.length >= 2) {
      data.points = route
    } else if (Array.isArray(data.points) && data.points.length > 0) {
      // Stale waypoints relative to the old geometry — drop them.
      data.points = []
    }
    return { ...edge, sourceHandle: h.sourceHandle, targetHandle: h.targetHandle, data }
  })
}

// ---------------------------------------------------------------------------
// ELK graph construction (layered / tree pipelines)
// ---------------------------------------------------------------------------

interface LayoutInput {
  nodes: Node[]
  /** Layout parent of each node (real parentId restricted to laid-out nodes). */
  parentOf: Map<string, string | undefined>
  edges: { edge: Edge; role: EdgeRole }[]
  layoutOptions: LayoutOptions
  nodeOptions?: (node: Node) => LayoutOptions | undefined
  /** Edge labels reserve space in ELK (text is only measured, not placed). */
  withLabels: boolean
  /** Include centre labels (names) — default true. */
  centreLabels?: boolean
}

interface ElkResult {
  /** Absolute rect of every laid-out node. */
  rects: Map<string, LayoutRect>
  /** Route per edge id, in the edge's own orientation, absolute coords. */
  routes: Map<string, LayoutPoint[]>
}

const estimateTextWidth = (text: string): number => Math.ceil(text.length * 6.6) + 8

const edgeLabels = (edge: Edge, reversed: boolean, withCentre: boolean): ElkLabel[] => {
  const data = (edge.data ?? {}) as Record<string, unknown>
  const labels: ElkLabel[] = []
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "")
  const centre = str(data.label) || str(data.name)
  if (centre && withCentre) {
    labels.push({
      text: centre,
      width: estimateTextWidth(centre),
      height: 16,
      layoutOptions: { "elk.edgeLabels.placement": "CENTER" },
    })
  }
  const endText = (role: string, mult: string) => [role, mult].filter(Boolean)
  const sourceEnd = endText(str(data.sourceRole), str(data.sourceMultiplicity))
  const targetEnd = endText(str(data.targetRole), str(data.targetMultiplicity))
  const endLabel = (parts: string[], placement: "HEAD" | "TAIL"): ElkLabel => ({
    text: parts.join(" "),
    width: Math.max(...parts.map(estimateTextWidth)),
    height: 16 * parts.length,
    layoutOptions: { "elk.edgeLabels.placement": placement },
  })
  // TAIL = ELK source end. For a reversed edge the model source is ELK's target.
  if (sourceEnd.length) labels.push(endLabel(sourceEnd, reversed ? "HEAD" : "TAIL"))
  if (targetEnd.length) labels.push(endLabel(targetEnd, reversed ? "TAIL" : "HEAD"))
  return labels
}

const runElk = async (input: LayoutInput): Promise<ElkResult> => {
  const { nodes, parentOf, edges } = input
  const childrenOf = new Map<string | undefined, Node[]>()
  for (const node of nodes) {
    const p = parentOf.get(node.id)
    const list = childrenOf.get(p)
    if (list) list.push(node)
    else childrenOf.set(p, [node])
  }
  const elkById = new Map<string, ElkNode>()
  const build = (node: Node): ElkNode => {
    const kids = childrenOf.get(node.id) ?? []
    const extra = input.nodeOptions?.(node) ?? {}
    if (kids.length > 0) {
      const { width, height } = nodeSize(node)
      const elkNode: ElkNode = {
        id: node.id,
        ports: [],
        edges: [],
        children: kids.map(build),
        layoutOptions: {
          "elk.padding": containerPadding(node.type),
          "elk.nodeSize.constraints": "[MINIMUM_SIZE]",
          "elk.nodeSize.minimum": `(${Math.min(width, 160)},${Math.min(height, 100)})`,
          ...extra,
        },
      }
      elkById.set(node.id, elkNode)
      return elkNode
    }
    const { width, height } = nodeSize(node)
    const elkNode: ElkNode = { id: node.id, width, height, ports: [], layoutOptions: extra }
    elkById.set(node.id, elkNode)
    return elkNode
  }
  const root: ElkNode = {
    id: "__besser_auto_layout_root__",
    layoutOptions: input.layoutOptions,
    children: (childrenOf.get(undefined) ?? []).map(build),
    edges: [],
  }

  // Ancestor chains for the edge container (lowest common ancestor).
  const ancestors = (id: string): string[] => {
    const chain: string[] = []
    let p = parentOf.get(id)
    const seen = new Set<string>()
    while (p && !seen.has(p)) {
      seen.add(p)
      chain.push(p)
      p = parentOf.get(p)
    }
    return chain
  }
  const containerFor = (a: string, b: string): ElkNode => {
    const aChain = [a, ...ancestors(a)]
    const bChain = [b, ...ancestors(b)]
    // One endpoint contains the other → the edge lives in the container.
    if (bChain.includes(a) && a !== b) return elkById.get(a) ?? root
    if (aChain.includes(b) && a !== b) return elkById.get(b) ?? root
    const bAnc = new Set(ancestors(b))
    for (const anc of ancestors(a)) if (bAnc.has(anc)) return elkById.get(anc) ?? root
    return root
  }

  const reversedById = new Map<string, boolean>()
  for (const { edge, role } of edges) {
    const from = role.reverse ? edge.target : edge.source
    const to = role.reverse ? edge.source : edge.target
    const fromNode = elkById.get(from)
    const toNode = elkById.get(to)
    if (!fromNode || !toNode) continue
    const fromPort: ElkPort = { id: `${edge.id}::from`, width: 0, height: 0 }
    const toPort: ElkPort = { id: `${edge.id}::to`, width: 0, height: 0 }
    fromNode.ports!.push(fromPort)
    toNode.ports!.push(toPort)
    const elkEdge: ElkExtendedEdge = {
      id: edge.id,
      sources: [fromPort.id],
      targets: [toPort.id],
      layoutOptions: {
        "elk.layered.priority.direction": String(role.direction),
        "elk.layered.priority.shortness": String(role.shortness),
        "elk.layered.priority.straightness": String(role.straightness),
      },
    }
    if (input.withLabels) {
      const labels = edgeLabels(edge, role.reverse, input.centreLabels !== false)
      if (labels.length) elkEdge.labels = labels
    }
    const container = containerFor(from, to)
    container.edges = container.edges ?? []
    container.edges.push(elkEdge)
    reversedById.set(edge.id, role.reverse)
  }

  const elk = new ELK()
  const laid = await elk.layout(root)

  const rects = new Map<string, LayoutRect>()
  const routes = new Map<string, LayoutPoint[]>()
  const walk = (elkNode: ElkNode, ox: number, oy: number) => {
    for (const child of elkNode.children ?? []) {
      const x = ox + (child.x ?? 0)
      const y = oy + (child.y ?? 0)
      rects.set(child.id, { x, y, width: child.width ?? 0, height: child.height ?? 0 })
      walk(child, x, y)
    }
    for (const e of elkNode.edges ?? []) {
      const sections = e.sections ?? []
      if (sections.length === 0) continue
      const pts: LayoutPoint[] = []
      for (const s of sections) {
        for (const p of [s.startPoint, ...(s.bendPoints ?? []), s.endPoint]) {
          const last = pts[pts.length - 1]
          if (!last || Math.abs(last.x - p.x) > 0.01 || Math.abs(last.y - p.y) > 0.01) {
            pts.push({ x: p.x, y: p.y })
          }
        }
      }
      routes.set(e.id, reversedById.get(e.id) ? pts.reverse() : pts)
    }
  }
  walk(laid, 0, 0)
  return { rects, routes }
}

// ---------------------------------------------------------------------------
// Result assembly
// ---------------------------------------------------------------------------

/**
 * Applies absolute rects to nodes: positions are written relative to the
 * node's real parent (or absolute for root nodes), containers take their new
 * size. Coordinates are rounded to whole pixels.
 */
const applyRects = (
  nodes: Node[],
  absolute: Map<string, LayoutRect>,
  resized: Set<string>
): { nodes: Node[]; rects: Map<string, LayoutRect> } => {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const rounded = new Map<string, LayoutRect>()
  for (const [id, r] of absolute) {
    rounded.set(id, {
      x: Math.round(r.x),
      y: Math.round(r.y),
      width: Math.round(r.width),
      height: Math.round(r.height),
    })
  }
  const out = nodes.map((node) => {
    const r = rounded.get(node.id)
    if (!r) return node
    const parent = node.parentId ? byId.get(node.parentId) : undefined
    let parentRect = parent ? rounded.get(parent.id) : undefined
    if (parent && !parentRect) {
      // Parent not laid out (e.g. non-visual) — keep coordinates relative to it.
      parentRect = absoluteRects(nodes).get(parent.id)
    }
    const position = parentRect ? { x: r.x - parentRect.x, y: r.y - parentRect.y } : { x: r.x, y: r.y }
    if (!resized.has(node.id)) return { ...node, position }
    return {
      ...node,
      position,
      width: r.width,
      height: r.height,
      ...(node.measured ? { measured: { width: r.width, height: r.height } } : {}),
    }
  })
  // Final absolute rects (from the written values) for handle placement.
  return { nodes: out, rects: absoluteRects(out) }
}

// ---------------------------------------------------------------------------
// Pipelines
// ---------------------------------------------------------------------------

interface Prepared {
  visible: Node[]
  byId: Map<string, Node>
  info: GraphInfo
  /** Node-to-node edges between visible nodes. */
  nodeEdges: Edge[]
}

const prepare = (nodes: Node[], edges: Edge[]): Prepared => {
  const visible = nodes.filter((n) => !NON_VISUAL_NODE_TYPES.has(n.type ?? ""))
  const byId = new Map(visible.map((n) => [n.id, n]))
  const nodeEdges = edges.filter((e) => byId.has(e.source) && byId.has(e.target))
  const indeg = new Map<string, number>()
  const outdeg = new Map<string, number>()
  for (const e of nodeEdges) {
    if (e.source === e.target) continue
    outdeg.set(e.source, (outdeg.get(e.source) ?? 0) + 1)
    indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1)
  }
  return { visible, byId, info: { byId, indeg, outdeg }, nodeEdges }
}

/**
 * BFS levels of the top-level nodes over the undirected edge graph, rooted
 * per connected component at its centre (minimum eccentricity; ties → higher
 * degree, then model order). Used to orient undirected associations so they
 * connect adjacent layers.
 */
const undirectedLevels = (
  ordered: Node[],
  edges: Edge[],
  parentOf: Map<string, string | undefined>
): Map<string, number> => {
  const topOf = (id: string): string => {
    let cur = id
    const seen = new Set<string>()
    for (let p = parentOf.get(cur); p && !seen.has(p); p = parentOf.get(cur)) {
      seen.add(p)
      cur = p
    }
    return cur
  }
  const ids = ordered.filter((n) => !parentOf.get(n.id)).map((n) => n.id)
  const adj = new Map<string, Set<string>>(ids.map((id) => [id, new Set<string>()]))
  for (const e of edges) {
    const a = topOf(e.source)
    const b = topOf(e.target)
    if (a === b || !adj.has(a) || !adj.has(b)) continue
    adj.get(a)!.add(b)
    adj.get(b)!.add(a)
  }
  const bfs = (root: string): Map<string, number> => {
    const dist = new Map<string, number>([[root, 0]])
    const queue = [root]
    for (let q = 0; q < queue.length; q++) {
      const cur = queue[q]
      for (const nb of adj.get(cur)!) {
        if (!dist.has(nb)) {
          dist.set(nb, dist.get(cur)! + 1)
          queue.push(nb)
        }
      }
    }
    return dist
  }
  const levels = new Map<string, number>()
  const done = new Set<string>()
  const exact = ids.length <= 400
  for (const start of ids) {
    if (done.has(start)) continue
    const component = [...bfs(start).keys()]
    component.forEach((id) => done.add(id))
    let root = component[0]
    let best = Infinity
    for (const id of component) {
      const ecc = exact ? Math.max(...bfs(id).values()) : -adj.get(id)!.size
      const better =
        ecc < best || (ecc === best && adj.get(id)!.size > adj.get(root)!.size)
      if (better) {
        best = ecc
        root = id
      }
    }
    for (const [id, d] of bfs(root)) levels.set(id, d)
  }
  // Children inherit their container's level.
  for (const n of ordered) {
    const top = topOf(n.id)
    if (top !== n.id && levels.has(top)) levels.set(n.id, levels.get(top)!)
  }
  return levels
}

const properCrossing = (a: LayoutPoint, b: LayoutPoint, c: LayoutPoint, d: LayoutPoint): boolean => {
  const cross = (p: LayoutPoint, q: LayoutPoint, r: LayoutPoint) =>
    (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)
  const d1 = cross(c, d, a)
  const d2 = cross(c, d, b)
  const d3 = cross(a, b, c)
  const d4 = cross(a, b, d)
  return d1 * d2 < -1e-6 && d3 * d4 < -1e-6
}

/**
 * Objective score of an ELK result (lower is better): total route length,
 * a heavy penalty per edge crossing and a mild one for the drawing's extent.
 */
export const scoreLayout = (result: {
  rects: Map<string, LayoutRect>
  routes: Map<string, LayoutPoint[]>
}): number => {
  const routes = [...result.routes.values()]
  let length = 0
  for (const pts of routes) {
    for (let i = 0; i + 1 < pts.length; i++) {
      length += Math.abs(pts[i + 1].x - pts[i].x) + Math.abs(pts[i + 1].y - pts[i].y)
    }
  }
  let crossings = 0
  if (routes.length <= 400) {
    for (let i = 0; i < routes.length; i++) {
      for (let j = i + 1; j < routes.length; j++) {
        const A = routes[i]
        const B = routes[j]
        for (let a = 0; a + 1 < A.length; a++) {
          for (let b = 0; b + 1 < B.length; b++) {
            if (properCrossing(A[a], A[a + 1], B[b], B[b + 1])) crossings++
          }
        }
      }
    }
  }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const r of result.rects.values()) {
    minX = Math.min(minX, r.x)
    minY = Math.min(minY, r.y)
    maxX = Math.max(maxX, r.x + r.width)
    maxY = Math.max(maxY, r.y + r.height)
  }
  const extent = Number.isFinite(minX) ? maxX - minX + (maxY - minY) : 0
  return length + 300 * crossings + extent
}

const runElkSafe = async (input: LayoutInput): Promise<ElkResult> => {
  try {
    return await runElk(input)
  } catch {
    // Defensive: retry with the most conservative configuration.
    return runElk({
      ...input,
      withLabels: false,
      nodeOptions: undefined,
      layoutOptions: {
        ...input.layoutOptions,
        "elk.layered.considerModelOrder.strategy": "NONE",
      },
    })
  }
}

const COMPONENT_GAP = 80

/**
 * Bottom-left "skyline" packing of rectangles into a strip of `targetWidth`
 * (items wider than the strip still fit, alone on their row). Returns the
 * top-left corner of every item, in input order.
 */
export const packRectangles = (
  items: { width: number; height: number }[],
  gap: number,
  targetWidth: number
): LayoutPoint[] => {
  type Seg = { x: number; w: number; y: number }
  let sky: Seg[] = [{ x: 0, w: Number.POSITIVE_INFINITY, y: 0 }]
  const out: LayoutPoint[] = []
  for (const item of items) {
    const w = item.width + gap
    let best: LayoutPoint | undefined
    for (let i = 0; i < sky.length; i++) {
      const x = sky[i].x
      if (x > 0 && x + item.width > targetWidth) continue
      let y = 0
      let covered = 0
      for (let j = i; j < sky.length && covered < w; j++) {
        y = Math.max(y, sky[j].y)
        covered += sky[j].w
      }
      if (!best || y < best.y - 0.5 || (Math.abs(y - best.y) <= 0.5 && x < best.x)) best = { x, y }
    }
    const pos = best ?? { x: 0, y: Math.max(...sky.map((s) => s.y)) }
    out.push(pos)
    const top = pos.y + item.height + gap
    const next: Seg[] = []
    for (const s of sky) {
      const sEnd = s.x + s.w
      if (sEnd <= pos.x || s.x >= pos.x + w) {
        next.push(s)
        continue
      }
      if (s.x < pos.x) next.push({ x: s.x, w: pos.x - s.x, y: s.y })
      if (sEnd > pos.x + w) next.push({ x: pos.x + w, w: sEnd - (pos.x + w), y: s.y })
    }
    next.push({ x: pos.x, w, y: top })
    next.sort((a, b) => a.x - b.x)
    sky = []
    for (const s of next) {
      const last = sky[sky.length - 1]
      if (last && Math.abs(last.y - s.y) < 0.5 && Math.abs(last.x + last.w - s.x) < 0.5) last.w += s.w
      else sky.push({ ...s })
    }
  }
  return out
}

/**
 * Lays out every connected component on its own (ELK) and packs the
 * components — largest first, then isolated elements such as enumerations or
 * notes — with a skyline packer, so small disconnected elements fill the
 * space next to the main graph instead of forming one long row.
 */
const layoutComponents = async (
  input: LayoutInput,
  direction: "DOWN" | "RIGHT"
): Promise<ElkResult> => {
  const { nodes, parentOf } = input
  const topOf = (id: string): string => {
    let cur = id
    const seen = new Set<string>()
    for (let p = parentOf.get(cur); p && !seen.has(p); p = parentOf.get(cur)) {
      seen.add(p)
      cur = p
    }
    return cur
  }
  const uf = new Map<string, string>()
  const find = (a: string): string => {
    let r = a
    while (uf.get(r) !== r) r = uf.get(r)!
    uf.set(a, r)
    return r
  }
  for (const n of nodes) if (!parentOf.get(n.id)) uf.set(n.id, n.id)
  for (const { edge } of input.edges) {
    const a = find(topOf(edge.source))
    const b = find(topOf(edge.target))
    if (a !== b) uf.set(a, b)
  }
  const compOrder: string[] = []
  const members = new Map<string, Node[]>()
  for (const n of nodes) {
    const c = find(topOf(n.id))
    if (!members.has(c)) {
      members.set(c, [])
      compOrder.push(c)
    }
    members.get(c)!.push(n)
  }
  const compEdges = new Map<string, LayoutInput["edges"]>()
  for (const e of input.edges) {
    const c = find(topOf(e.edge.source))
    const list = compEdges.get(c)
    if (list) list.push(e)
    else compEdges.set(c, [e])
  }

  interface Placed {
    result: ElkResult
    width: number
    height: number
    minX: number
    minY: number
    order: number
  }
  const placed: Placed[] = []
  for (const [order, c] of compOrder.entries()) {
    const compNodes = members.get(c)!
    const edgesHere = compEdges.get(c) ?? []
    let result: ElkResult
    if (compNodes.length === 1 && edgesHere.length === 0) {
      const { width, height } = nodeSize(compNodes[0])
      result = { rects: new Map([[compNodes[0].id, { x: 0, y: 0, width, height }]]), routes: new Map() }
    } else {
      result = await runElkSafe({
        ...input,
        nodes: compNodes,
        edges: edgesHere,
        layoutOptions: {
          ...input.layoutOptions,
          "elk.separateConnectedComponents": "false",
          "elk.padding": "[top=0,left=0,bottom=0,right=0]",
        },
      })
    }
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const r of result.rects.values()) {
      minX = Math.min(minX, r.x)
      minY = Math.min(minY, r.y)
      maxX = Math.max(maxX, r.x + r.width)
      maxY = Math.max(maxY, r.y + r.height)
    }
    for (const pts of result.routes.values()) {
      for (const p of pts) {
        minX = Math.min(minX, p.x)
        minY = Math.min(minY, p.y)
        maxX = Math.max(maxX, p.x)
        maxY = Math.max(maxY, p.y)
      }
    }
    placed.push({ result, width: maxX - minX, height: maxY - minY, minX, minY, order })
  }
  if (placed.length === 1) return placed[0].result

  // Largest component first (anchors the top-left), then tallest-first for a
  // tight skyline; ties keep the model order.
  const area = (p: Placed) => p.width * p.height
  const main = placed.reduce((a, b) => (area(b) > area(a) ? b : a))
  const rest = placed
    .filter((p) => p !== main)
    .sort((a, b) =>
      direction === "DOWN"
        ? b.height - a.height || a.order - b.order
        : b.width - a.width || a.order - b.order
    )
  const sequence = [main, ...rest]
  const totalArea = sequence.reduce((s, p) => s + (p.width + COMPONENT_GAP) * (p.height + COMPONENT_GAP), 0)
  const widest = Math.max(...sequence.map((p) => p.width))
  const targetWidth = Math.max(widest, Math.sqrt(totalArea * 1.6))
  const positions = packRectangles(sequence, COMPONENT_GAP, targetWidth)

  const rects = new Map<string, LayoutRect>()
  const routes = new Map<string, LayoutPoint[]>()
  sequence.forEach((p, i) => {
    const dx = positions[i].x - p.minX
    const dy = positions[i].y - p.minY
    for (const [id, r] of p.result.rects) rects.set(id, { ...r, x: r.x + dx, y: r.y + dy })
    for (const [id, pts] of p.result.routes) routes.set(id, pts.map((q) => ({ x: q.x + dx, y: q.y + dy })))
  })
  return { rects, routes }
}

/**
 * Breadth-first order along the directed edges, starting at the nodes forced
 * into the first layer (initial states), then nodes without incoming edges,
 * then — for pure cycles — the first node in positional order. Unreached
 * nodes keep their positional order at the end.
 */
const flowOrder = (
  positional: Node[],
  edges: Edge[],
  constraintOf: (node: Node) => LayerConstraint
): Node[] => {
  const ids = new Set(positional.map((n) => n.id))
  const out = new Map<string, string[]>()
  const indeg = new Map<string, number>()
  for (const e of edges) {
    if (e.source === e.target || !ids.has(e.source) || !ids.has(e.target)) continue
    ;(out.get(e.source) ?? out.set(e.source, []).get(e.source)!).push(e.target)
    indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1)
  }
  const rank = new Map(positional.map((n, i) => [n.id, i]))
  const visited = new Set<string>()
  const order: string[] = []
  const bfs = (starts: string[]) => {
    const queue = starts.filter((s) => !visited.has(s))
    queue.forEach((s) => visited.add(s))
    for (let q = 0; q < queue.length; q++) {
      const cur = queue[q]
      order.push(cur)
      const next = [...(out.get(cur) ?? [])].sort((a, b) => rank.get(a)! - rank.get(b)!)
      for (const nb of next) {
        if (!visited.has(nb)) {
          visited.add(nb)
          queue.push(nb)
        }
      }
    }
  }
  bfs(positional.filter((n) => constraintOf(n) === "FIRST").map((n) => n.id))
  bfs(positional.filter((n) => !indeg.get(n.id) && out.has(n.id)).map((n) => n.id))
  for (const n of positional) if (!visited.has(n.id) && out.has(n.id)) bfs([n.id])
  const byId = new Map(positional.map((n) => [n.id, n]))
  const result = order.map((id) => byId.get(id)!)
  for (const n of positional) if (!visited.has(n.id)) result.push(n)
  return result
}

/** Sort key reflecting the user's current arrangement (stable ELK model order). */
const modelOrder = (nodes: Node[], direction: "DOWN" | "RIGHT"): Node[] => {
  const rects = absoluteRects(nodes)
  return [...nodes].sort((a, b) => {
    const ra = rects.get(a.id)!
    const rb = rects.get(b.id)!
    return direction === "DOWN" ? ra.y - rb.y || ra.x - rb.x : ra.x - rb.x || ra.y - rb.y
  })
}

const layeredPipeline = async (
  nodes: Node[],
  edges: Edge[],
  diagramType: string,
  family: Family,
  direction: "DOWN" | "RIGHT"
): Promise<{ nodes: Node[]; edges: Edge[] }> => {
  const prep = prepare(nodes, edges)
  const positional = modelOrder(prep.visible, direction)
  const parentOf = new Map<string, string | undefined>()
  for (const n of positional) parentOf.set(n.id, n.parentId && prep.byId.has(n.parentId) ? n.parentId : undefined)
  // Flows: model order = reachability order from the start nodes, so ELK's
  // model-order cycle breaking treats edges back towards the start as the
  // feedback edges (state machines / agents are cyclic by nature).
  const ordered =
    family === "structural"
      ? positional
      : flowOrder(positional, prep.nodeEdges, (n) => layerConstraintOf(diagramType, n, prep.info))
  const roleOf = family === "structural" ? structuralEdgeRole : flowEdgeRole
  const plainEdges = prep.nodeEdges.map((edge) => ({ edge, role: roleOf(edge, prep.info) }))
  const options = layeredOptions(direction, family)
  const input: LayoutInput = {
    nodes: ordered,
    parentOf,
    edges: plainEdges,
    layoutOptions: options,
    // Structural diagrams: only end labels (roles / multiplicities) reserve
    // space; a centre-label dummy would add a whole layer per association.
    withLabels: true,
    centreLabels: family !== "structural",
    nodeOptions: (node) => {
      const constraint = layerConstraintOf(diagramType, node, prep.info)
      return constraint ? { "elk.layered.layering.layerConstraint": constraint } : undefined
    },
  }
  let result = await layoutComponents(input, direction)
  let layoutEdges = plainEdges
  if (family === "structural") {
    // Second candidate: undirected associations oriented along BFS levels
    // (they then span as few layers as possible instead of always stacking
    // source above target). Keep whichever candidate scores better.
    const levels = undirectedLevels(ordered, prep.nodeEdges, parentOf)
    let changed = false
    const bfsEdges = plainEdges.map(({ edge, role }) => {
      const type = edge.type ?? ""
      if (INHERITANCE_EDGE_TYPES.has(type) || WHOLE_PART_EDGE_TYPES.has(type) || ATTACHMENT_EDGE_TYPES.has(type)) {
        return { edge, role }
      }
      const ls = levels.get(edge.source)
      const lt = levels.get(edge.target)
      if (ls === undefined || lt === undefined || ls === lt) return { edge, role }
      const reverse = ls > lt
      if (reverse !== role.reverse) changed = true
      return { edge, role: { ...role, reverse, direction: 1 } }
    })
    if (changed) {
      const candidate = await layoutComponents({ ...input, edges: bfsEdges }, direction)
      if (scoreLayout(candidate) < scoreLayout(result)) {
        result = candidate
        layoutEdges = bfsEdges
      }
    }
  }
  const containers = new Set([...parentOf.values()].filter((p): p is string => !!p))
  const applied = applyRects(nodes, result.rects, containers)
  const typeOf = (id: string) => prep.byId.get(id)?.type
  const obstacles = leafObstacles(applied.nodes, applied.rects)
  const routed: RoutedEdge[] = []
  for (const { edge } of layoutEdges) {
    const route = result.routes.get(edge.id)
    const sRect = applied.rects.get(edge.source)
    const tRect = applied.rects.get(edge.target)
    if (!sRect || !tRect) continue
    if (route && route.length >= 2) {
      const back =
        renderKindOf(edge.type) === "bezier"
          ? bezierBackEdgeSides(sRect, tRect, route, direction, obstacles)
          : undefined
      routed.push({
        edge,
        route,
        sourceSide: back?.sourceSide ?? sideOfEndpoint(sRect, route[0], route[1]),
        targetSide: back?.targetSide ?? sideOfEndpoint(tRect, route[route.length - 1], route[route.length - 2]),
      })
    } else {
      const { sourceSide, targetSide } = chooseFacingSidesForRects(sRect, tRect)
      routed.push({ edge, sourceSide, targetSide })
    }
  }
  return {
    nodes: applied.nodes,
    edges: finaliseEdges(edges, routed, applied.rects, typeOf, obstacles),
  }
}

/**
 * Bézier edges ignore stored waypoints. A backward edge (against the flow
 * direction) is attached to the facing sides when the straight line between
 * them is free — it then reads as the return half of a pair — and otherwise
 * to the same side on both ends (the side ELK routed the feedback edge
 * around), so the curve arches over or under the nodes in between.
 */
const bezierBackEdgeSides = (
  s: LayoutRect,
  t: LayoutRect,
  route: LayoutPoint[],
  direction: "DOWN" | "RIGHT",
  obstacles: LayoutRect[]
): { sourceSide: HandleSide; targetSide: HandleSide } | undefined => {
  const sc = centerOf(s)
  const tc = centerOf(t)
  const backward = direction === "RIGHT" ? tc.x < sc.x - 10 : tc.y < sc.y - 10
  if (!backward) return undefined
  const facing = chooseFacingSidesForRects(s, t)
  const a = sidePoint(s, facing.sourceSide, 0.5)
  const b = sidePoint(t, facing.targetSide, 0.5)
  const others = obstacles.filter((o) => !sameRect(o, s) && !sameRect(o, t))
  const hits = others.some((r) => lineHitsRect(a, b, r))
  if (!hits) return facing
  let side: HandleSide
  if (direction === "RIGHT") {
    const minY = Math.min(...route.map((p) => p.y))
    const maxY = Math.max(...route.map((p) => p.y))
    if (minY < Math.min(s.y, t.y) - 1) side = "top"
    else if (maxY > Math.max(s.y + s.height, t.y + t.height) + 1) side = "bottom"
    else side = sc.y <= tc.y ? "top" : "bottom"
  } else {
    const minX = Math.min(...route.map((p) => p.x))
    const maxX = Math.max(...route.map((p) => p.x))
    if (minX < Math.min(s.x, t.x) - 1) side = "left"
    else if (maxX > Math.max(s.x + s.width, t.x + t.width) + 1) side = "right"
    else side = sc.x <= tc.x ? "left" : "right"
  }
  return { sourceSide: side, targetSide: side }
}

/** Liang–Barsky test of an arbitrary segment against a rectangle's interior. */
const lineHitsRect = (a: LayoutPoint, b: LayoutPoint, r: LayoutRect): boolean => {
  const x0 = r.x + 2
  const y0 = r.y + 2
  const x1 = r.x + r.width - 2
  const y1 = r.y + r.height - 2
  if (x1 <= x0 || y1 <= y0) return false
  let t0 = 0
  let t1 = 1
  const dx = b.x - a.x
  const dy = b.y - a.y
  const clip = (p: number, q: number): boolean => {
    if (Math.abs(p) < 1e-9) return q >= 0
    const t = q / p
    if (p < 0) {
      if (t > t1) return false
      if (t > t0) t0 = t
    } else {
      if (t < t0) return false
      if (t < t1) t1 = t
    }
    return true
  }
  return (
    clip(-dx, a.x - x0) && clip(dx, x1 - a.x) && clip(-dy, a.y - y0) && clip(dy, y1 - a.y) && t1 - t0 > 1e-6
  )
}

/** Leaf (non-container) node rects — obstacles for the orthogonal router. */
const leafObstacles = (nodes: Node[], rects: Map<string, LayoutRect>): RouterRect[] => {
  const parents = new Set(nodes.map((n) => n.parentId).filter(Boolean))
  return nodes
    .filter((n) => !parents.has(n.id) && !NON_VISUAL_NODE_TYPES.has(n.type ?? "") && !CONTAINER_NODE_TYPES.has(n.type ?? ""))
    .map((n) => rects.get(n.id))
    .filter((r): r is LayoutRect => !!r)
}

const CONTAINER_NODE_TYPES: ReadonlySet<string> = new Set([
  "bpmnPool",
  "bpmnSwimlane",
  "bpmnGroup",
  "NNContainer",
  "package",
  "useCaseSystem",
  "componentSubsystem",
  "deploymentNode",
  "activity",
])

/**
 * "Compact" strategy: ELK stress (distance-based, no levels) for placement,
 * SPOrE overlap removal, then orthogonal routing around the nodes.
 * Only used for flat diagrams (no compound nodes).
 */
const compactPipeline = async (
  nodes: Node[],
  edges: Edge[]
): Promise<{ nodes: Node[]; edges: Edge[] }> => {
  const prep = prepare(nodes, edges)
  const elk = new ELK()
  const connected = new Set(prep.nodeEdges.flatMap((e) => (e.source === e.target ? [] : [e.source, e.target])))
  const ordered = modelOrder(prep.visible, "DOWN")
  const children = ordered.filter((n) => connected.has(n.id)).map((n) => ({ id: n.id, ...nodeSize(n) }))
  const elkEdges = prep.nodeEdges
    .filter((e) => e.source !== e.target)
    .map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] }))
  const absolute = new Map<string, LayoutRect>()
  if (children.length > 0) {
    const stress = await elk.layout({
      id: "__besser_compact_root__",
      layoutOptions: {
        "elk.algorithm": "stress",
        "elk.stress.desiredEdgeLength": "260",
        "elk.stress.epsilon": "0.0001",
        "elk.stress.iterationLimit": "400",
        "elk.separateConnectedComponents": "true",
        "elk.spacing.componentComponent": "90",
        "elk.aspectRatio": "1.6",
      },
      children,
      edges: elkEdges,
    })
    const spored = await elk.layout({
      id: "__besser_compact_overlap__",
      layoutOptions: {
        "elk.algorithm": "sporeOverlap",
        "elk.spacing.nodeNode": "90",
        "elk.padding": "[top=0,left=0,bottom=0,right=0]",
      },
      children: (stress.children ?? []).map((c) => ({
        id: c.id,
        x: c.x,
        y: c.y,
        width: c.width,
        height: c.height,
      })),
      edges: elkEdges,
    })
    for (const c of spored.children ?? []) {
      absolute.set(c.id, { x: c.x ?? 0, y: c.y ?? 0, width: c.width ?? 0, height: c.height ?? 0 })
    }
  }
  // Isolated elements (enumerations, notes) are packed next to the graph.
  const isolated = ordered.filter((n) => !connected.has(n.id))
  if (isolated.length > 0) {
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const r of absolute.values()) {
      minX = Math.min(minX, r.x)
      minY = Math.min(minY, r.y)
      maxX = Math.max(maxX, r.x + r.width)
      maxY = Math.max(maxY, r.y + r.height)
    }
    const main = Number.isFinite(minX) ? [{ width: maxX - minX, height: maxY - minY }] : []
    const items = [...main, ...isolated.map((n) => nodeSize(n)).sort((a, b) => b.height - a.height)]
    const sizes = isolated.map((n) => ({ n, ...nodeSize(n) })).sort((a, b) => b.height - a.height)
    const totalArea = items.reduce((acc, it) => acc + (it.width + COMPONENT_GAP) * (it.height + COMPONENT_GAP), 0)
    const target = Math.max(...items.map((it) => it.width), Math.sqrt(totalArea * 1.6))
    const pos = packRectangles(items, COMPONENT_GAP, target)
    if (main.length) {
      const dx = pos[0].x - minX
      const dy = pos[0].y - minY
      for (const [id, r] of absolute) absolute.set(id, { ...r, x: r.x + dx, y: r.y + dy })
    }
    sizes.forEach((it, i) => {
      const p = pos[i + main.length]
      absolute.set(it.n.id, { x: p.x, y: p.y, width: it.width, height: it.height })
    })
  }
  const applied = applyRects(nodes, absolute, new Set())
  const typeOf = (id: string) => prep.byId.get(id)?.type
  const routed: RoutedEdge[] = prep.nodeEdges.map((edge) => {
    const sRect = applied.rects.get(edge.source)!
    const tRect = applied.rects.get(edge.target)!
    if (edge.source === edge.target) {
      return { edge, sourceSide: "right", targetSide: "top" }
    }
    const { sourceSide, targetSide } = chooseFacingSidesForRects(sRect, tRect)
    return { edge, sourceSide, targetSide }
  })
  return {
    nodes: applied.nodes,
    edges: finaliseEdges(edges, routed, applied.rects, typeOf, leafObstacles(applied.nodes, applied.rects)),
  }
}

/**
 * Syntax trees: ELK `mrtree` DOWN. Edges are oriented parent → child for the
 * tree algorithm (whichever orientation of the links yields a single root);
 * non-tree inputs fall back to the layered pipeline.
 */
const treePipeline = async (
  nodes: Node[],
  edges: Edge[],
  diagramType: string
): Promise<{ nodes: Node[]; edges: Edge[] }> => {
  const prep = prepare(nodes, edges)
  const links = prep.nodeEdges.filter((e) => e.source !== e.target)
  const roots = (reverse: boolean) => {
    const hasParent = new Set(links.map((e) => (reverse ? e.source : e.target)))
    return prep.visible.filter((n) => !hasParent.has(n.id)).length
  }
  const indegOk = (reverse: boolean) => {
    const count = new Map<string, number>()
    for (const e of links) {
      const child = reverse ? e.source : e.target
      count.set(child, (count.get(child) ?? 0) + 1)
    }
    return [...count.values()].every((c) => c <= 1)
  }
  const forwardOk = indegOk(false)
  const reverseOk = indegOk(true)
  if (!forwardOk && !reverseOk) return layeredPipeline(nodes, edges, diagramType, "flow", "DOWN")
  const reverse = !forwardOk || (reverseOk && roots(true) < roots(false))
  const elk = new ELK()
  const laid = await elk.layout({
    id: "__besser_tree_root__",
    layoutOptions: {
      "elk.algorithm": "mrtree",
      "elk.direction": "DOWN",
      "elk.spacing.nodeNode": "40",
      "elk.mrtree.weighting": "CONSTRAINT",
      "elk.separateConnectedComponents": "true",
      "elk.padding": "[top=20,left=20,bottom=20,right=20]",
    },
    children: modelOrder(prep.visible, "RIGHT").map((n) => ({ id: n.id, ...nodeSize(n) })),
    edges: links.map((e) => ({
      id: e.id,
      sources: [reverse ? e.target : e.source],
      targets: [reverse ? e.source : e.target],
    })),
  })
  const absolute = new Map<string, LayoutRect>()
  for (const c of laid.children ?? []) {
    absolute.set(c.id, { x: c.x ?? 0, y: c.y ?? 0, width: c.width ?? 0, height: c.height ?? 0 })
  }
  const applied = applyRects(nodes, absolute, new Set())
  const typeOf = (id: string) => prep.byId.get(id)?.type
  const routed: RoutedEdge[] = links.map((edge) => {
    const { sourceSide, targetSide } = chooseFacingSidesForRects(
      applied.rects.get(edge.source)!,
      applied.rects.get(edge.target)!
    )
    return { edge, sourceSide, targetSide }
  })
  return {
    nodes: applied.nodes,
    edges: finaliseEdges(edges, routed, applied.rects, typeOf, leafObstacles(applied.nodes, applied.rects)),
  }
}

// ---------------------------------------------------------------------------
// BPMN pipeline
// ---------------------------------------------------------------------------

const BPMN_ACTIVITY_TYPES: ReadonlySet<string> = new Set([
  "bpmnTask",
  "bpmnSubprocess",
  "bpmnTransaction",
  "bpmnCallActivity",
])

/** A horizontal band of the BPMN drawing: one lane, one lane-less pool, or the pool-less rest. */
interface BpmnBand {
  poolId?: string
  laneId?: string
  members: Node[]
}

/**
 * Stacks a band's nodes vertically while keeping their x (ELK layer) and their
 * vertical order: every node moves up as far as the nodes above it in the same
 * columns allow, snapping onto an existing row centre when possible so a
 * straight flow stays straight. Returns band-relative centre y per node.
 */
const compactBand = (
  members: { id: string; x: number; y: number; width: number; height: number }[],
  pad: number,
  gap: number
): { centre: Map<string, number>; height: number } => {
  const sorted = [...members].sort((a, b) => a.y + a.height / 2 - (b.y + b.height / 2) || a.x - b.x)
  const placed: { x0: number; x1: number; y0: number; y1: number }[] = []
  const rows: number[] = []
  const centre = new Map<string, number>()
  let bottom = 0
  for (const m of sorted) {
    const x0 = m.x - gap / 2
    const x1 = m.x + m.width + gap / 2
    let minC = pad + m.height / 2
    for (const p of placed) {
      if (p.x1 > x0 && p.x0 < x1) minC = Math.max(minC, p.y1 + gap + m.height / 2)
    }
    const fits = (c: number) =>
      placed.every((p) => !(p.x1 > x0 && p.x0 < x1 && p.y1 + gap / 2 > c - m.height / 2 && p.y0 - gap / 2 < c + m.height / 2))
    let c = rows.find((r) => r >= minC - 0.5 && r - minC < 40 && fits(r))
    if (c === undefined) {
      c = minC
      rows.push(c)
      rows.sort((a, b) => a - b)
    }
    centre.set(m.id, c)
    placed.push({ x0: m.x, x1: m.x + m.width, y0: c - m.height / 2, y1: c + m.height / 2 })
    bottom = Math.max(bottom, c + m.height / 2)
  }
  return { centre, height: bottom + pad }
}

const bpmnPipeline = async (
  nodes: Node[],
  edges: Edge[],
  diagramType: string
): Promise<{ nodes: Node[]; edges: Edge[] }> => {
  const prep = prepare(nodes, edges)
  const rects = absoluteRects(prep.visible)
  const pools = prep.visible
    .filter((n) => n.type === "bpmnPool" && !n.parentId)
    .sort((a, b) => rects.get(a.id)!.y - rects.get(b.id)!.y)
  if (pools.length === 0) {
    // No participants: a plain left-to-right flow.
    return layeredPipeline(nodes, edges, diagramType, "flow", "RIGHT")
  }
  const lanesOfPool = new Map<string, Node[]>()
  for (const pool of pools) {
    lanesOfPool.set(
      pool.id,
      prep.visible
        .filter((n) => n.type === "bpmnSwimlane" && n.parentId === pool.id)
        .sort((a, b) => a.position.y - b.position.y)
    )
  }
  const laneIds = new Set([...lanesOfPool.values()].flat().map((l) => l.id))
  const poolIds = new Set(pools.map((p) => p.id))

  // Boundary events: intermediate events sitting on an activity's border keep
  // their offset to the host.
  const attachedTo = new Map<string, { host: string; dx: number; dy: number }>()
  for (const n of prep.visible) {
    if (n.type !== "bpmnIntermediateEvent") continue
    const r = rects.get(n.id)!
    const c = centerOf(r)
    const host = prep.visible.find((h) => {
      if (!BPMN_ACTIVITY_TYPES.has(h.type ?? "") || h.id === n.id) return false
      const hr = rects.get(h.id)!
      const near = containsPoint({ x: hr.x - 4, y: hr.y - 4, width: hr.width + 8, height: hr.height + 8 }, c)
      const inside =
        r.x >= hr.x && r.y >= hr.y && r.x + r.width <= hr.x + hr.width && r.y + r.height <= hr.y + hr.height
      return near && !inside
    })
    if (host) {
      const hr = rects.get(host.id)!
      attachedTo.set(n.id, { host: host.id, dx: r.x - hr.x, dy: r.y - hr.y })
    }
  }

  // Bands: every lane of every pool (in order), lane-less pools, then the rest.
  const bands: BpmnBand[] = []
  const bandOfLane = new Map<string, number>()
  const bandOfPool = new Map<string, number>()
  for (const pool of pools) {
    const lanes = lanesOfPool.get(pool.id)!
    if (lanes.length === 0) {
      bandOfPool.set(pool.id, bands.length)
      bands.push({ poolId: pool.id, members: [] })
    } else {
      for (const lane of lanes) {
        bandOfLane.set(lane.id, bands.length)
        bands.push({ poolId: pool.id, laneId: lane.id, members: [] })
      }
    }
  }
  const freeBand = bands.length
  bands.push({ members: [] })

  // Top-level flow nodes (children of a subprocess ride along with it).
  const isTopLevel = (n: Node) => {
    const p = n.parentId ? prep.byId.get(n.parentId) : undefined
    return !p || poolIds.has(p.id) || laneIds.has(p.id)
  }
  const bandIndexOf = new Map<string, number>()
  for (const n of prep.visible) {
    if (poolIds.has(n.id) || laneIds.has(n.id) || attachedTo.has(n.id) || !isTopLevel(n)) continue
    const parent = n.parentId ? prep.byId.get(n.parentId) : undefined
    let band: number | undefined
    if (parent && laneIds.has(parent.id)) band = bandOfLane.get(parent.id)
    else if (parent && poolIds.has(parent.id)) {
      band = bandOfPool.get(parent.id) ?? bandOfLane.get(lanesOfPool.get(parent.id)![0].id)
    } else {
      const c = centerOf(rects.get(n.id)!)
      for (const pool of pools) {
        const lanes = lanesOfPool.get(pool.id)!
        const lane = lanes.find((l) => containsPoint(rects.get(l.id)!, c))
        if (lane) {
          band = bandOfLane.get(lane.id)
          break
        }
        if (containsPoint(rects.get(pool.id)!, c)) {
          if (lanes.length === 0) band = bandOfPool.get(pool.id)
          else {
            // Inside the pool but outside every lane: nearest lane.
            let best = lanes[0]
            for (const l of lanes) {
              const lr = rects.get(l.id)!
              const br = rects.get(best.id)!
              if (Math.abs(lr.y + lr.height / 2 - c.y) < Math.abs(br.y + br.height / 2 - c.y)) best = l
            }
            band = bandOfLane.get(best.id)
          }
          break
        }
      }
    }
    band = band ?? freeBand
    bandIndexOf.set(n.id, band)
    bands[band].members.push(n)
  }
  const topLevelOf = (id: string): string | undefined => {
    let cur: string | undefined = id
    const seen = new Set<string>()
    while (cur && !seen.has(cur)) {
      seen.add(cur)
      if (bandIndexOf.has(cur)) return cur
      const att = attachedTo.get(cur)
      cur = att ? att.host : prep.byId.get(cur)?.parentId
    }
    return undefined
  }
  const nested = prep.visible.filter(
    (n) => !poolIds.has(n.id) && !laneIds.has(n.id) && !attachedTo.has(n.id) && !isTopLevel(n) && topLevelOf(n.id)
  )

  // One ELK run across all pools: message flows take part in the layering
  // with a low priority, so a pool's steps line up (in x) with the partner
  // steps they exchange messages with. Band-major model order + forced
  // in-layer model order keeps every layer's nodes grouped by band.
  const topLevel = bands.flatMap((b) =>
    [...b.members].sort((a, c) => {
      const ra = rects.get(a.id)!
      const rc = rects.get(c.id)!
      return ra.y - rc.y || ra.x - rc.x
    })
  )
  const layoutNodes = [...topLevel, ...nested]
  const parentOf = new Map<string, string | undefined>()
  for (const n of topLevel) parentOf.set(n.id, undefined)
  for (const n of nested) parentOf.set(n.id, n.parentId)
  const inLayout = new Set(layoutNodes.map((n) => n.id))
  const layoutEdges = prep.nodeEdges
    .filter((e) => inLayout.has(e.source) && inLayout.has(e.target))
    .map((edge) => ({
      edge,
      role:
        edge.type === "BPMNMessageFlow"
          ? { reverse: false, direction: 1, shortness: 1, straightness: 0 }
          : flowEdgeRole(edge, prep.info),
    }))
  const result = await runElkSafe({
    nodes: layoutNodes,
    parentOf,
    edges: layoutEdges,
    layoutOptions: {
      ...layeredOptions("RIGHT", "flow"),
      "elk.separateConnectedComponents": "false",
      "elk.layered.crossingMinimization.forceNodeModelOrder": "true",
      // Model order is band-major here, not flow order: break cycles by
      // edge priorities (sequence flows outrank message flows) instead.
      "elk.layered.cycleBreaking.strategy": "GREEDY",
      "elk.padding": "[top=0,left=0,bottom=0,right=0]",
    },
    withLabels: true,
    nodeOptions: (node) => {
      const c = layerConstraintOf(diagramType, node, prep.info)
      return c ? { "elk.layered.layering.layerConstraint": c } : undefined
    },
  })

  // Band stacking.
  const HEADER = BPMN_POOL_HEADER_WIDTH
  const anyLanes = bands.some((b) => b.laneId)
  const PAD = 30
  const contentLeft = HEADER + (anyLanes ? BPMN_LANE_HEADER_WIDTH : 0) + PAD
  let minX = Infinity
  for (const n of topLevel) minX = Math.min(minX, result.rects.get(n.id)?.x ?? Infinity)
  if (!Number.isFinite(minX)) minX = 0
  const absolute = new Map<string, LayoutRect>()
  const bandTop: number[] = []
  const bandHeight: number[] = []
  let cursor = 0
  let contentRight = contentLeft + 200
  const POOL_GAP = 50
  bands.forEach((band, i) => {
    if (i > 0 && (band.poolId !== bands[i - 1].poolId || i === freeBand)) cursor += POOL_GAP
    const members = band.members
      .map((n) => {
        const r = result.rects.get(n.id)
        return r ? { id: n.id, x: r.x, y: r.y, width: r.width, height: r.height } : undefined
      })
      .filter((m): m is NonNullable<typeof m> => !!m)
    const { centre, height } = compactBand(members, PAD, 30)
    const minHeight = band.laneId || band.poolId ? BPMN_LANE_MIN_HEIGHT : 0
    const h = members.length === 0 ? minHeight : Math.max(minHeight, Math.ceil(height))
    bandTop.push(cursor)
    bandHeight.push(h)
    for (const m of members) {
      const x = m.x - minX + contentLeft
      const y = cursor + centre.get(m.id)! - m.height / 2
      absolute.set(m.id, { x, y, width: m.width, height: m.height })
      contentRight = Math.max(contentRight, x + m.width)
      // Children of a subprocess follow it.
      const dx = x - m.x
      const dy = y - m.y
      for (const c of nested) {
        if (topLevelOf(c.id) !== m.id) continue
        const r = result.rects.get(c.id)
        if (r) absolute.set(c.id, { ...r, x: r.x + dx, y: r.y + dy })
      }
    }
    cursor += h
  })
  const poolWidth = Math.ceil(contentRight + PAD)
  const resized = new Set<string>()
  for (const pool of pools) {
    const lanes = lanesOfPool.get(pool.id)!
    const idx = lanes.length ? lanes.map((l) => bandOfLane.get(l.id)!) : [bandOfPool.get(pool.id)!]
    const top = bandTop[idx[0]]
    const bottom = bandTop[idx[idx.length - 1]] + bandHeight[idx[idx.length - 1]]
    absolute.set(pool.id, { x: 0, y: top, width: poolWidth, height: bottom - top })
    resized.add(pool.id)
    for (const lane of lanes) {
      const b = bandOfLane.get(lane.id)!
      absolute.set(lane.id, { x: HEADER, y: bandTop[b], width: poolWidth - HEADER, height: bandHeight[b] })
      resized.add(lane.id)
    }
  }
  // Pool-less nodes start at the content column too (already), subprocesses were sized by ELK.
  for (const n of nested) if (n.parentId) resized.add(n.parentId)
  for (const [id, att] of attachedTo) {
    const host = absolute.get(att.host)
    const own = rects.get(id)!
    if (host) absolute.set(id, { x: host.x + att.dx, y: host.y + att.dy, width: own.width, height: own.height })
  }
  const applied = applyRects(nodes, absolute, resized)
  const typeOf = (id: string) => prep.byId.get(id)?.type

  // Every edge is re-routed around the final geometry.
  const routed: RoutedEdge[] = []
  for (const edge of prep.nodeEdges) {
    const sRect = applied.rects.get(edge.source)
    const tRect = applied.rects.get(edge.target)
    if (!sRect || !tRect || edge.source === edge.target) continue
    const sc = centerOf(sRect)
    const tc = centerOf(tRect)
    let sides: { sourceSide: HandleSide; targetSide: HandleSide }
    if (edge.type === "BPMNMessageFlow") {
      sides = tc.y >= sc.y ? { sourceSide: "bottom", targetSide: "top" } : { sourceSide: "top", targetSide: "bottom" }
    } else if (edge.type === "BPMNSequenceFlow" && tRect.x >= sRect.x + sRect.width - 1) {
      // Forward flow: leave right / enter left; a gateway or event (single
      // centre handle per side) branches out of its top/bottom instead.
      const dy = tc.y - sc.y
      const sourceCentreOnly = getSideHandles(typeOf(edge.source), "right").length === 1
      const targetCentreOnly = getSideHandles(typeOf(edge.target), "left").length === 1
      sides = {
        sourceSide:
          sourceCentreOnly && Math.abs(dy) > sRect.height / 2 ? (dy > 0 ? "bottom" : "top") : "right",
        targetSide:
          targetCentreOnly && Math.abs(dy) > tRect.height / 2 && !(sourceCentreOnly && Math.abs(dy) > sRect.height / 2)
            ? dy > 0
              ? "top"
              : "bottom"
            : "left",
      }
    } else {
      sides = chooseFacingSidesForRects(sRect, tRect)
    }
    routed.push({ edge, ...sides })
  }
  return {
    nodes: applied.nodes,
    edges: finaliseEdges(edges, routed, applied.rects, typeOf, leafObstacles(applied.nodes, applied.rects)),
  }
}

// ---------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------

/** Shifts root nodes and stored waypoints so the layout's bbox centre is `target`. */
const recenter = (
  original: Node[],
  layouted: { nodes: Node[]; edges: Edge[] },
  touchedEdges: Set<string>
): { nodes: Node[]; edges: Edge[] } => {
  const bboxCentre = (list: Node[]) => {
    const byId = new Map(list.map((n) => [n.id, n]))
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const n of list) {
      if (n.parentId && byId.has(n.parentId)) continue
      if (NON_VISUAL_NODE_TYPES.has(n.type ?? "")) continue
      const { width, height } = nodeSize(n)
      minX = Math.min(minX, n.position.x)
      minY = Math.min(minY, n.position.y)
      maxX = Math.max(maxX, n.position.x + width)
      maxY = Math.max(maxY, n.position.y + height)
    }
    return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 }
  }
  const before = bboxCentre(original)
  const after = bboxCentre(layouted.nodes)
  if (![before.x, before.y, after.x, after.y].every(Number.isFinite)) return layouted
  const dx = Math.round(before.x - after.x)
  const dy = Math.round(before.y - after.y)
  if (dx === 0 && dy === 0) return layouted
  const ids = new Set(layouted.nodes.map((n) => n.id))
  return {
    nodes: layouted.nodes.map((n) =>
      (n.parentId && ids.has(n.parentId)) || NON_VISUAL_NODE_TYPES.has(n.type ?? "")
        ? n
        : { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } }
    ),
    edges: layouted.edges.map((e) => {
      if (!touchedEdges.has(e.id)) return e
      const data = (e.data ?? {}) as Record<string, unknown>
      const pts = data.points as LayoutPoint[] | undefined
      if (!Array.isArray(pts) || pts.length === 0) return e
      return { ...e, data: { ...data, points: pts.map((p) => ({ x: p.x + dx, y: p.y + dy })) } }
    }),
  }
}

/**
 * Computes a new layout for the diagram. Node positions (and container
 * sizes) are replaced; node-to-node edges get new handles and — for edge
 * types that draw stored waypoints — ELK's orthogonal route as
 * `data.points`. Edge-anchored / dangling edges and data-only nodes are left
 * untouched. The result is centred on the diagram's previous centre.
 * Returns NEW nodes and edges arrays; all other data is preserved.
 */
export const computeAutoLayout = async (
  nodes: Node[],
  edges: Edge[],
  diagramType: string,
  options: AutoLayoutOptions = {}
): Promise<{ nodes: Node[]; edges: Edge[] }> => {
  if (nodes.length === 0) return { nodes, edges }
  const family = familyOf(diagramType)
  const strategies = getAutoLayoutStrategies(diagramType)
  const strategy =
    options.strategy && strategies.includes(options.strategy) ? options.strategy : strategies[0]
  const hasContainers = nodes.some((n) => n.parentId && nodes.some((p) => p.id === n.parentId))

  let result: { nodes: Node[]; edges: Edge[] }
  if (family === "bpmn") {
    result = await bpmnPipeline(nodes, edges, diagramType)
  } else if (family === "tree") {
    result = await treePipeline(nodes, edges, diagramType)
  } else if (strategy === "compact" && !hasContainers) {
    result = await compactPipeline(nodes, edges)
  } else {
    const direction =
      strategy === "horizontal" ? "RIGHT" : strategy === "vertical" ? "DOWN" : getLayoutDirection(diagramType)
    result = await layeredPipeline(nodes, edges, diagramType, family, direction)
  }
  const touched = new Set(
    result.edges.filter((e, i) => e !== edges[i]).map((e) => e.id)
  )
  return recenter(nodes, result, touched)
}

/**
 * Lays out a v4 `UMLModel` and returns a NEW model. Pure and fully awaitable
 * — no editor instance, no React Flow, no DOM — so it can run under node /
 * jsdom for headless uses such as the server's SVG export route. Runs the
 * same `computeAutoLayout` the in-canvas button uses; the result is centred
 * on the model's current bounding-box centre, and node-to-node edges get
 * fresh routes (stale waypoints are replaced or dropped).
 */
export const layoutModel = async (
  model: UMLModel,
  options: AutoLayoutOptions = {}
): Promise<UMLModel> => {
  const nodes = (model.nodes ?? []) as unknown as Node[]
  const edges = (model.edges ?? []) as unknown as Edge[]
  if (nodes.length === 0) return model
  const layouted = await computeAutoLayout(nodes, edges, model.type, options)
  if (layouted.nodes === nodes) return model
  return {
    ...model,
    nodes: layouted.nodes as unknown as BesserNode[],
    edges: layouted.edges as unknown as BesserEdge[],
  }
}
