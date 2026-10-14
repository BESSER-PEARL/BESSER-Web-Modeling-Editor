/**
 * Long class names were clipped at both ends: the bold header was measured
 * with the regular-weight font, so the node came out too narrow.
 */
import { describe, it, expect, vi } from "vitest"
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
import { LAYOUT } from "@/constants"

// jsdom has no canvas: stand in a measurer where bold text is wider.
const BOLD_PX = 12
const REGULAR_PX = 8
vi.mock("@/utils/textUtils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/textUtils")>()),
  measureTextWidth: (text: string, font = "") =>
    text.length * (/^(700|bold)\b/.test(font) ? BOLD_PX : REGULAR_PX),
}))

const NAME = "AVeryLongClassNameThatOverflows"

describe("Class header width", () => {
  it("fits the node to the bold header name", () => {
    const ydoc = new Y.Doc()
    const store = createDiagramStore(ydoc) as StoreApi<DiagramStore>
    const node: Node = {
      id: "c1",
      type: "class",
      position: { x: 0, y: 0 },
      width: 160,
      height: 40,
      data: { name: NAME, attributes: [], methods: [] },
    }
    store.getState().setNodes([node])
    render(
      <DiagramStoreContext.Provider value={store}>
        <MetadataStoreContext.Provider value={createMetadataStore(ydoc)}>
          <PopoverStoreContext.Provider value={createPopoverStore()}>
            <AssessmentSelectionStoreContext.Provider
              value={createAssessmentSelectionStore()}
            >
              <ReactFlowProvider>
                <Class
                  {...({
                    id: node.id,
                    width: node.width,
                    height: node.height,
                    data: node.data,
                  } as never)}
                />
              </ReactFlowProvider>
            </AssessmentSelectionStoreContext.Provider>
          </PopoverStoreContext.Provider>
        </MetadataStoreContext.Provider>
      </DiagramStoreContext.Provider>
    )
    const width = store.getState().nodes[0].width!
    expect(width).toBeGreaterThanOrEqual(
      NAME.length * BOLD_PX + 2 * LAYOUT.DEFAULT_PADDING
    )
  })
})
