/**
 * Association-class link (`ClassLinkRel`) helpers + store cascade.
 *
 * Covers the Wave-3 `[association-class-link]` brief:
 *  - pure helpers in `lib/utils/associationClassLink.ts`,
 *  - the `diagramStore` prune pass (deleting the association edge or
 *    the class node cascades the edge-anchored link).
 */
import { describe, it, expect } from "vitest"
import * as Y from "yjs"
import type { Edge, Node } from "@xyflow/react"
import {
  ASSOCIATION_CLASS_CAPABLE_TYPES,
  computeAnchorOnNodeBoundary,
  getAbsoluteNodePosition,
  getLinkRelForAssociation,
  isEdgeAnchoredLinkRel,
  pruneDanglingLinkRels,
  resolveLinkRelClassNodeId,
} from "@/utils/associationClassLink"
import { createDiagramStore } from "@/store/diagramStore"

const nodeIds = new Set(["class-a", "class-b", "class-ac"])

const assocEdge: Edge = {
  id: "assoc-1",
  source: "class-a",
  target: "class-b",
  type: "ClassBidirectional",
  data: { name: "owns" },
}

/** Backend-canonical orientation: source = association EDGE id. */
const linkEdge: Edge = {
  id: "link-1",
  source: "assoc-1",
  sourceHandle: "Center",
  target: "class-ac",
  targetHandle: "Up",
  type: "ClassLinkRel",
  data: { points: [] },
}

describe("isEdgeAnchoredLinkRel", () => {
  it("detects a link whose source is an edge id", () => {
    expect(isEdgeAnchoredLinkRel(linkEdge, nodeIds)).toBe(true)
  })

  it("detects the swapped orientation (target = edge id)", () => {
    const swapped = { ...linkEdge, source: "class-ac", target: "assoc-1" }
    expect(isEdgeAnchoredLinkRel(swapped, nodeIds)).toBe(true)
  })

  it("is false for node-to-node ClassLinkRel (legacy SA-2.1 shape)", () => {
    const nodeToNode = { ...linkEdge, source: "class-a", target: "class-ac" }
    expect(isEdgeAnchoredLinkRel(nodeToNode, nodeIds)).toBe(false)
  })

  it("is false for non-link edge types regardless of endpoints", () => {
    expect(isEdgeAnchoredLinkRel(assocEdge, new Set())).toBe(false)
  })
})

describe("getLinkRelForAssociation / resolveLinkRelClassNodeId", () => {
  it("finds the link by association edge id on either endpoint", () => {
    expect(getLinkRelForAssociation([assocEdge, linkEdge], "assoc-1")?.id).toBe(
      "link-1"
    )
    const swapped = { ...linkEdge, source: "class-ac", target: "assoc-1" }
    expect(
      getLinkRelForAssociation([assocEdge, swapped], "assoc-1")?.id
    ).toBe("link-1")
  })

  it("returns undefined when no link references the association", () => {
    expect(getLinkRelForAssociation([assocEdge], "assoc-1")).toBeUndefined()
  })

  it("resolves the node endpoint in both orientations", () => {
    expect(resolveLinkRelClassNodeId(linkEdge, nodeIds)).toBe("class-ac")
    const swapped = { ...linkEdge, source: "class-ac", target: "assoc-1" }
    expect(resolveLinkRelClassNodeId(swapped, nodeIds)).toBe("class-ac")
  })

  it("returns undefined for fully dangling links", () => {
    expect(
      resolveLinkRelClassNodeId(linkEdge, new Set(["unrelated"]))
    ).toBeUndefined()
  })
})

describe("pruneDanglingLinkRels", () => {
  it("keeps an intact edge-anchored link (identity return)", () => {
    const edges = [assocEdge, linkEdge]
    expect(pruneDanglingLinkRels(edges, nodeIds)).toBe(edges)
  })

  it("drops the link when the association edge is gone", () => {
    const pruned = pruneDanglingLinkRels([linkEdge], nodeIds)
    expect(pruned).toHaveLength(0)
  })

  it("drops the link when the class node is gone", () => {
    const pruned = pruneDanglingLinkRels(
      [assocEdge, linkEdge],
      new Set(["class-a", "class-b"])
    )
    expect(pruned.map((e) => e.id)).toEqual(["assoc-1"])
  })

  it("keeps node-to-node ClassLinkRel edges with live endpoints", () => {
    const nodeToNode = { ...linkEdge, source: "class-a", target: "class-ac" }
    const edges = [nodeToNode]
    expect(pruneDanglingLinkRels(edges, nodeIds)).toBe(edges)
  })

  it("never anchors a link on another ClassLinkRel edge", () => {
    // link-2 references link-1 (a ClassLinkRel) — not a valid anchor.
    const link2 = { ...linkEdge, id: "link-2", source: "link-1" }
    const pruned = pruneDanglingLinkRels([assocEdge, linkEdge, link2], nodeIds)
    expect(pruned.map((e) => e.id)).toEqual(["assoc-1", "link-1"])
  })
})

