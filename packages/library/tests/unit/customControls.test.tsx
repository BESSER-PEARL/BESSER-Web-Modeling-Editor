import { Profiler } from "react"
import { describe, expect, it, vi } from "vitest"
import { act, render, screen } from "@testing-library/react"
import * as Y from "yjs"
import { ReactFlowProvider, type Node } from "@xyflow/react"
import type { StoreApi } from "zustand"
import {
  DiagramStoreContext,
  MetadataStoreContext,
} from "@/store/context"
import { createDiagramStore, DiagramStore } from "@/store/diagramStore"
import { createMetadataStore } from "@/store/metadataStore"
import { CustomControls } from "@/components/CustomControls"

/**
 * Canvas controls (develop a8eac70c / 2ef9aa0e): every button has a name and
 * is keyboard-operable, and a drag step does not re-render the bar.
 */

const node: Node = {
  id: "A",
  type: "class",
  position: { x: 0, y: 0 },
  width: 160,
  height: 100,
  data: { name: "A", attributes: [], methods: [] },
}

const mount = () => {
  const ydoc = new Y.Doc()
  const diagram = createDiagramStore(ydoc)
  const metadata = createMetadataStore(ydoc)
  act(() => diagram.getState().setNodes([node]))
  const onRender = vi.fn()
  render(
    <DiagramStoreContext.Provider value={diagram as StoreApi<DiagramStore>}>
      <MetadataStoreContext.Provider value={metadata}>
        <ReactFlowProvider>
          <Profiler id="controls" onRender={onRender}>
            <CustomControls />
          </Profiler>
        </ReactFlowProvider>
      </MetadataStoreContext.Provider>
    </DiagramStoreContext.Provider>
  )
  return { diagram, onRender }
}

describe("CustomControls", () => {
  it("names the auto-layout button and makes the zoom readout a button", () => {
    mount()
    expect(
      screen.getByRole("button", { name: "Auto-layout diagram" })
    ).toBeInTheDocument()
    const readout = screen.getByRole("button", { name: "Reset zoom to 100%" })
    expect(readout.tagName).toBe("BUTTON")
    expect(readout.textContent).toBe("100%")
  })

  it("does not re-render on a drag step", () => {
    const { diagram, onRender } = mount()
    onRender.mockClear()
    act(() =>
      diagram.getState().onNodesChange([
        { id: "A", type: "position", position: { x: 40, y: 0 }, dragging: true },
      ])
    )
    expect(onRender).not.toHaveBeenCalled()
  })
})
