/**
 * Wave-3 ObjectDiagram inspector polish tests:
 *  - per-attribute-slot fill / text colors (v3 `ColorButton` +
 *    `StylePane fillColor textColor` on every object attribute row —
 *    `uml-object-attribute-update.tsx`),
 *  - Enter-to-next-slot navigation (v3 `onSubmitKeyUp` chain in
 *    `uml-object-name-update.tsx`: next attribute Textfield, falling
 *    through to the add-attribute field on the last row),
 *  - live `name : ClassName` canvas header label
 *    (`resolveObjectHeaderLabel`).
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import * as Y from "yjs"
import type { Node } from "@xyflow/react"
import type { StoreApi } from "zustand"
import { DiagramStoreContext } from "@/store/context"
import { createDiagramStore, DiagramStore } from "@/store/diagramStore"
import { ObjectEditPanel } from "@/components/inspectors/objectDiagram/ObjectEditPanel"
import { resolveObjectHeaderLabel } from "@/components/svgs/nodes/objectDiagram"
import { ObjectNodeProps } from "@/types"
import { diagramBridge } from "@/services/diagramBridge"

const objectNode = (
  data: Partial<ObjectNodeProps> & { name?: string },
  id = "obj-1"
): Node => ({
  id,
  type: "objectName",
  position: { x: 0, y: 0 },
  width: 200,
  height: 100,
  data: {
    name: "rex",
    attributes: [],
    ...data,
  },
})

const renderPanel = (nodes: Node[]) => {
  const store = createDiagramStore(new Y.Doc())
  store.getState().setNodes(nodes)
  const utils = render(
    <DiagramStoreContext.Provider value={store as StoreApi<DiagramStore>}>
      <ObjectEditPanel elementId="obj-1" />
    </DiagramStoreContext.Provider>
  )
  return { store, ...utils }
}

const getData = (store: StoreApi<DiagramStore>): ObjectNodeProps =>
  store.getState().nodes.find((n) => n.id === "obj-1")!.data as ObjectNodeProps

// No direct `localStorage` access — unavailable in this jsdom env;
// the bridge guards its own persistence.
beforeEach(() => {
  diagramBridge.clearDiagramData()
})

afterEach(() => {
  diagramBridge.clearDiagramData()
})

describe("ObjectEditPanel — per-attribute-slot colors", () => {
  const twoRows = () =>
    objectNode({
      attributes: [
        { id: "a-1", name: "name", attributeType: "str", value: "Rex" },
        { id: "a-2", name: "age", attributeType: "str", value: "3" },
      ],
    })

  it("patches row.fillColor through the slot color picker", () => {
    const { store, container } = renderPanel([twoRows()])

    // One paint-roller toggle per attribute row.
    const toggles = screen.getAllByLabelText("Row colors")
    expect(toggles).toHaveLength(2)
    fireEvent.click(toggles[0])

    const colorInputs = container.querySelectorAll('input[type="color"]')
    expect(colorInputs).toHaveLength(2) // fill + text for the open row

    fireEvent.change(colorInputs[0], { target: { value: "#ff0000" } })
    expect(getData(store).attributes[0].fillColor).toBe("#ff0000")
    // Sibling row untouched.
    expect(getData(store).attributes[1].fillColor).toBeUndefined()
  })

  it("patches row.textColor and resets it on right-click", () => {
    const { store, container } = renderPanel([twoRows()])
    fireEvent.click(screen.getAllByLabelText("Row colors")[1])

    const colorInputs = container.querySelectorAll('input[type="color"]')
    fireEvent.change(colorInputs[1], { target: { value: "#00ff00" } })
    expect(getData(store).attributes[1].textColor).toBe("#00ff00")

    // Right-click on the swatch label resets the color.
    const swatchLabel = colorInputs[1].closest("label")!
    fireEvent.contextMenu(swatchLabel)
    expect(getData(store).attributes[1].textColor).toBeUndefined()
  })
})

describe("ObjectEditPanel — Enter-to-next-slot navigation", () => {
  it("moves focus to the next attribute value input on Enter", () => {
    renderPanel([
      objectNode({
        attributes: [
          { id: "a-1", name: "name", attributeType: "str", value: "Rex" },
          { id: "a-2", name: "age", attributeType: "str", value: "3" },
        ],
      }),
    ])

    const first = screen.getByDisplayValue("Rex")
    const second = screen.getByDisplayValue("3")
    first.focus()
    fireEvent.keyDown(first, { key: "Enter" })
    expect(document.activeElement).toBe(second)
  })

  it("falls through to the add-attribute field after the last slot", () => {
    renderPanel([
      objectNode({
        attributes: [
          { id: "a-1", name: "name", attributeType: "str", value: "Rex" },
        ],
      }),
    ])

    const last = screen.getByDisplayValue("Rex")
    last.focus()
    fireEvent.keyDown(last, { key: "Enter" })
    expect(document.activeElement).toBe(
      screen.getByPlaceholderText("+ Add attribute (Enter)")
    )
  })
})

describe("ObjectEditPanel — duration and string value widgets", () => {
  it("renders a duration textfield with the v3 placeholder for timedelta-typed attributes", () => {
    const { store } = renderPanel([
      objectNode({
        attributes: [
          {
            id: "a-1",
            name: "elapsed",
            attributeType: "timedelta",
            value: "1d 2h 30m",
          },
        ],
      }),
    ])

    const input = screen.getByPlaceholderText(
      "e.g., 1d 2h 30m, P1DT2H30M, 1:30:00"
    ) as HTMLInputElement
    expect(input.value).toBe("1d 2h 30m")

    fireEvent.change(input, { target: { value: "PT45M" } })
    expect(getData(store).attributes[0].value).toBe("PT45M")
  })

  it("flanks str-typed attribute values with quote glyphs", () => {
    renderPanel([
      objectNode({
        attributes: [
          { id: "a-1", name: "label", attributeType: "str", value: "hello" },
        ],
      }),
    ])

    expect(screen.getAllByText('"')).toHaveLength(2)
    expect(screen.getByDisplayValue("hello")).toBeInTheDocument()
  })

  it("does not quote-wrap non-string fallback values", () => {
    renderPanel([
      objectNode({
        attributes: [
          {
            id: "a-1",
            name: "misc",
            attributeType: "customType",
            value: "raw",
          },
        ],
      }),
    ])

    expect(screen.queryByText('"')).not.toBeInTheDocument()
    expect(screen.getByDisplayValue("raw")).toBeInTheDocument()
  })
})

describe("resolveObjectHeaderLabel — live `name : ClassName` header", () => {
  it("renders the bare name for unlinked instances", () => {
    expect(resolveObjectHeaderLabel({ name: "rex" })).toBe("rex")
  })

  it("resolves the class name live from the diagram bridge", () => {
    diagramBridge.setClassDiagramData({
      nodes: [
        { id: "cls-dog", type: "class", data: { name: "Dog", attributes: [] } },
      ],
      edges: [],
    })
    expect(
      resolveObjectHeaderLabel({
        name: "rex",
        classId: "cls-dog",
        className: "StaleCachedName",
      })
    ).toBe("rex : Dog")

    // Renaming the class in the sibling diagram updates the label on
    // the next render — no node-data mutation required.
    diagramBridge.setClassDiagramData({
      nodes: [
        {
          id: "cls-dog",
          type: "class",
          data: { name: "GoodBoy", attributes: [] },
        },
      ],
      edges: [],
    })
    expect(
      resolveObjectHeaderLabel({ name: "rex", classId: "cls-dog" })
    ).toBe("rex : GoodBoy")
  })

  it("falls back to the cached className when the bridge has no data", () => {
    expect(
      resolveObjectHeaderLabel({
        name: "rex",
        classId: "cls-missing",
        className: "Dog",
      })
    ).toBe("rex : Dog")
  })
})
