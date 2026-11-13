/**
 * Regression tests for the floating-port routing fixes: each case records the
 * failure seen before the fix (see the comment on each test).
 */
import { describe, expect, it } from "vitest"
import type { Edge, Node } from "@xyflow/react"
import { computePortGeometry, type PortEdgeInput } from "../../lib/utils/edgePorts"
import { GridIndex, routeOrthogonalEdges } from "../../lib/utils/orthogonalRouter"
import { placeEdgeLabels, type EdgeLabelLayout } from "../../lib/utils/edgeLabelPlacement"
import { computeFloatingLayout, nodeRects } from "../../lib/utils/floatingEdges"
import { chooseFacingSidesForRects } from "../../lib/utils/autoLayoutHandles"
import { dragSegment } from "../../lib/utils/edgeDragging"
import { computeAutoLayout } from "../../lib/utils/autoLayout"
import { UMLDiagramType } from "../../lib/types"

type P = { x: number; y: number }
type R = { x: number; y: number; width: number; height: number }

const rects = (entries: Record<string, R>) => new Map(Object.entries(entries))

const diagonal = (pts: P[]) =>
  pts.slice(1).filter((p, i) => Math.abs(p.x - pts[i].x) > 0.5 && Math.abs(p.y - pts[i].y) > 0.5).length

/** Axis-aligned segment strictly crossing the interior of `r` (1px inset). */
const crosses = (pts: P[], r: R) => {
  for (let i = 0; i + 1 < pts.length; i++) {
    const [a, b] = [pts[i], pts[i + 1]]
    const [x0, x1, y0, y1] = [r.x + 1, r.x + r.width - 1, r.y + 1, r.y + r.height - 1]
    if (Math.abs(a.y - b.y) < 0.5) {
      if (a.y > y0 && a.y < y1 && Math.max(a.x, b.x) > x0 && Math.min(a.x, b.x) < x1) return true
    } else if (a.x > x0 && a.x < x1 && Math.max(a.y, b.y) > y0 && Math.min(a.y, b.y) < y1) return true
  }
  return false
}

const onSide = (r: R, side: string, p: P) =>
  side === "top"
    ? Math.abs(p.y - r.y) < 0.11
    : side === "bottom"
      ? Math.abs(p.y - r.y - r.height) < 0.11
      : side === "left"
        ? Math.abs(p.x - r.x) < 0.11
        : Math.abs(p.x - r.x - r.width) < 0.11

