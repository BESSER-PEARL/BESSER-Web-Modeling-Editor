import { describe, it, expect, vi, afterEach } from "vitest"
import { render, act } from "@testing-library/react"
import * as Y from "yjs"
import { ReactFlowProvider, type Node, type NodeChange } from "@xyflow/react"
import { createDiagramStore } from "@/store/diagramStore"
import { getNodesMap, getEdgesMap } from "@/sync/ydoc"
import { createAlignmentGuidesStore } from "@/store/alignmentGuidesStore"
import { AlignmentGuidesStoreContext } from "@/store/context"
import {
  AlignmentGuides,
  GUIDE_LINE_SLOTS,
} from "@/components/AlignmentGuides"

/**
 * Upstream Apollon #763 (82942cdd + follow-ups on main): with an
 * UndoManager present, transient drag/resize frames are never written to
 * Yjs -- only the settle frame -- and runtime interaction flags
 * (`selected` / `dragging` / `resizing`) never reach the shared doc.
 */

const makeNode = (id: string, over: Partial<Node> = {}): Node => ({
  id,
  type: "class",
  position: { x: 0, y: 0 },
  width: 100,
  height: 60,
  data: { name: id },
  ...over,
})

function spyMapOps<T>(map: Y.Map<T>) {
  const counts = { set: 0, delete: 0 }
  const origSet = map.set.bind(map)
  const origDelete = map.delete.bind(map)
  map.set = ((k: string, v: T) => {
    counts.set++
    return origSet(k, v)
  }) as typeof map.set
  map.delete = ((k: string) => {
    counts.delete++
    return origDelete(k)
  }) as typeof map.delete
  return counts
}

const setup = (withUndo = true, nodes: Node[] = [makeNode("a")]) => {
  const doc = new Y.Doc()
  const store = createDiagramStore(doc)
  store.getState().setNodes(nodes)
  if (withUndo) store.getState().initializeUndoManager()
  return { doc, store }
}

const dragFrame = (id: string, x: number, dragging: boolean): NodeChange => ({
  id,
  type: "position",
  position: { x, y: x },
  dragging,
})

afterEach(() => {
  vi.useRealTimers()
})

