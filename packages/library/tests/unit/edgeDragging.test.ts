import { describe, expect, it } from "vitest"
import type { Edge } from "@xyflow/react"
import { dragSegment, segmentHandles, trimRouteEnds } from "../../lib/utils/edgeDragging"
import { withReconnectableFlags } from "../../lib/App"

type P = { x: number; y: number }
const diagonal = (pts: P[]) =>
  pts.slice(1).filter((p, i) => Math.abs(p.x - pts[i].x) > 0.5 && Math.abs(p.y - pts[i].y) > 0.5).length

// Source on the left (right side at x=100), target on the right (left side at x=400).
const ctx = {
  sourceRect: { x: 0, y: 0, width: 100, height: 200 },
  targetRect: { x: 400, y: 100, width: 100, height: 200 },
  sourceSide: "right" as const,
  targetSide: "left" as const,
}
const zRoute: P[] = [
  { x: 100, y: 50 },
  { x: 250, y: 50 },
  { x: 250, y: 250 },
  { x: 400, y: 250 },
]

describe("segment handles", () => {
  it("offers a grip on every segment long enough to grab, including the first and last", () => {
    const h = segmentHandles(zRoute)
    expect(h.map((s) => s.index)).toEqual([0, 1, 2])
    expect(h[1]).toMatchObject({ x: 250, y: 150, horizontal: false })
  })
})

describe("dragSegment", () => {
  it("moves an inner segment and keeps the route orthogonal", () => {
    const r = dragSegment(zRoute, 1, 300, ctx)
    expect(r.preview[1]).toEqual({ x: 300, y: 50 })
    expect(r.preview[2]).toEqual({ x: 300, y: 250 })
    expect(diagonal(r.storedPoints)).toBe(0)
    expect(r.sourcePort).toBeUndefined()
    expect(r.targetPort).toBeUndefined()
  })

  it("slides the first segment along the source side and pins that end", () => {
    const r = dragSegment(zRoute, 0, 120, ctx)
    expect(r.preview[0]).toEqual({ x: 100, y: 120 })
    expect(r.sourcePort).toEqual({ side: "right", t: 0.6 })
    expect(diagonal(r.preview)).toBe(0)
  })

  it("dragged past the side, leaves the port and adds a detour (new bends) instead", () => {
    const r = dragSegment(zRoute, 0, 300, ctx)
    expect(r.preview[0]).toEqual({ x: 100, y: 50 })
    expect(r.preview[1]).toEqual({ x: 120, y: 50 })
    expect(r.preview[2]).toEqual({ x: 120, y: 300 })
    expect(r.sourcePort).toBeUndefined()
    expect(diagonal(r.storedPoints)).toBe(0)
    expect(r.storedPoints.length).toBeGreaterThan(zRoute.length)
  })

  it("removes bends when a segment is dragged onto its neighbour's line (route goes back to auto)", () => {
    // Moving the last segment up to y=50 (within the snap distance) makes the route straight.
    const r = dragSegment(zRoute, 2, 54, { ...ctx, targetRect: { x: 400, y: 0, width: 100, height: 200 } })
    expect(r.preview[3].y).toBe(50)
    expect(r.storedPoints).toEqual([])
    expect(r.targetPort).toEqual({ side: "left", t: 0.25 })
  })

  it("slides a straight edge within the common span, pinning both ends", () => {
    const straight: P[] = [{ x: 100, y: 150 }, { x: 400, y: 150 }]
    const r = dragSegment(straight, 0, 180, ctx)
    expect(r.preview).toEqual([{ x: 100, y: 180 }, { x: 400, y: 180 }])
    expect(r.sourcePort).toEqual({ side: "right", t: 0.9 })
    expect(r.targetPort).toEqual({ side: "left", t: 0.4 })
  })
})

describe("adding bends to a straight edge", () => {
  it("pulls a U-shaped detour out of a straight edge dragged beyond both nodes", () => {
    const straight: P[] = [{ x: 100, y: 150 }, { x: 400, y: 150 }]
    const r = dragSegment(straight, 0, 360, ctx)
    expect(r.storedPoints).toEqual([
      { x: 100, y: 150 },
      { x: 120, y: 150 },
      { x: 120, y: 360 },
      { x: 380, y: 360 },
      { x: 380, y: 150 },
      { x: 400, y: 150 },
    ])
    expect(r.sourcePort).toBeUndefined()
    expect(r.targetPort).toBeUndefined()
  })
})

describe("interaction stroke", () => {
  it("leaves the last px at each end free for the node's port band", () => {
    const t = trimRouteEnds(zRoute, 10)
    expect(t[0]).toEqual({ x: 110, y: 50 })
    expect(t[3]).toEqual({ x: 390, y: 250 })
    expect(trimRouteEnds([{ x: 0, y: 0 }, { x: 15, y: 0 }], 10)).toEqual([{ x: 0, y: 0 }, { x: 15, y: 0 }])
  })
})

describe("reconnect anchors (hijack fix)", () => {
  const edge = (id: string, type: string, selected = false): Edge => ({ id, source: "a", target: "b", type, selected })

  it("keeps React Flow's reconnect anchors off unselected edges and off edges with their own grips", () => {
    const out = withReconnectableFlags([
      edge("1", "ClassBidirectional"),
      edge("2", "ClassBidirectional", true),
      edge("3", "UseCaseAssociation"),
      edge("4", "UseCaseAssociation", true),
    ])
    expect(out.map((e) => e.reconnectable)).toEqual([false, false, false, true])
  })

  it("returns the same array when nothing changes", () => {
    const edges = withReconnectableFlags([edge("1", "ClassBidirectional")])
    expect(withReconnectableFlags(edges)).toBe(edges)
  })
})
