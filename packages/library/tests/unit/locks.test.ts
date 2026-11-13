import { describe, expect, it } from "vitest"
import * as Y from "yjs"
import type { Edge, Node } from "@xyflow/react"
import { createDiagramStore } from "@/store/diagramStore"
import { createMetadataStore } from "@/store/metadataStore"
import { getDiagramLock, getNodesMap } from "@/sync/ydoc"
import { YjsSyncClass } from "@/sync/yjsSyncClass"
import { isLocked } from "@/utils/locks"

/**
 * Element and diagram locks (#283): the diagram store refuses every edit of
 * locked content while unlocked neighbours stay editable.
 */

const node = (id: string, over: Partial<Node> = {}): Node => ({
  id,
  type: "class",
  position: { x: 0, y: 0 },
  width: 100,
  height: 60,
  data: { name: id },
  ...over,
})

const edge = (id: string, source: string, target: string, over: Partial<Edge> = {}): Edge => ({
  id,
  type: "ClassBidirectional",
  source,
  target,
  data: { name: id, points: [] },
  ...over,
})

const locked = <T extends Node | Edge>(element: T): T => ({ ...element, locked: true })

const setup = (nodes: Node[], edges: Edge[] = [], withUndo = false) => {
  const doc = new Y.Doc()
  const store = createDiagramStore(doc)
  store.getState().loadNodesAndEdges(nodes, edges)
  if (withUndo) {
    store.getState().initializeUndoManager()
    // Refreshes the store after an undo / redo transaction.
    new YjsSyncClass(doc, store, createMetadataStore(doc))
  }
  return { doc, store }
}

const byId = (nodes: Node[], id: string) => nodes.find((n) => n.id === id)!
const rename = (n: Node, name: string): Node => ({ ...n, data: { ...n.data, name } })

describe("locked node", () => {
  it("is not moved by a drag or a nudge; its unlocked neighbour is", () => {
    const { store } = setup([locked(node("A")), node("B")])
    store.getState().onNodesChange([
      { id: "A", type: "position", position: { x: 50, y: 50 }, dragging: true },
      { id: "B", type: "position", position: { x: 50, y: 50 }, dragging: true },
    ])
    store.getState().onNodesChange([
      { id: "A", type: "position", position: { x: 50, y: 50 }, dragging: false },
      { id: "B", type: "position", position: { x: 50, y: 50 }, dragging: false },
    ])
    const { nodes } = store.getState()
    expect(byId(nodes, "A").position).toEqual({ x: 0, y: 0 })
    expect(byId(nodes, "B").position).toEqual({ x: 50, y: 50 })

    // Arrow-key nudge writes positions through setNodes.
    store.getState().setNodes((all) =>
      all.map((n) => ({ ...n, position: { x: n.position.x + 10, y: n.position.y } }))
    )
    expect(byId(store.getState().nodes, "A").position).toEqual({ x: 0, y: 0 })
    expect(byId(store.getState().nodes, "B").position).toEqual({ x: 60, y: 50 })
  })

  it("is not resized, but React Flow still measures it", () => {
    const { store } = setup([locked(node("A"))])
    store.getState().onNodesChange([
      {
        id: "A",
        type: "dimensions",
        dimensions: { width: 300, height: 200 },
        resizing: true,
        setAttributes: true,
      },
    ])
    expect(byId(store.getState().nodes, "A").width).toBe(100)

    store.getState().onNodesChange([
      { id: "A", type: "dimensions", dimensions: { width: 104, height: 62 } },
    ])
    expect(byId(store.getState().nodes, "A").measured).toEqual({ width: 104, height: 62 })
  })

  it("keeps its name and contents; the unlocked neighbour is renamed", () => {
    const { store } = setup([locked(node("A")), node("B")])
    store.getState().setNodes((all) => all.map((n) => rename(n, `${n.id}2`)))
    expect(byId(store.getState().nodes, "A").data.name).toBe("A")
    expect(byId(store.getState().nodes, "B").data.name).toBe("B2")

    // React Flow's updateNodeData arrives as a replace change.
    store.getState().onNodesChange([
      { id: "A", type: "replace", item: rename(locked(node("A")), "A3") },
    ])
    expect(byId(store.getState().nodes, "A").data.name).toBe("A")
  })

  it("is not deleted, through setNodes, setNodesAndEdges or a remove change", () => {
    const { store } = setup([locked(node("A")), node("B")], [edge("e", "A", "B")])
    store.getState().setNodes([])
    expect(store.getState().nodes.map((n) => n.id)).toEqual(["A"])

    store.getState().setNodesAndEdges([], [])
    expect(store.getState().nodes.map((n) => n.id)).toEqual(["A"])

    store.getState().onNodesChange([{ id: "A", type: "remove" }])
    expect(store.getState().nodes.map((n) => n.id)).toEqual(["A"])
  })

  it("keeps its container: a container holding locked content is not deleted", () => {
    const { store } = setup([
      node("pkg", { type: "package" }),
      locked(node("A", { parentId: "pkg" })),
      node("C"),
    ])
    store.getState().setNodes([])
    expect(store.getState().nodes.map((n) => n.id).sort()).toEqual(["A", "pkg"])
  })

  it("can be unlocked, and the lock flag alone is a valid edit", () => {
    const { store } = setup([locked(node("A"))])
    store.getState().setElementLocked("A", false)
    const a = byId(store.getState().nodes, "A")
    expect(isLocked(a)).toBe(false)
    expect("locked" in a).toBe(false)
    store.getState().setNodes((all) => all.map((n) => rename(n, "A2")))
    expect(byId(store.getState().nodes, "A").data.name).toBe("A2")
  })
})