describe("transient drag frames (UndoManager present)", () => {
  it("writes nothing to Yjs mid-drag and commits the settle frame", () => {
    const { doc, store } = setup()
    const counts = spyMapOps(getNodesMap(doc))

    for (let x = 1; x <= 20; x++) {
      store.getState().onNodesChange([dragFrame("a", x, true)])
    }
    // The local store follows the pointer (drag stays smooth) ...
    expect(store.getState().nodes[0].position).toEqual({ x: 20, y: 20 })
    // ... but no per-frame struct was written to the doc.
    expect(counts.set).toBe(0)
    expect(getNodesMap(doc).get("a")?.position).toEqual({ x: 0, y: 0 })

    store.getState().onNodesChange([dragFrame("a", 21, false)])
    expect(getNodesMap(doc).get("a")?.position).toEqual({ x: 21, y: 21 })
    expect(counts.set).toBe(1)
    doc.destroy()
  })

  it("records exactly one undo step per drag, even with a mid-drag pause", () => {
    // Fake the clock the UndoManager reads (Date.now) so a >captureTimeout
    // pause happens mid-gesture: per-frame writes used to split such a drag
    // into several undo steps.
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 1, 12, 0, 0))
    const { doc, store } = setup()

    store.getState().onNodesChange([dragFrame("a", 5, true)])
    vi.advanceTimersByTime(2000)
    store.getState().onNodesChange([dragFrame("a", 10, true)])
    vi.advanceTimersByTime(2000)
    store.getState().onNodesChange([dragFrame("a", 15, false)])
    // BESSER's onNodeDragStop re-sets the node list right after the settle
    // frame (reparenting / parent resize) -- must not add a second step.
    store.getState().setNodes((nodes) => nodes.map((n) => ({ ...n })))

    const undoManager = store.getState().undoManager!
    expect(undoManager.undoStack.length).toBe(1)

    store.getState().undo()
    expect(getNodesMap(doc).get("a")?.position).toEqual({ x: 0, y: 0 })
    // (YjsSyncClass does this on the undo transaction in the editor.)
    store.getState().updateNodesFromYjs()
    expect(store.getState().nodes[0].position).toEqual({ x: 0, y: 0 })
    doc.destroy()
  })

  it("defers edge route writes made during a drag and undoes them with the move", () => {
    // A dragged BPMN pool carries its children, and useStepPathEdge shifts the
    // stored route points of the edges between them on every frame.
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 1, 12, 0, 0))
    const { doc, store } = setup(true, [makeNode("a"), makeNode("b")])
    const route = (dx: number) => [
      { x: 100 + dx, y: 30 + dx },
      { x: 150 + dx, y: 30 + dx },
    ]
    store.getState().setEdges([
      { id: "e", source: "a", target: "b", type: "ClassBidirectional", data: { points: route(0) } },
    ])
    const undoManager = store.getState().undoManager!
    undoManager.clear()
    const edgeCounts = spyMapOps(getEdgesMap(doc))
    const shiftRoute = (dx: number) =>
      store.getState().setEdges((edges) =>
        edges.map((e) => ({ ...e, data: { ...e.data, points: route(dx) } }))
      )

    store.getState().onNodesChange([dragFrame("a", 5, true)])
    shiftRoute(5)
    vi.advanceTimersByTime(2000)
    store.getState().onNodesChange([dragFrame("a", 10, true)])
    shiftRoute(10)
    // Local state follows the drag, the shared doc does not.
    expect(store.getState().edges[0].data?.points).toEqual(route(10))
    expect(edgeCounts.set).toBe(0)
    expect(getEdgesMap(doc).get("e")?.data?.points).toEqual(route(0))

    vi.advanceTimersByTime(2000)
    store.getState().onNodesChange([dragFrame("a", 10, false)])
    expect(getEdgesMap(doc).get("e")?.data?.points).toEqual(route(10))
    expect(undoManager.undoStack.length).toBe(1)

    store.getState().undo()
    expect(getNodesMap(doc).get("a")?.position).toEqual({ x: 0, y: 0 })
    expect(getEdgesMap(doc).get("e")?.data?.points).toEqual(route(0))
    doc.destroy()
  })

  it("keeps per-frame writes when there is no UndoManager (collaboration)", () => {
    const { doc, store } = setup(false)
    const counts = spyMapOps(getNodesMap(doc))
    store.getState().onNodesChange([dragFrame("a", 3, true)])
    store.getState().onNodesChange([dragFrame("a", 4, true)])
    expect(counts.set).toBe(2)
    expect(getNodesMap(doc).get("a")?.position).toEqual({ x: 4, y: 4 })
    // ... but the live flag itself is still not persisted.
    expect(getNodesMap(doc).get("a")?.dragging).toBeUndefined()
    doc.destroy()
  })

  it("treats keyboard nudges (dragging: false) as committed edits", () => {
    const { doc, store } = setup()
    store.getState().onNodesChange([dragFrame("a", 7, false)])
    expect(getNodesMap(doc).get("a")?.position).toEqual({ x: 7, y: 7 })
    doc.destroy()
  })
})

