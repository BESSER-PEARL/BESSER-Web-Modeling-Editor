/**
 * Agent transition labels and the edge toolbar position (2026-10-08 UX
 * review). Each case records what the review saw before the fix.
 */
import { afterEach, describe, expect, it } from "vitest"
import { act, cleanup, render } from "@testing-library/react"
import * as Y from "yjs"
import { Position, ReactFlowProvider, type Edge, type Node } from "@xyflow/react"
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
import { AgentDiagramEdge } from "@/edges/edgeTypes/AgentDiagramEdge"
import { labelClearOfEnds } from "@/edges/curvedPath"
import * as edgeUtils from "@/utils/edgeUtils"

const node = (id: string, x: number, y: number, width = 160, height = 80): Node => ({
  id,
  type: "AgentState",
  position: { x, y },
  width,
  height,
  measured: { width, height },
  data: { name: id },
})

const renderAgentEdge = (data: Record<string, unknown>, nodes: Node[]) => {
  const edge: Edge = { id: "t", type: "AgentStateTransition", source: "a", target: "b", data }
  const ydoc = new Y.Doc()
  const diagram = createDiagramStore(ydoc)
  act(() => {
    diagram.getState().setNodes(nodes)
    diagram.getState().setEdges([edge])
  })
  return render(
    <DiagramStoreContext.Provider value={diagram as StoreApi<DiagramStore>}>
      <MetadataStoreContext.Provider value={createMetadataStore(ydoc)}>
        <PopoverStoreContext.Provider value={createPopoverStore()}>
          <AssessmentSelectionStoreContext.Provider value={createAssessmentSelectionStore()}>
            <ReactFlowProvider initialNodes={nodes} initialEdges={[edge]}>
              <svg>
                <AgentDiagramEdge
                  id="t"
                  type="AgentStateTransition"
                  source="a"
                  target="b"
                  sourceX={80}
                  sourceY={80}
                  targetX={80}
                  targetY={130}
                  sourcePosition={Position.Bottom}
                  targetPosition={Position.Top}
                  data={data}
                />
              </svg>
            </ReactFlowProvider>
          </AssessmentSelectionStoreContext.Provider>
        </PopoverStoreContext.Provider>
      </MetadataStoreContext.Provider>
    </DiagramStoreContext.Provider>
  )
}

const labelOf = (container: HTMLElement) => container.querySelector('[data-testid="edge-middle-label"]')

describe("agent transition labels", () => {
  afterEach(() => cleanup())
  const far = [node("a", 0, 0), node("b", 0, 300)]

  // Before (FAQ RAG agent): "ReceiveTextEvent + 0 cond." on the canvas.
  it("shows the event name alone when the transition has no condition", () => {
    const { container } = renderAgentEdge(
      { transitionType: "custom", custom: { event: "ReceiveTextEvent", condition: [] } },
      far
    )
    expect(labelOf(container)?.textContent).toBe("ReceiveTextEvent")
  })

  it("adds the condition count when there are conditions", () => {
    const { container } = renderAgentEdge(
      { transitionType: "custom", custom: { event: "ReceiveTextEvent", condition: ["a", "b"] } },
      far
    )
    expect(labelOf(container)?.textContent).toBe("ReceiveTextEvent + 2 cond.")
  })

  // Before (FAQ RAG agent, Greeting → Idle 50 px apart): "Auto" sat on the
  // arrowhead at Idle.
  it("moves the label of a short transition beside the line, off the arrowhead", () => {
    const { container } = renderAgentEdge(
      { transitionType: "predefined", predefined: { predefinedType: "auto" } },
      [node("a", 0, 0), node("b", 0, 130)]
    )
    const label = labelOf(container)!
    const x = Number(label.getAttribute("x"))
    // Vertical edge at x = 80: the centred label box (≈ 4 chars) is clear of it.
    expect(Math.abs(x - 80)).toBeGreaterThanOrEqual(18)
  })

  it("keeps the label centred on a long transition", () => {
    const p = labelClearOfEnds({ x: 80, y: 190 }, { x: 80, y: 80 }, { x: 80, y: 300 }, 40, 14)
    expect(p).toEqual({ x: 80, y: 190 })
  })
})

describe("edge toolbar placement", () => {
  const W = 66
  const H = 36

  const overlaps = (p: { x: number; y: number }, r: { x: number; y: number; width: number; height: number }) =>
    p.x < r.x + r.width && p.x + W > r.x && p.y < r.y + r.height && p.y + H > r.y

  // Before (CustomEdgeToolBar): always +16 / +16 from the midpoint, so near a
  // corner it covered the next segment or a node header.
  it("leaves the default below-right spot when a node header is there", () => {
    const route = [
      { x: 0, y: 100 },
      { x: 300, y: 100 },
    ]
    const header = { x: 160, y: 112, width: 160, height: 60 }
    const p = edgeUtils.placeEdgeToolbar({ x: 150, y: 100 }, W, H, route, [header])
    expect(overlaps(p, header)).toBe(false)
    // Clear of the line too.
    expect(p.y >= 100 || p.y + H <= 100).toBe(true)
  })

  it("does not cover a segment turning right after the midpoint", () => {
    const route = [
      { x: 0, y: 100 },
      { x: 160, y: 100 },
      { x: 160, y: 300 },
    ]
    const p = edgeUtils.placeEdgeToolbar({ x: 150, y: 100 }, W, H, route, [])
    const crossesVertical = p.x < 160 && p.x + W > 160 && p.y < 300 && p.y + H > 100
    expect(crossesVertical).toBe(false)
  })

  it("keeps below-right when it is clear", () => {
    const p = edgeUtils.placeEdgeToolbar({ x: 150, y: 100 }, W, H, [{ x: 0, y: 100 }, { x: 300, y: 100 }], [])
    expect(p).toEqual({ x: 166, y: 116 })
  })
})
