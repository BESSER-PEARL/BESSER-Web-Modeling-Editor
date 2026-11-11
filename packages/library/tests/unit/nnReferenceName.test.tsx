/**
 * An NNReference goes by the current name of the container it points at
 * (develop rewrote the reference on a container rename).
 */
import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import * as Y from "yjs"
import type { Node } from "@xyflow/react"
import type { StoreApi } from "zustand"
import { DiagramStoreContext } from "@/store/context"
import { createDiagramStore, DiagramStore } from "@/store/diagramStore"
import { NNReferenceEditPanel } from "@/components/inspectors/nnDiagram/NNReferenceEditPanel"
import { computeNNPredecessors } from "@/utils/nnPredecessors"

afterEach(cleanup)

const nn = (
  id: string,
  type: string,
  name: string,
  parentId?: string,
  data: Record<string, unknown> = {}
): Node => ({
  id,
  type,
  position: { x: 0, y: 0 },
  width: 120,
  height: 60,
  ...(parentId && { parentId }),
  data: { name, attributes: { name }, ...data },
})

describe("NNReference name", () => {
  it("predecessors list a reference under its container's current name", () => {
    const nodes = [
      nn("main", "NNContainer", "main"),
      // Renamed after the reference copied the old name.
      nn("sub", "NNContainer", "encoder_v2"),
      nn("ref", "NNReference", "encoder", "main", { referenceTarget: "sub" }),
      nn("fc", "LinearLayer", "fc", "main"),
    ]
    const edges = [{ type: "NNNext", source: "ref", target: "fc" }]
    expect(computeNNPredecessors(nodes, edges, "fc")).toEqual([
      { id: "ref", name: "encoder_v2" },
    ])
  })

  it("a reference whose target is gone keeps its own name", () => {
    const nodes = [
      nn("ref", "NNReference", "encoder", undefined, { referenceTarget: "gone" }),
      nn("fc", "LinearLayer", "fc"),
    ]
    const edges = [{ type: "NNNext", source: "ref", target: "fc" }]
    expect(computeNNPredecessors(nodes, edges, "fc")).toEqual([
      { id: "ref", name: "encoder" },
    ])
  })

  it("the reference panel's texts come from the translations", () => {
    const store = createDiagramStore(new Y.Doc()) as StoreApi<DiagramStore>
    store.getState().setNodes([nn("ref", "NNReference", "x")])
    render(
      <DiagramStoreContext.Provider value={store}>
        <NNReferenceEditPanel elementId="ref" />
      </DiagramStoreContext.Provider>
    )
    expect(screen.getByText("references")).toBeTruthy()
    expect(screen.getByText("No other NN container in this diagram yet.")).toBeTruthy()
  })
})
