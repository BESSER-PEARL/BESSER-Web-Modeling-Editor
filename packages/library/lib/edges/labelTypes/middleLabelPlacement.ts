/**
 * Where the middle label of an orthogonal edge goes: on a segment long
 * enough to hold it, clear of nodes and of container borders (pools,
 * packages). Candidates sit at a few points along every segment — above /
 * below a horizontal one, beside / on a vertical one; the cheapest wins.
 */
import type { IPoint } from "../Connection"

export interface LabelRect {
  x: number
  y: number
  width: number
  height: number
}

export interface MiddleLabelPlacement {
  x: number
  y: number
  textAnchor: "start" | "middle" | "end"
  dominantBaseline: "auto" | "middle"
}

/** 12px bold UI text: average advance per character, and line box. */
const CHAR_WIDTH = 7
const ASCENT = 10
const DESCENT = 3
const HEIGHT = ASCENT + DESCENT
/** Gap between the label and its line. */
export const LABEL_GAP = 10
/** Positions along a segment, preferred first. */
const FRACTIONS = [0.5, 0.35, 0.65]

export const estimateMiddleLabelWidth = (text: string) => text.length * CHAR_WIDTH

const overlapArea = (a: LabelRect, b: LabelRect) =>
  Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y))

const contains = (r: LabelRect, p: IPoint) =>
  p.x > r.x && p.x < r.x + r.width && p.y > r.y && p.y < r.y + r.height

interface Candidate {
  box: LabelRect
  placement: MiddleLabelPlacement
  cost: number
}

const candidatesAt = (p: IPoint, horizontal: boolean, w: number): Candidate[] =>
  horizontal
    ? [
        {
          cost: 0,
          box: { x: p.x - w / 2, y: p.y - LABEL_GAP - ASCENT, width: w, height: HEIGHT },
          placement: { x: p.x, y: p.y - LABEL_GAP, textAnchor: "middle", dominantBaseline: "auto" },
        },
        {
          cost: 1,
          box: { x: p.x - w / 2, y: p.y + LABEL_GAP - DESCENT, width: w, height: HEIGHT },
          placement: { x: p.x, y: p.y + LABEL_GAP + ASCENT - DESCENT, textAnchor: "middle", dominantBaseline: "auto" },
        },
      ]
    : [
        // Left of the line (develop parity; the edge toolbar opens to the right).
        {
          cost: 0,
          box: { x: p.x - LABEL_GAP - w, y: p.y - HEIGHT / 2, width: w, height: HEIGHT },
          placement: { x: p.x - LABEL_GAP, y: p.y, textAnchor: "end", dominantBaseline: "middle" },
        },
        // On the line: the label's halo interrupts the stroke.
        {
          cost: 1,
          box: { x: p.x - w / 2, y: p.y - HEIGHT / 2, width: w, height: HEIGHT },
          placement: { x: p.x, y: p.y, textAnchor: "middle", dominantBaseline: "middle" },
        },
        {
          cost: 2,
          box: { x: p.x + LABEL_GAP, y: p.y - HEIGHT / 2, width: w, height: HEIGHT },
          placement: { x: p.x + LABEL_GAP, y: p.y, textAnchor: "start", dominantBaseline: "middle" },
        },
      ]

export const placeMiddleLabel = (
  points: IPoint[],
  labelWidth: number,
  obstacles: readonly LabelRect[] = []
): MiddleLabelPlacement | null => {
  let best: Candidate | null = null
  const last = points.length - 2
  for (let i = 0; i <= last; i++) {
    const a = points[i]
    const b = points[i + 1]
    const length = Math.hypot(b.x - a.x, b.y - a.y)
    if (length < 1) continue
    const horizontal = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y)
    const along = horizontal ? labelWidth : HEIGHT
    const segmentCost =
      Math.max(0, along - length) * 5 + (i === 0 || i === last ? 20 : 0) - length * 0.01
    FRACTIONS.forEach((f, k) => {
      const p = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }
      for (const c of candidatesAt(p, horizontal, labelWidth)) {
        const area = c.box.width * c.box.height
        let blocked = 0
        for (const r of obstacles) {
          const overlap = overlapArea(c.box, r)
          // A node the line runs through is its container (pool, package,
          // …): stay off its border rather than out of it.
          blocked += contains(r, p) ? Math.min(overlap, area - overlap) / 2 : overlap
        }
        const cost = blocked * 100 + segmentCost + c.cost + k * 3
        if (!best || cost < best.cost) best = { ...c, cost }
      }
    })
  }
  return best ? (best as Candidate).placement : null
}
