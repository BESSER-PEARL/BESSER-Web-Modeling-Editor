// Load the library through its public entry FIRST, exactly like the
// webapp does, so module-evaluation order (and the popover seeds that
// depend on it) matches production.
import "@/index"
import { describe, expect, it } from "vitest"
import { ReactFlowProvider } from "@xyflow/react"
import { act, render, screen } from "@testing-library/react"
import * as Y from "yjs"
import type { Edge, Node } from "@xyflow/react"
import {
  DiagramStoreContext,
  MetadataStoreContext,
  PopoverStoreContext,
} from "@/store/context"
import { createDiagramStore } from "@/store/diagramStore"
import { createMetadataStore } from "@/store/metadataStore"
import { createPopoverStore } from "@/store/popoverStore"
// Production bootstrap: PopoverManager seeds the stock popovers + the
// assessment fallbacks; the inspectors barrel registers BESSER panels.
import "@/components/popovers/PopoverManager"
import "@/components/inspectors"
import { diagramNodeTypes } from "@/nodes"
import { diagramEdgeTypes } from "@/edges/types"
import "@/edges"
import {
  getInspector,
  registerInspector,
  registerInspectorAlias,
  resolveElementInspector,
} from "@/components/inspectors/registry"
import { NODE_TYPE_INSPECTOR_ALIASES } from "@/components/inspectors/nodeTypeInspectorAliases"
import { DefaultNodeEditPopover } from "@/components/popovers/DefaultNodeEditPopover"
import { ComponentEditPopover } from "@/components/popovers/componentDiagram"
import { DeploymentNodeEditPopover } from "@/components/popovers/deploymentDiagram"
import { BPMNTaskEditPopover } from "@/components/popovers/bpmnDiagram"
import { ReachabilityGraphMarkingEditPopover } from "@/components/popovers/reachabilityGraphDiagram"
import { ActivityMergeNodeEditPanel } from "@/components/inspectors/activityDiagram"
import {
  ElementGiveFeedbackPopover,
  ElementSeeFeedbackPopover,
} from "@/components/popovers/ElementFeedbackPopovers"
import {
  ObjectGiveFeedbackPopover,
  ObjectSeeFeedbackPopover,
} from "@/components/popovers/objectDiagram"
import { PropertiesPanel } from "@/components/propertiesPanel/PropertiesPanel"
import { BesserMode } from "@/typings"

/**
 * Node types that intentionally have NO edit inspector — v3 `popups.ts`
 * mapped them to `null` (or they never had an editor).
 */
const NO_EDITOR_NODE_TYPES = new Set([
  "UserModelIcon",
  "titleAndDesctiption",
  "sfcTransitionBranch",
  "AgentLLM",
])

describe("inspector registry — every node type resolves its editor", () => {
  it("every registered node type (bar the v3 `null` ones) has an edit inspector", () => {
    const missing = Object.keys(diagramNodeTypes).filter(
      (type) =>
        !NO_EDITOR_NODE_TYPES.has(type) && getInspector(type, "edit") === null
    )
    expect(missing).toEqual([])
  })

  it("keeps the v3 `null` types editor-less", () => {
    for (const type of NO_EDITOR_NODE_TYPES) {
      expect(getInspector(type, "edit")).toBeNull()
    }
  })

  it("maps camelCase node types to the type-specific v3 popup", () => {
    expect(getInspector("package", "edit")).toBe(DefaultNodeEditPopover)
    expect(getInspector("colorDescription", "edit")).toBe(
      DefaultNodeEditPopover
    )
    expect(getInspector("activityActionNode", "edit")).toBe(
      DefaultNodeEditPopover
    )
    expect(getInspector("useCaseActor", "edit")).toBe(DefaultNodeEditPopover)
    expect(getInspector("component", "edit")).toBe(ComponentEditPopover)
    expect(getInspector("deploymentNode", "edit")).toBe(
      DeploymentNodeEditPopover
    )
    expect(getInspector("bpmnTask", "edit")).toBe(BPMNTaskEditPopover)
    expect(getInspector("reachabilityGraphMarking", "edit")).toBe(
      ReachabilityGraphMarkingEditPopover
    )
    expect(getInspector("activityMergeNode", "edit")).toBe(
      ActivityMergeNodeEditPanel
    )
  })

  it("every alias target is itself a registered inspector key", () => {
    for (const target of new Set(Object.values(NODE_TYPE_INSPECTOR_ALIASES))) {
      expect(getInspector(target, "edit")).not.toBeNull()
    }
  })

  it("aliases resolve at lookup time (later overrides are picked up)", () => {
    const First = () => null
    const Second = () => null
    registerInspector("__aliasTarget", "edit", First)
    registerInspectorAlias("__aliasSource", "__aliasTarget")
    expect(getInspector("__aliasSource", "edit")).toBe(First)
    registerInspector("__aliasTarget", "edit", Second)
    expect(getInspector("__aliasSource", "edit")).toBe(Second)
  })

  it("popover resolution prefers the element's own type over the passed popover type", () => {
    // ActivityMergeNode passes `type="default"` to PopoverManager, but its
    // node type has a dedicated panel — both surfaces must open it.
    expect(
      resolveElementInspector("activityMergeNode", "edit", "default")
    ).toBe(ActivityMergeNodeEditPanel)
    // Unknown element type → the passed popover type still works.
    expect(resolveElementInspector(undefined, "edit", "default")).toBe(
      DefaultNodeEditPopover
    )
    expect(
      resolveElementInspector("UserModelIcon", "edit", "UserModelIcon")
    ).toBeNull()
  })
})

