import { afterEach, describe, expect, it, vi } from "vitest"
import { act } from "@testing-library/react"
import { BesserEditor } from "@/besser-editor"
import { UMLDiagramType } from "@/types"
import type { UMLModel } from "@/typings"

vi.mock("@/App", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/App")>()),
  AppWithProvider: () => null,
}))

let editor: BesserEditor | null = null
afterEach(() => {
  act(() => editor?.destroy())
  editor = null
})

const row = {
  id: "ocl-1",
  name: "positiveAge",
  expression: "context Person inv positiveAge: self.age > 0",
}

// v4 model as the v3 -> v4 migrator writes it: an owned v3 constraint
// collapsed onto the class as a `data.oclConstraints` row.
const migrated = (): UMLModel =>
  ({
    version: "4.0.0",
    id: "m",
    title: "M",
    type: UMLDiagramType.ClassDiagram,
    nodes: [
      {
        id: "Person",
        type: "class",
        position: { x: 100, y: 50 },
        width: 200,
        height: 100,
        data: { name: "Person", attributes: [], methods: [], oclConstraints: [row] },
      },
    ],
    edges: [],
    assessments: {},
  }) as unknown as UMLModel

describe("OCL rows collapsed onto a class", () => {
  // Review finding: rows on `data.oclConstraints` reached the backend
  // (class_diagram_processor reads them) but the editor showed them nowhere.
  it("load as visible constraint boxes linked to their class", () => {
    const el = document.createElement("div")
    document.body.appendChild(el)
    act(() => {
      editor = new BesserEditor(el, { type: UMLDiagramType.ClassDiagram })
    })
    act(() => {
      editor!.model = migrated()
    })
    const { nodes, edges } = editor!.model
    const box = nodes.find((n) => n.type === "ClassOCLConstraint")
    expect(box).toMatchObject({
      id: "ocl-1",
      position: { x: 360, y: 50 },
      data: { name: "positiveAge", expression: row.expression },
    })
    expect(edges).toMatchObject([
      { type: "ClassOCLLink", source: "ocl-1", target: "Person" },
    ])
    const person = nodes.find((n) => n.id === "Person")!
    expect("oclConstraints" in person.data).toBe(false)
  })
})
