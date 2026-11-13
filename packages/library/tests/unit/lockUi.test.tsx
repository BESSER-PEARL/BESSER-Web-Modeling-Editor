import { describe, expect, it } from "vitest"
import { act, fireEvent, render, screen } from "@testing-library/react"
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
import { CustomControls } from "@/components/CustomControls"
import { InspectorLockGate } from "@/components/inspectors/_shared/InspectorLockGate"
import { DefaultNodeWrapper } from "@/nodes/wrappers"
import { DraggableGhost } from "@/components/DraggableGhost"
import { dropElementConfigs } from "@/constants"
import { UMLDiagramType } from "@/types"

/** The lock controls: canvas toggle, inspector notice, node badge, palette. */

const node = (id: string, over: Partial<Node> = {}): Node => ({
  id,
  type: "class",
  position: { x: 0, y: 0 },
  width: 160,
  height: 100,
  data: { name: id, attributes: [], methods: [] },
  ...over,
})

const setup = (ui: React.ReactElement, nodes: Node[] = []) => {
  const ydoc = new Y.Doc()
  const diagram = createDiagramStore(ydoc)
  act(() => diagram.getState().loadNodesAndEdges(nodes, []))
  render(
    <DiagramStoreContext.Provider value={diagram as StoreApi<DiagramStore>}>
      <MetadataStoreContext.Provider value={createMetadataStore(ydoc)}>
        <PopoverStoreContext.Provider value={createPopoverStore()}>
          <AssessmentSelectionStoreContext.Provider
            value={createAssessmentSelectionStore()}
          >
            <ReactFlowProvider>{ui}</ReactFlowProvider>
          </AssessmentSelectionStoreContext.Provider>
        </PopoverStoreContext.Provider>
      </MetadataStoreContext.Provider>
    </DiagramStoreContext.Provider>
  )
  return diagram
}

describe("diagram lock toggle", () => {
  it("is a pressed toggle that locks the diagram and disables auto-layout", () => {
    const diagram = setup(<CustomControls />, [node("A")])
    const toggle = screen.getByRole("button", { name: "Lock diagram" })
    expect(toggle).toHaveAttribute("aria-pressed", "false")
    expect(screen.getByRole("button", { name: "Auto-layout diagram" })).toBeEnabled()

    fireEvent.click(toggle)
    expect(diagram.getState().diagramLocked).toBe(true)
    expect(toggle).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: "Auto-layout diagram" })).toBeDisabled()
  })
})

describe("inspector of a locked element", () => {
  const Fields = () => <input aria-label="Name" defaultValue="A" />

  it("shows a notice, disables the fields and unlocks from there", () => {
    const diagram = setup(
      <InspectorLockGate elementId="A">
        <Fields />
      </InspectorLockGate>,
      [{ ...node("A"), locked: true } as Node]
    )
    expect(screen.getByRole("status")).toHaveTextContent("This element is locked.")
    expect(screen.getByLabelText("Name")).toBeDisabled()

    fireEvent.click(screen.getByRole("button", { name: "Unlock" }))
    expect(diagram.getState().nodes[0]).not.toHaveProperty("locked")
    expect(screen.queryByRole("status")).toBeNull()
    expect(screen.getByLabelText("Name")).toBeEnabled()
  })

  it("names the diagram lock and unlocks the diagram", () => {
    const diagram = setup(
      <InspectorLockGate elementId="A">
        <Fields />
      </InspectorLockGate>,
      [node("A")]
    )
    act(() => diagram.getState().setDiagramLocked(true))
    expect(screen.getByRole("status")).toHaveTextContent("This diagram is locked.")
    expect(screen.getByLabelText("Name")).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "Unlock diagram" }))
    expect(diagram.getState().diagramLocked).toBe(false)
  })
})

describe("locked node on the canvas", () => {
  it("shows a lock badge on the locked node only, and marks its content pinned", () => {
    setup(
      <>
        <DefaultNodeWrapper elementId="pkg">pkg</DefaultNodeWrapper>
        <DefaultNodeWrapper elementId="A">A</DefaultNodeWrapper>
        <DefaultNodeWrapper elementId="B">B</DefaultNodeWrapper>
      </>,
      [
        { ...node("pkg", { type: "package" }), locked: true } as Node,
        node("A", { parentId: "pkg" }),
        node("B"),
      ]
    )
    expect(screen.getAllByRole("img", { name: "Locked" })).toHaveLength(1)
    // The locked package and its child are pinned; B is not.
    expect(document.querySelectorAll(".besser-node-lock")).toHaveLength(2)
    expect(document.querySelector(".besser-node-lock")).toHaveAttribute("data-export-skip")
  })
})

describe("palette of a locked diagram", () => {
  it("is disabled", () => {
    const config = dropElementConfigs[UMLDiagramType.ClassDiagram][0]
    const diagram = setup(
      <DraggableGhost dropElementConfig={config}>
        <div />
      </DraggableGhost>
    )
    const item = document.querySelector(".besser-palette-item")!
    expect(item).toHaveAttribute("tabindex", "0")
    act(() => diagram.getState().setDiagramLocked(true))
    expect(item).toHaveAttribute("aria-disabled", "true")
    expect(item).toHaveAttribute("tabindex", "-1")
    fireEvent.click(item)
    expect(diagram.getState().nodes).toEqual([])
  })
})