describe("inspector registry — assessment is generic", () => {
  it("every node type has feedbackGive + feedbackSee bodies", () => {
    for (const type of Object.keys(diagramNodeTypes)) {
      expect(getInspector(type, "feedbackGive"), type).not.toBeNull()
      expect(getInspector(type, "feedbackSee"), type).not.toBeNull()
    }
  })

  it("every edge type has feedbackGive + feedbackSee bodies", () => {
    for (const type of Object.keys(diagramEdgeTypes)) {
      expect(getInspector(type, "feedbackGive"), type).not.toBeNull()
      expect(getInspector(type, "feedbackSee"), type).not.toBeNull()
    }
  })

  it("State / Agent / NN / comment / edges fall back to the generic body", () => {
    for (const type of [
      "State",
      "AgentState",
      "Conv2DLayer",
      "NNContainer",
      "ClassOCLConstraint",
      "comment",
      "StateTransition",
      "AgentStateTransition",
      "NNNext",
      "CommentLink",
      "UserModelLink",
    ]) {
      expect(getInspector(type, "feedbackGive")).toBe(
        ElementGiveFeedbackPopover
      )
      expect(getInspector(type, "feedbackSee")).toBe(ElementSeeFeedbackPopover)
    }
  })

  it("UserModelName scores its attribute rows like ObjectName", () => {
    expect(getInspector("UserModelName", "feedbackGive")).toBe(
      ObjectGiveFeedbackPopover
    )
    expect(getInspector("UserModelName", "feedbackSee")).toBe(
      ObjectSeeFeedbackPopover
    )
  })
})

// ---------------------------------------------------------------------------
// PropertiesPanel end-to-end: the panel must open for camelCase node types
// (previously `getInspector("package", …)` returned null) and, in
// assessment mode, for element kinds without a dedicated feedback body.
// ---------------------------------------------------------------------------
const renderPanel = (nodes: Node[], edges: Edge[] = []) => {
  const ydoc = new Y.Doc()
  const diagram = createDiagramStore(ydoc)
  const metadata = createMetadataStore(ydoc)
  const popover = createPopoverStore()
  diagram.getState().setNodesAndEdges(nodes, edges)
  render(
    <ReactFlowProvider>
      <DiagramStoreContext.Provider value={diagram}>
        <MetadataStoreContext.Provider value={metadata}>
          <PopoverStoreContext.Provider value={popover}>
            <PropertiesPanel />
          </PopoverStoreContext.Provider>
        </MetadataStoreContext.Provider>
      </DiagramStoreContext.Provider>
    </ReactFlowProvider>
  )
  return { diagram, metadata, popover }
}

describe("PropertiesPanel — camelCase node types + generic assessment", () => {
  it("opens for a `package` node", () => {
    const { popover } = renderPanel([
      {
        id: "pkg-1",
        type: "package",
        position: { x: 0, y: 0 },
        width: 200,
        height: 100,
        data: { name: "billing" },
      },
    ])
    act(() => popover.getState().setPopOverElementId("pkg-1"))
    expect(screen.getByLabelText("Close editor")).toBeInTheDocument()
    expect(screen.getByDisplayValue("billing")).toBeInTheDocument()
  })

  it("opens the feedback body for a State node in assessment mode", () => {
    const { popover, metadata } = renderPanel([
      {
        id: "st-1",
        type: "State",
        position: { x: 0, y: 0 },
        width: 160,
        height: 100,
        data: { name: "Idle" },
      },
    ])
    act(() => {
      metadata.getState().setMode(BesserMode.Assessment)
      popover.getState().setPopOverElementId("st-1")
    })
    expect(screen.getByLabelText("Close editor")).toBeInTheDocument()
    expect(screen.getByText(/Idle/)).toBeInTheDocument()
  })

  it("opens the feedback body for a StateTransition edge in assessment mode", () => {
    const nodes: Node[] = ["a", "b"].map((id) => ({
      id,
      type: "State",
      position: { x: 0, y: 0 },
      width: 160,
      height: 100,
      data: { name: id },
    }))
    const { popover, metadata } = renderPanel(nodes, [
      { id: "tr-1", type: "StateTransition", source: "a", target: "b" },
    ])
    act(() => {
      metadata.getState().setMode(BesserMode.Assessment)
      popover.getState().setPopOverElementId("tr-1")
    })
    expect(screen.getByLabelText("Close editor")).toBeInTheDocument()
    expect(screen.getByRole("spinbutton")).toBeInTheDocument()
  })
})
