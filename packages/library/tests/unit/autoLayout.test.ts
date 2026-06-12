import { describe, expect, it } from "vitest"
import type { Edge, Node } from "@xyflow/react"
import { chooseFacingHandles, chooseFacingSides, computeAutoLayout, getLayoutDirection } from "../../lib/utils/autoLayout"
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
  it("returns the same arrays for an empty diagram", async () => {
    const nodes: Node[] = []
    const result = await computeAutoLayout(nodes, [], UMLDiagramType.ClassDiagram)
    expect(result.nodes).toBe(nodes)
  })

  it("assigns distinct, non-overlapping positions to connected nodes", async () => {
    const nodes = [node("a"), node("b"), node("c")]
    const edges = [edge("e1", "a", "b"), edge("e2", "a", "c")]

    const { nodes: layouted } = await computeAutoLayout(nodes, edges, UMLDiagramType.ClassDiagram)

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

    const { nodes: layouted } = await computeAutoLayout(nodes, edges, UMLDiagramType.StateMachineDiagram)

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

    const { nodes: layouted } = await computeAutoLayout(nodes, edges, UMLDiagramType.NNDiagram)

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

    const { nodes: layouted, edges: layoutedEdges } = await computeAutoLayout(
      nodes,
      edges,
      UMLDiagramType.ClassDiagram,
    )
    expect(layouted).toHaveLength(2)
    // the edge-anchored link keeps its original (no) handles
    const linkRel = layoutedEdges.find((e) => e.id === "linkrel")!
    expect(linkRel.sourceHandle ?? null).toBeNull()
  })

  it("preserves node data and ids", async () => {
    const nodes = [node("a", { data: { name: "A", attributes: [{ id: "x", name: "attr" }] } })]
    const { nodes: layouted } = await computeAutoLayout(nodes, [], UMLDiagramType.ClassDiagram)
    expect(layouted[0].id).toBe("a")
    expect(layouted[0].data).toEqual(nodes[0].data)
  })

  it("distributes multiple edges sharing a side across that side's handles", async () => {
    // One parent with three children below it: all three inheritance edges
    // land on the parent's bottom side and must not collapse onto one handle.
    const nodes = [node("parent"), node("c1"), node("c2"), node("c3")]
    const edges = [
      edge("e1", "c1", "parent"),
      edge("e2", "c2", "parent"),
      edge("e3", "c3", "parent"),
    ]

    const { edges: layoutedEdges } = await computeAutoLayout(
      nodes,
      edges,
      UMLDiagramType.ClassDiagram,
    )
    // The parent end of each edge (whichever end points at "parent").
    const parentHandles = layoutedEdges.map((e) =>
      e.source === "parent" ? e.sourceHandle : e.targetHandle,
    )
    const ALL_HANDLES = [
      "top-left", "top", "top-right",
      "bottom-left", "bottom", "bottom-right",
      "left-top", "left", "left-bottom",
      "right-top", "right", "right-bottom",
    ]
    // No collision: the three edges resolve to three distinct handles
    // (the anti-overlap goal), each a real connectable handle id.
    expect(new Set(parentHandles).size).toBe(3)
    parentHandles.forEach((h) => expect(ALL_HANDLES).toContain(h))
  })

  it("reassigns edge handles to the facing sides of a vertical layout", async () => {
    const nodes = [node("parent"), node("child")]
    // child inherits parent -> edge source=child, target=parent
    const edges = [edge("inh", "child", "parent")]

    const { nodes: layouted, edges: layoutedEdges } = await computeAutoLayout(
      nodes,
      edges,
      UMLDiagramType.ClassDiagram,
    )
    const child = layouted.find((n) => n.id === "child")!
    const parent = layouted.find((n) => n.id === "parent")!
    const e = layoutedEdges[0]
    // whichever ends up higher connects from its bottom to the other's top
    if (child.position.y < parent.position.y) {
      expect(e.sourceHandle).toBe("bottom")
      expect(e.targetHandle).toBe("top")
    } else {
      expect(e.sourceHandle).toBe("top")
      expect(e.targetHandle).toBe("bottom")
    }
  })
})

describe("chooseFacingHandles", () => {
  it("connects bottom→top when the source is above the target", () => {
    expect(chooseFacingHandles({ x: 0, y: 0 }, { x: 0, y: 200 })).toEqual({
      sourceHandle: "bottom",
      targetHandle: "top",
    })
  })

  it("connects top→bottom when the source is below the target", () => {
    expect(chooseFacingHandles({ x: 0, y: 200 }, { x: 0, y: 0 })).toEqual({
      sourceHandle: "top",
      targetHandle: "bottom",
    })
  })

  it("connects right→left when the source is left of the target", () => {
    expect(chooseFacingHandles({ x: 0, y: 0 }, { x: 200, y: 0 })).toEqual({
      sourceHandle: "right",
      targetHandle: "left",
    })
  })

  it("connects left→right when the source is right of the target", () => {
    expect(chooseFacingHandles({ x: 200, y: 0 }, { x: 0, y: 0 })).toEqual({
      sourceHandle: "left",
      targetHandle: "right",
    })
  })

  it("prefers the dominant axis on a diagonal", () => {
    // mostly-vertical separation -> vertical handles
    expect(chooseFacingHandles({ x: 0, y: 0 }, { x: 30, y: 200 })).toEqual({
      sourceHandle: "bottom",
      targetHandle: "top",
    })
  })
})

describe("chooseFacingSides", () => {
  it("returns side keys, not handle ids", () => {
    expect(chooseFacingSides({ x: 0, y: 0 }, { x: 0, y: 200 })).toEqual({
      sourceSide: "bottom",
      targetSide: "top",
    })
    expect(chooseFacingSides({ x: 0, y: 0 }, { x: 200, y: 0 })).toEqual({
      sourceSide: "right",
      targetSide: "left",
    })
  })
})
