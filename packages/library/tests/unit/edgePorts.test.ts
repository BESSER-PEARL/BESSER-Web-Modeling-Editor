import { describe, expect, it } from "vitest"
import type { Edge, Node } from "@xyflow/react"
import { readFileSync } from "fs"
import { resolve } from "path"
import {
  computePortGeometry,
  facingHandleIds,
  handleIdToPort,
  nearestBorderPort,
  portPoint,
  readPort,
  type PortEdgeInput,
} from "../../lib/utils/edgePorts"
import { placeEdgeLabels } from "../../lib/utils/edgeLabelPlacement"
import { computeFloatingLayout } from "../../lib/utils/floatingEdges"

type P = { x: number; y: number }
type R = { x: number; y: number; width: number; height: number }

const rects = (entries: Record<string, R>) => new Map(Object.entries(entries))

const diagonalSegments = (pts: P[]) =>
  pts.slice(1).filter((p, i) => Math.abs(p.x - pts[i].x) > 0.5 && Math.abs(p.y - pts[i].y) > 0.5).length

const onBorder = (r: R, p: P) =>
  ((Math.abs(p.x - r.x) < 0.01 || Math.abs(p.x - r.x - r.width) < 0.01) && p.y >= r.y && p.y <= r.y + r.height) ||
  ((Math.abs(p.y - r.y) < 0.01 || Math.abs(p.y - r.y - r.height) < 0.01) && p.x >= r.x && p.x <= r.x + r.width)

const loadTemplate = (file: string) =>
  JSON.parse(
    readFileSync(resolve(__dirname, "../../../webapp/src/main/templates/pattern/structural", file), "utf8")
  ) as { nodes: Node[]; edges: Edge[] }

describe("legacy handle ids and stored ports", () => {
  it("maps every legacy handle id to a side + ratio, case-insensitively", () => {
    expect(handleIdToPort("right-top")).toEqual({ side: "right", t: 0.2 })
    expect(handleIdToPort("bottom")).toEqual({ side: "bottom", t: 0.5 })
    expect(handleIdToPort("top-mid-right")).toEqual({ side: "top", t: 0.65 })
    expect(handleIdToPort("Left")).toEqual({ side: "left", t: 0.5 })
    expect(handleIdToPort("Center")).toBeUndefined()
    expect(handleIdToPort(null)).toBeUndefined()
  })

  it("validates and clamps a stored port", () => {
    expect(readPort({ side: "right", t: 0.3 })).toEqual({ side: "right", t: 0.3 })
    expect(readPort({ side: "right", t: 1.7 })).toEqual({ side: "right", t: 1 })
    expect(readPort({ side: "middle", t: 0.3 })).toBeUndefined()
    expect(readPort({ side: "top", t: Number.NaN })).toBeUndefined()
    expect(readPort("right")).toBeUndefined()
  })

  it("round-trips a pinned border point (nearest port → point)", () => {
    const r = { x: 100, y: 50, width: 200, height: 120 }
    for (const p of [{ x: 160, y: 40 }, { x: 330, y: 80 }, { x: 140, y: 175 }, { x: 95, y: 150 }, { x: 290, y: 60 }]) {
      const port = nearestBorderPort(r, p)
      const q = portPoint(r, port)
      expect(onBorder(r, q)).toBe(true)
      expect(nearestBorderPort(r, q)).toEqual(port)
    }
    expect(nearestBorderPort(r, { x: 160, y: 40 })).toEqual({ side: "top", t: 0.3 })
  })

  it("serialises the facing sides as valid handle ids for a new edge", () => {
    expect(facingHandleIds({ x: 0, y: 0, width: 100, height: 80 }, { x: 300, y: 20, width: 100, height: 80 })).toEqual({
      sourceHandle: "right",
      targetHandle: "left",
    })
    expect(facingHandleIds({ x: 0, y: 0, width: 100, height: 80 }, { x: 10, y: 300, width: 100, height: 80 })).toEqual({
      sourceHandle: "bottom",
      targetHandle: "top",
    })
  })
})

