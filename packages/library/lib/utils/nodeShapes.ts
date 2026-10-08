/**
 * Node outlines as continuous ports see them: the box inside a node's
 * bounding box that edges attach to, and the shape drawn in that box.
 *
 * Ports (`edgePorts`) are computed on the box's sides; `outlinePoint` then
 * moves an end from the box side onto the real outline along the side's
 * normal, so an orthogonal route stays orthogonal up to the shape.
 *
 * Pure and DOM-free. Mirrors what each node component draws (the node
 * files are the reference: keep both in sync when a shape changes).
 */
import type { LayoutPoint, LayoutRect } from "./autoLayoutHandles"

export type OutlineKind = "rect" | "roundRect" | "circle" | "diamond"
type Side = "top" | "right" | "bottom" | "left"

export interface NodeShape {
  kind: OutlineKind
  /** Corner radius of a `roundRect`. */
  radius?: number
  /** Attachment box relative to the node's top-left; default: the whole node. */
  box?: (width: number, height: number) => LayoutRect
}

const RECT: NodeShape = { kind: "rect" }

/** Centred square of side min(w, h) (circles and diamonds drawn that way). */
const centredSquare = (w: number, h: number): LayoutRect => {
  const s = Math.min(w, h)
  return { x: (w - s) / 2, y: (h - s) / 2, width: s, height: s }
}

const CIRCLE: NodeShape = { kind: "circle", box: centredSquare }
const roundRect = (radius: number): NodeShape => ({ kind: "roundRect", radius })

/**
 * NN layer card (`_NNLayerBase`): with an icon, edges attach to the icon
 * square above the name; without one (too small / no icon) to the card.
 */
const NN_ICON_CARD: NodeShape = {
  kind: "roundRect",
  radius: 6,
  box: (w, h) => {
    const size = Math.min(70, w - 12, Math.max(0, h - 22 - 12))
    return size >= 24 ? { x: (w - size) / 2, y: 6, width: size, height: size } : { x: 0, y: 0, width: w, height: h }
  },
}

const SHAPES: Record<string, NodeShape> = {
  // State machine
  State: roundRect(8),
  StateInitialNode: CIRCLE,
  StateFinalNode: {
    kind: "circle",
    // Outer ring is drawn at 90 % of the half size.
    box: (w, h) => {
      const s = Math.min(w, h) * 0.9
      return { x: (w - s) / 2, y: (h - s) / 2, width: s, height: s }
    },
  },
  StateMergeNode: { kind: "diamond" },
  // Agent (AgentNodeCard)
  AgentState: roundRect(14),
  AgentIntent: roundRect(14),
  AgentRagElement: roundRect(14),
  AgentTool: roundRect(14),
  AgentSkill: roundRect(14),
  AgentWorkspace: roundRect(14),
  // BPMN
  bpmnTask: roundRect(10),
  bpmnSubprocess: roundRect(10),
  bpmnTransaction: roundRect(10),
  bpmnCallActivity: roundRect(10),
  bpmnStartEvent: CIRCLE,
  bpmnIntermediateEvent: CIRCLE,
  bpmnEndEvent: CIRCLE,
  bpmnGateway: { kind: "diamond", box: centredSquare },
  // NN: container body sits below its 24 px name tab.
  NNContainer: { kind: "rect", box: (w, h) => ({ x: 0, y: Math.min(24, h), width: w, height: Math.max(0, h - 24) }) },
  NNReference: roundRect(4),
  Conv1DLayer: NN_ICON_CARD,
  Conv2DLayer: NN_ICON_CARD,
  Conv3DLayer: NN_ICON_CARD,
  PoolingLayer: NN_ICON_CARD,
  RNNLayer: NN_ICON_CARD,
  LSTMLayer: NN_ICON_CARD,
  GRULayer: NN_ICON_CARD,
  LinearLayer: NN_ICON_CARD,
  FlattenLayer: NN_ICON_CARD,
  EmbeddingLayer: NN_ICON_CARD,
  DropoutLayer: NN_ICON_CARD,
  LayerNormalizationLayer: NN_ICON_CARD,
  BatchNormalizationLayer: NN_ICON_CARD,
  TensorOp: NN_ICON_CARD,
  Configuration: NN_ICON_CARD,
  TrainingDataset: NN_ICON_CARD,
  TestDataset: NN_ICON_CARD,
}

