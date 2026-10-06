import { Profiler, type ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen } from "@testing-library/react"
import * as Y from "yjs"
import type { Node } from "@xyflow/react"
import type { StoreApi } from "zustand"
import {
  DiagramStoreContext,
  MetadataStoreContext,
  PopoverStoreContext,
} from "@/store/context"
import { createDiagramStore, DiagramStore } from "@/store/diagramStore"
import { createMetadataStore } from "@/store/metadataStore"
import { createPopoverStore } from "@/store/popoverStore"

/**
 * Node toolbar (develop a8eac70c): Edit / Delete are named and work from the
 * keyboard; a drag of another node does not re-render this node's toolbar.
 * React Flow's NodeToolbar needs a mounted canvas, so it is a plain wrapper.
 */
vi.mock("@xyflow/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@xyflow/react")>()
  return {
    ...actual,
    NodeToolbar: ({ children, isVisible }: { children: ReactNode; isVisible?: boolean }) =>
      isVisible ? <div>{children}</div> : null,
  }
})

import { NodeToolbar } from "@/components/toolbars/NodeToolbar"

const classNode = (id: string, x: number): Node => ({
  id,
  type: "class",
  position: { x, y: 0 },
  width: 160,
  height: 100,
  data: { name: id, attributes: [], methods: [] },
})

const mount = () => {
  const ydoc = new Y.Doc()
  const diagram = createDiagramStore(ydoc)
  const metadata = createMetadataStore(ydoc)
  const popover = createPopoverStore()
  act(() => {
    diagram.getState().setNodes([classNode("A", 0), classNode("B", 300)])
    diagram.getState().setSelectedElementsId(["A"])
  })
  const onRender = vi.fn()
  render(
    <DiagramStoreContext.Provider value={diagram as StoreApi<DiagramStore>}>
      <MetadataStoreContext.Provider value={metadata}>
        <PopoverStoreContext.Provider value={popover}>
          <Profiler id="toolbar" onRender={onRender}>
            <NodeToolbar elementId="A" />
          </Profiler>
        </PopoverStoreContext.Provider>
      </MetadataStoreContext.Provider>
    </DiagramStoreContext.Provider>
  )
  return { diagram, popover, onRender }
}

describe("NodeToolbar keyboard access", () => {
  it("Enter on Edit opens the inspector; Space on Delete removes the node", () => {
    const { diagram, popover } = mount()

    const edit = screen.getByRole("button", { name: "Edit" })
    expect(edit.getAttribute("tabindex")).toBe("0")
    fireEvent.keyDown(edit, { key: "Enter" })
    expect(popover.getState().popoverElementId).toBe("A")

    fireEvent.keyDown(screen.getByRole("button", { name: "Delete" }), { key: " " })
    expect(diagram.getState().nodes.map((n) => n.id)).toEqual(["B"])
  })

  it("does not re-render when another node is dragged", () => {
    const { diagram, onRender } = mount()
    onRender.mockClear()
    act(() =>
      diagram.getState().onNodesChange([
        { id: "B", type: "position", position: { x: 340, y: 0 }, dragging: true },
      ])
    )
    expect(onRender).not.toHaveBeenCalled()
  })
})
