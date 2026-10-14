/**
 * Redo must survive the remount of the nodes it re-adds.
 *
 * Regression: in Object and User diagrams, drop A, drop B, connect A→B,
 * undo twice, redo once -- B came back but the redo stack was empty, so the
 * A→B edge was lost for good. Re-adding B remounts its component, whose
 * content-sizing effect (`width <= minWidth`, true at equality) rebuilt
 * `measured` as `{ width }`, dropping `measured.height`. That turned an
 * idempotent clamp into a real, tracked Yjs write, and a Y.UndoManager drops
 * its whole redo stack on any new tracked change.
 *
 * Class carried the same effect; it only escaped in the editor because the
 * palette drops classes wider than their content. A class that sits exactly
 * at its content width (grown by the effect, as here) hit the same bug.
 */
import { describe, it, expect, afterEach } from "vitest"
import { act, cleanup, render } from "@testing-library/react"
import * as Y from "yjs"
import { ReactFlowProvider, type Edge, type Node } from "@xyflow/react"
import type { StoreApi } from "zustand"
import { useStore } from "zustand"
import type { ComponentType } from "react"
import {
  AssessmentSelectionStoreContext,
  DiagramStoreContext,
  MetadataStoreContext,
  PopoverStoreContext,
} from "@/store/context"
import { createAssessmentSelectionStore } from "@/store/assessmentSelectionStore"
import { createDiagramStore, DiagramStore } from "@/store/diagramStore"
import { createMetadataStore } from "@/store/metadataStore"
import { createPopoverStore } from "@/store/popoverStore"
import { getEdgesMap, getNodesMap } from "@/sync/ydoc"
import { ObjectName } from "@/nodes/objectDiagram/ObjectName"
import { UserModelName } from "@/nodes/userDiagram/UserModelName"
import { Class } from "@/nodes/classDiagram/Class"
import { applyNodeSize } from "@/utils/nodeSizing"

afterEach(cleanup)

const ICON_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg'><rect width='4' height='4'/></svg>"

const NODE_COMPONENTS: Record<string, ComponentType<never>> = {
  ObjectName: ObjectName as ComponentType<never>,
  UserModelName: UserModelName as ComponentType<never>,
  class: Class as ComponentType<never>,
}

/** Renders every store node with its real component, like the canvas does. */
const Canvas = ({ store }: { store: StoreApi<DiagramStore> }) => {
  const nodes = useStore(store, (state) => state.nodes)
  return (
    <>
      {nodes.map((node) => {
        const Component = NODE_COMPONENTS[node.type!]
        return (
          <Component
            key={node.id}
            {...({
              id: node.id,
              width: node.width,
              height: node.height,
              data: node.data,
            } as never)}
          />
        )
      })}
    </>
  )
}

const setup = () => {
  const ydoc = new Y.Doc()
  const store = createDiagramStore(ydoc) as StoreApi<DiagramStore>
  store.getState().initializeUndoManager()
  // What YjsSyncClass does for the UndoManager's own transactions.
  ydoc.on("afterTransaction", (tr: Y.Transaction) => {
    if (tr.origin === store.getState().undoManager) {
      store.getState().updateNodesFromYjs()
      store.getState().updateEdgesFromYjs()
    }
  })
  render(
    <DiagramStoreContext.Provider value={store}>
      <MetadataStoreContext.Provider value={createMetadataStore(ydoc)}>
        <PopoverStoreContext.Provider value={createPopoverStore()}>
          <AssessmentSelectionStoreContext.Provider
            value={createAssessmentSelectionStore()}
          >
            <ReactFlowProvider>
              <Canvas store={store} />
            </ReactFlowProvider>
          </AssessmentSelectionStoreContext.Provider>
        </PopoverStoreContext.Provider>
      </MetadataStoreContext.Provider>
    </DiagramStoreContext.Provider>
  )
  const undoManager = store.getState().undoManager!
  return { ydoc, store, undoManager }
}