export const nodeShapeOf = (type: string | undefined): NodeShape => (type && SHAPES[type]) || RECT

/** Whether ports of this type use the node's full bounding box as a plain rect. */
export const isPlainRect = (shape: NodeShape) => shape.kind === "rect" && !shape.box

/**
 * Member rows drawn inside their parent (React Flow children): they are
 * not connection ends, so they get no port band (it would cover the
 * parent's outline).
 */
export const NO_PORT_NODE_TYPES: ReadonlySet<string> = new Set([
  "StateBody",
  "StateFallbackBody",
  "UserModelAttribute",
  "UserModelIcon",
])

/**
 * Containers edges run through rather than around (a flow between two lanes
 * crosses the lane between them).
 */
export const ROUTE_TRANSPARENT_NODE_TYPES: ReadonlySet<string> = new Set([
  "bpmnPool",
  "bpmnSwimlane",
  "bpmnGroup",
])

/** Absolute attachment box of a node whose bounding box is `rect`. */
export const attachmentRect = (shape: NodeShape, rect: LayoutRect): LayoutRect => {
  if (!shape.box) return rect
  const b = shape.box(rect.width, rect.height)
  return { x: rect.x + b.x, y: rect.y + b.y, width: b.width, height: b.height }
}

const isVertical = (side: Side) => side === "left" || side === "right"

/**
 * How far inside the box side the outline lies at `offset` from the side's
 * start (offset along the side, 0..len). 0 for a plain rect.
 */
const depthAt = (shape: NodeShape, box: LayoutRect, side: Side, offset: number): number => {
  const len = isVertical(side) ? box.height : box.width
  const across = isVertical(side) ? box.width : box.height
  const d = Math.min(Math.max(offset, 0), len)
  switch (shape.kind) {
    case "circle": {
      // Ellipse inscribed in the box (a circle for the square boxes above).
      const u = len > 0 ? (d - len / 2) / (len / 2) : 0
      return (across / 2) * (1 - Math.sqrt(Math.max(0, 1 - u * u)))
    }
    case "diamond": {
      const u = len > 0 ? Math.abs(d - len / 2) / (len / 2) : 0
      return (across / 2) * Math.min(1, u)
    }
    case "roundRect": {
      const r = Math.min(shape.radius ?? 0, len / 2, across / 2)
      const e = Math.min(d, len - d)
      if (e >= r) return 0
      return r - Math.sqrt(Math.max(0, r * r - (r - e) * (r - e)))
    }
    default:
      return 0
  }
}

/** Point on the outline for a port at axis coordinate `c` on `side` of the box. */
export const outlinePoint = (shape: NodeShape, box: LayoutRect, side: Side, c: number): LayoutPoint => {
  const start = isVertical(side) ? box.y : box.x
  const depth = depthAt(shape, box, side, c - start)
  switch (side) {
    case "top":
      return { x: c, y: box.y + depth }
    case "bottom":
      return { x: c, y: box.y + box.height - depth }
    case "left":
      return { x: box.x + depth, y: c }
    default:
      return { x: box.x + box.width - depth, y: c }
  }
}

/**
 * Port (side + ratio along the box side) of the outline point nearest to
 * `p`, such that `outlinePoint` of it lands on that outline point.
 */