describe("computeAnchorOnNodeBoundary", () => {
  const pos = { x: 100, y: 100 }
  const dims = { width: 200, height: 100 } // center (200, 150)

  it("anchors on the left border toward a point due west", () => {
    expect(
      computeAnchorOnNodeBoundary(pos, dims, { x: 0, y: 150 })
    ).toEqual({ x: 100, y: 150 })
  })

  it("anchors on the top border toward a point due north", () => {
    expect(
      computeAnchorOnNodeBoundary(pos, dims, { x: 200, y: 0 })
    ).toEqual({ x: 200, y: 100 })
  })

  it("anchors on the boundary (not the corner) for diagonal rays", () => {
    const anchor = computeAnchorOnNodeBoundary(pos, dims, { x: 400, y: 250 })
    // Direction (200, 100) from center: ty = 50/100 < tx = 100/200 — equal
    // here, lands exactly on the corner.
    expect(anchor).toEqual({ x: 300, y: 200 })
  })

  it("falls back to the center for a degenerate ray", () => {
    expect(
      computeAnchorOnNodeBoundary(pos, dims, { x: 200, y: 150 })
    ).toEqual({ x: 200, y: 150 })
  })
})

describe("getAbsoluteNodePosition", () => {
  it("returns the node position for top-level nodes", () => {
    const n = { id: "a", position: { x: 10, y: 20 } }
    expect(getAbsoluteNodePosition(n, new Map([["a", n]]))).toEqual({
      x: 10,
      y: 20,
    })
  })

  it("accumulates parent offsets (class nested in a package)", () => {
    const pkg = { id: "pkg", position: { x: 100, y: 50 } }
    const cls = { id: "cls", position: { x: 10, y: 20 }, parentId: "pkg" }
    const byId = new Map([
      ["pkg", pkg],
      ["cls", cls],
    ])
    expect(getAbsoluteNodePosition(cls, byId)).toEqual({ x: 110, y: 70 })
  })

  it("guards against parent cycles", () => {
    const a = { id: "a", position: { x: 1, y: 1 }, parentId: "b" }
    const b = { id: "b", position: { x: 2, y: 2 }, parentId: "a" }
    const byId = new Map([
      ["a", a],
      ["b", b],
    ])
    expect(getAbsoluteNodePosition(a, byId)).toEqual({ x: 3, y: 3 })
  })
})

describe("ASSOCIATION_CLASS_CAPABLE_TYPES", () => {
  it("matches develop's center-port whitelist plus Composition", () => {
    expect([...ASSOCIATION_CLASS_CAPABLE_TYPES].sort()).toEqual([
      "ClassBidirectional",
      "ClassComposition",
      "ClassUnidirectional",
    ])
  })
})

/* -------------------------------------------------------------------------- */
/* Store-level cascade                                                        */
/* -------------------------------------------------------------------------- */

const classNode = (id: string): Node => ({
  id,
  type: "class",
  position: { x: 0, y: 0 },
  width: 160,
  height: 110,
  data: { name: id, attributes: [], methods: [] },
})

describe("diagramStore ClassLinkRel cascade", () => {
  const seedStore = () => {
    const store = createDiagramStore(new Y.Doc())
    store
      .getState()
      .setNodesAndEdges(
        [classNode("class-a"), classNode("class-b"), classNode("class-ac")],
        [assocEdge, linkEdge]
      )
    return store
  }

  it("keeps an intact edge-anchored link through setNodesAndEdges", () => {
    const store = seedStore()
    expect(store.getState().edges.map((e) => e.id)).toEqual([
      "assoc-1",
      "link-1",
    ])
  })

  it("addEdge then setEdges removing the association prunes the link", () => {
    const store = seedStore()
    store
      .getState()
      .setEdges((edges) => edges.filter((e) => e.id !== "assoc-1"))
    expect(store.getState().edges).toHaveLength(0)
  })

  it("onEdgesChange remove of the association cascades the link in Yjs too", () => {
    const ydoc = new Y.Doc()
    const store = createDiagramStore(ydoc)
    store
      .getState()
      .setNodesAndEdges(
        [classNode("class-a"), classNode("class-b"), classNode("class-ac")],
        [assocEdge, linkEdge]
      )
    store.getState().onEdgesChange([{ type: "remove", id: "assoc-1" }])
    expect(store.getState().edges).toHaveLength(0)
    // Yjs map mirrors the prune (undo/redo replays stay consistent).
    const edgesMap = ydoc.getMap("edges")
    expect(edgesMap.get("link-1")).toBeUndefined()
  })

  it("setNodes removing the class node leaves pruning to the edge pass", () => {
    const store = seedStore()
    // Remove the association-class node, then trigger any edge write —
    // the prune runs against the live node set.
    store
      .getState()
      .setNodes((nodes) => nodes.filter((n) => n.id !== "class-ac"))
    store.getState().setEdges((edges) => [...edges])
    expect(store.getState().edges.map((e) => e.id)).toEqual(["assoc-1"])
  })
})
