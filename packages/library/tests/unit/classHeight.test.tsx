/**
 * Classes can be made taller than their rows (the resizer used to lock the
 * height to the content). A class nobody resized still fits its rows.
 */
import { describe, it, expect } from "vitest"
import type { ComponentProps } from "react"
import { render } from "@testing-library/react"
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
import { Class } from "@/nodes/classDiagram/Class"

const attr = (id: string) => ({ id, name: id, visibility: "public", attributeType: "str" })
// Header 40 + 30 per row.
const fitted = (rows: number) => 40 + 30 * rows

const mount = (height: number, rows: number) => {
  const ydoc = new Y.Doc()
  const store = createDiagramStore(ydoc) as StoreApi<DiagramStore>
  const data = (n: number) => ({
    name: "Order",
    attributes: Array.from({ length: n }, (_, i) => attr(`a${i}`)),
    methods: [],
  })
  store.getState().setNodes([
    { id: "c", type: "class", position: { x: 0, y: 0 }, width: 160, height, data: data(rows) } as Node,
  ])
  const ui = (n: number) => {
    const node = store.getState().nodes[0]
    return (
      <DiagramStoreContext.Provider value={store}>
        <MetadataStoreContext.Provider value={createMetadataStore(ydoc)}>
          <PopoverStoreContext.Provider value={createPopoverStore()}>
            <AssessmentSelectionStoreContext.Provider value={createAssessmentSelectionStore()}>
              <ReactFlowProvider>
                <Class
                  {...({ id: "c", width: node.width, height: node.height, data: data(n) } as unknown as ComponentProps<
                    typeof Class
                  >)}
                />
              </ReactFlowProvider>
            </AssessmentSelectionStoreContext.Provider>
          </PopoverStoreContext.Provider>
        </MetadataStoreContext.Provider>
      </DiagramStoreContext.Provider>
    )
  }
  const view = render(ui(rows))
  return {
    height: () => store.getState().nodes[0].height,
    setRows: (n: number) => view.rerender(ui(n)),
    container: view.container,
  }
}

describe("class height", () => {
  it("keeps a class the user made taller", () => {
    const c = mount(200, 1)
    expect(c.height()).toBe(200)
    expect(c.container.querySelector("svg rect")!.getAttribute("height")).toBe("200")
    c.setRows(2)
    expect(c.height()).toBe(200)
  })

  it("grows a class that is shorter than its rows", () => {
    expect(mount(40, 1).height()).toBe(fitted(1))
  })

  it("keeps a fitted class fitted when rows are added or removed", () => {
    const c = mount(fitted(1), 1)
    c.setRows(2)
    expect(c.height()).toBe(fitted(2))
    c.setRows(2)
    c.setRows(1)
    expect(c.height()).toBe(fitted(1))
  })
})
