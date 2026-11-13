import { afterEach, describe, expect, it, vi } from "vitest"
import { act } from "@testing-library/react"
import { BesserEditor } from "@/besser-editor"
import { UMLDiagramType } from "@/types"
import type { UMLModel } from "@/typings"
import { convertV3ToV4 } from "@/utils/versionConverter"

// Store-level API: skip mounting the React Flow canvas.
vi.mock("@/App", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/App")>()),
  AppWithProvider: () => null,
}))

/** Locks live in the model: `UMLModel.locked`, `node.locked`, `edge.locked`. */

const editors: BesserEditor[] = []
afterEach(() => {
  act(() => editors.splice(0).forEach((e) => e.destroy()))
})

const mount = (model?: UMLModel) => {
  const el = document.createElement("div")
  document.body.appendChild(el)
  let editor!: BesserEditor
  act(() => {
    editor = new BesserEditor(el, { type: UMLDiagramType.ClassDiagram, model })
  })
  editors.push(editor)
  return editor
}

const classNode = (id: string, x: number) => ({
  id,
  type: "class",
  position: { x, y: 0 },
  width: 160,
  height: 100,
  measured: { width: 160, height: 100 },
  data: { name: id, attributes: [], methods: [] },
})

const lockedModel = (): UMLModel =>
  ({
    version: "4.0.0",
    id: "m",
    title: "Library",
    type: UMLDiagramType.ClassDiagram,
    locked: true,
    nodes: [{ ...classNode("A", 0), locked: true }, classNode("B", 300)],
    edges: [
      {
        id: "e",
        type: "ClassBidirectional",
        source: "A",
        target: "B",
        sourceHandle: "right",
        targetHandle: "left",
        data: { name: "", points: [] },
        locked: true,
      },
    ],
    assessments: {},
  }) as unknown as UMLModel

describe("lock persistence", () => {
  it("round-trips both locks through the model and its JSON", () => {
    const first = mount(lockedModel()).model
    expect(first.locked).toBe(true)
    expect(first.nodes.find((n) => n.id === "A")?.locked).toBe(true)
    expect(first.nodes.find((n) => n.id === "B")).not.toHaveProperty("locked")
    expect(first.edges[0].locked).toBe(true)

    // Project export / import is the model as JSON.
    const reloaded = mount(JSON.parse(JSON.stringify(first))).model
    expect(reloaded.locked).toBe(true)
    expect(reloaded.nodes.find((n) => n.id === "A")?.locked).toBe(true)
    expect(reloaded.edges[0].locked).toBe(true)

    const editor = mount()
    act(() => {
      editor.model = JSON.parse(JSON.stringify(first))
    })
    expect(editor.model.locked).toBe(true)
    act(() => {
      editor.model = { ...first, locked: undefined }
    })
    expect(editor.model).not.toHaveProperty("locked")
  })

  it("writes no lock keys for an unlocked diagram, nor for a migrated v3 one", () => {
    const unlocked = { ...lockedModel(), locked: undefined }
    unlocked.nodes = unlocked.nodes.map((n) => ({ ...n, locked: undefined }))
    unlocked.edges = unlocked.edges.map((e) => ({ ...e, locked: undefined }))
    expect(JSON.stringify(mount(unlocked).model)).not.toContain('"locked"')

    const v3 = convertV3ToV4({
      version: "3.0.0",
      type: "ClassDiagram",
      size: { width: 400, height: 200 },
      interactive: { elements: {}, relationships: {} },
      elements: {
        c: {
          id: "c",
          name: "C",
          type: "Class",
          owner: null,
          bounds: { x: 0, y: 0, width: 160, height: 100 },
          attributes: [],
          methods: [],
        },
      },
      relationships: {},
      assessments: {},
    } as unknown as Parameters<typeof convertV3ToV4>[0])
    expect(JSON.stringify(mount(v3).model)).not.toContain('"locked"')
  })

  it("tells model subscribers when the diagram lock changes", () => {
    const editor = mount()
    const seen: (boolean | undefined)[] = []
    editor.subscribeToModelChange((model) => seen.push(model.locked))
    const discrete: (boolean | undefined)[] = []
    editor.subscribeToModelDiscreteChange((model) => discrete.push(model.locked))
    act(() => {
      ;(editor as unknown as {
        diagramStore: { getState: () => { setDiagramLocked: (l: boolean) => void } }
      }).diagramStore
        .getState()
        .setDiagramLocked(true)
    })
    expect(seen.at(-1)).toBe(true)
    expect(discrete).toEqual([true])
  })

  it("keeps the diagram lock across applyModel, which does not enforce element locks", () => {
    const editor = mount(lockedModel())
    const next = editor.model
    next.nodes = next.nodes.map((n) =>
      n.id === "A" ? { ...n, data: { ...n.data, name: "Renamed" } } : n
    )
    delete next.locked
    act(() => editor.applyModel(next))
    expect(editor.model.locked).toBe(true)
    expect(editor.model.nodes.find((n) => n.id === "A")?.data.name).toBe("Renamed")
  })
})