describe("transient resize frames (UndoManager present)", () => {
  it("defers resize frames incl. top-left position + auto-grown parent, then settles in one step", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 1, 12, 0, 0))
    const parent = makeNode("p", { width: 300, height: 300 })
    const child = makeNode("c", {
      parentId: "p",
      position: { x: 10, y: 10 },
    })
    const { doc, store } = setup(true, [parent, child])
    const counts = spyMapOps(getNodesMap(doc))

    // A top-left-handle resize frame as React Flow emits it.
    store.getState().onNodesChange([
      { id: "c", type: "position", position: { x: 5, y: 5 } },
      {
        id: "c",
        type: "dimensions",
        resizing: true,
        setAttributes: true,
        dimensions: { width: 120, height: 80 },
      },
    ])
    vi.advanceTimersByTime(1000)
    // useHandleOnResize grows the parent via updateNode -> `replace`.
    store.getState().onNodesChange([
      {
        id: "p",
        type: "replace",
        item: { ...store.getState().nodes[0], width: 400 },
      },
    ])
    expect(counts.set).toBe(0)

    vi.advanceTimersByTime(1000)
    store
      .getState()
      .onNodesChange([{ id: "c", type: "dimensions", resizing: false }])

    const persistedChild = getNodesMap(doc).get("c")!
    expect(persistedChild.position).toEqual({ x: 5, y: 5 })
    expect(persistedChild.width).toBe(120)
    expect(persistedChild.resizing).toBeUndefined()
    expect(getNodesMap(doc).get("p")?.width).toBe(400)
    expect(store.getState().undoManager!.undoStack.length).toBe(1)
    doc.destroy()
  })
})

describe("runtime flags are never persisted", () => {
  it("selecting a node produces zero Yjs writes", () => {
    const { doc, store } = setup(true, [makeNode("a"), makeNode("b")])
    const counts = spyMapOps(getNodesMap(doc))
    store.getState().onNodesChange([{ id: "a", type: "select", selected: true }])
    store
      .getState()
      .setNodes((nodes) =>
        nodes.map((n) => (n.id === "b" ? { ...n, selected: true } : n))
      )
    expect(counts.set + counts.delete).toBe(0)
    expect(store.getState().undoManager!.undoStack.length).toBe(0)
    doc.destroy()
  })

  it("strips selected from edges and re-overlays it on read", () => {
    const { doc, store } = setup(true, [makeNode("a"), makeNode("b")])
    store.getState().setEdges([
      { id: "e", source: "a", target: "b", selected: true, data: {} },
    ])
    expect(getEdgesMap(doc).get("e")?.selected).toBeUndefined()
    // A remote write re-reads the edge from Yjs; the local selection sticks.
    doc.transact(() => {
      getEdgesMap(doc).set("e", {
        ...getEdgesMap(doc).get("e")!,
        data: { name: "x" },
      })
    }, "remote")
    store.getState().updateEdgesFromYjs()
    expect(store.getState().edges[0].selected).toBe(true)
    doc.destroy()
  })

  it("keeps the local live dragging flag when a remote update lands mid-drag", () => {
    const { doc, store } = setup(false)
    store.getState().onNodesChange([dragFrame("a", 3, true)])
    store.getState().updateNodesFromYjs()
    expect(store.getState().nodes[0].dragging).toBe(true)
    doc.destroy()
  })
})

describe("AlignmentGuides line pool", () => {
  it("keeps a fixed set of <line> slots mounted across guide clear / show", () => {
    const guidesStore = createAlignmentGuidesStore()
    const { container } = render(
      <ReactFlowProvider>
        <AlignmentGuidesStoreContext.Provider value={guidesStore}>
          <AlignmentGuides />
        </AlignmentGuidesStoreContext.Provider>
      </ReactFlowProvider>
    )
    const lines = () => Array.from(container.querySelectorAll("line"))
    expect(lines()).toHaveLength(GUIDE_LINE_SLOTS)
    const first = lines()[0]
    expect(first.style.display).toBe("none")

    act(() => {
      guidesStore.getState().setGuides([
        { id: "g1", type: "vertical", position: 40 },
        { id: "g2", type: "horizontal", position: 25 },
      ])
    })
    expect(lines()).toHaveLength(GUIDE_LINE_SLOTS)
    // Same DOM node reused in place -- never detached.
    expect(lines()[0]).toBe(first)
    expect(first.getAttribute("x1")).toBe("40")
    expect(first.classList.contains("alignment-guide-vertical")).toBe(true)
    expect(lines()[1].getAttribute("y1")).toBe("25")

    act(() => guidesStore.getState().clearGuides())
    expect(lines()).toHaveLength(GUIDE_LINE_SLOTS)
    expect(lines()[0]).toBe(first)
  })
})