describe("anchor computation", () => {
  it("attaches on the facing sides and draws a straight edge when the boxes overlap", () => {
    const g = computePortGeometry(
      rects({ a: { x: 0, y: 0, width: 160, height: 100 }, b: { x: 400, y: 40, width: 160, height: 120 } }),
      [{ id: "e", source: "a", target: "b", sourceHandle: "top", targetHandle: "bottom" }]
    ).get("e")!
    expect(g.source.side).toBe("right")
    expect(g.target.side).toBe("left")
    expect(g.points).toHaveLength(2)
    expect(g.points[0].y).toBe(g.points[1].y)
    expect(g.points[0].y).toBeGreaterThanOrEqual(40)
    expect(g.points[0].y).toBeLessThanOrEqual(100)
  })

  it("ignores the legacy handle side: a class moved below re-attaches bottom → top", () => {
    const g = computePortGeometry(
      rects({ a: { x: 0, y: 0, width: 160, height: 100 }, b: { x: 300, y: 300, width: 160, height: 100 } }),
      [{ id: "e", source: "a", target: "b", sourceHandle: "right", targetHandle: "left" }]
    ).get("e")!
    expect(g.source.side).toBe("bottom")
    expect(g.target.side).toBe("top")
    expect(diagonalSegments(g.points)).toBe(0)
  })

  it("re-routes around a class in between", () => {
    const g = computePortGeometry(
      rects({
        a: { x: 0, y: 0, width: 100, height: 100 },
        blocker: { x: 200, y: -20, width: 100, height: 140 },
        b: { x: 400, y: 0, width: 100, height: 100 },
      }),
      [{ id: "e", source: "a", target: "b" }]
    ).get("e")!
    const blocker = { x: 200, y: -20, width: 100, height: 140 }
    for (let i = 0; i + 1 < g.points.length; i++) {
      const a = g.points[i]
      const b = g.points[i + 1]
      const hits =
        Math.abs(a.y - b.y) < 0.5
          ? a.y > blocker.y && a.y < blocker.y + blocker.height && Math.max(a.x, b.x) > blocker.x && Math.min(a.x, b.x) < blocker.x + blocker.width
          : a.x > blocker.x && a.x < blocker.x + blocker.width && Math.max(a.y, b.y) > blocker.y && Math.min(a.y, b.y) < blocker.y + blocker.height
      expect(hits).toBe(false)
    }
    expect(diagonalSegments(g.points)).toBe(0)
  })
})

describe("self-loops", () => {
  it("loops around the top-right corner outside the class", () => {
    const r = { x: 240, y: 495, width: 160, height: 70 }
    const g = computePortGeometry(rects({ c: r }), [{ id: "l", source: "c", target: "c" }]).get("l")!
    expect(g.source.side).toBe("right")
    expect(g.target.side).toBe("top")
    expect(diagonalSegments(g.points)).toBe(0)
    // Every interior point lies outside the class.
    for (const p of g.points.slice(1, -1)) {
      const inside = p.x > r.x && p.x < r.x + r.width && p.y > r.y && p.y < r.y + r.height
      expect(inside).toBe(false)
    }
    expect(g.points).toHaveLength(5)
  })
})

