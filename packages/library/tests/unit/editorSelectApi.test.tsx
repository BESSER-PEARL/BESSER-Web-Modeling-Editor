import { afterEach, describe, expect, it } from "vitest"
import { act } from "@testing-library/react"
import type { Edge, Node } from "@xyflow/react"
import { BesserEditor } from "@/besser-editor"
import { UMLDiagramType } from "@/types"
import type { UMLModel } from "@/typings"

/**
 * Live: the lineage "Source" link opened the source diagram but selected
 * nothing -- `editor.select(ids)` only wrote `selectedElementIds`, never the
 * React Flow `selected` flag the canvas renders.
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
  edges: [{ id: "AB", source: "A", target: "B", type: "ClassBidirectional", data: { points: [] } }],
  assessments: {},
} as unknown as UMLModel

type Internals = {
  diagramStore: {
    getState: () => { nodes: Node[]; edges: Edge[]; selectedElementIds: string[] }
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
  return { el, store: (editor as unknown as Internals).diagramStore }
}

const flagged = (items: Array<{ id: string; selected?: boolean }>) =>
  items.filter((i) => i.selected).map((i) => i.id)

describe("editor.select(ids)", () => {
  it("selects the nodes on the canvas", async () => {
    const { el, store } = await mount()
    act(() => editor!.select(["B"]))
    expect(flagged(store.getState().nodes)).toEqual(["B"])
    expect(store.getState().selectedElementIds).toEqual(["B"])
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20))
    })
    expect(el.querySelector('.react-flow__node[data-id="B"]')?.classList.contains("selected")).toBe(true)
  })

  it("replaces the previous selection, edges included, and ignores unknown ids", async () => {
    const { store } = await mount()
    act(() => editor!.select(["A", "C"]))
    act(() => editor!.select(["AB", "missing"]))
    expect(flagged(store.getState().nodes)).toEqual([])
    expect(flagged(store.getState().edges)).toEqual(["AB"])
    expect(store.getState().selectedElementIds).toEqual(["AB"])
  })
})
