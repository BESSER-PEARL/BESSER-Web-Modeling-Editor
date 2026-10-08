import { afterEach, describe, expect, it, vi } from "vitest"
import { act } from "@testing-library/react"
import type { Edge, Node, ReactFlowInstance } from "@xyflow/react"
import * as Y from "yjs"
import { BesserEditor } from "@/besser-editor"
import { fitViewToModel, LOADED_MODEL_MIN_ZOOM } from "@/App"
import { UMLDiagramType } from "@/types"
import type { UMLModel } from "@/typings"

// Store-level API: skip mounting the React Flow canvas but keep the real
// viewport helpers exported next to it.
vi.mock("@/App", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/App")>()),
  AppWithProvider: () => null,
}))

type Internals = BesserEditor & {
  diagramStore: {
    getState: () => {
      nodes: Node[]
      undoManager: Y.UndoManager | null
      onNodesChange: (changes: unknown[]) => void
      setEdges: (fn: (edges: Edge[]) => Edge[]) => void
      setNodes: (fn: (nodes: Node[]) => Node[]) => void
    }
  }
  setReactFlowInstance: (instance: ReactFlowInstance) => void
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

const classNode = (id: string, x: number, y: number) => ({
  id,
  type: "class",
  position: { x, y },
  width: 200,
  height: 100,
  data: { name: id, attributes: [], methods: [] },
})

const template = (): UMLModel =>
  ({
    version: "4.0.0",
    id: "tpl",
    title: "Template",
    type: UMLDiagramType.ClassDiagram,
    nodes: [classNode("A", 0, 0), classNode("B", 400, 0)],
    edges: [
      {
        id: "AB",
        source: "A",
        target: "B",
        type: "ClassUnidirectional",
        data: { points: [] },
      },
    ],
    assessments: {},
  }) as unknown as UMLModel

const frames = async (n: number) => {
  for (let i = 0; i < n; i++) {
    await new Promise((resolve) => requestAnimationFrame(resolve))
  }
}

/** Minimal React Flow instance whose nodes all count as measured. */
const fakeInstance = (
  getNodes: () => Node[],
  viewport = { x: 100, y: 200, zoom: 1 }
) =>
  ({
    getNodes,
    getNode: (id: string) => getNodes().find((n) => n.id === id),
    getInternalNode: (id: string) => {
      const node = getNodes().find((n) => n.id === id)
      return node && { ...node, measured: { width: 200, height: 100 } }
    },
    getNodesBounds: () => ({ x: 0, y: 0, width: 600, height: 100 }),
    getViewport: () => viewport,
    fitView: vi.fn(async () => true),
    setViewport: vi.fn(async () => true),
  }) as unknown as ReactFlowInstance & {
    fitView: ReturnType<typeof vi.fn>
    setViewport: ReturnType<typeof vi.fn>
  }

describe("BesserEditor model load", () => {
  // Live repro: load a template, Ctrl+Z twice -> empty canvas. The undo
  // history was cleared BEFORE the write, so the write was the undo step.
  it("leaves an empty undo history after `editor.model = ...`", () => {
    const e = mount()
    act(() => {
      e.model = template()
    })
    const { undoManager } = e.diagramStore.getState()
    expect(undoManager).not.toBeNull()
    expect(undoManager!.undoStack).toHaveLength(0)

    act(() => {
      e.undo()
      e.undo()
    })
    expect(e.model.nodes.map((n) => n.id).sort()).toEqual(["A", "B"])
  })

  // Live repro: after a load, a click on the empty canvas left one undo step
  // (the deselect stamped `dragging: false` on every edge and persisted it).
  it("records no undo step for the pane-click deselect", () => {
    const e = mount()
    act(() => {
      e.model = template()
    })
    act(() =>
      e.diagramStore
        .getState()
        .setEdges((edges) =>
          edges.map((edge) => ({ ...edge, selected: false, dragging: false }))
        )
    )
    expect(e.diagramStore.getState().undoManager!.undoStack).toHaveLength(0)
  })

  // Undo used to rebuild every node object, so React Flow re-rendered the
  // whole diagram for a one-node change.
  it("keeps untouched node objects when undoing", () => {
    const e = mount()
    act(() => {
      e.model = template()
    })
    const store = e.diagramStore
    act(() =>
      store
        .getState()
        .setNodes((nodes) =>
          nodes.map((n) =>
            n.id === "A" ? { ...n, position: { x: 80, y: 40 } } : n
          )
        )
    )
    const before = store.getState().nodes
    act(() => e.undo())
    const after = store.getState().nodes
    const byId = (nodes: Node[], id: string) => nodes.find((n) => n.id === id)
    expect(byId(after, "A")!.position).toEqual({ x: 0, y: 0 })
    expect(byId(after, "B")).toBe(byId(before, "B"))
  })

  it("drops the undo step of React Flow's first measurement and fits the view", async () => {
    const e = mount()
    const instance = fakeInstance(() => e.diagramStore.getState().nodes)
    act(() => e.setReactFlowInstance(instance))
    await frames(3)

    act(() => {
      e.model = template()
    })
    // React Flow measures the new nodes and the store persists `measured`.
    act(() =>
      e.diagramStore.getState().onNodesChange([
        { id: "A", type: "dimensions", dimensions: { width: 210, height: 90 } },
      ])
    )
    expect(e.diagramStore.getState().undoManager!.undoStack.length).toBe(1)

    await frames(4)
    expect(e.diagramStore.getState().undoManager!.undoStack).toHaveLength(0)
    expect(instance.fitView).toHaveBeenCalledWith(
      expect.objectContaining({ minZoom: 1, maxZoom: 1 })
    )
  })

  it("fitView delegates to React Flow and resolves false before mount", async () => {
    const e = mount()
    await expect(e.fitView()).resolves.toBe(false)
    const instance = fakeInstance(() => e.diagramStore.getState().nodes)
    act(() => e.setReactFlowInstance(instance))
    await e.fitView({ padding: 0.1, duration: 300, maxZoom: 1 })
    expect(instance.fitView).toHaveBeenCalledWith({
      padding: 0.1,
      duration: 300,
      maxZoom: 1,
    })
  })

  it("fitToElements fits only known nodes and is a no-op for none", async () => {
    const e = mount()
    act(() => {
      e.model = template()
    })
    const instance = fakeInstance(() => e.diagramStore.getState().nodes)
    act(() => e.setReactFlowInstance(instance))
    await frames(3)

    e.fitToElements(["missing"])
    expect(instance.fitView).not.toHaveBeenCalled()

    e.fitToElements(["B", "missing"])
    expect(instance.fitView).toHaveBeenCalledWith({
      nodes: [{ id: "B" }],
      duration: 300,
      padding: 0.4,
      maxZoom: 1,
    })
  })
})

describe("BesserEditor viewport during a model load", () => {
  // The agent simulation sets a new model per step and then scrolls to the
  // active state; the load's own fit must not override that afterwards.
  it("a fitToElements call made right after `model =` replaces the load fit", async () => {
    const e = mount()
    const instance = fakeInstance(() => e.diagramStore.getState().nodes)
    act(() => e.setReactFlowInstance(instance))
    await frames(3)

    act(() => {
      e.model = template()
    })
    e.fitToElements(["B"])
    expect(instance.fitView).not.toHaveBeenCalled()

    await frames(4)
    expect(instance.fitView).toHaveBeenCalledTimes(1)
    expect(instance.fitView).toHaveBeenCalledWith(
      expect.objectContaining({ nodes: [{ id: "B" }] })
    )
  })
})

describe("fitViewToModel", () => {
  /** A canvas of `w` x `h`: the 100% centred viewport for `bounds`. */
  const onCanvas = (
    bounds: { width: number; height: number },
    w = 1200,
    h = 800
  ) => {
    const instance = fakeInstance(() => [classNode("A", 0, 0)] as Node[], {
      x: (w - bounds.width) / 2,
      y: (h - bounds.height) / 2,
      zoom: 1,
    })
    return Object.assign(instance, {
      getNodesBounds: () => ({ x: 0, y: 0, ...bounds }),
    })
  }

  it("keeps 100% (never zooms in) and centres a diagram that fits, clear of the bottom toolbar", async () => {
    const instance = fakeInstance(() => [classNode("A", 0, 0)] as Node[])
    await fitViewToModel(instance)
    // Canvas 800 x 500; padded area 720 x 364 starting at (40, 40).
    expect(instance.setViewport).toHaveBeenLastCalledWith({
      x: 100,
      y: 172,
      zoom: 1,
    })
  })

  it("zooms a larger diagram out so all of it is visible", async () => {
    const instance = onCanvas({ width: 2000, height: 1000 })
    await fitViewToModel(instance)
    const [{ x, y, zoom }] = instance.setViewport.mock.calls.at(-1)!
    expect(zoom).toBeCloseTo(0.56)
    expect(x).toBeCloseTo(40)
    // Bottom edge stays above the toolbar band (96px).
    expect(y + 1000 * zoom).toBeLessThanOrEqual(800 - 96 + 0.01)
  })

  it("stops at the minimum zoom and pins a huge diagram to its top-left corner", async () => {
    const instance = onCanvas({ width: 10000, height: 5000 })
    await fitViewToModel(instance)
    expect(instance.setViewport).toHaveBeenLastCalledWith({
      x: 40,
      y: 40,
      zoom: LOADED_MODEL_MIN_ZOOM,
    })
  })

  it("goes below the desktop minimum on a phone-width canvas so the diagram fits", async () => {
    const instance = onCanvas({ width: 2000, height: 600 }, 390, 700)
    await fitViewToModel(instance)
    const [{ x, zoom }] = instance.setViewport.mock.calls.at(-1)!
    expect(zoom).toBeLessThan(LOADED_MODEL_MIN_ZOOM)
    expect(x + 2000 * zoom).toBeLessThanOrEqual(390 - 40 + 0.01)
  })

  it("resets an empty diagram to the origin", async () => {
    const instance = fakeInstance(() => [])
    await fitViewToModel(instance)
    expect(instance.fitView).not.toHaveBeenCalled()
    expect(instance.setViewport).toHaveBeenCalledWith({ x: 0, y: 0, zoom: 1 })
  })
})
