import { afterEach, describe, expect, it } from "vitest"
import { cleanup, renderHook } from "@testing-library/react"
import * as Y from "yjs"
import { Position, ReactFlowProvider, type Edge, type Node } from "@xyflow/react"
import type { StoreApi } from "zustand"
import type { ReactNode } from "react"
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
import { useStepPathEdge } from "@/hooks/useStepPathEdge"
import { UMLDiagramType } from "@/types"

/**
 * Live: assistant-built component edges carry placeholder points
 * `[(0,0),(100,0)]` with `isManuallyLayouted: false`; the step renderer drew
 * them as straight diagonals through the boxes. A route flagged as not
 * manually laid out is re-routed (as the floating renderer already does).
 */

afterEach(cleanup)

const node = (id: string, x: number, y: number): Node => ({
  id,
  type: "component",
  position: { x, y },
  width: 120,
  height: 80,
  measured: { width: 120, height: 80 },
  data: { name: id },
})

const nodes = [node("a", 0, 0), node("b", 400, 300)]

const wrapper = ({ children }: { children: ReactNode }) => {
  const ydoc = new Y.Doc()
  const metadata = createMetadataStore(ydoc)
  metadata.getState().updateDiagramType(UMLDiagramType.ComponentDiagram)
  const diagram = createDiagramStore(ydoc)
  diagram.getState().setNodes(nodes)
  return (
    <DiagramStoreContext.Provider value={diagram as StoreApi<DiagramStore>}>
      <MetadataStoreContext.Provider value={metadata}>
        <PopoverStoreContext.Provider value={createPopoverStore()}>
          <AssessmentSelectionStoreContext.Provider value={createAssessmentSelectionStore()}>
            <ReactFlowProvider initialNodes={nodes} initialEdges={[] as Edge[]}>
              {children}
            </ReactFlowProvider>
          </AssessmentSelectionStoreContext.Provider>
        </PopoverStoreContext.Provider>
      </MetadataStoreContext.Provider>
    </DiagramStoreContext.Provider>
  )
}

const pointsFor = (data: Record<string, unknown>) =>
  renderHook(
    () =>
      useStepPathEdge({
        id: "e",
        type: "ComponentDependency",
        source: "a",
        target: "b",
        sourceX: 120,
        sourceY: 40,
        targetX: 400,
        targetY: 340,
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        data: data as never,
      }).edgeData.activePoints,
    { wrapper }
  ).result.current

const isOrthogonal = (pts: Array<{ x: number; y: number }>) =>
  pts.slice(1).every((p, i) => p.x === pts[i].x || p.y === pts[i].y)

describe("step edge with an auto (not manually laid out) stored route", () => {
  const placeholder = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
  ]

  it("re-routes placeholder points flagged isManuallyLayouted: false", () => {
    const pts = pointsFor({ isManuallyLayouted: false, points: placeholder })
    expect(pts.length).toBeGreaterThan(2)
    expect(isOrthogonal(pts)).toBe(true)
  })

  it("keeps a user route", () => {
    const route = [
      { x: 125, y: 40 },
      { x: 260, y: 40 },
      { x: 260, y: 340 },
      { x: 390, y: 340 },
    ]
    expect(pointsFor({ isManuallyLayouted: true, points: route })[1]).toEqual({ x: 260, y: 40 })
    expect(pointsFor({ points: route })[1]).toEqual({ x: 260, y: 40 })
  })
})
