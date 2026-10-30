/**
 * Edges joining the same two nodes, close nodes, stale stored routes and
 * BPMN side rules (2026-10-08 UX review). Each case records what the review
 * saw before the fix.
 */
import { describe, expect, it } from "vitest"
import type { Edge, Node } from "@xyflow/react"
import { readFileSync } from "fs"
import { resolve } from "path"
import { computePortGeometry, PORT_STUB, type PortEdgeInput, type PortGeometry } from "../../lib/utils/edgePorts"
import { computeFloatingLayout, nodeRects } from "../../lib/utils/floatingEdges"
import { curveEnds, getCurvedPath } from "../../lib/edges/curvedPath"

type P = { x: number; y: number }
type R = { x: number; y: number; width: number; height: number }

const rects = (entries: Record<string, R>) => new Map(Object.entries(entries))

/** Axis-aligned segment strictly crossing the interior of `r` (1px inset). */
const crossesRect = (pts: P[], r: R) => {
  for (let i = 0; i + 1 < pts.length; i++) {
    const [a, b] = [pts[i], pts[i + 1]]
    const [x0, x1, y0, y1] = [r.x + 1, r.x + r.width - 1, r.y + 1, r.y + r.height - 1]
    if (Math.abs(a.y - b.y) < 0.5) {
      if (a.y > y0 && a.y < y1 && Math.max(a.x, b.x) > x0 && Math.min(a.x, b.x) < x1) return true
    } else if (a.x > x0 && a.x < x1 && Math.max(a.y, b.y) > y0 && Math.min(a.y, b.y) < y1) return true
  }
  return false
}

/** Proper crossings between two orthogonal polylines (touching ends excluded). */
const crossings = (p: P[], q: P[]) => {
  let n = 0
  for (let i = 0; i + 1 < p.length; i++) {
    for (let j = 0; j + 1 < q.length; j++) {
      const [a, b, c, d] = [p[i], p[i + 1], q[j], q[j + 1]]
      const h1 = Math.abs(a.y - b.y) < 0.5
      const h2 = Math.abs(c.y - d.y) < 0.5
      if (h1 === h2) continue
      const [hs, he, vs, ve] = h1 ? [a, b, c, d] : [c, d, a, b]
      const x = vs.x
      const y = hs.y
      if (
        x > Math.min(hs.x, he.x) + 0.5 &&
        x < Math.max(hs.x, he.x) - 0.5 &&
        y > Math.min(vs.y, ve.y) + 0.5 &&
        y < Math.max(vs.y, ve.y) - 0.5
      )
        n++
    }
  }
  return n
}

/** Collinear overlap length between two orthogonal polylines. */
const sharedLength = (p: P[], q: P[]) => {
  let len = 0
  for (let i = 0; i + 1 < p.length; i++) {
    for (let j = 0; j + 1 < q.length; j++) {
      const [a, b, c, d] = [p[i], p[i + 1], q[j], q[j + 1]]
      if (Math.abs(a.x - b.x) < 0.5 && Math.abs(c.x - d.x) < 0.5 && Math.abs(a.x - c.x) < 0.5) {
        len += Math.max(0, Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y)) - Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y)))
      } else if (Math.abs(a.y - b.y) < 0.5 && Math.abs(c.y - d.y) < 0.5 && Math.abs(a.y - c.y) < 0.5) {
        len += Math.max(0, Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) - Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x)))
      }
    }
  }
  return len
}

const allPairs = <T,>(xs: T[]) => xs.flatMap((a, i) => xs.slice(i + 1).map((b) => [a, b] as const))

describe("edges joining the same two classes", () => {
  // Before (41b): three associations Class1 → Class2 shared one vertical
  // trunk (lines exactly on top of each other).
  it("gives parallel Z routes their own lanes, nested without crossings", () => {
    const geo = computePortGeometry(
      rects({ a: { x: 0, y: 0, width: 160, height: 70 }, b: { x: 400, y: 150, width: 160, height: 70 } }),
      ["e1", "e2", "e3"].map((id) => ({ id, source: "a", target: "b" }))
    )
    const routes = ["e1", "e2", "e3"].map((id) => geo.get(id)!.points)
    for (const r of routes) expect(r).toHaveLength(4)
    const trunks = routes.map((r) => r[1].x)
    expect(new Set(trunks.map(Math.round)).size).toBe(3)
    for (const [p, q] of allPairs(routes)) {
      expect(crossings(p, q)).toBe(0)
      expect(sharedLength(p, q)).toBe(0)
    }
  })

  it("keeps reciprocal associations (A → B and B → A) apart and uncrossed", () => {
    const geo = computePortGeometry(
      rects({ a: { x: 0, y: 0, width: 160, height: 70 }, b: { x: 400, y: 150, width: 160, height: 70 } }),
      [
        { id: "ab", source: "a", target: "b" },
        { id: "ba", source: "b", target: "a" },
      ]
    )
    const [p, q] = [geo.get("ab")!.points, geo.get("ba")!.points]
    expect(crossings(p, q)).toBe(0)
    expect(sharedLength(p, q)).toBe(0)
  })

  // Before (41c): Class2 moved up beside Class1, the three associations got
  // 4-5 px stair-steps (each side spread its ends on its own).
  it("draws near-aligned parallel associations straight, without stair-step kinks", () => {
    const geo = computePortGeometry(
      rects({ a: { x: 0, y: 0, width: 160, height: 70 }, b: { x: 240, y: 5, width: 160, height: 70 } }),
      ["e1", "e2", "e3"].map((id) => ({ id, source: "a", target: "b" }))
    )
    const routes = ["e1", "e2", "e3"].map((id) => geo.get(id)!.points)
    for (const r of routes) expect(r).toHaveLength(2)
    const ys = routes.map((r) => r[0].y).sort((x, y) => x - y)
    expect(ys[1] - ys[0]).toBeGreaterThanOrEqual(8)
    expect(ys[2] - ys[1]).toBeGreaterThanOrEqual(8)
  })
})

