import { describe, expect, it } from "vitest"
import { layoutModel } from "../../lib/utils/autoLayout"
import type { BesserEdge, BesserNode, UMLModel } from "../../lib/typings"
import { UMLDiagramType } from "../../lib/types"

const node = (id: string, overrides: Partial<BesserNode> = {}): BesserNode => ({
  id,
  type: "Class" as BesserNode["type"],
  position: { x: 0, y: 0 },
  width: 200,
  height: 120,
  measured: { width: 200, height: 120 },
  data: { name: id },
  ...overrides,
})

const edge = (
  id: string,
  source: string,
  target: string,
  data: Record<string, unknown> = {}
): BesserEdge => ({
  id,
  type: "ClassBidirectional" as BesserEdge["type"],
  source,
  target,
  sourceHandle: "top",
  targetHandle: "top",
  data: { points: [], ...data },
})

const model = (nodes: BesserNode[], edges: BesserEdge[]): UMLModel => ({
  version: "4.0.0",
  id: "m",
  title: "Layout",
  type: UMLDiagramType.ClassDiagram,
  nodes,
  edges,
  assessments: {},
})

const overlaps = (a: BesserNode, b: BesserNode): boolean =>
  a.position.x < b.position.x + b.width &&
  b.position.x < a.position.x + a.width &&
  a.position.y < b.position.y + b.height &&
  b.position.y < a.position.y + a.height

describe("layoutModel (headless)", () => {
  it("returns the same model for an empty diagram", async () => {
    const m = model([], [])
    expect(await layoutModel(m)).toBe(m)
  })

  it("assigns distinct, non-overlapping positions without a React Flow instance", async () => {
    const m = model(
      [node("a"), node("b"), node("c")],
      [edge("e1", "a", "b"), edge("e2", "a", "c")]
    )
    const out = await layoutModel(m)
    expect(out).not.toBe(m)
    expect(out.nodes).toHaveLength(3)
    const [a, b, c] = out.nodes
    expect(overlaps(a, b)).toBe(false)
    expect(overlaps(a, c)).toBe(false)
    expect(overlaps(b, c)).toBe(false)
    // Class diagrams flow top-down: children sit below their parent.
    expect(b.position.y).toBeGreaterThan(a.position.y)
    expect(c.position.y).toBeGreaterThan(a.position.y)
  })

  it("is pure — the input model and its arrays are untouched", async () => {
    const nodes = [node("a", { position: { x: 500, y: 500 } }), node("b", { position: { x: 500, y: 500 } })]
    const edges = [edge("e1", "a", "b", { points: [{ x: 1, y: 1 }] })]
    const m = model(nodes, edges)
    await layoutModel(m)
    expect(m.nodes).toBe(nodes)
    expect(m.edges).toBe(edges)
    expect(nodes[0].position).toEqual({ x: 500, y: 500 })
    expect(nodes[1].position).toEqual({ x: 500, y: 500 })
    expect(edges[0].data.points).toEqual([{ x: 1, y: 1 }])
  })

  it("recenters the result onto the model's current bounding-box centre", async () => {
    const m = model(
      [node("a", { position: { x: 1000, y: 1000 } }), node("b", { position: { x: 1000, y: 1400 } })],
      [edge("e1", "a", "b")]
    )
    const out = await layoutModel(m)
    const centre = (nodes: BesserNode[]) => {
      const xs = nodes.flatMap((n) => [n.position.x, n.position.x + n.width])
      const ys = nodes.flatMap((n) => [n.position.y, n.position.y + n.height])
      return {
        x: (Math.min(...xs) + Math.max(...xs)) / 2,
        y: (Math.min(...ys) + Math.max(...ys)) / 2,
      }
    }
    expect(centre(out.nodes).x).toBeCloseTo(centre(m.nodes).x, 5)
    expect(centre(out.nodes).y).toBeCloseTo(centre(m.nodes).y, 5)
  })

  it("reassigns handles to facing sides and clears stale manual waypoints", async () => {
    const m = model(
      [node("a"), node("b")],
      [edge("e1", "a", "b", { points: [{ x: 10, y: 10 }, { x: 20, y: 20 }], label: "keep" })]
    )
    const out = await layoutModel(m)
    const e = out.edges[0]
    expect(e.sourceHandle).toMatch(/^bottom/)
    expect(e.targetHandle).toMatch(/^top/)
    expect(e.data.points).toEqual([])
    expect(e.data.label).toBe("keep")
  })

  it("leaves edges with a dangling endpoint untouched", async () => {
    const dangling = edge("e2", "a", "ghost", { points: [{ x: 3, y: 3 }] })
    const m = model([node("a"), node("b")], [edge("e1", "a", "b"), dangling])
    const out = await layoutModel(m)
    expect(out.edges[1]).toBe(dangling)
  })

  it("keeps child positions relative to their parent container", async () => {
    const m = model(
      [
        node("container", { type: "NNContainer" as BesserNode["type"], width: 400, height: 300 }),
        node("child1", { parentId: "container", width: 100, height: 60 }),
        node("child2", { parentId: "container", width: 100, height: 60 }),
      ],
      [edge("e1", "child1", "child2")]
    )
    const out = await layoutModel({ ...m, type: UMLDiagramType.NNDiagram })
    const container = out.nodes.find((n) => n.id === "container")!
    const child1 = out.nodes.find((n) => n.id === "child1")!
    const child2 = out.nodes.find((n) => n.id === "child2")!
    expect(child1.parentId).toBe("container")
    expect(child2.parentId).toBe("container")
    expect(child1.position.x).toBeGreaterThanOrEqual(0)
    expect(child1.position.y).toBeGreaterThanOrEqual(0)
    expect(child1.position.x + child1.width).toBeLessThanOrEqual(container.width)
    expect(child2.position.x + child2.width).toBeLessThanOrEqual(container.width)
    expect(overlaps(child1, child2)).toBe(false)
  })
})
