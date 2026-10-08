/**
 * Inspector parity fixes found by the React Flow migration sweep.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import * as Y from "yjs"
import type { Edge, Node } from "@xyflow/react"
import type { StoreApi } from "zustand"
import { DiagramStoreContext } from "@/store/context"
import { createDiagramStore, DiagramStore } from "@/store/diagramStore"
import { ObjectEditPanel } from "@/components/inspectors/objectDiagram/ObjectEditPanel"
import { findNameField } from "@/components/propertiesPanel/PropertiesPanel"
import { diagramBridge } from "@/services/diagramBridge"
import { ClassEditPanel } from "@/components/inspectors/classDiagram/ClassEditPanel"
import { ClassEdgeEditPanel } from "@/components/inspectors/classDiagram/ClassEdgeEditPanel"

vi.mock("@uiw/react-codemirror", () => ({ default: () => null }))
vi.mock("@codemirror/lang-python", () => ({ python: () => [] }))

const renderWith = (ui: React.ReactElement, nodes: Node[] = []) => {
  const store = createDiagramStore(new Y.Doc())
  store.getState().setNodes(nodes)
  const utils = render(
    <DiagramStoreContext.Provider value={store as StoreApi<DiagramStore>}>
      {ui}
    </DiagramStoreContext.Provider>
  )
  return { store: store as StoreApi<DiagramStore>, ...utils }
}

beforeEach(() => diagramBridge.clearDiagramData())
afterEach(() => diagramBridge.clearDiagramData())

describe("Object inspector focus", () => {
  const linkedObject = (): Node => ({
    id: "obj-1",
    type: "objectName",
    position: { x: 0, y: 0 },
    width: 200,
    height: 100,
    data: {
      name: "library_1",
      classId: "c-lib",
      className: "Library",
      attributes: [
        { id: "a-1", name: "name", attributeType: "str", attributeId: "ca-1" },
      ],
    },
  })

  // Opening an object focused the first slot's name ("Attribute name"), so
  // typing renamed a slot instead of the object.
  it("the auto-focused field is the object's own name", () => {
    const { container } = renderWith(<ObjectEditPanel elementId="obj-1" />, [
      linkedObject(),
    ])
    const field = findNameField(container)
    expect(field).toBe(screen.getByLabelText("Object name"))
    expect((field as HTMLInputElement).value).toBe("library_1")
  })

  it("slot names of a class-linked object are read-only", () => {
    renderWith(<ObjectEditPanel elementId="obj-1" />, [linkedObject()])
    const slot = screen.getByLabelText("Attribute name") as HTMLInputElement
    expect(slot.readOnly).toBe(true)
  })
})

describe("Class inspector add-row inputs", () => {
  const cls = (): Node => ({
    id: "c1",
    type: "class",
    position: { x: 0, y: 0 },
    width: 200,
    height: 100,
    data: { name: "Person", attributes: [], methods: [] },
  })

  // The placeholder promised "Enter for auto-name" but an empty Enter adds
  // nothing (deliberately), and it repeated the "Add attribute" button.
  it("placeholders neither promise auto-naming nor repeat the add buttons", () => {
    renderWith(<ClassEditPanel elementId="c1" />, [cls()])
    expect(screen.queryAllByPlaceholderText(/auto-name/i)).toHaveLength(0)
    expect(screen.queryAllByPlaceholderText(/add (attribute|method)/i)).toHaveLength(0)
    expect(screen.getByPlaceholderText("+ attribute: str")).toBeDefined()
    expect(screen.getByPlaceholderText("+ method(param: str): str")).toBeDefined()
  })
})

describe("Class edge inspector", () => {
  const edge = (type: string, data: Record<string, unknown> = {}): Edge => ({
    id: "e",
    type,
    source: "a",
    target: "b",
    data,
  })
  const mount = (e: Edge) => {
    const store = createDiagramStore(new Y.Doc())
    store.getState().setEdges([e])
    render(
      <DiagramStoreContext.Provider value={store as StoreApi<DiagramStore>}>
        <ClassEdgeEditPanel elementId="e" />
      </DiagramStoreContext.Provider>
    )
    return store as StoreApi<DiagramStore>
  }

  // The heading said "Association" for a Generalization.
  it("heading reflects the edge type", () => {
    mount(edge("ClassInheritance"))
    expect(screen.queryByText("Association")).toBeNull()
    expect(screen.getAllByText("Generalization").length).toBeGreaterThan(0)
  })

  // "abc" was written to the model (and drawn on the canvas) while the
  // field showed the error.
  it("keeps an invalid multiplicity as a draft, not in the model", () => {
    const store = mount(edge("ClassBidirectional", { sourceMultiplicity: "1" }))
    const input = screen.getByTestId("source-multiplicity") as HTMLInputElement
    fireEvent.change(input, { target: { value: "abc" } })
    fireEvent.blur(input)
    const data = store.getState().edges[0].data as { sourceMultiplicity?: string }
    expect(data.sourceMultiplicity).toBe("1")
    expect(input.value).toBe("abc")
    expect(input.getAttribute("aria-invalid")).toBe("true")

    fireEvent.change(input, { target: { value: "0..*" } })
    expect(
      (store.getState().edges[0].data as { sourceMultiplicity?: string })
        .sourceMultiplicity
    ).toBe("0..*")
  })
})
