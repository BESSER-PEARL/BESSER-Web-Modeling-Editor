import { describe, expect, it, vi } from "vitest"
import type { Edge, Node } from "@xyflow/react"
import { computeFloatingLayout } from "@/utils/floatingEdges"

const router = vi.hoisted(() => ({ calls: 0 }))
vi.mock("@/utils/orthogonalRouter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/orthogonalRouter")>()
  return {
    ...actual,
    routeOrthogonalEdges: (...args: Parameters<typeof actual.routeOrthogonalEdges>) => {
      router.calls += 1
      return actual.routeOrthogonalEdges(...args)
    },
  }
})

const rnd = (seed: number) => () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff
  return seed / 0x7fffffff
}

const cls = (id: string, x: number, y: number): Node => ({
  id,
  type: "class",
  position: { x, y },
  width: 160,
  height: 100,
  data: {},
})

const assoc = (id: string, source: string, target: string): Edge => ({
  id,
  source,
  target,
  type: "ClassBidirectional",
  data: {},
})

const crosses = (points: { x: number; y: number }[], r: Node) => {
  const x0 = r.position.x
  const y0 = r.position.y
  const x1 = x0 + 160
  const y1 = y0 + 100
  return points.slice(1).some((p, i) => {
    const q = points[i]
    if (q.y === p.y) {
      return q.y > y0 && q.y < y1 && Math.max(q.x, p.x) > x0 && Math.min(q.x, p.x) < x1
    }
    return q.x > x0 && q.x < x1 && Math.max(q.y, p.y) > y0 && Math.min(q.y, p.y) < y1
  })
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]

describe("floating routes while a node is dragged", () => {
  // Review finding (r3 bench): on 150 scattered classes / 300 associations a
  // drag frame re-routed every edge whose search window held the moved node,
  // ~7 s per frame. Only routes the moved node actually crosses re-route now.
  it("keeps a drag frame cheap on 150 nodes / 300 edges", () => {
    const r = rnd(7)
    const nodes = Array.from({ length: 150 }, (_, i) =>
      cls(`n${i}`, Math.floor(r() * 3000), Math.floor(r() * 2500))
    )
    const edges = Array.from({ length: 300 }, (_, k) =>
      assoc(`e${k}`, `n${Math.floor(r() * 150)}`, `n${Math.floor(r() * 150)}`)
    )
    computeFloatingLayout(nodes, edges)
    // Edges of the dragged node re-route; the others keep their routes.
    const own = edges.filter((e) => e.source === "n50" || e.target === "n50").length
    const frames: number[] = []
    const calls: number[] = []
    for (let f = 1; f <= 6; f++) {
      const moved = nodes.map((n) =>
        n.id === "n50"
          ? { ...n, dragging: true, position: { x: n.position.x + f * 9, y: n.position.y + f * 3 } }
          : n
      )
      router.calls = 0
      const t = performance.now()
      computeFloatingLayout(moved, edges)
      frames.push(performance.now() - t)
      calls.push(router.calls)
    }
    // Up to 4 router calls per re-routed edge: the dragged node's own edges
    // plus the odd one it now crosses (was ~54 calls per frame).
    expect(Math.max(...calls)).toBeLessThanOrEqual(4 * own + 4)
    // Generous wall-clock bound: ~4-7 s per frame before, < 1 s after.
    expect(median(frames)).toBeLessThan(3000)
  }, 120_000)

  it("re-routes an edge whose route the dragged node now blocks", () => {
    const nodes = [cls("A", 0, 0), cls("B", 600, 0), cls("M", 300, 400)]
    const edges = [assoc("AB", "A", "B")]
    const before = computeFloatingLayout(nodes, edges).get("AB")!
    const blocker = { ...nodes[2], dragging: true, position: { x: 300, y: 0 } }
    expect(crosses(before.points, blocker)).toBe(true)
    const during = computeFloatingLayout([nodes[0], nodes[1], blocker], edges).get("AB")!
    expect(crosses(during.points, blocker)).toBe(false)
  })
})