export const nearestOutlinePort = (
  shape: NodeShape,
  box: LayoutRect,
  p: LayoutPoint
): { side: Side; t: number } => {
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  const ratio = (side: Side, c: number) => {
    const [a, len] = isVertical(side) ? [box.y, box.height] : [box.x, box.width]
    return len > 0 ? Math.min(1, Math.max(0, (c - a) / len)) : 0.5
  }
  if (shape.kind === "circle" || shape.kind === "diamond") {
    const dx = p.x - cx
    const dy = p.y - cy
    const rx = box.width / 2 || 1
    const ry = box.height / 2 || 1
    // The side whose normal is closest to the direction of p.
    const side: Side =
      Math.abs(dx) / rx >= Math.abs(dy) / ry ? (dx >= 0 ? "right" : "left") : dy >= 0 ? "bottom" : "top"
    let q: LayoutPoint
    if (shape.kind === "circle") {
      const a = Math.atan2(dy / ry, dx / rx)
      q = { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) }
    } else {
      // Project onto the diamond edge of p's quadrant.
      const sx = dx >= 0 ? 1 : -1
      const sy = dy >= 0 ? 1 : -1
      const ax = { x: cx + sx * rx, y: cy }
      const ay = { x: cx, y: cy + sy * ry }
      const vx = ay.x - ax.x
      const vy = ay.y - ax.y
      const t = Math.min(1, Math.max(0, ((p.x - ax.x) * vx + (p.y - ax.y) * vy) / (vx * vx + vy * vy || 1)))
      q = { x: ax.x + vx * t, y: ax.y + vy * t }
    }
    return { side, t: ratio(side, isVertical(side) ? q.y : q.x) }
  }
  // Rects (rounded corners are within the side ranges): nearest box side.
  const inside = p.x >= box.x && p.x <= box.x + box.width && p.y >= box.y && p.y <= box.y + box.height
  const dist: Record<Side, number> = inside
    ? { top: p.y - box.y, bottom: box.y + box.height - p.y, left: p.x - box.x, right: box.x + box.width - p.x }
    : {
        top: p.y < box.y ? box.y - p.y : Infinity,
        bottom: p.y > box.y + box.height ? p.y - box.y - box.height : Infinity,
        left: p.x < box.x ? box.x - p.x : Infinity,
        right: p.x > box.x + box.width ? p.x - box.x - box.width : Infinity,
      }
  let side: Side = "top"
  for (const s of ["top", "right", "bottom", "left"] as Side[]) if (dist[s] < dist[side]) side = s
  return { side, t: ratio(side, isVertical(side) ? p.y : p.x) }
}

/** SVG path of the outline (box-relative to `origin`), for hit bands / highlights. */
export const outlinePath = (shape: NodeShape, box: LayoutRect, origin: LayoutPoint = { x: 0, y: 0 }): string => {
  const x = box.x - origin.x
  const y = box.y - origin.y
  const w = box.width
  const h = box.height
  switch (shape.kind) {
    case "circle": {
      const rx = w / 2
      const ry = h / 2
      return `M ${x} ${y + ry} A ${rx} ${ry} 0 1 0 ${x + w} ${y + ry} A ${rx} ${ry} 0 1 0 ${x} ${y + ry} Z`
    }
    case "diamond":
      return `M ${x + w / 2} ${y} L ${x + w} ${y + h / 2} L ${x + w / 2} ${y + h} L ${x} ${y + h / 2} Z`
    case "roundRect": {
      const r = Math.min(shape.radius ?? 0, w / 2, h / 2)
      return (
        `M ${x + r} ${y} H ${x + w - r} A ${r} ${r} 0 0 1 ${x + w} ${y + r} V ${y + h - r} ` +
        `A ${r} ${r} 0 0 1 ${x + w - r} ${y + h} H ${x + r} A ${r} ${r} 0 0 1 ${x} ${y + h - r} ` +
        `V ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y} Z`
      )
    }
    default:
      return `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`
  }
}

/** Outline point of a port given as side + ratio along the box side. */
export const portOutlinePoint = (
  shape: NodeShape,
  box: LayoutRect,
  port: { side: Side; t: number }
): LayoutPoint => {
  const [a, len] = isVertical(port.side) ? [box.y, box.height] : [box.x, box.width]
  return outlinePoint(shape, box, port.side, a + len * port.t)
}

/** Distance from `p` to the outline (0 on it). */
export const distanceToOutline = (shape: NodeShape, box: LayoutRect, p: LayoutPoint): number => {
  const q = portOutlinePoint(shape, box, nearestOutlinePort(shape, box, p))
  return Math.hypot(p.x - q.x, p.y - q.y)
}

/** Ports geometry of a node: its shape and absolute attachment box. */
export const portFrame = (type: string | undefined, rect: LayoutRect) => {
  const shape = nodeShapeOf(type)
  return { shape, box: attachmentRect(shape, rect) }
}

/** Usable fraction of a side kept free of auto ends at each end. */
export const cornerFraction = (shape: NodeShape): number =>
  shape.kind === "diamond" ? 0.3 : shape.kind === "circle" ? 0.22 : 0.2
