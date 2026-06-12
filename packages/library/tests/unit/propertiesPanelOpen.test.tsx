import { describe, it, expect, beforeEach } from "vitest"
import { act, fireEvent, render, screen } from "@testing-library/react"
import * as Y from "yjs"
import type { Node } from "@xyflow/react"
import {
  DiagramStoreContext,
  MetadataStoreContext,
  PopoverStoreContext,
} from "@/store/context"
import { createDiagramStore } from "@/store/diagramStore"
import { createMetadataStore } from "@/store/metadataStore"
import { createPopoverStore } from "@/store/popoverStore"
import { PropertiesPanel } from "@/components/propertiesPanel/PropertiesPanel"
import {
  PANEL_DEFAULT_WIDTH,
  usePropertiesPanelStore,
} from "@/store/propertiesPanelStore"
import { registerInspector } from "@/components/inspectors/registry"

// Register a stub editor for the "class" node type so the panel can resolve
// an inspector. The test asserts the open/close TRIGGER, not which body renders.
registerInspector("class", "edit", () => <div data-testid="class-inspector" />)

/**
 * The right-side inspector must open ONLY for an explicit edit target
 * (double-click or the edit button, both via setPopOverElementId) — never
 * from plain selection or a palette drop.
 */

const classNode = (): Node => ({
  id: "class-1",
  type: "class",
  position: { x: 0, y: 0 },
  width: 200,
  height: 110,
  data: { name: "Person", attributes: [], methods: [] },
})

const renderPanel = () => {
  const ydoc = new Y.Doc()
  const diagram = createDiagramStore(ydoc)
  const metadata = createMetadataStore(ydoc)
  const popover = createPopoverStore()
  diagram.getState().setNodes([classNode()])
  const utils = render(
    <DiagramStoreContext.Provider value={diagram}>
      <MetadataStoreContext.Provider value={metadata}>
        <PopoverStoreContext.Provider value={popover}>
          <PropertiesPanel />
        </PopoverStoreContext.Provider>
      </MetadataStoreContext.Provider>
    </DiagramStoreContext.Provider>
  )
  return { diagram, popover, ...utils }
}

describe("PropertiesPanel open trigger", () => {
  beforeEach(() => {
    usePropertiesPanelStore.setState({ panelWidth: PANEL_DEFAULT_WIDTH })
  })

  it("stays closed when an element is only selected (e.g. after a drop)", () => {
    const { diagram } = renderPanel()
    act(() => diagram.getState().setSelectedElementsId(["class-1"]))
    // No inspector content rendered — selection alone does not open it.
    expect(screen.queryByLabelText("Close editor")).toBeNull()
  })

  it("opens when an explicit edit target is set (double-click / edit button)", () => {
    const { popover } = renderPanel()
    act(() => popover.getState().setPopOverElementId("class-1"))
    expect(screen.getByLabelText("Close editor")).toBeInTheDocument()
  })

  it("closes again when the edit target is cleared via the close button", () => {
    const { popover } = renderPanel()
    act(() => popover.getState().setPopOverElementId("class-1"))
    fireEvent.click(screen.getByLabelText("Close editor"))
    expect(screen.queryByLabelText("Close editor")).toBeNull()
    expect(popover.getState().popoverElementId).toBeNull()
  })
})