describe("locked container", () => {
  const tree = () => [
    locked(node("pool", { type: "BPMNPool" })),
    node("lane", { type: "BPMNLane", parentId: "pool" }),
    node("task", { type: "BPMNTask", parentId: "lane", position: { x: 20, y: 20 } }),
    node("outside", { type: "BPMNTask", position: { x: 500, y: 0 } }),
  ]

  it("pins the position, size and parent of everything inside it", () => {
    const { store } = setup(tree())
    store.getState().onNodesChange([
      { id: "task", type: "position", position: { x: 90, y: 90 }, dragging: false },
      { id: "outside", type: "position", position: { x: 600, y: 0 }, dragging: false },
    ])
    store.getState().setNodes((all) =>
      all.map((n) => (n.id === "task" ? { ...n, parentId: undefined, width: 400 } : n))
    )
    const task = byId(store.getState().nodes, "task")
    expect(task.position).toEqual({ x: 20, y: 20 })
    expect(task.parentId).toBe("lane")
    expect(task.width).toBe(100)
    expect(byId(store.getState().nodes, "outside").position).toEqual({ x: 600, y: 0 })
  })

  it("keeps its content but lets that content be renamed", () => {
    const { store } = setup(tree())
    store.getState().setNodes((all) =>
      all.filter((n) => n.id !== "task").map((n) => (n.id === "lane" ? rename(n, "Sales") : n))
    )
    expect(byId(store.getState().nodes, "task")).toBeDefined()
    expect(byId(store.getState().nodes, "lane").data.name).toBe("Sales")
  })
})

describe("locked edge", () => {
  const graph = () => setup([node("A"), node("B"), node("C")], [locked(edge("e", "A", "B")), edge("f", "B", "C")])

  it("keeps its ends and labels; its route may follow the nodes", () => {
    const { store } = graph()
    store.getState().setEdges((all) =>
      all.map((e) => ({
        ...e,
        target: "C",
        data: { ...e.data, name: `${e.id}2`, points: [{ x: 1, y: 2 }] },
      }))
    )
    const [e, f] = ["e", "f"].map((id) => store.getState().edges.find((x) => x.id === id)!)
    expect(e.target).toBe("B")
    expect(e.data?.name).toBe("e")
    expect(f.data?.name).toBe("f2")

    store.getState().setEdges((all) =>
      all.map((x) => (x.id === "e" ? { ...x, data: { ...x.data, points: [{ x: 5, y: 5 }] } } : x))
    )
    expect(store.getState().edges.find((x) => x.id === "e")?.data?.points).toEqual([{ x: 5, y: 5 }])
  })

  it("is not deleted, nor are its end nodes", () => {
    const { store } = graph()
    store.getState().onEdgesChange([
      { id: "e", type: "remove" },
      { id: "f", type: "remove" },
    ])
    expect(store.getState().edges.map((x) => x.id)).toEqual(["e"])

    store.getState().setNodes((all) => all.filter((n) => n.id === "C"))
    expect(store.getState().nodes.map((n) => n.id).sort()).toEqual(["A", "B", "C"])

    // A new edge may still be attached to a locked edge's end.
    store.getState().addEdge(edge("g", "A", "C"))
    expect(store.getState().edges.map((x) => x.id)).toContain("g")
  })
})

