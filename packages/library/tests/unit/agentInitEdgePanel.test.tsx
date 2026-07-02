import { describe, it, expect } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import * as Y from "yjs"
import { ReactFlowProvider, type Edge } from "@xyflow/react"
import type { StoreApi } from "zustand"
import { DiagramStoreContext, PopoverStoreContext } from "@/store/context"
import { createDiagramStore, DiagramStore } from "@/store/diagramStore"
import { createPopoverStore } from "@/store/popoverStore"
import { AgentDiagramInitEdgeEditPanel } from "@/components/inspectors/agentDiagram/AgentDiagramInitEdgeEditPanel"
import { DraggableGhost } from "@/components/DraggableGhost"
import { dropElementConfigs, DropElementConfig } from "@/constants"
import { UMLDiagramType } from "@/types"
import type { AgentStateBodyRow } from "@/types"

/**
 * Wave-3 agent polish — init-edge inspector controls.
 *
 * Develop parity: `AgentStateTransitionInit` resolves to
 * `DefaultRelationshipPopup` (header + line-color style pane + delete).
 * The migration panel mirrors that surface plus the flip affordance the
 * sibling `AgentDiagramEdgeEditPanel` exposes:
 *
 *   1. style header + flip + delete controls render,
 *   2. flip swaps source/target (and handle ids),
 *   3. delete removes the edge AND closes the popover,
 *   4. line / text color picks write through to the edge data,
 *   5. a missing edge renders nothing (popover may outlive the edge).
 *
 * Plus the palette remainder (develop `agent-state-preview.ts`
 * `stateWithBothBodies`): the third AgentState preview with body +
 * fallback rows, and the `DraggableGhost` re-id of template body rows
 * on drop (their ids become top-level v3 element ids on export).
 */

/* ────────────────────────────── helpers ────────────────────────────── */

const initEdge = (over: Partial<Edge> = {}): Edge => ({
  id: "edge-1",
  type: "AgentStateTransitionInit" as Edge["type"],
  source: "init-1",
  sourceHandle: "right",
  target: "state-1",
  targetHandle: "left",
  data: {},
  ...over,
})

const renderPanel = (edges: Edge[], elementId = "edge-1") => {
  const diagramStore = createDiagramStore(new Y.Doc())
  diagramStore.getState().setEdges(edges)
  const popoverStore = createPopoverStore()
  popoverStore.getState().setPopOverElementId(elementId)
  const utils = render(
    <DiagramStoreContext.Provider
      value={diagramStore as StoreApi<DiagramStore>}
    >
      <PopoverStoreContext.Provider value={popoverStore}>
        <AgentDiagramInitEdgeEditPanel elementId={elementId} />
      </PopoverStoreContext.Provider>
    </DiagramStoreContext.Provider>
  )
  return { diagramStore, popoverStore, ...utils }
}

const getEdge = (store: StoreApi<DiagramStore>, id = "edge-1") =>
  store.getState().edges.find((e) => e.id === id)

/** Open the color pane, drill into the row labelled `rowLabel`, then
 * click the palette swatch with the given (jsdom-normalized) rgb. */
const pickColor = (
  container: HTMLElement,
  rowLabel: string,
  swatchRgb: string
) => {
  fireEvent.click(screen.getByLabelText("Toggle color settings"))
  const row = screen.getByText(rowLabel).parentElement!
  fireEvent.click(row.querySelector("button")!)
  const swatch = Array.from(
    container.querySelectorAll<HTMLButtonElement>("button")
  ).find((b) => b.style.backgroundColor === swatchRgb)
  expect(swatch).toBeDefined()
  fireEvent.click(swatch!)
}

/* ───────────────────────── inspector controls ──────────────────────── */

describe("AgentDiagramInitEdgeEditPanel", () => {
  it("renders the style header with flip and delete controls", () => {
    renderPanel([initEdge()])
    expect(screen.getByText("Init Transition")).toBeDefined()
    expect(
      screen.getByRole("button", { name: "Flip source / target" })
    ).toBeDefined()
    expect(
      screen.getByRole("button", { name: "Delete init transition" })
    ).toBeDefined()
  })

  it("flips source/target and their handle ids", () => {
    const { diagramStore } = renderPanel([initEdge()])
    fireEvent.click(screen.getByRole("button", { name: "Flip source / target" }))
    expect(getEdge(diagramStore)).toMatchObject({
      source: "state-1",
      sourceHandle: "left",
      target: "init-1",
      targetHandle: "right",
    })
  })

  it("delete removes the edge and closes the popover", () => {
    const { diagramStore, popoverStore } = renderPanel([initEdge()])
    fireEvent.click(
      screen.getByRole("button", { name: "Delete init transition" })
    )
    expect(diagramStore.getState().edges).toHaveLength(0)
    expect(popoverStore.getState().popoverElementId).toBeNull()
  })

  it("writes a line-color pick to the edge data", () => {
    const { diagramStore, container } = renderPanel([initEdge()])
    // #fc5c65 — first palette swatch.
    pickColor(container, "Line Color", "rgb(252, 92, 101)")
    expect((getEdge(diagramStore)!.data as { strokeColor?: string }).strokeColor)
      .toBe("#fc5c65")
  })

  it("writes a text-color pick to the edge data", () => {
    const { diagramStore, container } = renderPanel([initEdge()])
    // #fd9644 — second palette swatch.
    pickColor(container, "Text Color", "rgb(253, 150, 68)")
    expect((getEdge(diagramStore)!.data as { textColor?: string }).textColor)
      .toBe("#fd9644")
  })

  it("renders nothing when the edge no longer exists", () => {
    const { container } = renderPanel([], "gone")
    expect(container.textContent).toBe("")
  })
})

