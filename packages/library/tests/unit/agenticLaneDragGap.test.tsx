import { afterEach, describe, expect, it } from "vitest"
import { act, cleanup, renderHook } from "@testing-library/react"
import * as Y from "yjs"
import { ReactFlowProvider, type Node } from "@xyflow/react"
import type { StoreApi } from "zustand"
import type { ReactNode } from "react"
import {
  AlignmentGuidesStoreContext,
  DiagramStoreContext,
  MetadataStoreContext,
} from "@/store/context"
import { createAlignmentGuidesStore } from "@/store/alignmentGuidesStore"
import { createDiagramStore, DiagramStore } from "@/store/diagramStore"
import { createMetadataStore } from "@/store/metadataStore"
import { useNodeDragStop } from "@/hooks/useNodeDragStop"
import { UMLDiagramType } from "@/types"

/**
 * Live: a task dragged onto an agentic lane kept a 30 px gap, under the
 * lane's 60 px agentic header. The drag-stop clamp now sees the lane itself
 * (agentic or not), not just its type.
 */

afterEach(cleanup)

const sized = (n: Omit<Node, "measured">, w: number, h: number): Node => ({
  ...n,
  width: w,
  height: h,
  measured: { width: w, height: h },
})

const pool = sized({ id: "pool", type: "bpmnPool", position: { x: 0, y: 0 }, data: { name: "P" } }, 700, 300)
const lane = (id: string, y: number, isAgentic: boolean) =>
  sized({ id, type: "bpmnSwimlane", parentId: "pool", position: { x: 40, y }, data: { name: id, isAgentic } }, 660, 150)

const setup = (nodes: Node[]) => {
  const ydoc = new Y.Doc()
  const metadata = createMetadataStore(ydoc)
  metadata.getState().updateDiagramType(UMLDiagramType.BPMN)
  const diagram = createDiagramStore(ydoc)
  act(() => diagram.getState().setNodes(nodes))
  const wrapper = ({ children }: { children: ReactNode }) => (
    <DiagramStoreContext.Provider value={diagram as StoreApi<DiagramStore>}>
      <MetadataStoreContext.Provider value={metadata}>
        <AlignmentGuidesStoreContext.Provider value={createAlignmentGuidesStore()}>
          <ReactFlowProvider initialNodes={nodes}>{children}</ReactFlowProvider>
        </AlignmentGuidesStoreContext.Provider>
      </MetadataStoreContext.Provider>
    </DiagramStoreContext.Provider>
  )
  const { result } = renderHook(() => useNodeDragStop(), { wrapper })
  /** Release `node` with the pointer at flow point (x, y). */
  const release = (node: Node, x: number, y: number) =>
    act(() => result.current(new MouseEvent("mouseup", { clientX: x, clientY: y }) as never, node, [node]))
  const byId = (id: string) => diagram.getState().nodes.find((n) => n.id === id)!
  return { release, byId }
}

const task = (parentId: string, x: number): Node =>
  sized({ id: "task", type: "bpmnTask", parentId, position: { x, y: 40 }, data: { name: "T" } }, 120, 60)

describe("task released on an agentic lane", () => {
  it("moved inside the lane: stays clear of the 60 px header", () => {
    const t = task("agentic", 35)
    const { release, byId } = setup([pool, lane("agentic", 0, true), lane("plain", 150, false), t])
    release(t, 40 + 35 + 10, 50)
    expect(byId("task").position.x).toBeGreaterThanOrEqual(60)
  })

  it("dropped from another lane: stays clear of the 60 px header", () => {
    const t = task("plain", 35)
    const { release, byId } = setup([pool, lane("agentic", 0, true), lane("plain", 150, false), t])
    // Moved up into the agentic lane, near its header.
    release({ ...t, position: { x: 35, y: -110 } }, 40 + 40, 60)
    expect(byId("task").parentId).toBe("agentic")
    expect(byId("task").position.x).toBeGreaterThanOrEqual(60)
  })

  it("a plain lane keeps the 30 px header gap", () => {
    const t = task("plain", 10)
    const { release, byId } = setup([pool, lane("agentic", 0, true), lane("plain", 150, false), t])
    release(t, 40 + 20, 200)
    expect(byId("task").position.x).toBe(30)
  })
})