describe("locked diagram", () => {
  it("accepts selection and measurement only", () => {
    const { store } = setup([node("A")], [])
    store.getState().setDiagramLocked(true)

    store.getState().setNodes((all) => [...all.map((n) => rename(n, "A2")), node("B")])
    store.getState().addNode(node("C"))
    store.getState().addEdge(edge("e", "A", "A"))
    store.getState().onNodesChange([
      { id: "A", type: "position", position: { x: 9, y: 9 }, dragging: false },
      { type: "add", item: node("D") },
      { id: "A", type: "remove" },
    ])
    store.getState().setNodesAndEdges([], [])
    const { nodes, edges } = store.getState()
    expect(nodes.map((n) => n.id)).toEqual(["A"])
    expect(nodes[0].data.name).toBe("A")
    expect(nodes[0].position).toEqual({ x: 0, y: 0 })
    expect(edges).toEqual([])

    store.getState().setNodes((all) => all.map((n) => ({ ...n, selected: true })))
    expect(store.getState().nodes[0].selected).toBe(true)
    store.getState().onNodesChange([
      { id: "A", type: "dimensions", dimensions: { width: 120, height: 70 } },
    ])
    expect(store.getState().nodes[0].measured).toEqual({ width: 120, height: 70 })
  })

  it("blocks element lock toggles until unlocked", () => {
    const { store } = setup([node("A")])
    store.getState().setDiagramLocked(true)
    store.getState().setElementLocked("A", true)
    expect(isLocked(store.getState().nodes[0])).toBe(false)
    store.getState().setDiagramLocked(false)
    store.getState().setElementLocked("A", true)
    expect(isLocked(store.getState().nodes[0])).toBe(true)
  })

  it("does not guard model loads", () => {
    const { store } = setup([locked(node("A"))])
    store.getState().setDiagramLocked(true)
    store.getState().loadNodesAndEdges([node("B")], [])
    expect(store.getState().nodes.map((n) => n.id)).toEqual(["B"])
  })
})

describe("lock undo / redo", () => {
  it("undoes an element lock as its own step, apart from the edit before it", () => {
    const { store } = setup([node("A")], [], true)
    store.getState().setNodes((all) => all.map((n) => rename(n, "A2")))
    store.getState().setElementLocked("A", true)

    store.getState().undo()
    let a = byId(store.getState().nodes, "A")
    expect(isLocked(a)).toBe(false)
    expect(a.data.name).toBe("A2")

    store.getState().redo()
    a = byId(store.getState().nodes, "A")
    expect(isLocked(a)).toBe(true)
  })

  it("undoes and redoes the diagram lock", () => {
    const { store } = setup([node("A")], [], true)
    store.getState().setNodes((all) => all.map((n) => rename(n, "A2")))
    store.getState().setDiagramLocked(true)

    store.getState().undo()
    expect(store.getState().diagramLocked).toBe(false)
    expect(store.getState().nodes[0].data.name).toBe("A2")
    store.getState().redo()
    expect(store.getState().diagramLocked).toBe(true)
  })
})

describe("lock collaboration sync", () => {
  it("reaches a peer document", () => {
    const docA = new Y.Doc()
    const a = createDiagramStore(docA)
    new YjsSyncClass(docA, a, createMetadataStore(docA))
    const docB = new Y.Doc()
    const b = createDiagramStore(docB)
    new YjsSyncClass(docB, b, createMetadataStore(docB))

    a.getState().setNodes([node("A")])
    a.getState().setElementLocked("A", true)
    a.getState().setDiagramLocked(true)
    Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA), "remote")

    expect(isLocked(b.getState().nodes[0])).toBe(true)
    expect(b.getState().diagramLocked).toBe(true)
    expect(getDiagramLock(docB).get("locked")).toBe(true)
    // The flag is stored on the node in the shared map.
    expect((getNodesMap(docB).get("A") as Node & { locked?: boolean }).locked).toBe(true)
  })
})
