import { afterEach, describe, expect, it } from "vitest"
import type { ComponentProps } from "react"
import { act, cleanup, render } from "@testing-library/react"
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
import { makeNNLayerComponent } from "@/nodes/nnDiagram/_NNLayerBase"
import { finalizeNewNode } from "@/components/DraggableGhost"
import { withUniqueCopyNames } from "@/utils/elementNaming"

const layer = (id: string, name: string, parentId?: string): Node => ({
  id,
  type: "LinearLayer",
  position: { x: 0, y: 0 },
  width: 90,
  height: 100,
  ...(parentId && { parentId }),
  data: { name, attributes: { name } },
})

const container = (id: string, name: string): Node => ({
  id,
  type: "NNContainer",
  position: { x: 0, y: 0 },
  width: 400,
  height: 300,
  data: { name },
})

const names = (nodes: readonly Node[]) =>
  nodes.map((n) => (n.data as { name: string }).name)

afterEach(cleanup)

describe("NN unique naming", () => {
  // Review finding: the dedupe ran in a mount effect, so LOADING a saved
  // NN renamed layers; and it compared across containers, so `fc` in the
  // main NN and `fc` in a sub-NN collided (backend scopes layers per NN).
  it("does not rename layers when a saved diagram mounts", () => {
    const Linear = makeNNLayerComponent("LinearLayer", "Linear", "#fff")
    const nodes = [
      container("main", "main"),
      container("sub", "sub"),
      layer("a", "fc", "main"),
      layer("b", "fc", "sub"),
    ]
    const ydoc = new Y.Doc()
    const diagram = createDiagramStore(ydoc)
    act(() => diagram.getState().setNodes(nodes))
    render(
      <DiagramStoreContext.Provider value={diagram as StoreApi<DiagramStore>}>
        <MetadataStoreContext.Provider value={createMetadataStore(ydoc)}>
          <PopoverStoreContext.Provider value={createPopoverStore()}>
            <AssessmentSelectionStoreContext.Provider
              value={createAssessmentSelectionStore()}
            >
              <ReactFlowProvider>
                {(["a", "b"] as const).map((id) => (
                  <Linear
                    key={id}
                    {...({ id, width: 90, height: 100, data: { name: "fc" } } as unknown as ComponentProps<typeof Linear>)}
                  />
                ))}
              </ReactFlowProvider>
            </AssessmentSelectionStoreContext.Provider>
          </PopoverStoreContext.Provider>
        </MetadataStoreContext.Provider>
      </DiagramStoreContext.Provider>
    )
    expect(names(diagram.getState().nodes)).toEqual(["main", "sub", "fc", "fc"])
  })

  it("a dropped layer is deduped among its siblings only", () => {
    const existing = [layer("a", "fc", "main"), layer("b", "fc", "sub")]
    expect(names([finalizeNewNode(layer("n", "fc", "main"), existing)])).toEqual([
      "fc2",
    ])
    expect(names([finalizeNewNode(layer("n", "fc", "other"), existing)])).toEqual([
      "fc",
    ])
    const renamed = finalizeNewNode(layer("n", "fc", "main"), existing)
    expect((renamed.data as { attributes: { name: string } }).attributes.name).toBe(
      "fc2"
    )
  })

  it("a dropped container is deduped against other containers", () => {
    expect(
      names([finalizeNewNode(container("n", "Neural_Network"), [container("c", "Neural_Network")])])
    ).toEqual(["Neural_Network2"])
  })

  it("a pasted layer is deduped among its new siblings", () => {
    const existing = [container("main", "main"), layer("a", "fc", "main")]
    expect(names(withUniqueCopyNames([layer("n", "fc", "main")], existing))).toEqual([
      "fc2",
    ])
    // Pasted together with a fresh container: no sibling collides.
    expect(
      names(
        withUniqueCopyNames(
          [container("main2", "main2"), layer("n", "fc", "main2")],
          existing
        )
      )
    ).toEqual(["main2", "fc"])
  })
})