/** Deterministic PRNG (mulberry32). */
const rng = (seed: number) => {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Random non-overlapping rects (at least `gap` apart) and random edges. */
const randomScene = (seed: number, n: number, e: number, gap = 10) => {
  const r = rng(seed)
  const out = new Map<string, R>()
  for (let tries = 0; out.size < n && tries < 5000; tries++) {
    const rect = {
      x: Math.round(r() * 1200),
      y: Math.round(r() * 1200),
      width: 40 + Math.round(r() * 200),
      height: 30 + Math.round(r() * 160),
    }
    const clash = [...out.values()].some(
      (q) =>
        rect.x < q.x + q.width + gap &&
        rect.x + rect.width + gap > q.x &&
        rect.y < q.y + q.height + gap &&
        rect.y + rect.height + gap > q.y
    )
    if (!clash) out.set(`n${out.size}`, rect)
  }
  const ids = [...out.keys()]
  const edges: PortEdgeInput[] = []
  for (let k = 0; k < e; k++) {
    const s = ids[Math.floor(r() * ids.length)]
    let t = ids[Math.floor(r() * ids.length)]
    if (t === s && r() < 0.8) t = ids[(ids.indexOf(s) + 1) % ids.length]
    edges.push({ id: `e${k}`, source: s, target: t })
  }
  return { rects: out, edges }
}

/** Grid of classes with mostly local associations (the drag benchmark scene). */
const classGrid = (n: number, e: number, seed = 7) => {
  const r = rng(seed)
  const cols = Math.ceil(Math.sqrt(n))
  const nodes: Node[] = []
  for (let i = 0; i < n; i++) {
    const w = 140 + Math.floor(r() * 80)
    const h = 80 + Math.floor(r() * 120)
    nodes.push({
      id: `c${i}`,
      type: "class",
      position: { x: (i % cols) * 320 + Math.floor(r() * 60), y: Math.floor(i / cols) * 300 + Math.floor(r() * 60) },
      width: w,
      height: h,
      measured: { width: w, height: h },
      data: { name: `C${i}` },
    } as Node)
  }
  const edges: Edge[] = []
  for (let k = 0; k < e; k++) {
    const s = Math.floor(r() * n)
    let t = r() < 0.8 ? s + [1, -1, cols, -cols, cols + 1][Math.floor(r() * 5)] : Math.floor(r() * n)
    if (t < 0 || t >= n || t === s) t = (s + 1) % n
    edges.push({
      id: `e${k}`,
      source: `c${s}`,
      target: `c${t}`,
      type: "ClassBidirectional",
      data: { sourceMultiplicity: "0..*", targetMultiplicity: "1", sourceRole: `src_${k}`, targetRole: `role_${k}` },
    } as Edge)
  }
  return { nodes, edges }
}

describe("routing near close neighbours (C3)", () => {
  // Before: any gap under 28 px (2 x router margin) put the port stub inside the
  // neighbour's clearance; the search failed and the fallback Z ran straight
  // through the neighbour.
  it("detours around a neighbour 8-26 px from the port", () => {
    for (let gap = 8; gap <= 26; gap += 2) {
      const block = { x: 100 + gap, y: 20, width: 60, height: 60 }
      const g = computePortGeometry(
        rects({ s: { x: 0, y: 0, width: 100, height: 100 }, b: block, t: { x: 400, y: 0, width: 100, height: 100 } }),
        [{ id: "e", source: "s", target: "t" }]
      ).get("e")!
      expect(crosses(g.points, block), `gap ${gap}`).toBe(false)
      expect(diagonal(g.points)).toBe(0)
    }
  })
})

describe("ports on one side (C4, C5)", () => {
  // Before: 18 coincident anchors over 300 seeded scenes (auto ends pushed
  // clear of a fixed end all landed on the same spot).
  it("never puts two ends on the same point of a side", () => {
    let coincident = 0
    for (let seed = 1; seed <= 300; seed++) {
      const { rects: rs, edges } = randomScene(seed, 8, 12)
      const g = computePortGeometry(rs, edges)
      const seen = new Map<string, P[]>()
      for (const e of edges) {
        const geo = g.get(e.id)!
        for (const [end, node] of [[geo.source, e.source], [geo.target, e.target]] as const) {
          const k = `${node}|${end.side}`
          const list = seen.get(k) ?? []
          if (list.some((p) => Math.hypot(p.x - end.x, p.y - end.y) < 0.5)) coincident++
          list.push(end)
          seen.set(k, list)
        }
      }
    }
    expect(coincident).toBe(0)
  })

  it("keeps auto ends off a pinned end on the same side", () => {
    const g = computePortGeometry(
      rects({ a: { x: 0, y: 0, width: 100, height: 60 }, b: { x: 400, y: 0, width: 100, height: 300 } }),
      [
        { id: "p", source: "a", target: "b", data: { targetPort: { side: "left", t: 0.5 } } },
        { id: "x", source: "a", target: "b" },
        { id: "y", source: "a", target: "b" },
      ]
    )
    const ys = ["p", "x", "y"].map((id) => g.get(id)!.target.y)
    expect(new Set(ys.map((y) => Math.round(y))).size).toBe(3)
  })

  // Before: two self-loops on one class were drawn exactly on top of each other.
  it("nests a second self-loop outside the first", () => {
    const r = { x: 0, y: 0, width: 160, height: 100 }
    const g = computePortGeometry(rects({ a: r }), [
      { id: "l1", source: "a", target: "a" },
      { id: "l2", source: "a", target: "a" },
    ])
    const [l1, l2] = [g.get("l1")!, g.get("l2")!]
    expect(l1.points).not.toEqual(l2.points)
    // Outer loop: further from the corner on both sides, reaching further out.
    expect(l2.source.y).toBeGreaterThan(l1.source.y)
    expect(l2.target.x).toBeLessThan(l1.target.x)
    expect(Math.max(...l2.points.map((p) => p.x))).toBeGreaterThan(Math.max(...l1.points.map((p) => p.x)))
    expect(Math.min(...l2.points.map((p) => p.y))).toBeLessThan(Math.min(...l1.points.map((p) => p.y)))
    for (const l of [l1, l2]) expect(diagonal(l.points)).toBe(0)
  })
})

describe("facing sides of close boxes (C6)", () => {
  // Before: a stack 10 px apart overlapping sideways connected right → left
  // with a detour around both boxes.
  // 2026-10-08: a 10 px straight edge is mostly hidden under its marker; under
  // 20 px of gap the edge takes a clean L instead (still no detour around both).
  it("connects a close vertical stack with a visible L, not a detour around both", () => {
    const a = { x: 0, y: 0, width: 300, height: 50 }
    const b = { x: 250, y: 60, width: 300, height: 50 }
    expect(chooseFacingSidesForRects(a, b)).toEqual({ sourceSide: "bottom", targetSide: "top" })
    const g = computePortGeometry(rects({ a, b }), [{ id: "e", source: "a", target: "b" }]).get("e")!
    expect(g.points).toHaveLength(3)
    expect(crosses(g.points, a) || crosses(g.points, b)).toBe(false)
  })

  it("keeps the centre rule for diagonal neighbours (no flip while dragging past a corner)", () => {
    const a = { x: 0, y: 0, width: 100, height: 100 }
    const b = { x: 108, y: 115, width: 300, height: 100 }
    expect(chooseFacingSidesForRects(a, b)).toEqual({ sourceSide: "right", targetSide: "left" })
  })
})

describe("orthogonal router (C2, C10)", () => {
  // Before: grid lines 0.5 px apart were merged and the route left the port
  // with a 0.5 px slanted first segment.
  it("keeps the first segment on the port's line when grid lines merge", () => {
    const obstacles = [
      { x: 938, y: 137, width: 197, height: 62 },
      { x: 1152, y: 966, width: 40, height: 187 },
      { x: 1050, y: 400, width: 80, height: 80 },
    ]
    const route = routeOrthogonalEdges(obstacles, [
      {
        id: "r",
        source: { point: { x: 1036.5, y: 199 }, side: "bottom" },
        target: { point: { x: 1171.5, y: 966 }, side: "top" },
      },
    ]).get("r")!
    expect(diagonal(route)).toBe(0)
    expect(route[1].x).toBe(1036.5)
  })

  it("routes a 200-node batch deterministically around every node", () => {
    const r = rng(9)
    const obstacles: R[] = []
    for (let i = 0; i < 200; i++) {
      obstacles.push({ x: (i % 15) * 260 + r() * 40, y: Math.floor(i / 15) * 240 + r() * 40, width: 160, height: 120 })
    }
    const requests = []
    for (let k = 0; k < 250; k++) {
      const i = Math.floor(r() * 199)
      const j = r() < 0.5 ? i + 1 : Math.min(199, i + 15)
      if (i === j) continue
      const [a, b] = [obstacles[i], obstacles[j]]
      requests.push({
        id: `e${k}`,
        source: { point: { x: a.x + a.width, y: a.y + 60 }, side: "right" as const },
        target: { point: { x: b.x, y: b.y + 60 }, side: "left" as const },
      })
    }
    const out = routeOrthogonalEdges(obstacles, requests)
    expect(JSON.stringify([...routeOrthogonalEdges(obstacles, requests)])).toBe(JSON.stringify([...out]))
    for (const [, pts] of out) {
      expect(diagonal(pts)).toBe(0)
      for (const o of obstacles) expect(crosses(pts, { x: o.x + 1, y: o.y + 1, width: o.width - 2, height: o.height - 2 })).toBe(false)
    }
  })

  it("indexes boxes: a query returns each overlapping id once, ascending", () => {
    const index = new GridIndex(50)
    index.insert(3, 0, 0, 120, 10)
    index.insert(1, 200, 200, 210, 210)
    index.insert(2, 90, 0, 100, 300)
    expect(index.query(95, 5, 96, 6)).toEqual([2, 3])
    expect(index.query(500, 500, 600, 600)).toEqual([])
  })
})

describe("segment dragging on a degenerate route (C10)", () => {
  // Before: a first segment running along the top side was "slid" to y=40,
  // moving the port inside the node.
  it("keeps the port on the border and leaves the node perpendicular", () => {
    const pts = [{ x: 50, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 200 }]
    const res = dragSegment(pts, 0, 40, {
      sourceRect: { x: 0, y: 0, width: 100, height: 100 },
      targetRect: { x: 250, y: 200, width: 100, height: 100 },
      sourceSide: "top",
      targetSide: "top",
    })
    expect(res.sourcePort).toBeUndefined()
    expect(res.storedPoints[0]).toEqual({ x: 50, y: 0 })
    expect(res.storedPoints[1].x).toBe(50)
    expect(res.storedPoints[1].y).toBeLessThan(0)
    expect(diagonal(res.storedPoints)).toBe(0)
  })
})

describe("end labels while dragging (C8)", () => {
  // Before: placement ignored the previous frame, so near-ties flipped sides.
  it("keeps the previous side unless the other side is clearly better", () => {
    const points = [{ x: 0, y: 0 }, { x: 200, y: 0 }]
    const input = [{ id: "e", points, sourceRole: "owner", sourceMultiplicity: "1" }]
    const fresh = placeEdgeLabels(input, [])
    // Default: role above the line.
    expect(fresh.get("e")!.source.role!.y).toBeLessThan(0)
    const swapped: EdgeLabelLayout = {
      source: { role: { ...fresh.get("e")!.source.multiplicity!, y: 22 }, multiplicity: { ...fresh.get("e")!.source.role! } },
      target: {},
    }
    const kept = placeEdgeLabels(input, [], undefined, new Map([["e", { points, labels: swapped }]]))
    expect(kept.get("e")!.source.role!.y).toBeGreaterThan(0)
    // A node sitting on the kept side wins over the hysteresis.
    const blocked = placeEdgeLabels(input, [{ x: 0, y: 5, width: 200, height: 60 }], undefined, new Map([["e", { points, labels: swapped }]]))
    expect(blocked.get("e")!.source.role!.y).toBeLessThan(0)
  })
})

describe("auto-layout and floating ports (C7)", () => {
  // Before: every class edge stored the layout route in data.points, which
  // the floating ports read as user bends: the shape froze while nodes moved.
  it("stores no route for class edges after a compact layout", async () => {
    const { nodes, edges } = classGrid(12, 14)
    const out = await computeAutoLayout(nodes, edges, UMLDiagramType.ClassDiagram, { strategy: "compact" })
    for (const e of out.edges) expect((e.data as { points?: P[] }).points ?? []).toEqual([])
    const live = computeFloatingLayout(out.nodes, out.edges)
    for (const g of live.values()) expect(g.hasBends).toBe(false)
  })
})

describe("moving a class (usability)", () => {
  it("re-routes the affected edges around every other class", () => {
    for (let seed = 1; seed <= 60; seed++) {
      const { rects: rs, edges } = randomScene(seed, 8, 12, 12)
      const ids = [...rs.keys()]
      const moved = ids[seed % ids.length]
      const r = rs.get(moved)!
      // Move it to a free spot: below everything.
      const maxY = Math.max(...[...rs.values()].map((q) => q.y + q.height))
      const next = new Map(rs)
      next.set(moved, { ...r, y: maxY + 40, x: r.x + 30 })
      for (const scene of [rs, next]) {
        const g = computePortGeometry(scene, edges)
        for (const e of edges) {
          const geo = g.get(e.id)!
          expect(geo.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true)
          expect(onSide(scene.get(e.source)!, geo.source.side, geo.points[0])).toBe(true)
          expect(onSide(scene.get(e.target)!, geo.target.side, geo.points[geo.points.length - 1])).toBe(true)
          expect(diagonal(geo.points)).toBe(0)
          if (e.source === e.target) continue
          for (const [id, q] of scene) {
            if (id === e.source || id === e.target) continue
            expect(crosses(geo.points, q), `seed ${seed} ${e.id} through ${id}`).toBe(false)
          }
        }
      }
    }
  })

  it("re-routes when a node moves onto a cached detour outside the first search window", () => {
    // A tall blocker forces a detour far above the ports (outside the 160 px
    // window around them); a second node then lands on that detour.
    const base = {
      s: { x: 0, y: 0, width: 100, height: 100 },
      blocker: { x: 200, y: -300, width: 100, height: 700 },
      t: { x: 400, y: 0, width: 100, height: 100 },
    }
    const first = computePortGeometry(rects(base), [{ id: "e", source: "s", target: "t" }]).get("e")!
    const detourY = Math.min(...first.points.map((p) => p.y))
    expect(detourY).toBeLessThan(-300)
    const lander = { x: 120, y: detourY - 30, width: 300, height: 60 }
    const second = computePortGeometry(rects({ ...base, lander }), [{ id: "e", source: "s", target: "t" }]).get("e")!
    expect(crosses(second.points, lander)).toBe(false)
    expect(crosses(second.points, base.blocker)).toBe(false)
  })

  it("keeps end labels off the classes", () => {
    const { nodes, edges } = classGrid(20, 24, 3)
    const moved = nodes.map((n) => (n.id === "c6" ? { ...n, position: { x: n.position.x + 40, y: n.position.y + 30 } } : n))
    const layout = computeFloatingLayout(moved, edges)
    const rs = [...nodeRects(moved).values()]
    let onNode = 0
    for (const g of layout.values()) {
      for (const end of [g.labels.source, g.labels.target]) {
        for (const l of [end.role, end.multiplicity]) {
          if (!l) continue
          const w = 60
          const x0 = l.anchor === "start" ? l.x : l.anchor === "end" ? l.x - w : l.x - w / 2
          if (rs.some((r) => x0 < r.x + r.width && x0 + w > r.x && l.y - 13 < r.y + r.height && l.y + 4 > r.y)) onNode++
        }
      }
    }
    expect(onNode).toBe(0)
  })
})

describe("drag performance (C1)", () => {
  // Before: every frame re-routed every edge from scratch and scored labels
  // against every node and segment: ~210-310 ms per frame at 200 classes /
  // 250 associations.
  it("keeps a drag frame of a 200-class diagram well under 100 ms", () => {
    const { nodes, edges } = classGrid(200, 250)
    let cur = nodes
    let prev = computeFloatingLayout(cur, edges)
    const times: number[] = []
    for (let i = 0; i < 12; i++) {
      cur = cur.map((n) => (n.id === "c0" ? { ...n, position: { x: n.position.x + 3, y: n.position.y } } : n))
      const t0 = performance.now()
      prev = computeFloatingLayout(cur, edges, { previous: prev })
      times.push(performance.now() - t0)
    }
    times.sort((a, b) => a - b)
    expect(times[Math.floor(times.length / 2)]).toBeLessThan(100)
  })

  it("matches an uncached computation exactly", () => {
    const { nodes, edges } = classGrid(30, 36, 5)
    const moved = nodes.map((n) => (n.id === "c4" ? { ...n, position: { x: n.position.x + 70, y: n.position.y - 20 } } : n))
    computeFloatingLayout(nodes, edges)
    const cachedRun = computeFloatingLayout(moved, edges)
    // Fresh rect objects with shifted coordinates miss the cache; shifting
    // back must give the same geometry as the cached run.
    const shift = (ns: Node[], d: number) => ns.map((n) => ({ ...n, position: { x: n.position.x + d, y: n.position.y + d } }))
    const fresh = computeFloatingLayout(shift(moved, 100000), edges)
    for (const [id, g] of cachedRun) {
      const f = fresh.get(id)!
      expect(f.points.map((p) => ({ x: Math.round((p.x - 100000) * 10) / 10, y: Math.round((p.y - 100000) * 10) / 10 }))).toEqual(g.points)
    }
  })
})