describe("spreading and order", () => {
  it("spreads the ends sharing a side, ordered by where the other end is (no crossings)", () => {
    // Hub on the left, three targets stacked on the right, listed out of order.
    const r = rects({
      hub: { x: 0, y: 0, width: 160, height: 200 },
      low: { x: 400, y: 260, width: 120, height: 60 },
      high: { x: 400, y: -120, width: 120, height: 60 },
      mid: { x: 400, y: 70, width: 120, height: 60 },
    })
    const edges: PortEdgeInput[] = ["low", "high", "mid"].map((t) => ({ id: t, source: "hub", target: t, sourceHandle: "right" }))
    const g = computePortGeometry(r, edges)
    const ys = ["high", "mid", "low"].map((id) => g.get(id)!.source)
    for (const s of ys) expect(s.side).toBe("right")
    expect(ys[0].y).toBeLessThan(ys[1].y)
    expect(ys[1].y).toBeLessThan(ys[2].y)
    expect(ys[1].y - ys[0].y).toBeGreaterThanOrEqual(20)
    expect(ys[2].y - ys[1].y).toBeGreaterThanOrEqual(20)
    // Old behaviour piled them onto 3 fixed slots; they are now distinct and inside the side.
    for (const s of ys) expect(s.y).toBeGreaterThan(0)
    for (const s of ys) expect(s.y).toBeLessThan(200)
  })

  it("keeps five ends on one side apart (no more 3-slot pile-up)", () => {
    const r = rects({ hub: { x: 0, y: 0, width: 160, height: 300 } })
    const edges: PortEdgeInput[] = []
    for (let i = 0; i < 5; i++) {
      r.set(`t${i}`, { x: 400, y: i * 90 - 60, width: 100, height: 50 })
      edges.push({ id: `e${i}`, source: "hub", target: `t${i}` })
    }
    const g = computePortGeometry(r, edges)
    const ys = edges.map((e) => g.get(e.id)!.source.y)
    expect(new Set(ys.map(Math.round)).size).toBe(5)
    for (let i = 1; i < 5; i++) expect(ys[i]).toBeGreaterThan(ys[i - 1])
  })
})

describe("pinning", () => {
  it("keeps a pinned end exactly where it was pinned and straightens the auto partner", () => {
    const r = rects({ a: { x: 0, y: 0, width: 160, height: 200 }, b: { x: 400, y: 0, width: 160, height: 200 } })
    const g = computePortGeometry(r, [
      { id: "e", source: "a", target: "b", data: { sourcePort: { side: "right", t: 0.25 } } },
    ]).get("e")!
    expect(g.source).toMatchObject({ x: 160, y: 50, side: "right", pinned: true })
    expect(g.target).toMatchObject({ x: 400, y: 50, side: "left", pinned: false })
  })

  it("leaves unpinned ends automatic when the other end is pinned on another side", () => {
    const r = rects({ a: { x: 0, y: 0, width: 160, height: 100 }, b: { x: 400, y: 300, width: 160, height: 100 } })
    const g = computePortGeometry(r, [
      { id: "e", source: "a", target: "b", data: { sourcePort: { side: "bottom", t: 0.8 } } },
    ]).get("e")!
    expect(g.source).toMatchObject({ side: "bottom", x: 128, y: 100, pinned: true })
    // Clean L into the side facing the pinned point (no wrap-around).
    expect(["top", "left"]).toContain(g.target.side)
    expect(g.points.length).toBeLessThanOrEqual(4)
    expect(g.target.pinned).toBe(false)
    expect(diagonalSegments(g.points)).toBe(0)
  })
})

