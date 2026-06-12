/**
 * Wave-3 UserDiagram inspector polish tests: per-row fillColor /
 * textColor swatches and the per-row Icon field — v3 parity with the
 * `ColorButton` + `StylePane showIcon fillColor textColor` block on
 * every `UMLUserModelAttributeUpdate` row
 * (`uml-user-model-attribute-update.tsx:233-238`).
 */
import { describe, it, expect } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import * as Y from "yjs"
import type { Node } from "@xyflow/react"
import type { StoreApi } from "zustand"
import { DiagramStoreContext } from "@/store/context"
import { createDiagramStore, DiagramStore } from "@/store/diagramStore"
import { UserModelNameEditPanel } from "@/components/inspectors/userDiagram/UserModelNameEditPanel"
import { UserModelNameNodeProps } from "@/types"

const userNode = (
  data: Partial<UserModelNameNodeProps> & { name?: string },
  id = "user-1"
): Node => ({
  id,
  type: "UserModelName",
  position: { x: 0, y: 0 },
  width: 200,
  height: 100,
  data: {
    name: "alice",
    attributes: [],
    ...data,
  },
})

const renderPanel = (nodes: Node[]) => {
  const store = createDiagramStore(new Y.Doc())
  store.getState().setNodes(nodes)
  const utils = render(
    <DiagramStoreContext.Provider value={store as StoreApi<DiagramStore>}>
      <UserModelNameEditPanel elementId="user-1" />
    </DiagramStoreContext.Provider>
  )
  return { store, ...utils }
}

const getData = (store: StoreApi<DiagramStore>): UserModelNameNodeProps =>
  store.getState().nodes.find((n) => n.id === "user-1")!
    .data as UserModelNameNodeProps

const nodeWithRow = () =>
  userNode({
    attributes: [
      {
        id: "row-1",
        name: "age",
        attributeType: "int",
        attributeOperator: "==",
        value: "30",
      },
    ],
  })

describe("UserModelNameEditPanel — per-row style controls", () => {
  it("opens the row style panel and patches row.fillColor", () => {
    const { store, container } = renderPanel([nodeWithRow()])

    fireEvent.click(screen.getByLabelText("Row style"))
    const colorInputs = container.querySelectorAll('input[type="color"]')
    expect(colorInputs).toHaveLength(2) // fill + text

    fireEvent.change(colorInputs[0], { target: { value: "#123456" } })
    expect(getData(store).attributes[0].fillColor).toBe("#123456")
  })

  it("patches row.textColor and resets it on right-click", () => {
    const { store, container } = renderPanel([nodeWithRow()])
    fireEvent.click(screen.getByLabelText("Row style"))

    const colorInputs = container.querySelectorAll('input[type="color"]')
    fireEvent.change(colorInputs[1], { target: { value: "#654321" } })
    expect(getData(store).attributes[0].textColor).toBe("#654321")

    fireEvent.contextMenu(colorInputs[1].closest("label")!)
    expect(getData(store).attributes[0].textColor).toBeUndefined()
  })

  it("exposes the v3 Icon field and patches row.icon", () => {
    const { store } = renderPanel([nodeWithRow()])
    fireEvent.click(screen.getByLabelText("Row style"))

    const iconField = screen.getByPlaceholderText("Enter icon name...")
    fireEvent.change(iconField, { target: { value: "fluent-person" } })
    expect(getData(store).attributes[0].icon).toBe("fluent-person")

    // Clearing the field removes the stored icon.
    fireEvent.change(iconField, { target: { value: "" } })
    expect(getData(store).attributes[0].icon).toBeUndefined()
  })
})
