import { afterEach, describe, expect, it, vi } from "vitest"
import { act } from "@testing-library/react"
import type { Node } from "@xyflow/react"
import * as Y from "yjs"
import { BesserEditor } from "@/besser-editor"
import { createDiagramStore, MAX_UNDO_STEPS } from "@/store/diagramStore"
import { getNodesMap } from "@/sync/ydoc"
import { UMLDiagramType } from "@/types"
import type { UMLModel } from "@/typings"

// Store-level API: skip mounting the React Flow canvas.
vi.mock("@/App", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/App")>()),
  AppWithProvider: () => null,
}))

type Internals = BesserEditor & {
  diagramStore: {
    getState: () => {
      nodes: Node[]
      undoManager: Y.UndoManager | null
      setNodes: (fn: (nodes: Node[]) => Node[]) => void
    }
  }
}

let editor: BesserEditor | null = null
afterEach(() => {
  act(() => editor?.destroy())
  editor = null
})

const mount = () => {
  const el = document.createElement("div")
  document.body.appendChild(el)
  act(() => {
    editor = new BesserEditor(el, { type: UMLDiagramType.ClassDiagram })
  })
  return editor as Internals
}

const classNode = (id: string, x = 0, y = 0): Node => ({
  id,
  type: "class",
  position: { x, y },
  width: 200,
  height: 100,
  data: { name: id, attributes: [], methods: [] },
})

const modelOf = (...ids: string[]): UMLModel =>
  ({
    version: "4.0.0",
    id: "m",
    title: "Model",
    type: UMLDiagramType.ClassDiagram,
    nodes: ids.map((id, i) => classNode(id, i * 300)),
    edges: [],
    assessments: {},
  }) as unknown as UMLModel

const ids = (e: BesserEditor) => e.model.nodes.map((n) => n.id).sort()

describe("BesserEditor.applyModel", () => {
  // The assistant / scaffold / user-profile form replaced the model through
  // the `model` setter, which wipes the undo history: Ctrl+Z could neither
  // undo the change nor anything the user did before it.
  it("applies the model as one undo step and keeps the earlier history", () => {
    const e = mount()
    act(() => {
      e.model = modelOf("A")
    })
    const um = e.diagramStore.getState().undoManager!
    act(() => {
      e.diagramStore.getState().setNodes((nodes) => [...nodes, classNode("B", 300)])
    })
    um.stopCapturing()
    act(() => e.applyModel(modelOf("A", "B", "C", "D")))

    expect(ids(e)).toEqual(["A", "B", "C", "D"])
    expect(um.undoStack).toHaveLength(2)

    act(() => e.undo())
    expect(ids(e)).toEqual(["A", "B"])
    act(() => e.undo())
    expect(ids(e)).toEqual(["A"])
    act(() => e.redo())
    act(() => e.redo())
    expect(ids(e)).toEqual(["A", "B", "C", "D"])
  })

  it("does not merge with an edit made right before it", () => {
    const e = mount()
    act(() => {
      e.model = modelOf("A")
    })
    // No stopCapturing between the user edit and the apply: still two steps.
    act(() => {
      e.diagramStore.getState().setNodes((nodes) => [...nodes, classNode("B", 300)])
      e.applyModel(modelOf("X"))
    })
    act(() => e.undo())
    expect(ids(e)).toEqual(["A", "B"])
  })

  it("the model setter still starts a fresh history (loads)", () => {
    const e = mount()
    act(() => e.applyModel(modelOf("A")))
    act(() => {
      e.model = modelOf("Z")
    })
    expect(e.diagramStore.getState().undoManager!.undoStack).toHaveLength(0)
  })
})

describe("undo history cap", () => {
  const editNTimes = (n: number) => {
    const ydoc = new Y.Doc()
    const store = createDiagramStore(ydoc)
    store.getState().initializeUndoManager()
    const um = store.getState().undoManager!
    store.getState().setNodes([classNode("A")])
    for (let i = 1; i <= n; i++) {
      um.stopCapturing()
      // One gesture: the node moves (its Y.Map entry is replaced).
      store.getState().setNodes([classNode("A", i * 10, i * 10)])
    }
    return { ydoc, store, um }
  }

  it(`keeps at most ${MAX_UNDO_STEPS} undo steps`, () => {
    const { um } = editNTimes(MAX_UNDO_STEPS + 100)
    expect(um.undoStack).toHaveLength(MAX_UNDO_STEPS)
  })

  // Every step pinned the replaced node in the Y.Doc, so memory grew with
  // each gesture for the whole session.
  it("document size stops growing once the cap is reached", () => {
    const size = (n: number) => Y.encodeStateAsUpdate(editNTimes(n).ydoc).length
    const atCap = size(MAX_UNDO_STEPS + 50)
    const farBeyond = size(MAX_UNDO_STEPS * 4)
    // Only GC tombstones (a few bytes each) are left of the dropped steps.
    expect(farBeyond).toBeLessThan(atCap * 1.25)
  })

  it("the oldest steps are dropped, the newest still undo", () => {
    const { ydoc, um } = editNTimes(MAX_UNDO_STEPS + 10)
    const position = () => (getNodesMap(ydoc).get("A") as Node).position
    um.undo()
    expect(position()).toEqual({
      x: (MAX_UNDO_STEPS + 9) * 10,
      y: (MAX_UNDO_STEPS + 9) * 10,
    })
    while (um.canUndo()) um.undo()
    // The first 10 moves are no longer undoable.
    expect(position()).toEqual({ x: 100, y: 100 })
  })
})
