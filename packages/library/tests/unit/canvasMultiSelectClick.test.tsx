import { afterEach, describe, expect, it } from "vitest"
import { act, fireEvent } from "@testing-library/react"
import type { Node } from "@xyflow/react"
import { BesserEditor } from "@/besser-editor"
import { UMLDiagramType } from "@/types"
import type { UMLModel } from "@/typings"

/**
 * Live: Ctrl+A, click one node, Delete deleted everything -- a plain click
 * inside a multi-selection kept the whole selection (React Flow's default).
 */

const classNode = (id: string, x: number) => ({
  id,
  type: "class",
  position: { x, y: 0 },
  width: 160,
  height: 100,
  data: { name: id, attributes: [], methods: [] },
})

const model = {
  version: "4.0.0",
  id: "m",
  title: "M",
  type: UMLDiagramType.ClassDiagram,
  nodes: [classNode("A", 0), classNode("B", 300), classNode("C", 600)],
  edges: [],
  assessments: {},
} as unknown as UMLModel

type Internals = {
  diagramStore: {
    getState: () => { nodes: Node[]; setNodes: (nodes: Node[]) => void }
  }
}

let editor: BesserEditor | null = null
afterEach(() => {
  act(() => editor?.destroy())
  editor = null
  document.body.innerHTML = ""
})

const mount = async () => {
  const el = document.createElement("div")
  document.body.appendChild(el)
  act(() => {
    editor = new BesserEditor(el, { type: UMLDiagramType.ClassDiagram, model })
  })
  await act(async () => {
    await new Promise((r) => setTimeout(r, 50))
  })
  const store = (editor as unknown as Internals).diagramStore
  act(() => store.getState().setNodes(store.getState().nodes.map((n) => ({ ...n, selected: true }))))
  await act(async () => {
    await new Promise((r) => setTimeout(r, 20))
  })
  return { el, store }
}

const selectedIds = (store: Internals["diagramStore"]) =>
  store.getState().nodes.filter((n) => n.selected).map((n) => n.id)

describe("a click inside a multi-selection", () => {
  it("selects only the clicked node", async () => {
    const { el, store } = await mount()
    expect(selectedIds(store)).toEqual(["A", "B", "C"])
    act(() => {
      fireEvent.click(el.querySelector('.react-flow__node[data-id="B"]')!)
    })
    expect(selectedIds(store)).toEqual(["B"])
  })

  it("toggles with Shift", async () => {
    const { el, store } = await mount()
    act(() => {
      fireEvent.click(el.querySelector('.react-flow__node[data-id="B"]')!, { shiftKey: true })
    })
    expect(selectedIds(store)).toContain("A")
    expect(selectedIds(store)).toContain("C")
  })
})
