/**
 * Wave-3 sweep (A2a + A2b) — StateEditPanel / AgentStateEditPanel:
 *
 *  - A2b rapid-entry keyboard flow (develop `uml-state-update.tsx`):
 *    always-present "+ add body (Enter)" field per section; Enter
 *    commits the text as a new row; Enter inside an existing row chains
 *    focus row → row → add field.
 *  - A2a per-body-row fill / text colors (develop
 *    `uml-state-body-update.tsx` ColorButton + StylePane).
 */
import { describe, it, expect } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import * as Y from "yjs"
import type { Node } from "@xyflow/react"
import type { StoreApi } from "zustand"
import { DiagramStoreContext } from "@/store/context"
import { createDiagramStore, DiagramStore } from "@/store/diagramStore"
import { StateEditPanel } from "@/components/inspectors/stateMachineDiagram/StateEditPanel"
import { AgentStateEditPanel } from "@/components/inspectors/agentDiagram/AgentStateEditPanel"
import { AgentStateNodeProps, StateNodeProps } from "@/types"

const stateNode = (data: Partial<StateNodeProps> = {}): Node => ({
  id: "state-1",
  type: "State",
  position: { x: 0, y: 0 },
  width: 200,
  height: 100,
  data: { name: "Working", bodies: [], fallbackBodies: [], ...data },
})

const agentStateNode = (data: Partial<AgentStateNodeProps> = {}): Node => ({
  id: "state-1",
  type: "AgentState",
  position: { x: 0, y: 0 },
  width: 200,
  height: 100,
  data: { name: "Greeting", replyType: "text", bodies: [], ...data },
})

const renderWith = (
  nodes: Node[],
  Panel: React.FC<{ elementId: string }>
) => {
  const store = createDiagramStore(new Y.Doc())
  store.getState().setNodes(nodes)
  const utils = render(
    <DiagramStoreContext.Provider value={store as StoreApi<DiagramStore>}>
      <Panel elementId="state-1" />
    </DiagramStoreContext.Provider>
  )
  return { store, ...utils }
}

const getData = (store: StoreApi<DiagramStore>): StateNodeProps =>
  store.getState().nodes.find((n) => n.id === "state-1")!
    .data as StateNodeProps

describe("StateEditPanel — rapid-entry keyboard flow (A2b)", () => {
  it("Enter in the add-body field appends a row and clears the field", () => {
    const { store } = renderWith([stateNode()], StateEditPanel)

    const addField = screen.getByPlaceholderText("+ add body (Enter)")
    fireEvent.change(addField, { target: { value: "entry / start()" } })
    fireEvent.keyDown(addField, { key: "Enter" })

    const data = getData(store)
    expect(data.bodies).toHaveLength(1)
    expect(data.bodies![0].name).toBe("entry / start()")
    expect(data.bodies![0].id).toBeTruthy()
    expect((addField as HTMLInputElement).value).toBe("")
  })

  it("Enter in the add-fallback field appends a fallback row", () => {
    const { store } = renderWith([stateNode()], StateEditPanel)

    const addField = screen.getByPlaceholderText("+ add fallback body (Enter)")
    fireEvent.change(addField, { target: { value: "fallback action" } })
    fireEvent.keyDown(addField, { key: "Enter" })

    const data = getData(store)
    expect(data.fallbackBodies).toHaveLength(1)
    expect(data.fallbackBodies![0].name).toBe("fallback action")
  })

  it("Enter on a body row chains focus to the next row, then the add field", () => {
    renderWith(
      [
        stateNode({
          bodies: [
            { id: "b-1", name: "first" },
            { id: "b-2", name: "second" },
          ],
        }),
      ],
      StateEditPanel
    )

    const first = screen.getByDisplayValue("first")
    const second = screen.getByDisplayValue("second")
    const addField = screen.getByPlaceholderText("+ add body (Enter)")

    first.focus()
    fireEvent.keyDown(first, { key: "Enter" })
    expect(document.activeElement).toBe(second)

    fireEvent.keyDown(second, { key: "Enter" })
    expect(document.activeElement).toBe(addField)
  })
})

describe("StateEditPanel — per-row colors (A2a)", () => {
  it("patches row.fillColor / row.textColor through the swatches", () => {
    const { store, container } = renderWith(
      [stateNode({ bodies: [{ id: "b-1", name: "entry" }] })],
      StateEditPanel
    )

    const fill = screen.getByLabelText("Row fill color")
    fireEvent.change(fill, { target: { value: "#ff0000" } })
    expect(getData(store).bodies![0].fillColor).toBe("#ff0000")

    const text = screen.getByLabelText("Row text color")
    fireEvent.change(text, { target: { value: "#00ff00" } })
    expect(getData(store).bodies![0].textColor).toBe("#00ff00")

    // Right-click on the swatch label resets to the theme default.
    const swatchLabel = fill.closest("label")!
    fireEvent.contextMenu(swatchLabel)
    expect(getData(store).bodies![0].fillColor).toBeUndefined()
    expect(container).toBeTruthy()
  })
})

describe("AgentStateEditPanel — rapid-entry keyboard flow (A2b)", () => {
  it("Enter in the add-text-body field appends a text row and clears", () => {
    const { store } = renderWith([agentStateNode()], AgentStateEditPanel)

    // Both sections render an add field; the first belongs to the
    // main body section.
    const addFields = screen.getAllByPlaceholderText("+ add text body (Enter)")
    expect(addFields.length).toBeGreaterThan(0)

    fireEvent.change(addFields[0], { target: { value: "Hello there!" } })
    fireEvent.keyDown(addFields[0], { key: "Enter" })

    const data = store
      .getState()
      .nodes.find((n) => n.id === "state-1")!.data as AgentStateNodeProps
    expect(data.bodies).toHaveLength(1)
    expect(data.bodies![0].name).toBe("Hello there!")
    expect(data.bodies![0].replyType).toBe("text")
    expect((addFields[0] as HTMLInputElement).value).toBe("")
  })

  it("Enter on an existing text row falls through to the add field", () => {
    renderWith(
      [
        agentStateNode({
          bodies: [{ id: "b-1", name: "Hi", replyType: "text" }],
        }),
      ],
      AgentStateEditPanel
    )

    const row = screen.getByDisplayValue("Hi")
    const addFields = screen.getAllByPlaceholderText("+ add text body (Enter)")

    row.focus()
    fireEvent.keyDown(row, { key: "Enter" })
    expect(document.activeElement).toBe(addFields[0])
  })
})