describe("classes placed close together", () => {
  const A = { x: 472, y: 272, width: 161, height: 70 }
  const B = { x: 637, y: 212, width: 161, height: 70 }

  // Before (08c): Class2 snapped 4 px right of Class1 by the alignment guide;
  // the association became a 4 px stub hidden between the two boxes.
  it("switches sides when the facing gap leaves no visible route", () => {
    const g = computePortGeometry(rects({ a: A, b: B }), [{ id: "e", source: "a", target: "b" }]).get("e")!
    const pts = g.points
    // Both ends leave their box visibly (room for a marker), none inside a box.
    expect(Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y)).toBeGreaterThanOrEqual(PORT_STUB)
    const [m, n] = [pts[pts.length - 2], pts[pts.length - 1]]
    expect(Math.hypot(n.x - m.x, n.y - m.y)).toBeGreaterThanOrEqual(PORT_STUB)
    expect(crossesRect(pts, A) || crossesRect(pts, B)).toBe(false)
  })

  it("keeps two associations on the L sides apart and uncrossed", () => {
    const geo = computePortGeometry(rects({ a: A, b: B }), [
      { id: "e1", source: "a", target: "b" },
      { id: "e2", source: "a", target: "b" },
    ])
    const [p, q] = [geo.get("e1")!.points, geo.get("e2")!.points]
    expect(crossings(p, q)).toBe(0)
    expect(sharedLength(p, q)).toBe(0)
  })
})

describe("reciprocal agent transitions (curves)", () => {
  // Before (Library agent Idle ↔ Contact, Gym Idle ↔ TrainingPlan): the two
  // curves pinched together into an X in the middle and both labels sat on
  // the pinch, one over the other.
  it("bows sibling curves apart and staggers their labels", () => {
    // Library agent layout: Idle's right side carries six transition ends.
    const geo = computePortGeometry(
      rects({
        idle: { x: 0, y: 0, width: 260, height: 90 },
        cheap: { x: 560, y: -230, width: 420, height: 210 },
        hours: { x: 560, y: -10, width: 420, height: 120 },
        contact: { x: 560, y: 190, width: 420, height: 120 },
      }),
      [
        { id: "a1", source: "idle", target: "cheap", curved: true },
        { id: "a2", source: "cheap", target: "idle", curved: true },
        { id: "b1", source: "idle", target: "hours", curved: true },
        { id: "b2", source: "hours", target: "idle", curved: true },
        { id: "go", source: "idle", target: "contact", curved: true },
        { id: "back", source: "contact", target: "idle", curved: true },
      ]
    )
    const curve = (id: string) => {
      const g = geo.get(id)!
      return getCurvedPath(curveEnds(g.points, g, false))
    }
    const sample = (id: string) => {
      const d = curve(id).path.match(/-?\d+(\.\d+)?/g)!.map(Number)
      const [p0, p1, p2, p3] = [0, 2, 4, 6].map((i) => ({ x: d[i], y: d[i + 1] }))
      return Array.from({ length: 41 }, (_, k) => {
        const u = k / 40
        const v = 1 - u
        return {
          x: v * v * v * p0.x + 3 * v * v * u * p1.x + 3 * v * u * u * p2.x + u * u * u * p3.x,
          y: v * v * v * p0.y + 3 * v * v * u * p1.y + 3 * v * u * u * p2.y + u * u * u * p3.y,
        }
      })
    }
    const [s1, s2] = [sample("go"), sample("back")]
    // Middle half of the curves: clearly apart.
    let gap = Infinity
    for (const p of s1.slice(10, 31)) for (const q of s2) gap = Math.min(gap, Math.hypot(p.x - q.x, p.y - q.y))
    expect(gap).toBeGreaterThanOrEqual(18)
    // Label boxes (12px bold text, ~16px tall) do not overlap.
    const box = (p: P, w: number) => ({ x0: p.x - w / 2, x1: p.x + w / 2, y0: p.y - 8, y1: p.y + 8 })
    const [l1, l2] = [box(curve("go").label, 70), box(curve("back").label, 40)]
    const overlap = Math.min(l1.x1, l2.x1) > Math.max(l1.x0, l2.x0) && Math.min(l1.y1, l2.y1) > Math.max(l1.y0, l2.y0)
    expect(overlap).toBe(false)
  })

  it("leaves a lone curve as React Flow draws it", () => {
    const geo = computePortGeometry(
      rects({ a: { x: 0, y: 0, width: 160, height: 80 }, b: { x: 400, y: 0, width: 160, height: 80 } }),
      [{ id: "e", source: "a", target: "b", curved: true }]
    )
    const g = geo.get("e")!
    expect(g.bow).toBeUndefined()
    expect(g.labelAt).toBeUndefined()
    expect(getCurvedPath(curveEnds(g.points, g, false)).path).toBe("M160,40 C280,40 280,40 400,40")
  })
})