/**
 * Lets mount effects run, then emulates React Flow's measurement pass: a
 * `dimensions` change carrying the rendered size of every node whose
 * `measured` is stale (no-op for nodes that are already measured).
 */
const settle = (store: StoreApi<DiagramStore>) => {
  act(() => {})
  act(() => {
    const changes = store
      .getState()
      .nodes.filter(
        (node) =>
          node.measured?.width !== node.width ||
          node.measured?.height !== node.height
      )
      .map((node) => ({
        id: node.id,
        type: "dimensions" as const,
        dimensions: { width: node.width!, height: node.height! },
      }))
    if (changes.length > 0) store.getState().onNodesChange(changes)
  })
  act(() => {})
}

type NodeFactory = (id: string, x: number) => Node

// Dropped narrower than the content so the grow effect runs on drop and
// settles the node at exactly `minWidth` -- the `width === minWidth` state
// the old `<=` effect kept re-writing on every mount.
const objectNode: NodeFactory = (id, x) => ({
  id,
  type: "ObjectName",
  position: { x, y: 0 },
  width: 10,
  height: 70,
  data: {
    name: "Object",
    attributes: [{ id: `${id}-a`, name: "attribute", value: "value" }],
    methods: [],
  },
})

const userNode: NodeFactory = (id, x) => ({
  id,
  type: "UserModelName",
  position: { x, y: 0 },
  width: 10,
  height: 100,
  data: {
    name: `personal_Information_${id}`,
    className: "Personal_Information",
    icon: ICON_SVG,
    attributes: [],
    methods: [],
  },
})

const classNode: NodeFactory = (id, x) => ({
  id,
  type: "class",
  position: { x, y: 0 },
  width: 10,
  height: 100,
  data: { name: "Class", attributes: [], methods: [] },
})

const edge = (source: string, target: string): Edge => ({
  id: `${source}-${target}`,
  source,
  target,
  type: "ObjectLink",
  data: { points: [] },
})

describe.each([
  ["ObjectName", objectNode],
  ["UserModelName", userNode],
  ["Class", classNode],
])("%s: add, add, connect, undo, undo, redo, redo", (_label, makeNode) => {
  it("replays every step and keeps the edge", () => {
    const { ydoc, store, undoManager } = setup()

    act(() => store.getState().addNode(makeNode("A", 0)))
    settle(store)
    undoManager.stopCapturing()
    act(() => store.getState().addNode(makeNode("B", 400)))
    settle(store)
    undoManager.stopCapturing()
    act(() => store.getState().addEdge(edge("A", "B")))
    settle(store)
    undoManager.stopCapturing()

    // The drop grew the node to its content width (sanity: the mount-time
    // effect did run and the node now sits exactly at its minimum).
    const settledA = store.getState().nodes.find((n) => n.id === "A")!
    expect(settledA.width).toBeGreaterThan(10)
    expect(settledA.measured).toEqual({
      width: settledA.width,
      height: settledA.height,
    })
    expect(undoManager.undoStack.length).toBe(3)

    act(() => store.getState().undo())
    settle(store)
    expect(getEdgesMap(ydoc).size).toBe(0)
    act(() => store.getState().undo())
    settle(store)
    expect(Array.from(getNodesMap(ydoc).keys())).toEqual(["A"])
    expect(undoManager.redoStack.length).toBe(2)

    // Redo re-adds B, which remounts and re-runs its sizing effects.
    act(() => store.getState().redo())
    settle(store)
    expect(store.getState().nodes.map((n) => n.id).sort()).toEqual(["A", "B"])
    expect(undoManager.redoStack.length).toBe(1)
    expect(store.getState().canRedo).toBe(true)

    act(() => store.getState().redo())
    settle(store)
    expect(getEdgesMap(ydoc).has("A-B")).toBe(true)
    expect(store.getState().edges.map((e) => e.id)).toEqual(["A-B"])
    expect(store.getState().canRedo).toBe(false)
    // B is restored with the size it had before the undo.
    expect(getNodesMap(ydoc).get("B")).toEqual(
      expect.objectContaining({
        width: settledA.width,
        measured: settledA.measured,
      })
    )
  })
})

