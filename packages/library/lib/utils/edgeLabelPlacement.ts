/**
 * Placement of the role / multiplicity labels at the two ends of each edge.
 *
 * Per end the role and the multiplicity sit on opposite sides of the line,
 * just past the end marker. Candidates (which label goes on which side, and
 * a few offsets along the line) are scored against nodes, the labels placed
 * so far and edge lines; the cheapest one wins (greedy, deterministic).
 */
import type { LayoutPoint, LayoutRect } from "./autoLayoutHandles"
import { GridIndex } from "./orthogonalRouter"

export type LabelAnchor = "start" | "middle" | "end"

export interface LabelPos {
  x: number
  /** Text baseline. */
  y: number
  anchor: LabelAnchor
}

export interface EndLabelLayout {
  role?: LabelPos
  multiplicity?: LabelPos
}

export interface EdgeLabelLayout {
  source: EndLabelLayout
  target: EndLabelLayout
}

export interface EdgeLabelInput {
  id: string
  points: LayoutPoint[]
  sourceRole?: string
  sourceMultiplicity?: string
  targetRole?: string
  targetMultiplicity?: string
  /** How far each end marker reaches back along the line. */
  sourceMarkerLength?: number
  targetMarkerLength?: number
}

/** 16px labels: ascent / descent around the baseline. */
const ASCENT = 13
const DESCENT = 4
/** Gap between a label and the line it labels. */
const LINE_GAP = 5

interface Box {
  x0: number
  y0: number
  x1: number
  y1: number
}

const boxOf = (pos: LabelPos, width: number): Box => {
  const x0 = pos.anchor === "start" ? pos.x : pos.anchor === "end" ? pos.x - width : pos.x - width / 2
  return { x0, y0: pos.y - ASCENT, x1: x0 + width, y1: pos.y + DESCENT }
}

const overlapArea = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) *
  Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0))

const segmentHitsBox = (a: LayoutPoint, b: LayoutPoint, box: Box) =>
  Math.max(a.x, b.x) > box.x0 &&
  Math.min(a.x, b.x) < box.x1 &&
  Math.max(a.y, b.y) > box.y0 &&
  Math.min(a.y, b.y) < box.y1

/** Rough width of 16px UI text when nothing better is available. */
export const estimateLabelWidth = (text: string) => Math.ceil(text.length * 8.4) + 2

interface EndInput {
  port: LayoutPoint
  /** Unit direction from the port along the first segment. */
  dir: LayoutPoint
  segLength: number
  markerLength: number
  role?: string
  multiplicity?: string
}

const endInput = (
  points: LayoutPoint[],
  atSource: boolean,
  markerLength: number,
  role?: string,
  multiplicity?: string
): EndInput | undefined => {
  if (points.length < 2 || (!role && !multiplicity)) return undefined
  const port = atSource ? points[0] : points[points.length - 1]
  const next = atSource ? points[1] : points[points.length - 2]
  const dx = next.x - port.x
  const dy = next.y - port.y
  const len = Math.hypot(dx, dy)
  if (len === 0) return undefined
  // Snap to the dominant axis: routes are orthogonal.
  const dir = Math.abs(dx) >= Math.abs(dy) ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) }
  return { port, dir, segLength: len, markerLength, role, multiplicity }
}

/**
 * Extra cost of flipping an end's labels to the other side of the line, or of
 * moving them along it, relative to the previous placement (hysteresis).
 */
const KEEP_SIDE = 40
const KEEP_STEP = 10
const STEPS = [0, 14, 30, 48]

/**
 * Side (`swap`) and step an end's labels had in a previous placement, if the
 * end still leaves its node the same way.
 */
const previousChoice = (
  prev: { points: LayoutPoint[]; labels: EdgeLabelLayout } | undefined,
  atSource: boolean,
  end: EndInput
): { swap: boolean; step: number } | undefined => {
  if (!prev) return undefined
  const was = endInput(prev.points, atSource, end.markerLength, end.role, end.multiplicity)
  if (!was || was.dir.x !== end.dir.x || was.dir.y !== end.dir.y) return undefined
  const labels = atSource ? prev.labels.source : prev.labels.target
  const label = labels.role ?? labels.multiplicity
  if (!label) return undefined
  const horizontal = end.dir.y === 0
  // Side A is above (horizontal line) / left (vertical line); the role takes A unless swapped.
  const onA = horizontal ? label.y < was.port.y : label.x < was.port.x
  const swap = labels.role ? !onA : onA
  const along = horizontal ? (label.x - was.port.x) * end.dir.x : (label.y - was.port.y) * end.dir.y
  const offset = horizontal ? along : along - (end.dir.y > 0 ? ASCENT : DESCENT)
  const stepGuess = offset - (end.markerLength + 6)
  let step = STEPS[0]
  for (const s of STEPS) if (Math.abs(s - stepGuess) < Math.abs(step - stepGuess)) step = s
  return { swap, step }
}

