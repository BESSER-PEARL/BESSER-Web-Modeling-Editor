import { describe, expect, it } from "vitest"
import type { Edge, Node } from "@xyflow/react"
import { computeAutoLayout, getLayoutDirection } from "../../lib/utils/autoLayout"
import { UMLDiagramType } from "../../lib/types"

const node = (id: string, overrides: Partial<Node> = {}): Node => ({
  id,
  type: "class",
  position: { x: 0, y: 0 },
  data: { name: id },
  measured: { width: 200, height: 120 },
  ...overrides,
})

const edge = (id: string, source: string, target: string): Edge => ({ id, source, target })

describe("getLayoutDirection", () => {
  it("lays flow diagrams out left-to-right", () => {
    expect(getLayoutDirection(UMLDiagramType.StateMachineDiagram)).toBe("RIGHT")
    expect(getLayoutDirection(UMLDiagramType.AgentDiagram)).toBe("RIGHT")
    expect(getLayoutDirection(UMLDiagramType.NNDiagram)).toBe("RIGHT")
  })

  it("lays structural diagrams out top-down", () => {
    expect(getLayoutDirection(UMLDiagramType.ClassDiagram)).toBe("DOWN")
    expect(getLayoutDirection(UMLDiagramType.ObjectDiagram)).toBe("DOWN")
  })
})

describe("computeAutoLayout", () => {
  it("returns the same array for an empty diagram", async () => {
    const nodes: Node[] = []
    expect(await computeAutoLayout(nodes, [], UMLDiagramType.ClassDiagram)).toBe(nodes)
  })

  it("assigns distinct, non-overlapping positions to connected nodes", async () => {
    const nodes = [node("a"), node("b"), node("c")]
    const edges = [edge("e1", "a", "b"), edge("e2", "a", "c")]

    const layouted = await computeAutoLayout(nodes, edges, UMLDiagramType.ClassDiagram)

    expect(layouted).toHaveLength(3)
    const positions = layouted.map((n) => `${n.position.x},${n.position.y}`)
    expect(new Set(positions).size).toBe(3)
    // children below the root in a DOWN layout
    const a = layouted.find((n) => n.id === "a")!
    const b = layouted.find((n) => n.id === "b")!
    expect(b.position.y).toBeGreaterThan(a.position.y)
  })

  it("orders a state flow left-to-right in RIGHT layouts", async () => {
    const nodes = [node("start"), node("middle"), node("end")]
    const edges = [edge("t1", "start", "middle"), edge("t2", "middle", "end")]

    const layouted = await computeAutoLayout(nodes, edges, UMLDiagramType.StateMachineDiagram)

    const x = (id: string) => layouted.find((n) => n.id === id)!.position.x
    expect(x("middle")).toBeGreaterThan(x("start"))
    expect(x("end")).toBeGreaterThan(x("middle"))
  })

  it("keeps parentId children relative to their container and grows the container", async () => {
    const nodes = [
      node("container", { type: "NNContainer", measured: { width: 300, height: 200 } }),
      node("layer1", { parentId: "container", measured: { width: 120, height: 60 } }),
      node("layer2", { parentId: "container", measured: { width: 120, height: 60 } }),
    ]
    const edges = [edge("n1", "layer1", "layer2")]

    const layouted = await computeAutoLayout(nodes, edges, UMLDiagramType.NNDiagram)

    const layer1 = layouted.find((n) => n.id === "layer1")!
    const layer2 = layouted.find((n) => n.id === "layer2")!
    // relative coordinates inside the container stay positive
    expect(layer1.position.x).toBeGreaterThanOrEqual(0)
    expect(layer2.position.x).toBeGreaterThan(layer1.position.x)
    const container = layouted.find((n) => n.id === "container")!
    expect(container.width ?? 0).toBeGreaterThanOrEqual(120 * 2)
  })

  it("ignores edges whose endpoints are not nodes (edge-anchored ClassLinkRel)", async () => {
    const nodes = [node("a"), node("b")]
    const edges = [edge("assoc", "a", "b"), edge("linkrel", "assoc", "a")]

    const layouted = await computeAutoLayout(nodes, edges, UMLDiagramType.ClassDiagram)
    expect(layouted).toHaveLength(2)
  })

  it("preserves node data and ids", async () => {
    const nodes = [node("a", { data: { name: "A", attributes: [{ id: "x", name: "attr" }] } })]
    const layouted = await computeAutoLayout(nodes, [], UMLDiagramType.ClassDiagram)
    expect(layouted[0].id).toBe("a")
    expect(layouted[0].data).toEqual(nodes[0].data)
  })
})
