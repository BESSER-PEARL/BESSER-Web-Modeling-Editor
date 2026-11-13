import { afterEach, describe, expect, it } from "vitest"
import { act, cleanup, renderHook } from "@testing-library/react"
import * as Y from "yjs"
import type { Node } from "@xyflow/react"
import type { StoreApi } from "zustand"
import type { ReactNode } from "react"
import { DiagramStoreContext, MetadataStoreContext } from "@/store/context"
import { createDiagramStore, DiagramStore } from "@/store/diagramStore"
import { createMetadataStore } from "@/store/metadataStore"
import { useHandleDelete } from "@/hooks/useHandleDelete"
import { UMLDiagramType } from "@/types"

/**
 * Live: the node toolbar's Delete on a lane removed only the lane -- its
 * tasks were left pointing at a missing parent and the pool kept the gap.
 * It now does what the lane editor's Delete does: an occupied lane merges
 * into its neighbour, an empty one shrinks the pool.
 */

afterEach(cleanup)

const pool = (h: number): Node => ({ id: "pool", type: "bpmnPool", position: { x: 0, y: 0 }, width: 600, height: h, data: { name: "P" } })
const lane = (id: string, y: number): Node => ({
  id,
  type: "bpmnSwimlane",
  parentId: "pool",
  position: { x: 40, y },
  width: 560,
  height: 120,
  data: { name: id },
})

const setup = (nodes: Node[]) => {
  const ydoc = new Y.Doc()
  const metadata = createMetadataStore(ydoc)
  metadata.getState().updateDiagramType(UMLDiagramType.BPMN)
  const diagram = createDiagramStore(ydoc)
  act(() => diagram.getState().setNodes(nodes))
  const wrapper = ({ children }: { children: ReactNode }) => (
    <DiagramStoreContext.Provider value={diagram as StoreApi<DiagramStore>}>
      <MetadataStoreContext.Provider value={metadata}>{children}</MetadataStoreContext.Provider>
    </DiagramStoreContext.Provider>
  )
  const deleteVia = (id: string) => {
    const { result } = renderHook(() => useHandleDelete(id), { wrapper })
    act(() => result.current())
  }
  const byId = (id: string) => diagram.getState().nodes.find((n) => n.id === id)
  return { diagram, deleteVia, byId }
}

describe("toolbar Delete on a lane", () => {
  it("merges an occupied lane into its neighbour; the task keeps its place", () => {
    const task: Node = { id: "task", type: "bpmnTask", parentId: "b", position: { x: 50, y: 30 }, width: 120, height: 60, data: { name: "T" } }
    const { deleteVia, byId } = setup([pool(240), lane("a", 0), lane("b", 120), task])
    deleteVia("b")
    expect(byId("b")).toBeUndefined()
    expect(byId("task")?.parentId).toBe("a")
    // Lane "a" spans both slots, so the task is still at y = 120 + 30 in the pool.
    expect(byId("task")!.position.y + byId("a")!.position.y).toBe(150)
    expect(byId("pool")?.height).toBe(240)
  })

  it("removes an empty lane and shrinks the pool", () => {
    const { deleteVia, byId } = setup([pool(240), lane("a", 0), lane("b", 120)])
    deleteVia("b")
    expect(byId("b")).toBeUndefined()
    expect(byId("pool")?.height).toBe(120)
  })

  // Live: the pool's toolbar Delete left its lanes on the canvas without a parent.
  it("deletes a container with its content, like the Delete key", () => {
    const task: Node = { id: "task", type: "bpmnTask", parentId: "b", position: { x: 50, y: 30 }, width: 120, height: 60, data: { name: "T" } }
    const other: Node = { id: "other", type: "bpmnTask", position: { x: 900, y: 0 }, width: 120, height: 60, data: { name: "O" } }
    const { diagram, deleteVia, byId } = setup([pool(240), lane("a", 0), lane("b", 120), task, other])
    act(() => diagram.getState().setEdges([{ id: "f", source: "task", target: "other", type: "BPMNSequenceFlow" }]))
    deleteVia("pool")
    expect(diagram.getState().nodes.map((n) => n.id)).toEqual(["other"])
    expect(diagram.getState().edges).toEqual([])
    expect(byId("pool")).toBeUndefined()
  })
})