/** The two label positions of one candidate (side A / side B of the line). */
const candidatePositions = (end: EndInput, offset: number): [LabelPos, LabelPos] => {
  const { port, dir } = end
  if (dir.y === 0) {
    const anchor: LabelAnchor = dir.x > 0 ? "start" : "end"
    const x = port.x + dir.x * offset
    return [
      { x, y: port.y - LINE_GAP - DESCENT, anchor },
      { x, y: port.y + LINE_GAP + ASCENT, anchor },
    ]
  }
  const y = dir.y > 0 ? port.y + offset + ASCENT : port.y - offset - DESCENT
  return [
    { x: port.x - LINE_GAP - 1, y, anchor: "end" },
    { x: port.x + LINE_GAP + 1, y, anchor: "start" },
  ]
}

/**
 * Places the end labels of every edge. `nodes` are all node rects; `measure`
 * returns a label's rendered width. With `previous` (the last placement, e.g.
 * the frame before during a drag) an end keeps its labels' side and offset
 * unless the other choice is clearly better, so labels do not flicker.
 */
export const placeEdgeLabels = (
  edges: EdgeLabelInput[],
  nodes: LayoutRect[],
  measure: (text: string) => number = estimateLabelWidth,
  previous?: ReadonlyMap<string, { points: LayoutPoint[]; labels: EdgeLabelLayout }>
): Map<string, EdgeLabelLayout> => {
  // Spatial indexes: a candidate box is scored against what is near it only.
  const placed: Box[] = []
  const placedIndex = new GridIndex(64)
  const nodeBoxes: Box[] = nodes.map((r) => ({ x0: r.x, y0: r.y, x1: r.x + r.width, y1: r.y + r.height }))
  const nodeIndex = new GridIndex(128)
  nodeBoxes.forEach((b, i) => nodeIndex.insert(i, b.x0, b.y0, b.x1, b.y1))
  const segments: [LayoutPoint, LayoutPoint, string][] = []
  const segmentIndex = new GridIndex(64)
  for (const e of edges) {
    for (let i = 0; i + 1 < e.points.length; i++) {
      const [p, q] = [e.points[i], e.points[i + 1]]
      segmentIndex.insert(segments.length, p.x, p.y, q.x, q.y)
      segments.push([p, q, e.id])
    }
  }
  const out = new Map<string, EdgeLabelLayout>()
  const ordered = [...edges].sort((a, b) => a.id.localeCompare(b.id))
  for (const e of ordered) {
    const layout: EdgeLabelLayout = { source: {}, target: {} }
    for (const atSource of [true, false]) {
      const end = endInput(
        e.points,
        atSource,
        (atSource ? e.sourceMarkerLength : e.targetMarkerLength) ?? 0,
        atSource ? e.sourceRole : e.targetRole,
        atSource ? e.sourceMultiplicity : e.targetMultiplicity
      )
      if (!end) continue
      const roleW = end.role ? measure(end.role) : 0
      const multW = end.multiplicity ? measure(end.multiplicity) : 0
      const base = end.markerLength + 6
      let best: { cost: number; role?: LabelPos; mult?: LabelPos; boxes: Box[] } | undefined
      const prev = previousChoice(previous?.get(e.id), atSource, end)
      for (const step of STEPS) {
        const offset = base + step
        const [a, b] = candidatePositions(end, offset)
        for (const swap of [false, true]) {
          const rolePos = end.role ? (swap ? b : a) : undefined
          const multPos = end.multiplicity ? (swap ? a : b) : undefined
          const boxes: Box[] = []
          if (rolePos) boxes.push(boxOf(rolePos, roleW))
          if (multPos) boxes.push(boxOf(multPos, multW))
          let cost = step * 0.6 + (swap ? 3 : 0)
          if (prev) cost += (swap !== prev.swap ? KEEP_SIDE : 0) + (step !== prev.step ? KEEP_STEP : 0)
          // Labels should sit beside their own end segment, not past its corner.
          if (offset + (end.dir.y === 0 ? Math.max(roleW, multW) * 0.5 : ASCENT) > end.segLength) cost += 25
          for (const box of boxes) {
            for (const i of nodeIndex.query(box.x0, box.y0, box.x1, box.y1)) cost += overlapArea(box, nodeBoxes[i]) * 4
            for (const i of placedIndex.query(box.x0, box.y0, box.x1, box.y1)) {
              const pb = placed[i]
              cost += overlapArea(box, pb) * 8 + (overlapArea(box, pb) > 0 ? 200 : 0)
            }
            for (const i of segmentIndex.query(box.x0, box.y0, box.x1, box.y1)) {
              const [p, q, id] = segments[i]
              if (segmentHitsBox(p, q, box)) cost += id === e.id ? 60 : 90
            }
          }
          if (!best || cost < best.cost) best = { cost, role: rolePos, mult: multPos, boxes }
        }
        if (!prev && best && best.cost < 1 + step * 0.6) break
      }
      if (best) {
        for (const b of best.boxes) {
          placedIndex.insert(placed.length, b.x0, b.y0, b.x1, b.y1)
          placed.push(b)
        }
        const target = atSource ? layout.source : layout.target
        if (best.role) target.role = best.role
        if (best.mult) target.multiplicity = best.mult
      }
    }
    out.set(e.id, layout)
  }
  return out
}
