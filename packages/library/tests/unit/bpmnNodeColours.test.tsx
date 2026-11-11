/**
 * Fill, line and text colour are editable on every BPMN shape that had them
 * on develop (bpmn-popup-header.tsx, bpmn-gateway-update.tsx).
 */
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import * as Y from "yjs"
import { ReactFlowProvider, type Node } from "@xyflow/react"
import type { StoreApi } from "zustand"
import { DiagramStoreContext, MetadataStoreContext } from "@/store/context"
import { createDiagramStore, DiagramStore } from "@/store/diagramStore"
import { createMetadataStore } from "@/store/metadataStore"
import {
  BPMNCallActivityEditPopover,
  BPMNEndEventEditPopover,
  BPMNGatewayEditPopover,
  BPMNIntermediateEventEditPopover,
  BPMNStartEventEditPopover,
  BPMNSubprocessEditPopover,
  BPMNTransactionEditPopover,
} from "@/components/popovers/bpmnDiagram"
import type { PopoverProps } from "@/components/popovers/types"

const updateNodeData = vi.fn()
vi.mock("@xyflow/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@xyflow/react")>()
  return {
    ...actual,
    useReactFlow: () => ({ ...actual.useReactFlow(), updateNodeData }),
  }
})

afterEach(() => {
  cleanup()
  updateNodeData.mockClear()
})

const open = (Popover: React.FC<PopoverProps>, type: string) => {
  const ydoc = new Y.Doc()
  const diagram = createDiagramStore(ydoc) as StoreApi<DiagramStore>
  const node: Node = {
    id: "n",
    type,
    position: { x: 0, y: 0 },
    width: 40,
    height: 40,
    data: { name: "Shape" },
  }
  diagram.getState().setNodes([node])
  render(
    <DiagramStoreContext.Provider value={diagram}>
      <MetadataStoreContext.Provider value={createMetadataStore(ydoc)}>
        <ReactFlowProvider>
          <Popover elementId="n" />
        </ReactFlowProvider>
      </MetadataStoreContext.Provider>
    </DiagramStoreContext.Provider>
  )
  return diagram
}

const pickFillRed = () => {
  fireEvent.click(screen.getByRole("button", { name: "Toggle color settings" }))
  fireEvent.click(screen.getByRole("button", { name: "Fill Color" }))
  fireEvent.click(screen.getByRole("button", { name: "Red" }))
}

describe("BPMN colour editing", () => {
  it.each([
    ["bpmnStartEvent", BPMNStartEventEditPopover],
    ["bpmnIntermediateEvent", BPMNIntermediateEventEditPopover],
    ["bpmnEndEvent", BPMNEndEventEditPopover],
    ["bpmnSubprocess", BPMNSubprocessEditPopover],
    ["bpmnTransaction", BPMNTransactionEditPopover],
    ["bpmnCallActivity", BPMNCallActivityEditPopover],
  ])("%s offers fill, line and text colour", (type, Popover) => {
    open(Popover, type)
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Shape")
    fireEvent.click(screen.getByRole("button", { name: "Toggle color settings" }))
    for (const label of ["Fill Color", "Line Color", "Text Color"]) {
      expect(screen.getByRole("button", { name: label })).toBeTruthy()
    }
    fireEvent.click(screen.getByRole("button", { name: "Fill Color" }))
    fireEvent.click(screen.getByRole("button", { name: "Red" }))
    expect(updateNodeData).toHaveBeenCalledWith("n", { fillColor: "#fc5c65" })
  })

  it("a gateway stores the picked colour", () => {
    const diagram = open(BPMNGatewayEditPopover, "bpmnGateway")
    pickFillRed()
    expect(diagram.getState().nodes[0].data).toMatchObject({
      name: "Shape",
      fillColor: "#fc5c65",
    })
  })

  it("the start event's type select carries no leftover debug colour", () => {
    open(BPMNStartEventEditPopover, "bpmnStartEvent")
    const select = screen.getByRole("combobox", { name: "Start Type" })
    expect(getComputedStyle(select.parentElement!).color).not.toBe("red")
    expect(getComputedStyle(select.parentElement!).color).not.toBe("rgb(255, 0, 0)")
  })
})
