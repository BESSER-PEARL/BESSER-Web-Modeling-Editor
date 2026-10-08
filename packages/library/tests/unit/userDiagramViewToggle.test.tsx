/**
 * UserDiagram nodes render the icon by default; the properties pane has an
 * "Icon | Attributes" switch stored in `data.view`, and the attribute rows
 * stay editable in either view. Switching resizes the node (icon slot vs
 * row-count table height).
 */
import { describe, it, expect } from "vitest"
import { fireEvent, render, screen, within } from "@testing-library/react"
import * as Y from "yjs"
import { ReactFlowProvider, type Node } from "@xyflow/react"
import type { StoreApi } from "zustand"
import {
  AssessmentSelectionStoreContext,
  DiagramStoreContext,
  MetadataStoreContext,
  PopoverStoreContext,
} from "@/store/context"
import { createAssessmentSelectionStore } from "@/store/assessmentSelectionStore"
import { createDiagramStore, DiagramStore } from "@/store/diagramStore"
import { createMetadataStore } from "@/store/metadataStore"
import { createPopoverStore } from "@/store/popoverStore"
import { UserModelName } from "@/nodes/userDiagram/UserModelName"
import { UserModelNameEditPanel } from "@/components/inspectors/userDiagram/UserModelNameEditPanel"
import { UserModelNameNodeProps } from "@/types"
import { LAYOUT } from "@/constants"

const ICON_SVG = "<svg xmlns='http://www.w3.org/2000/svg'><rect width='4' height='4'/></svg>"

// Live data: personalized_gym_agent.json carries unmigrated legacy rows.
const rows = [
  { id: "r1", name: "age < 18", attributeType: "int", attributeOperator: "<" as const },
  { id: "r2", name: "lastName", attributeType: "str", attributeOperator: "==" as const },
  { id: "r3", name: "firstName", attributeType: "str", attributeOperator: "==" as const },
]

const userNode = (data: Partial<UserModelNameNodeProps> = {}): Node => ({
  id: "u1",
  type: "UserModelName",
  position: { x: 0, y: 0 },
  width: 200,
  height: 100,
  data: {
    name: "personal_Information_1",
    className: "Personal_Information",
    icon: ICON_SVG,
    attributes: rows,
    ...data,
  },
})

const nodeOf = (store: StoreApi<DiagramStore>) =>
  store.getState().nodes.find((n) => n.id === "u1")!

const renderNode = (node: Node) => {
  const ydoc = new Y.Doc()
  const store = createDiagramStore(ydoc) as StoreApi<DiagramStore>
  store.getState().setNodes([node])
  const utils = render(
    <DiagramStoreContext.Provider value={store}>
      <MetadataStoreContext.Provider value={createMetadataStore(ydoc)}>
        <PopoverStoreContext.Provider value={createPopoverStore()}>
          <AssessmentSelectionStoreContext.Provider
            value={createAssessmentSelectionStore()}
          >
            <ReactFlowProvider>
              <UserModelName
                {...({
                  id: node.id,
                  width: node.width,
                  height: node.height,
                  data: node.data,
                } as never)}
              />
            </ReactFlowProvider>
          </AssessmentSelectionStoreContext.Provider>
        </PopoverStoreContext.Provider>
      </MetadataStoreContext.Provider>
    </DiagramStoreContext.Provider>
  )
  return { store, ...utils }
}

const renderPanel = (node: Node) => {
  const store = createDiagramStore(new Y.Doc()) as StoreApi<DiagramStore>
  store.getState().setNodes([node])
  const utils = render(
    <DiagramStoreContext.Provider value={store}>
      <UserModelNameEditPanel elementId={node.id} />
    </DiagramStoreContext.Provider>
  )
  return { store, ...utils }
}

const ICON_HEIGHT = LAYOUT.DEFAULT_HEADER_HEIGHT + 60
const TABLE_HEIGHT =
  LAYOUT.DEFAULT_HEADER_HEIGHT + rows.length * LAYOUT.DEFAULT_ATTRIBUTE_HEIGHT

describe("UserModelName canvas node", () => {
  it("renders the icon by default, with the class name in the header", () => {
    const { container, store } = renderNode(userNode())
    expect(container.getElementsByTagName("foreignObject")[0] ?? null).not.toBeNull()
    expect(container.textContent).toContain("Personal_Information")
    expect(container.textContent).not.toContain("age < 18")
    expect(nodeOf(store).height).toBe(ICON_HEIGHT)
  })

  it("renders legacy rows correctly in the attribute table", () => {
    const { container } = renderNode(userNode({ view: "attributes" }))
    expect(container.getElementsByTagName("foreignObject")[0] ?? null).toBeNull()
    expect(container.textContent).toContain("age < 18")
    expect(container.textContent).toContain("lastName ==")
  })

  it("resizes the node to the table height in attributes view", () => {
    const { store } = renderNode(userNode({ view: "attributes" }))
    expect(TABLE_HEIGHT).not.toBe(ICON_HEIGHT)
    expect(nodeOf(store).height).toBeGreaterThanOrEqual(TABLE_HEIGHT)
  })
})

describe("UserModelNameEditPanel view switch", () => {
  const segmented = () => screen.getByRole("group", { name: "Show on canvas as" })
  const toggle = (name: "Icon" | "Attributes") =>
    within(segmented()).getByRole("button", { name })

  it("shows Icon selected when no view is stored", () => {
    renderPanel(userNode())
    expect(toggle("Icon").getAttribute("aria-pressed")).toBe("true")
    expect(toggle("Attributes").getAttribute("aria-pressed")).toBe("false")
  })

  it("persists the choice in data.view and back", () => {
    const { store } = renderPanel(userNode())
    fireEvent.click(toggle("Attributes"))
    expect((nodeOf(store).data as UserModelNameNodeProps).view).toBe("attributes")
    expect(toggle("Attributes").getAttribute("aria-pressed")).toBe("true")
    fireEvent.click(toggle("Icon"))
    expect((nodeOf(store).data as UserModelNameNodeProps).view).toBe("icon")
  })

  it("keeps the attribute rows editable in icon view", () => {
    const { store, container } = renderPanel(userNode({ view: "icon" }))
    const nameInput = screen.getByDisplayValue("lastName")
    fireEvent.change(nameInput, { target: { value: "surname" } })
    expect((nodeOf(store).data as UserModelNameNodeProps).attributes[1].name).toBe(
      "surname"
    )
    // Value field per row, plus the comparator for the int row.
    const valueInputs = container.querySelectorAll(
      ".bp-member input:not([type='hidden']):not([aria-hidden='true'])"
    )
    expect(valueInputs.length).toBeGreaterThanOrEqual(rows.length * 2)
    expect(screen.getAllByRole("combobox").length).toBeGreaterThanOrEqual(1)
  })
})