const TEMPLATES = resolve(__dirname, "../../../webapp/src/main/templates/pattern")

/** Every `{ nodes, edges }` model inside a template file. */
const modelsIn = (file: string): { type?: string; nodes: Node[]; edges: Edge[] }[] => {
  const out: { type?: string; nodes: Node[]; edges: Edge[] }[] = []
  const walk = (v: unknown) => {
    if (!v || typeof v !== "object") return
    if (Array.isArray(v)) return v.forEach(walk)
    const o = v as Record<string, unknown>
    if (Array.isArray(o.nodes) && Array.isArray(o.edges)) out.push(o as never)
    else Object.values(o).forEach(walk)
  }
  walk(JSON.parse(readFileSync(resolve(TEMPLATES, file), "utf8")))
  return out
}

describe("stored routes on load", () => {
  // Before (Personalized Gym, ParaplegicUser): the ObjectLink edges kept the
  // old renderer's full route as bends, Accessibility → Disability looping
  // bottom → top through Disability.
  it("re-attaches template ObjectLinks to facing sides instead of their saved route", () => {
    const model = modelsIn("project/personalized_gym_agent.json").find(
      (m) => m.type === "UserDiagram" && m.nodes.length === 3
    )!
    const layout = computeFloatingLayout(model.nodes, model.edges)
    const rs = nodeRects(model.nodes)
    expect(layout.size).toBe(2)
    for (const e of model.edges) {
      const g = layout.get(e.id)!
      expect(g.hasBends, e.id).toBe(false)
      for (const [id, r] of rs) {
        expect(crossesRect(g.points, r), `${e.id} through ${id}`).toBe(false)
      }
    }
  })

  it("keeps stored bends the user laid out (isManuallyLayouted: true)", () => {
    const edge: PortEdgeInput = {
      id: "e",
      source: "a",
      target: "b",
      data: { isManuallyLayouted: true, points: [{ x: 160, y: 40 }, { x: 250, y: -80 }, { x: 450, y: -80 }, { x: 400, y: 40 }] },
    }
    const g = computePortGeometry(
      rects({ a: { x: 0, y: 0, width: 160, height: 80 }, b: { x: 400, y: 0, width: 160, height: 80 } }),
      [edge]
    ).get("e")!
    expect(g.hasBends).toBe(true)
    expect(g.points.some((p) => p.x === 250 && p.y === -80)).toBe(true)
  })
})

const bpmn = (id: string, type: string, x: number, y: number, width: number, height: number): Node => ({
  id,
  type,
  position: { x, y },
  width,
  height,
  measured: { width, height },
  data: {},
})

describe("BPMN side rules", () => {
  // Before: a message flow between tasks of two stacked pools, far apart
  // sideways, left / entered on the right / left and ran along the pools.
  it("attaches a message flow between stacked nodes on bottom / top", () => {
    const nodes = [bpmn("t1", "bpmnTask", 0, 0, 120, 60), bpmn("t2", "bpmnTask", 500, 140, 120, 60)]
    const edges: Edge[] = [{ id: "m", type: "BPMNMessageFlow", source: "t1", target: "t2", data: {} }]
    const g: PortGeometry = computeFloatingLayout(nodes, edges).get("m")!
    expect([g.source.side, g.target.side]).toEqual(["bottom", "top"])
  })

  // Before: both flows of a split gateway left from its right corner.
  it("splits a gateway's flows to the corners facing their targets", () => {
    const nodes = [
      bpmn("g", "bpmnGateway", 0, 105, 50, 50),
      bpmn("up", "bpmnTask", 200, 0, 120, 60),
      bpmn("down", "bpmnTask", 200, 200, 120, 60),
    ]
    const edges: Edge[] = [
      { id: "f1", type: "BPMNSequenceFlow", source: "g", target: "up", data: {} },
      { id: "f2", type: "BPMNSequenceFlow", source: "g", target: "down", data: {} },
    ]
    const layout = computeFloatingLayout(nodes, edges)
    expect(layout.get("f1")!.source.side).toBe("top")
    expect(layout.get("f2")!.source.side).toBe("bottom")
  })
})
