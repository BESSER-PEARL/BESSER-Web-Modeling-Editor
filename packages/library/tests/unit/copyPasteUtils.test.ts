import { describe, it, expect, vi } from "vitest"
import {
  calculateRelativePosition,
  getAllDescendants,
  getAllNodesToInclude,
  getRelevantEdges,
  buildParentChildRelations,
  getEdgesToRemove,
  createClipboardData,
  createNewNodeDataWithNewIds,
  materializeClipboardData,
} from "@/utils/copyPasteUtils"
import type { Node, Edge } from "@xyflow/react"

// Mock generateUUID to return predictable values
vi.mock("@/utils", () => {
  let counter = 0
  return {
    generateUUID: () => `uuid-${++counter}`,
  }
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNode(id: string, x = 0, y = 0, parentId?: string): Node {
  return { id, position: { x, y }, data: {}, parentId } as Node
}

function makeEdge(id: string, source: string, target: string): Edge {
  return { id, source, target, data: {} } as Edge
}

// ---------------------------------------------------------------------------
// calculateRelativePosition
// ---------------------------------------------------------------------------

describe("calculateRelativePosition", () => {
  it("returns the difference between child and parent positions", () => {
    const child = makeNode("c", 150, 200)
    const parent = makeNode("p", 100, 50)
    expect(calculateRelativePosition(child, parent)).toEqual({
      x: 50,
      y: 150,
    })
  })

  it("returns negative values when child is above/left of parent", () => {
    const child = makeNode("c", 10, 10)
    const parent = makeNode("p", 100, 100)
    expect(calculateRelativePosition(child, parent)).toEqual({
      x: -90,
      y: -90,
    })
  })

  it("returns zero when same position", () => {
    const child = makeNode("c", 50, 50)
    const parent = makeNode("p", 50, 50)
    expect(calculateRelativePosition(child, parent)).toEqual({ x: 0, y: 0 })
  })
})

// ---------------------------------------------------------------------------
// getAllDescendants
// ---------------------------------------------------------------------------

describe("getAllDescendants", () => {
  it("returns empty array when no children exist", () => {
    const nodes = [makeNode("a"), makeNode("b")]
    expect(getAllDescendants(["a"], nodes)).toEqual([])
  })

  it("finds direct children", () => {
    const nodes = [
      makeNode("p"),
      makeNode("c1", 0, 0, "p"),
      makeNode("c2", 0, 0, "p"),
    ]
    const descendants = getAllDescendants(["p"], nodes)
    expect(descendants).toHaveLength(2)
    expect(descendants.map((n) => n.id).sort()).toEqual(["c1", "c2"])
  })

  it("finds grandchildren recursively", () => {
    const nodes = [
      makeNode("p"),
      makeNode("c", 0, 0, "p"),
      makeNode("gc", 0, 0, "c"),
    ]
    const descendants = getAllDescendants(["p"], nodes)
    expect(descendants).toHaveLength(2)
    expect(descendants.map((n) => n.id)).toContain("gc")
  })

  it("returns empty for empty nodeIds", () => {
    const nodes = [makeNode("a")]
    expect(getAllDescendants([], nodes)).toEqual([])
  })

  it("handles multiple starting nodeIds", () => {
    const nodes = [
      makeNode("p1"),
      makeNode("p2"),
      makeNode("c1", 0, 0, "p1"),
      makeNode("c2", 0, 0, "p2"),
    ]
    const descendants = getAllDescendants(["p1", "p2"], nodes)
    expect(descendants).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// getAllNodesToInclude
// ---------------------------------------------------------------------------

describe("getAllNodesToInclude", () => {
  it("includes selected nodes and their descendants", () => {
    const nodes = [makeNode("p"), makeNode("c", 0, 0, "p"), makeNode("other")]
    const result = getAllNodesToInclude(["p"], nodes)
    expect(result.map((n) => n.id).sort()).toEqual(["c", "p"])
  })

  it("returns only selected nodes when no descendants exist", () => {
    const nodes = [makeNode("a"), makeNode("b")]
    const result = getAllNodesToInclude(["a"], nodes)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe("a")
  })

  it("returns empty for empty selectedIds", () => {
    const nodes = [makeNode("a")]
    expect(getAllNodesToInclude([], nodes)).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// getRelevantEdges
// ---------------------------------------------------------------------------

describe("getRelevantEdges", () => {
  it("returns edges matching selectedElementIds", () => {
    const edges = [makeEdge("e1", "a", "b"), makeEdge("e2", "c", "d")]
    const result = getRelevantEdges(["e1"], edges)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe("e1")
  })

  it("returns empty array when no edges match", () => {
    const edges = [makeEdge("e1", "a", "b")]
    expect(getRelevantEdges(["nope"], edges)).toEqual([])
  })

  it("returns empty array for empty selectedElementIds", () => {
    const edges = [makeEdge("e1", "a", "b")]
    expect(getRelevantEdges([], edges)).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// buildParentChildRelations
// ---------------------------------------------------------------------------

describe("buildParentChildRelations", () => {
  it("builds relations for child nodes whose parentId is in nodeIds", () => {
    const parent = makeNode("p", 10, 20)
    const child = makeNode("c", 30, 50, "p")
    const result = buildParentChildRelations([parent, child], ["p", "c"])
    expect(result).toEqual([
      {
        parentId: "p",
        childId: "c",
        relativePosition: { x: 20, y: 30 },
      },
    ])
  })

  it("skips nodes whose parentId is not in nodeIds", () => {
    const child = makeNode("c", 0, 0, "external")
    const result = buildParentChildRelations([child], ["c"])
    expect(result).toEqual([])
  })

  it("returns empty for nodes with no parents", () => {
    const a = makeNode("a")
    const b = makeNode("b")
    expect(buildParentChildRelations([a, b], ["a", "b"])).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// getEdgesToRemove
// ---------------------------------------------------------------------------

describe("getEdgesToRemove", () => {
  it("includes directly selected edges", () => {
    const edges = [makeEdge("e1", "a", "b"), makeEdge("e2", "c", "d")]
    const result = getEdgesToRemove(["e1"], [], edges)
    expect(result.has("e1")).toBe(true)
    expect(result.has("e2")).toBe(false)
  })

  it("includes edges connected to expanded nodes", () => {
    const edges = [makeEdge("e1", "a", "b"), makeEdge("e2", "c", "d")]
    const result = getEdgesToRemove([], ["a"], edges)
    expect(result.has("e1")).toBe(true)
    expect(result.has("e2")).toBe(false)
  })

  it("includes edges where expanded node is target", () => {
    const edges = [makeEdge("e1", "x", "y")]
    const result = getEdgesToRemove([], ["y"], edges)
    expect(result.has("e1")).toBe(true)
  })

  it("deduplicates when an edge is both selected and connected", () => {
    const edges = [makeEdge("e1", "a", "b")]
    const result = getEdgesToRemove(["e1"], ["a"], edges)
    expect(result.size).toBe(1)
  })

  it("returns empty set when nothing matches", () => {
    const edges = [makeEdge("e1", "a", "b")]
    const result = getEdgesToRemove([], [], edges)
    expect(result.size).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// createClipboardData
// ---------------------------------------------------------------------------

describe("createClipboardData", () => {
  it("creates clipboard data with nodes, edges, and relations", () => {
    const nodes = [makeNode("p", 0, 0), makeNode("c", 10, 10, "p")]
    const edges = [makeEdge("e1", "p", "c")]
    const result = createClipboardData(["p", "e1"], nodes, edges)

    expect(result.nodes).toHaveLength(2) // p + descendant c
    expect(result.edges).toHaveLength(1)
    expect(result.parentChildRelations!.length).toBeGreaterThanOrEqual(1)
    expect(result.timestamp).toBeGreaterThan(0)
  })

  it("creates clipboard with empty selections", () => {
    const result = createClipboardData([], [], [])
    expect(result.nodes).toEqual([])
    expect(result.edges).toEqual([])
    expect(result.parentChildRelations).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// createNewNodeDataWithNewIds
// ---------------------------------------------------------------------------

describe("createNewNodeDataWithNewIds", () => {
  it("returns null/undefined as-is", () => {
    expect(createNewNodeDataWithNewIds(null)).toBeNull()
    expect(createNewNodeDataWithNewIds(undefined)).toBeUndefined()
  })

  it("generates new UUIDs for attributes", () => {
    const data = {
      name: "MyClass",
      attributes: [
        { id: "old-1", name: "attr1" },
        { id: "old-2", name: "attr2" },
      ],
    }
    const result = createNewNodeDataWithNewIds(data)
    expect(result.attributes).toHaveLength(2)
    expect(result.attributes[0].id).not.toBe("old-1")
    expect(result.attributes[0].name).toBe("attr1")
    expect(result.attributes[1].id).not.toBe("old-2")
  })

  it("generates new UUIDs for methods", () => {
    const data = {
      methods: [{ id: "old-m", name: "doStuff" }],
    }
    const result = createNewNodeDataWithNewIds(data)
    expect(result.methods[0].id).not.toBe("old-m")
    expect(result.methods[0].name).toBe("doStuff")
  })

  it("generates new UUIDs for actionRows", () => {
    const data = {
      actionRows: [{ id: "old-ar", name: "step" }],
    }
    const result = createNewNodeDataWithNewIds(data)
    expect(result.actionRows[0].id).not.toBe("old-ar")
    expect(result.actionRows[0].name).toBe("step")
  })

  it("preserves data without sub-elements unchanged", () => {
    const data = { name: "Simple", value: 42 }
    const result = createNewNodeDataWithNewIds(data)
    expect(result.name).toBe("Simple")
    expect(result.value).toBe(42)
  })

  it("does not modify the original data object", () => {
    const data = {
      attributes: [{ id: "original", name: "a" }],
    }
    createNewNodeDataWithNewIds(data)
    expect(data.attributes[0].id).toBe("original")
  })
})

// ---------------------------------------------------------------------------
// Upstream Apollon #817 / #826 ports
// ---------------------------------------------------------------------------

describe("getRelevantEdges between individually selected nodes (#817)", () => {
  it("carries edges between two copied nodes even when the edge is not selected", () => {
    const edges = [
      makeEdge("assoc", "a", "b"),
      makeEdge("outside", "a", "z"),
    ]
    const result = getRelevantEdges(["a", "b"], edges, ["a", "b"])
    expect(result.map((e) => e.id)).toEqual(["assoc"])
  })

  it("createClipboardData keeps the association between two clicked classes", () => {
    const nodes = [makeNode("a"), makeNode("b"), makeNode("z")]
    const edges = [makeEdge("assoc", "a", "b"), makeEdge("az", "a", "z")]
    const result = createClipboardData(["a", "b"], nodes, edges)
    expect(result.edges.map((e) => e.id)).toEqual(["assoc"])
  })

  it("carries an edge-anchored association-class link with its association", () => {
    const edges = [
      makeEdge("assoc", "a", "b"),
      {
        ...makeEdge("link", "assoc", "ac"),
        type: "ClassLinkRel",
      } as Edge,
      { ...makeEdge("dangling", "other-edge", "ac"), type: "ClassLinkRel" },
    ] as Edge[]
    const result = getRelevantEdges(["a", "b", "ac"], edges, ["a", "b", "ac"])
    expect(result.map((e) => e.id).sort()).toEqual(["assoc", "link"])
  })
})

describe("remintNestedChildIds (#826)", () => {
  it("re-mints every id-bearing list, including nested and BESSER-only ones", () => {
    const data = {
      name: "C",
      attributes: [{ id: "at1", name: "a" }],
      methods: [
        {
          id: "m1",
          name: "run",
          parameters: [{ id: "p1", name: "x" }],
        },
      ],
      oclConstraints: [
        { id: "o1", name: "pre", expression: "x > 0", targetMethodId: "m1" },
      ],
      bodies: [{ id: "b1", name: "reply" }],
      fallbackBodies: [{ id: "f1", name: "sorry" }],
      training_phrases: [{ id: "t1", name: "hi" }],
      entity_slots: [{ id: "s1", name: "slot" }],
      actionRows: [{ id: "r1", identifier: "N" }],
      return_vars: ["out"],
    }
    const idMap = new Map<string, string>()
    const result = createNewNodeDataWithNewIds(data, idMap)

    const oldIds = ["at1", "m1", "p1", "o1", "b1", "f1", "t1", "s1", "r1"]
    const newIds = [
      result.attributes[0].id,
      result.methods[0].id,
      result.methods[0].parameters[0].id,
      result.oclConstraints[0].id,
      result.bodies[0].id,
      result.fallbackBodies[0].id,
      result.training_phrases[0].id,
      result.entity_slots[0].id,
      result.actionRows[0].id,
    ]
    newIds.forEach((id, i) => expect(id).not.toBe(oldIds[i]))
    expect(new Set(newIds).size).toBe(newIds.length)
    oldIds.forEach((id) => expect(idMap.has(id)).toBe(true))
    // A pre/post OCL row follows its re-minted target method.
    expect(result.oclConstraints[0].targetMethodId).toBe(result.methods[0].id)
    // Non-id lists and scalar fields pass through.
    expect(result.return_vars).toEqual(["out"])
    expect(result.methods[0].parameters[0].name).toBe("x")
  })

  it("leaves the NN layer attributes dict alone and never mutates the input", () => {
    const data = {
      attributes: { "pooling.dimension": "2D" },
      methods: [{ id: "m", name: "f", parameters: [{ id: "p", name: "q" }] }],
    }
    const snapshot = structuredClone(data)
    const result = createNewNodeDataWithNewIds(data)
    expect(result.attributes).toEqual({ "pooling.dimension": "2D" })
    expect(data).toEqual(snapshot)
  })
})

describe("materializeClipboardData", () => {
  it("offsets only top-level nodes: children inside a copied parent keep their relative position", () => {
    const parent = makeNode("pool", 100, 100)
    const lane = { ...makeNode("lane", 0, 0, "pool"), draggable: false }
    const task = makeNode("task", 40, 30, "lane")
    const clip = createClipboardData(["pool"], [parent, lane, task], [])
    const result = materializeClipboardData(clip, 2)

    const byOld = (old: string) =>
      result.nodes[clip.nodes.findIndex((n) => n.id === old)]
    // 2 pastes deep -> 2 x PASTE_OFFSET_PX on the top-level node only.
    expect(byOld("pool").position).toEqual({ x: 140, y: 140 })
    expect(byOld("lane").position).toEqual({ x: 0, y: 0 })
    expect(byOld("task").position).toEqual({ x: 40, y: 30 })
    expect(byOld("lane").parentId).toBe(byOld("pool").id)
    expect(byOld("task").parentId).toBe(byOld("lane").id)
    expect(byOld("lane").draggable).toBe(false)
  })

  it("offsets a lone child whose parent was not copied (it stays in the old parent)", () => {
    const child = makeNode("c", 10, 10, "external")
    const result = materializeClipboardData({ nodes: [child], edges: [] }, 1)
    expect(result.nodes[0].position).toEqual({ x: 30, y: 30 })
    expect(result.nodes[0].parentId).toBe("external")
  })

  it("remaps edge endpoints (incl. edge-anchored links), re-mints message ids and offsets points", () => {
    const nodes = [makeNode("a"), makeNode("b"), makeNode("ac")]
    const edges = [
      {
        ...makeEdge("assoc", "a", "b"),
        data: {
          points: [{ x: 1, y: 2 }],
          messages: [{ id: "msg", name: "call()" }],
        },
      },
      { ...makeEdge("link", "assoc", "ac"), type: "ClassLinkRel" },
    ] as Edge[]
    const clip = createClipboardData(["a", "b", "ac"], nodes, edges)
    const result = materializeClipboardData(clip, 1)
    const [assoc, link] = result.edges
    const newIds = new Map(clip.nodes.map((n, i) => [n.id, result.nodes[i].id]))

    expect(assoc.source).toBe(newIds.get("a"))
    expect(assoc.target).toBe(newIds.get("b"))
    expect((assoc.data as any).points).toEqual([{ x: 21, y: 22 }])
    expect((assoc.data as any).messages[0].id).not.toBe("msg")
    expect(link.source).toBe(assoc.id)
    expect(link.target).toBe(newIds.get("ac"))
    expect(result.newElementIds).toEqual(
      expect.arrayContaining([assoc.id, link.id, ...newIds.values()])
    )
  })

  it("remaps a node-level entryLayerId and cross-node targetMethodId", () => {
    const container = {
      ...makeNode("nn", 0, 0),
      data: { entryLayerId: "layer" },
    } as Node
    const layer = makeNode("layer", 5, 5, "nn")
    const cls = {
      ...makeNode("cls"),
      data: { methods: [{ id: "m1", name: "f" }] },
    } as Node
    const ocl = {
      ...makeNode("ocl"),
      data: { expression: "pre: true", targetMethodId: "m1" },
    } as Node
    const result = materializeClipboardData(
      { nodes: [container, layer, cls, ocl], edges: [] },
      1
    )
    expect((result.nodes[0].data as any).entryLayerId).toBe(result.nodes[1].id)
    expect((result.nodes[3].data as any).targetMethodId).toBe(
      (result.nodes[2].data as any).methods[0].id
    )
  })
})
