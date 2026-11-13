import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import React from "react"
import * as Y from "yjs"
import type { Node } from "@xyflow/react"
import type { StoreApi } from "zustand"
import { getInspector } from "@/components/inspectors/registry"
// Side-effect imports — each barrel registers its panels against the
// central inspector registry exactly like the production bootstrap
// (`lib/components/inspectors/index.ts`).
import "@/components/inspectors/userDiagram"
import "@/components/inspectors/objectDiagram"
import {
  AgentDiagramEdgeEditPanel,
  AgentDiagramInitEdgeEditPanel,
} from "@/components/inspectors/agentDiagram"
import { StateMachineDiagramEdgeEditPanel } from "@/components/inspectors/stateMachineDiagram"
import { ObjectLinkEditPanel } from "@/components/inspectors/objectDiagram/ObjectLinkEditPanel"
import { ObjectEditPopover } from "@/components/popovers/objectDiagram/ObjectEditPopover"
import { DiagramStoreContext } from "@/store/context"
import { createDiagramStore, DiagramStore } from "@/store/diagramStore"
import {
  CommentEditPanel,
  CommentLinkEditPanel,
} from "@/components/inspectors/common"

// ---------------------------------------------------------------------------
// Edge inspector registration — hand-drawn edges on the BESSER
// behavioral diagrams must open the right edit panel. v3 parity:
// `UserModelLink` maps onto the same inspector as `ObjectLink`
// (`uml-relationships.ts`: UserModelLink → UMLObjectLink).
// ---------------------------------------------------------------------------
describe("edge inspector registration", () => {
  it("registers the ObjectLink-style panel for UserModelLink", () => {
    expect(getInspector("UserModelLink", "edit")).toBe(ObjectLinkEditPanel)
  })

  it("keeps ObjectLink on the same panel (shared inspector)", () => {
    expect(getInspector("ObjectLink", "edit")).toBe(ObjectLinkEditPanel)
  })

  it("registers the agent transition panels", () => {
    expect(getInspector("AgentStateTransition", "edit")).toBe(
      AgentDiagramEdgeEditPanel
    )
    expect(getInspector("AgentStateTransitionInit", "edit")).toBe(
      AgentDiagramInitEdgeEditPanel
    )
  })

  it("registers the state-machine transition panel", () => {
    expect(getInspector("StateTransition", "edit")).toBe(
      StateMachineDiagramEdgeEditPanel
    )
  })

  it("registers the comment sticky-note + CommentLink tether panels", () => {
    // Registry resolution lights up BOTH surfaces (PropertiesPanel and
    // PopoverManager) from this single registration.
    expect(getInspector("comment", "edit")).toBe(CommentEditPanel)
    expect(getInspector("CommentLink", "edit")).toBe(CommentLinkEditPanel)
  })
})

// ---------------------------------------------------------------------------
// Object-diagram node popover — must delegate to the full `ObjectEditPanel`
// (class link + type-aware widgets), not the old class-oriented
// `EditableAttributeList` stub which had no class picker at all. This
// guards against a future revert of that delegation shipping silently.
// ---------------------------------------------------------------------------
describe("ObjectEditPopover — delegates to the full ObjectEditPanel", () => {
  it("renders the class-link picker for a classId-linked object node", () => {
    const node: Node = {
      id: "obj-1",
      type: "objectName",
      position: { x: 0, y: 0 },
      width: 200,
      height: 100,
      data: {
        name: "rex",
        classId: "cls-dog",
        className: "Dog",
        attributes: [],
      },
    }
    const store = createDiagramStore(new Y.Doc())
    store.getState().setNodes([node])
    render(
      React.createElement(
        DiagramStoreContext.Provider,
        { value: store as StoreApi<DiagramStore> },
        React.createElement(ObjectEditPopover, { elementId: "obj-1" })
      )
    )

    // The old EditableAttributeList-based stub rendered no combobox at
    // all — its rows were plain free-form name textfields. The class
    // picker (`ObjectEditPanel`'s "class" Select) is the tell.
    expect(screen.getByText("class")).toBeInTheDocument()
    expect(screen.getAllByRole("combobox").length).toBeGreaterThan(0)
  })
})
