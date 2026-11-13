import { afterEach, describe, expect, it } from "vitest"
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
import { useConnect } from "@/hooks/useConnect"
import { clearConnectionNotice } from "@/edges/connectionNotice"
import { UMLDiagramType } from "@/types"

/**
 * Live (BPMN, zoom >= 93%): a click on a gateway's port band, with the usual
 * pixel of pointer jitter, ended as a connection to the pool around it and
 * showed "BPMN doesn't allow a flow between these elements". A press that
 * never leaves the source node is a click, not a connection to its container.
 */

// jsdom has no hit testing; the drag tracker only uses it for the invalid-target outline.
document.elementsFromPoint = () => []

afterEach(() => {
  clearConnectionNotice()
  cleanup()
})

const sized = (n: Omit<Node, "measured">, w: number, h: number): Node => ({
  ...n,
  width: w,
  height: h,
  measured: { width: w, height: h },
})

const nodes: Node[] = [
  sized({ id: "pool", type: "bpmnPool", position: { x: 0, y: 0 }, data: { name: "Pool" } }, 600, 300),
  sized({ id: "gw", type: "bpmnGateway", parentId: "pool", position: { x: 100, y: 100 }, data: { gatewayType: "exclusive" } }, 40, 40),
  sized({ id: "task", type: "bpmnTask", parentId: "pool", position: { x: 300, y: 90 }, data: { name: "T" } }, 120, 60),
]

const setup = () => {
  const ydoc = new Y.Doc()
  const metadata = createMetadataStore(ydoc)
  const diagram = createDiagramStore(ydoc)
  metadata.getState().updateDiagramType(UMLDiagramType.BPMN)
  act(() => diagram.getState().setNodes(nodes))
  let api: ReturnType<typeof useConnect> | undefined
  const Host = () => {
    api = useConnect()
    return null
  }
  render(
    <DiagramStoreContext.Provider value={diagram as StoreApi<DiagramStore>}>
      <MetadataStoreContext.Provider value={metadata}>
        <PopoverStoreContext.Provider value={createPopoverStore()}>
          <AssessmentSelectionStoreContext.Provider value={createAssessmentSelectionStore()}>
            <ReactFlowProvider initialNodes={nodes}>
              <div className="react-flow">
                <Host />
              </div>
            </ReactFlowProvider>
          </AssessmentSelectionStoreContext.Provider>
        </PopoverStoreContext.Provider>
      </MetadataStoreContext.Provider>
    </DiagramStoreContext.Provider>
  )
  /** Press on `gw`'s port band and release at (x, y) (flow = screen coords here). */
  const pressRelease = (moves: Array<[number, number]>) => {
    act(() => {
      api!.onConnectStart(new MouseEvent("mousedown") as never, { nodeId: "gw", handleId: "port", handleType: "source" })
    })
    for (const [x, y] of moves) {
      act(() => {
        document.dispatchEvent(new PointerEvent("pointermove", { clientX: x, clientY: y }))
      })
    }
    const [x, y] = moves[moves.length - 1]
    act(() => {
      api!.onConnectEnd(new MouseEvent("mouseup", { clientX: x, clientY: y }), {
        isValid: false,
        fromNode: { id: "gw" },
        fromHandle: { id: "port", nodeId: "gw", type: "source" },
      } as never)
    })
  }
  return { diagram, pressRelease }
}

const notice = () => document.querySelector(".besser-connection-notice")?.textContent ?? null

describe("a click on the port band of a node inside a container", () => {
  it("connects nothing and shows no refusal", () => {
    const { diagram, pressRelease } = setup()
    pressRelease([[121, 101]])
    expect(diagram.getState().edges).toEqual([])
    expect(notice()).toBeNull()
  })

  it("a real drag to a sibling still connects", () => {
    const { diagram, pressRelease } = setup()
    pressRelease([[200, 120], [360, 120]])
    expect(diagram.getState().edges.map((e) => [e.source, e.target, e.type])).toEqual([
      ["gw", "task", "BPMNSequenceFlow"],
    ])
  })
})