/* ──────────────────── palette — body+fallback preview ──────────────── */

describe("AgentDiagram palette — AgentState previews (develop parity)", () => {
  const entries = dropElementConfigs[UMLDiagramType.AgentDiagram]
  // Standard AgentState body previews. The reasoning drag source is also
  // `AgentState`-typed (develop folded AgentReasoningState into
  // `stateType: "reasoning"`), so exclude it here to count only the
  // standard body-preview variants.
  const states = entries.filter(
    (e) =>
      (e.type as string) === "AgentState" &&
      (e.defaultData as { stateType?: string })?.stateType !== "reasoning"
  )

  it("offers three AgentState previews (empty / body / body+fallback)", () => {
    // Develop `agent-state-preview.ts` composes emptyAgentState,
    // agentState-with-body and stateWithBothBodies.
    expect(states).toHaveLength(3)
  })

  it("ships a preview carrying one body and one fallback template row", () => {
    const withFallback = states.find((s) =>
      Array.isArray(
        (s.defaultData as { fallbackBodies?: unknown[] })?.fallbackBodies
      )
    )
    expect(withFallback).toBeDefined()
    const dd = withFallback!.defaultData as {
      bodies: AgentStateBodyRow[]
      fallbackBodies: AgentStateBodyRow[]
    }
    expect(dd.bodies).toHaveLength(1)
    expect(dd.bodies[0]).toMatchObject({ name: "Body", replyType: "text" })
    expect(dd.fallbackBodies).toHaveLength(1)
    expect(dd.fallbackBodies[0]).toMatchObject({
      name: "Fallback Body",
      replyType: "text",
    })
  })
})

/* ─────────────────── DraggableGhost — body row re-id ────────────────── */

describe("DraggableGhost — AgentState template body re-id on drop", () => {
  const withFallbackConfig = (
    dropElementConfigs[UMLDiagramType.AgentDiagram] as ReadonlyArray<DropElementConfig>
  ).find((e) =>
    Array.isArray(
      (e.defaultData as { fallbackBodies?: unknown[] })?.fallbackBodies
    )
  )!

  const renderGhost = () => {
    const store = createDiagramStore(new Y.Doc())
    store.getState().setDiagramId("dg-test")
    const canvas = document.createElement("div")
    canvas.id = "react-flow-library-dg-test"
    document.body.appendChild(canvas)
    const utils = render(
      <ReactFlowProvider>
        <DiagramStoreContext.Provider value={store as StoreApi<DiagramStore>}>
          <DraggableGhost dropElementConfig={withFallbackConfig}>
            <div data-testid="palette-item">AgentState</div>
          </DraggableGhost>
        </DiagramStoreContext.Provider>
      </ReactFlowProvider>
    )
    const drop = () => {
      // jsdom rects are all-zero, so (0,0) counts as inside the canvas.
      fireEvent.pointerDown(screen.getAllByTestId("palette-item")[0], {
        clientX: 0,
        clientY: 0,
      })
      fireEvent.pointerUp(document, { clientX: 0, clientY: 0 })
    }
    return { store, drop, canvas, ...utils }
  }

  it("re-ids body/fallback rows per drop (no shared v3 element ids)", () => {
    const { store, drop, canvas } = renderGhost()
    try {
      drop()
      drop()
      const nodes = store.getState().nodes
      expect(nodes).toHaveLength(2)
      const rows = nodes.flatMap((n) => {
        const d = n.data as {
          bodies?: AgentStateBodyRow[]
          fallbackBodies?: AgentStateBodyRow[]
        }
        return [...(d.bodies ?? []), ...(d.fallbackBodies ?? [])]
      })
      expect(rows).toHaveLength(4)
      // Template placeholder ids must never reach the canvas …
      for (const row of rows) {
        expect(row.id).not.toBe("agentstate-template-body")
        expect(row.id).not.toBe("agentstate-template-fallback-body")
      }
      // … and every dropped row id must be unique (v3 export keys
      // `elements[row.id]`, so collisions silently drop bodies).
      expect(new Set(rows.map((r) => r.id)).size).toBe(4)
    } finally {
      canvas.remove()
    }
  })
})