describe("mount-time measurement writes and the redo stack", () => {
  const twoNodes = () => {
    const ydoc = new Y.Doc()
    const store = createDiagramStore(ydoc)
    store.getState().initializeUndoManager()
    const undoManager = store.getState().undoManager!
    const sized = (id: string): Node => ({
      id,
      type: "class",
      position: { x: 0, y: 0 },
      width: 160,
      height: 70,
      measured: { width: 160, height: 70 },
      data: { name: id },
    })
    store.getState().addNode(sized("A"))
    undoManager.stopCapturing()
    store.getState().addNode(sized("B"))
    undoManager.stopCapturing()
    store.getState().undo()
    store.getState().updateNodesFromYjs()
    expect(undoManager.redoStack.length).toBe(1)
    return { store, undoManager }
  }

  it("a size clamp to the current size is a no-op and keeps redo", () => {
    const { store, undoManager } = twoNodes()
    const before = store.getState().nodes
    store
      .getState()
      .setNodes((prev) => applyNodeSize(prev, "A", { width: 160 }))
    store
      .getState()
      .setNodes((prev) => applyNodeSize(prev, "A", { height: 70 }))
    expect(store.getState().nodes).toBe(before)
    expect(undoManager.redoStack.length).toBe(1)
    expect(store.getState().canRedo).toBe(true)
  })

  it("a structurally equal node list is a no-op and keeps redo", () => {
    const { store, undoManager } = twoNodes()
    store.getState().setNodes((prev) =>
      prev.map((node) => ({ ...node, measured: { ...node.measured } }))
    )
    expect(undoManager.redoStack.length).toBe(1)
  })

  it("a real size change is still a tracked, undoable edit", () => {
    const { store, undoManager } = twoNodes()
    store
      .getState()
      .setNodes((prev) => applyNodeSize(prev, "A", { width: 240 }))
    // Genuine edits still branch history (standard undo semantics) ...
    expect(undoManager.redoStack.length).toBe(0)
    undoManager.stopCapturing()
    // ... and can be undone.
    store.getState().undo()
    store.getState().updateNodesFromYjs()
    expect(store.getState().nodes[0]).toMatchObject({
      width: 160,
      measured: { width: 160, height: 70 },
    })
  })
})

describe("applyNodeSize", () => {
  const node: Node = {
    id: "n",
    position: { x: 0, y: 0 },
    width: 100,
    height: 50,
    measured: { width: 100, height: 50 },
    data: {},
  }

  it("returns the same array when the size is already applied", () => {
    const nodes = [node]
    expect(applyNodeSize(nodes, "n", { width: 100 })).toBe(nodes)
    expect(applyNodeSize(nodes, "n", { height: 50 })).toBe(nodes)
    expect(applyNodeSize(nodes, "n", { width: 100, height: 50 })).toBe(nodes)
    expect(applyNodeSize(nodes, "missing", { width: 1 })).toBe(nodes)
  })

  it("keeps the other axis of `measured`", () => {
    expect(applyNodeSize([node], "n", { width: 140 })[0]).toMatchObject({
      width: 140,
      height: 50,
      measured: { width: 140, height: 50 },
    })
    expect(applyNodeSize([node], "n", { height: 80 })[0]).toMatchObject({
      width: 100,
      height: 80,
      measured: { width: 100, height: 80 },
    })
  })

  it("fills in a stale `measured` even when width/height already match", () => {
    const unmeasured = { ...node, measured: undefined }
    expect(applyNodeSize([unmeasured], "n", { width: 100 })[0].measured).toEqual({
      width: 100,
    })
  })
})
