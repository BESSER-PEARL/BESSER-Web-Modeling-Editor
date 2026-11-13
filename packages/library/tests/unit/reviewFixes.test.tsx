/**
 * Fixes from the React Flow diagram review: a dropped TensorOp converts as
 * is, and the state code block no longer offers BAL (the backend runs state
 * code as Python only).
 */
import { describe, expect, it } from "vitest"
import { fireEvent, render, screen, within } from "@testing-library/react"
import * as Y from "yjs"
import type { StoreApi } from "zustand"
import { DiagramStoreContext } from "@/store/context"
import { createDiagramStore, DiagramStore } from "@/store/diagramStore"
import { dropElementConfigs } from "@/constants"
import { UMLDiagramType } from "@/types"
import { withMandatoryNNDefaults } from "@/utils/nnMandatoryDefaults"
import { StateCodeBlockEditPanel } from "@/components/inspectors/stateMachineDiagram/StateCodeBlockEditPanel"

describe("TensorOp palette entry", () => {
  it("is a reshape with its target shape", () => {
    const entry = dropElementConfigs[UMLDiagramType.NNDiagram].find(
      (e) => (e.type as string) === "TensorOp"
    )!
    const data = withMandatoryNNDefaults("TensorOp", entry.defaultData as Record<string, unknown>)
    expect(data.attributes).toMatchObject({ tns_type: "reshape", reshape_dim: "[-1]" })
  })
})

describe("state code block language", () => {
  const languages = (language: string) => {
    const store = createDiagramStore(new Y.Doc())
    store.getState().setNodes([
      {
        id: "c",
        type: "StateCodeBlock",
        position: { x: 0, y: 0 },
        data: { name: "", code: "x", language },
      },
    ])
    render(
      <DiagramStoreContext.Provider value={store as StoreApi<DiagramStore>}>
        <StateCodeBlockEditPanel elementId="c" />
      </DiagramStoreContext.Provider>
    )
    fireEvent.mouseDown(screen.getAllByRole("combobox").at(-1)!)
    return within(screen.getByRole("listbox"))
      .getAllByRole("option")
      .map((o) => o.textContent)
  }

  it("offers only Python for a new block", () => {
    expect(languages("python")).toEqual(["Python"])
  })

  it("still shows BAL for a block that already uses it", () => {
    expect(languages("bal")).toEqual(["Python", "BESSER Action Language"])
  })
})
