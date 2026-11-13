import { afterEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen } from "@testing-library/react"
import * as Y from "yjs"
import { ReactFlowProvider, type Edge, type Node } from "@xyflow/react"
import type { StoreApi } from "zustand"
import { BesserEditor } from "@/besser-editor"
import { CustomControls } from "@/components/CustomControls"
import { DiagramStoreContext, MetadataStoreContext } from "@/store/context"
import { createDiagramStore, DiagramStore } from "@/store/diagramStore"
import { createMetadataStore } from "@/store/metadataStore"
import { UMLDiagramType } from "@/types"
import type { UMLModel } from "@/typings"

vi.mock("@/App", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/App")>()),
  AppWithProvider: () => null,
}))

// The layout resolves only when the test says so; it moves every node it
// was given by +1000 x and re-handles every edge.
const pending: Array<() => void> = []
vi.mock("@/utils/autoLayout", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/autoLayout")>()),
  computeAutoLayout: (nodes: Node[], edges: Edge[]) =>
    new Promise((resolve) =>
      pending.push(() =>
        resolve({
          nodes: nodes.map((n) => ({
            ...n,
            position: { x: n.position.x + 1000, y: n.position.y },
          })),
          edges: edges.map((e) => ({ ...e, sourceHandle: "laid", targetHandle: "laid" })),
        })
      )
    ),
}))

const cls = (id: string, x: number): Node => ({
  id,
  type: "class",
  position: { x, y: 0 },
  width: 160,
  height: 100,
  data: { name: id, attributes: [], methods: [] },
})
const edge = (id: string, source: string, target: string): Edge => ({
  id,
  source,
  target,
  type: "ClassBidirectional",
  sourceHandle: "old",
  targetHandle: "old",
  data: { points: [] },
})

/** Edits made while the layout runs: rename A, delete C (+ its edge), add D. */
const editDuringLayout = (store: StoreApi<DiagramStore>) => {
  const { nodes, edges } = store.getState()
  store.getState().setNodesAndEdges(
    [
      ...nodes
        .filter((n) => n.id !== "C")
        .map((n) => (n.id === "A" ? { ...n, data: { ...n.data, name: "Renamed" } } : n)),
      cls("D", 50),
    ],
    edges.filter((e) => e.id !== "BC")
  )
}

const expectMerged = (store: StoreApi<DiagramStore>) => {
  const { nodes, edges } = store.getState()
  expect(nodes.map((n) => n.id)).toEqual(["A", "B", "D"])
  const a = nodes.find((n) => n.id === "A")!
  expect(a.data.name).toBe("Renamed")
  expect(a.position).toEqual({ x: 1000, y: 0 })
  // Added during the layout: kept where the user put it.
  expect(nodes.find((n) => n.id === "D")!.position).toEqual({ x: 50, y: 0 })
  expect(edges.map((e) => [e.id, e.sourceHandle])).toEqual([["AB", "laid"]])
}

afterEach(() => {
  pending.length = 0
})

describe("auto-layout result is merged into the current diagram", () => {
  // Review finding: the result overwrote the store with a node list
  // captured before the await, undoing edits made while ELK ran.
  it("BesserEditor.autoLayout keeps edits made while the layout ran", async () => {
    const el = document.createElement("div")
    document.body.appendChild(el)
    let editor!: BesserEditor
    act(() => {
      editor = new BesserEditor(el, { type: UMLDiagramType.ClassDiagram })
      editor.model = {
        version: "4.0.0",
        id: "m",
        title: "M",
        type: UMLDiagramType.ClassDiagram,
        nodes: [cls("A", 0), cls("B", 300), cls("C", 600)],
        edges: [edge("AB", "A", "B"), edge("BC", "B", "C")],
        assessments: {},
      } as unknown as UMLModel
    })
    const store = (editor as unknown as { diagramStore: StoreApi<DiagramStore> })
      .diagramStore
    const done = editor.autoLayout()
    act(() => editDuringLayout(store))
    pending.forEach((resolve) => resolve())
    await act(async () => {
      await done
    })
    expectMerged(store)
    act(() => editor.destroy())
  })

  it("the canvas button keeps edits made while the layout ran", async () => {
    const ydoc = new Y.Doc()
    const store = createDiagramStore(ydoc)
    act(() =>
      store
        .getState()
        .setNodesAndEdges(
          [cls("A", 0), cls("B", 300), cls("C", 600)],
          [edge("AB", "A", "B"), edge("BC", "B", "C")]
        )
    )
    render(
      <DiagramStoreContext.Provider value={store}>
        <MetadataStoreContext.Provider value={createMetadataStore(ydoc)}>
          <ReactFlowProvider>
            <CustomControls />
          </ReactFlowProvider>
        </MetadataStoreContext.Provider>
      </DiagramStoreContext.Provider>
    )
    fireEvent.click(screen.getByRole("button", { name: "Auto-layout diagram" }))
    act(() => editDuringLayout(store))
    await act(async () => {
      pending.forEach((resolve) => resolve())
      await new Promise((r) => setTimeout(r, 0))
    })
    expectMerged(store)
  })
})