describe("stored routes (v4 models)", () => {
  // The template's stored points are the old renderer's auto route
  // (isManuallyLayouted: false): the edge re-routes live instead of keeping
  // them as bends (Personalized Gym looped through a node that way).
  it("re-routes a stored auto route (isManuallyLayouted: false) and draws no diagonal segment", () => {
    const model = loadTemplate("Library_Complete.json")
    const layout = computeFloatingLayout(model.nodes, model.edges)
    expect(layout.size).toBe(2)
    for (const g of layout.values()) expect(diagonalSegments(g.points)).toBe(0)
    const [libToBook] = model.edges
    const g = layout.get(libToBook.id)!
    // Library→Book: a live Z between the facing sides (its middle at x = -130).
    expect(g.hasBends).toBe(false)
    expect(g.points.filter((p) => p.x === -130)).toHaveLength(2)
    // The two edges landing on Book's right side do not share an anchor.
    const ends = [...layout.values()].map((l) => l.target)
    expect(ends[0].side).toBe("right")
    expect(ends[1].side).toBe("right")
    expect(Math.abs(ends[0].y - ends[1].y)).toBeGreaterThanOrEqual(20)
  })

  it("routes every NexaCRM relationship orthogonally with distinct anchors", () => {
    const model = loadTemplate("nexacrm.json")
    const layout = computeFloatingLayout(model.nodes, model.edges)
    expect(layout.size).toBe(19)
    let diagonal = 0
    const anchors = new Map<string, number>()
    for (const g of layout.values()) {
      diagonal += diagonalSegments(g.points)
      for (const end of [g.source, g.target]) {
        const key = `${Math.round(end.x)},${Math.round(end.y)}`
        anchors.set(key, (anchors.get(key) ?? 0) + 1)
      }
    }
    expect(diagonal).toBe(0)
    expect([...anchors.values()].every((n) => n === 1)).toBe(true)
  })

  it("drops bends that ended up inside an end node", () => {
    const g = computePortGeometry(
      rects({ a: { x: 0, y: 0, width: 160, height: 100 }, b: { x: 400, y: 0, width: 160, height: 100 } }),
      [{ id: "e", source: "a", target: "b", data: { points: [{ x: 160, y: 50 }, { x: 80, y: 50 }, { x: 80, y: 300 }, { x: 400, y: 50 }] } }]
    ).get("e")!
    expect(g.hasBends).toBe(false)
    expect(g.points).toHaveLength(2)
  })

  it("adds an elbow when a bend no longer lines up with its side", () => {
    const g = computePortGeometry(
      rects({ a: { x: 0, y: 0, width: 100, height: 100 }, b: { x: 400, y: 300, width: 100, height: 100 } }),
      [{ id: "e", source: "a", target: "b", data: { points: [{ x: 0, y: 0 }, { x: 250, y: -80 }, { x: 450, y: -80 }, { x: 0, y: 0 }] } }]
    ).get("e")!
    expect(g.hasBends).toBe(true)
    expect(diagonalSegments(g.points)).toBe(0)
    expect(g.points.some((p) => p.x === 250 && p.y === -80)).toBe(true)
  })
})

describe("end labels", () => {
  it("puts role and multiplicity on opposite sides of the line, past the marker", () => {
    const layout = placeEdgeLabels(
      [{ id: "e", points: [{ x: 0, y: 0 }, { x: 300, y: 0 }], sourceRole: "owner", sourceMultiplicity: "1", targetRole: "items", targetMultiplicity: "0..*", targetMarkerLength: 18 }],
      []
    ).get("e")!
    expect(layout.source.role!.y).toBeLessThan(0)
    expect(layout.source.multiplicity!.y).toBeGreaterThan(0)
    expect(layout.source.role!.anchor).toBe("start")
    expect(layout.target.role!.anchor).toBe("end")
    expect(layout.target.role!.x).toBeLessThanOrEqual(300 - 18)
  })

  it("keeps labels of neighbouring ends from overlapping (created_by / performed_by)", () => {
    // Two edges arriving next to each other at the top of a class.
    const layout = placeEdgeLabels(
      [
        { id: "a", points: [{ x: 120, y: -200 }, { x: 120, y: 0 }], targetRole: "created_by", targetMultiplicity: "1..1" },
        { id: "b", points: [{ x: 150, y: -200 }, { x: 150, y: 0 }], targetRole: "performed_by", targetMultiplicity: "1..1" },
      ],
      [{ x: 50, y: 0, width: 200, height: 150 }]
    )
    const box = (p: { x: number; y: number; anchor: string }, w: number) => {
      const x0 = p.anchor === "start" ? p.x : p.anchor === "end" ? p.x - w : p.x - w / 2
      return { x0, x1: x0 + w, y0: p.y - 13, y1: p.y + 4 }
    }
    const w = (t: string) => Math.ceil(t.length * 8.4) + 2
    const boxes = [
      box(layout.get("a")!.target.role!, w("created_by")),
      box(layout.get("a")!.target.multiplicity!, w("1..1")),
      box(layout.get("b")!.target.role!, w("performed_by")),
      box(layout.get("b")!.target.multiplicity!, w("1..1")),
    ]
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]
        const b = boxes[j]
        const overlap = a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1
        expect(overlap).toBe(false)
      }
    // Nothing on top of the class.
    for (const b of boxes) expect(b.y1).toBeLessThanOrEqual(0)
  })
})
