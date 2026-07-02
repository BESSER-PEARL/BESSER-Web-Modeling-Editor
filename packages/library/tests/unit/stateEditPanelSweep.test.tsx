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

describe("AgentStateEditPanel — multi-action ActionCard flow", () => {
  // The migration-specific "+ add text body (Enter)" rapid-entry field was
  // replaced by develop's ActionCard model (`agent-state-update.tsx`): a
  // per-section "Add action" 2-level picker (Simple / AI / Data tab → type
  // → Add). The Simple tab defaults to "text", so clicking the main
  // section's Add button appends a seeded text action.
  it("adds a text action to the body section via the Add button", () => {
    const { store } = renderWith([agentStateNode()], AgentStateEditPanel)

    // Two "Add" buttons render (Body + Fallback Body); the first belongs
    // to the main body section.
    const addButtons = screen.getAllByRole("button", { name: "Add" })
    expect(addButtons.length).toBeGreaterThan(0)

    fireEvent.click(addButtons[0])

    const data = store
      .getState()
      .nodes.find((n) => n.id === "state-1")!.data as AgentStateNodeProps
    expect(data.bodies).toHaveLength(1)
    expect(data.bodies![0].replyType).toBe("text")
    // Seeded default name (develop `addPredefinedAction`).
    expect(data.bodies![0].name).toBe("Enter reply message")
    expect(data.bodies![0].id).toBeTruthy()
  })

  it("switching State Type to Reasoning surfaces the reasoning fields and preserves bodies", () => {
    const { store } = renderWith(
      [
        agentStateNode({
          bodies: [{ id: "b-1", name: "Hi", replyType: "text" }],
        }),
      ],
      AgentStateEditPanel
    )

    // The State Type select (MUI) exposes a combobox with a "Standard"
    // value; open it and pick "Reasoning".
    const combos = screen.getAllByRole("combobox")
    fireEvent.mouseDown(combos[0])
    fireEvent.click(screen.getByRole("option", { name: "Reasoning" }))

    const data = store
      .getState()
      .nodes.find((n) => n.id === "state-1")!.data as AgentStateNodeProps
    expect(data.stateType).toBe("reasoning")
    // Bodies are preserved across the toggle (not deleted).
    expect(data.bodies).toHaveLength(1)
    expect(data.bodies![0].name).toBe("Hi")
    // Reasoning-only fields render (Max steps).
    expect(screen.getByLabelText("Max steps")).toBeDefined()
  })
})
