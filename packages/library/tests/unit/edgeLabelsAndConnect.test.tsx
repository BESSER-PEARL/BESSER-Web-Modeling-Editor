import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, render } from "@testing-library/react"
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
import {
  placeMiddleLabel,
  estimateMiddleLabelWidth,
  type LabelRect,
} from "@/edges/labelTypes/middleLabelPlacement"
import { EdgeMiddleLabels, truncateLabel } from "@/edges/labelTypes/EdgeMiddleLabels"
import { getCurvedPath } from "@/edges/curvedPath"
import {
  isInteriorPoint,
  isRefusedCrossPoolFlow,
  owningPoolId,
  pickBodyDropHandle,
  preselectLinkAssociation,
  refusalReason,
  resolveCrossPoolFlowType,
  REFUSAL_MESSAGES,
} from "@/edges/connectRules"
import { diagramBridge } from "@/services/diagramBridge"
import { StateMachineDiagramEdge } from "@/edges/edgeTypes/StateMachineDiagramEdge"
import { ClassDiagramEdge } from "@/edges/edgeTypes/ClassDiagramEdge"

/**
 * Edge rendering / connection fixes from the React Flow usability sweep:
 * middle-label placement, halo, truncation and clickability; agent
 * self-loops and on-curve labels; midpoint clicks that rewrote the route;
 * generalization end labels; body drops, cross-pool BPMN flows, object-link
 * association preselection and refusal reasons.
 */

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const boxOf = (
  p: { x: number; y: number; textAnchor: string; dominantBaseline: string },
  w: number
): LabelRect => {
  const x0 = p.textAnchor === "middle" ? p.x - w / 2 : p.textAnchor === "end" ? p.x - w : p.x
  const y0 = p.dominantBaseline === "middle" ? p.y - 6.5 : p.y - 10
  return { x: x0, y: y0, width: w, height: 13 }
}
const overlaps = (a: LabelRect, b: LabelRect) =>
  Math.min(a.x + a.width, b.x + b.width) > Math.max(a.x, b.x) &&
  Math.min(a.y + a.height, b.y + b.height) > Math.max(a.y, b.y)

describe("middle label placement", () => {
  it("keeps a transition label off the nodes (Traffic Light: Red -> Green)", () => {
    // Live route: three ~85px segments; the longest one leaves Red, so a
    // longest-segment rule put the 190px label on top of Red.
    const red = { x: 0, y: 0, width: 88, height: 55 }
    const green = { x: 261, y: 81, width: 88, height: 55 }
    const route = [
      { x: 88, y: 27 },
      { x: 175, y: 27 },
      { x: 175, y: 108 },
      { x: 261, y: 108 },
    ]
    const w = estimateMiddleLabelWidth("chronometer_finished [{60}]")
    const placement = placeMiddleLabel(route, w, [red, green])!
    const box = boxOf(placement, w)
    expect(overlaps(box, red)).toBe(false)
    expect(overlaps(box, green)).toBe(false)
  })

  it("stays off a pool border the line crosses (BPMN message flow)", () => {
    const pool = { x: -400, y: -300, width: 800, height: 210 } // bottom border y = -90
    const route = [
      { x: -275, y: -185 },
      { x: -275, y: 5 },
    ]
    const w = estimateMiddleLabelWidth("Pizza order")
    const box = boxOf(placeMiddleLabel(route, w, [pool])!, w)
    const inside = box.y >= pool.y && box.y + box.height <= pool.y + pool.height
    const outside = box.y >= pool.y + pool.height || box.y + box.height <= pool.y
    expect(inside || outside).toBe(true)
  })

  it("truncates long labels and keeps the full text as a tooltip", () => {
    expect(truncateLabel("short")).toBe("short")
    const long = "a_very_long_transition_event_name_that_keeps_going"
    expect(truncateLabel(long)).toHaveLength(32)
    expect(truncateLabel(long).endsWith("…")).toBe(true)

    const { container } = render(
      <ReactFlowProvider>
        <svg>
          <EdgeMiddleLabels
            label={long}
            pathMiddlePosition={{ x: 0, y: 0 }}
            isMiddlePathHorizontal
            points={[
              { x: 0, y: 0 },
              { x: 400, y: 0 },
            ]}
            showRelationshipLabels
            textColor="#000"
          />
        </svg>
      </ReactFlowProvider>
    )
    const text = container.querySelector("text")!
    expect(text.querySelector("title")?.textContent).toBe(long)
    // Halo class + clickable (clicks bubble to the React Flow edge).
    expect(text.getAttribute("class")).toContain("besser-edge-label")
    expect(text.style.pointerEvents).not.toBe("none")
  })
})

describe("agent curved transitions", () => {
  it("draws a self-loop between two bottom handles as a real loop, not a flat line", () => {
    const loop = getCurvedPath({
      sourceX: 506,
      sourceY: 31,
      sourcePosition: Position.Bottom,
      targetX: 254,
      targetY: 31,
      targetPosition: Position.Bottom,
      selfLoop: true,
    })
    const ys = loop.path.match(/-?\d+(\.\d+)?/g)!.map(Number).filter((_, i) => i % 2 === 1)
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(50)
    // The label sits below the node, on the loop's apex.
    expect(loop.label.y).toBeGreaterThan(31 + 40)
  })

  it("opens a loop on a single handle sideways", () => {
    const loop = getCurvedPath({
      sourceX: 0,
      sourceY: 0,
      sourcePosition: Position.Right,
      targetX: 0,
      targetY: 0,
      targetPosition: Position.Right,
      selfLoop: true,
    })
    const nums = loop.path.match(/-?\d+(\.\d+)?/g)!.map(Number)
    const ys = nums.filter((_, i) => i % 2 === 1)
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(30)
    expect(loop.label.x).toBeGreaterThan(30)
  })

  it("puts a normal transition's label on its bezier midpoint", () => {
    const { label } = getCurvedPath({
      sourceX: 61,
      sourceY: -3,
      sourcePosition: Position.Right,
      targetX: 232,
      targetY: -112,
      targetPosition: Position.Left,
    })
    // Cubic midpoint of M61,-3 C146.5,-3 146.5,-112 232,-112.
    expect(label.x).toBeCloseTo(146.5, 0)
    expect(label.y).toBeCloseTo(-57.5, 0)
  })
})

describe("connection rules", () => {
  const rect = (x: number, y: number, width = 160, height = 100) => ({ x, y, width, height })

  it("treats only points away from the border as interior", () => {
    expect(isInteriorPoint({ x: 80, y: 50 }, rect(0, 0))).toBe(true)
    expect(isInteriorPoint({ x: 155, y: 50 }, rect(0, 0))).toBe(false)
  })

  it("lands a body drop on the side facing the source, not the closest handle", () => {
    // Red -> Green dropped near Green's right edge used to pick `right`.
    const handle = pickBodyDropHandle({
      nodeId: "green",
      nodeType: "State",
      rect: rect(400, 0),
      sourceRect: rect(0, 0),
      edges: [],
    })
    expect(handle.startsWith("left")).toBe(true)
  })

  it("spreads two edges from different nodes over the side's handles (NN dataset + configuration)", () => {
    const container = rect(0, 0, 800, 200)
    const dataset = rect(380, 400, 90, 100)
    const config = rect(630, 400, 90, 100)
    const first = pickBodyDropHandle({
      nodeId: "c",
      nodeType: "NNContainer",
      rect: container,
      sourceRect: dataset,
      edges: [],
    })
    const second = pickBodyDropHandle({
      nodeId: "c",
      nodeType: "NNContainer",
      rect: container,
      sourceRect: config,
      edges: [{ source: "d", target: "c", sourceHandle: "top", targetHandle: first }],
    })
    expect(first.startsWith("bottom")).toBe(true)
    expect(second.startsWith("bottom")).toBe(true)
    expect(second).not.toBe(first)
  })

  it("uses only the centre handle on four-handle nodes", () => {
    expect(
      pickBodyDropHandle({
        nodeId: "i",
        nodeType: "componentInterface",
        rect: rect(400, 0, 40, 40),
        sourceRect: rect(0, 0),
        edges: [],
        centreOnly: true,
      })
    ).toBe("left")
  })

  const bpmnNodes = [
    { id: "p1", type: "bpmnPool" },
    { id: "p2", type: "bpmnPool" },
    { id: "lane", type: "bpmnSwimlane", parentId: "p2" },
    { id: "t1", type: "bpmnTask", parentId: "p1" },
    { id: "t1b", type: "bpmnTask", parentId: "p1" },
    { id: "t2", type: "bpmnTask", parentId: "lane" },
    { id: "gw", type: "bpmnGateway", parentId: "p1" },
  ]

  it("finds a node's pool through its lane", () => {
    expect(owningPoolId("t2", bpmnNodes)).toBe("p2")
    expect(owningPoolId("t1", bpmnNodes)).toBe("p1")
  })

  it("turns a sequence flow across pools into a message flow", () => {
    expect(resolveCrossPoolFlowType("BPMNSequenceFlow", bpmnNodes, "t1", "t2")).toBe(
      "BPMNMessageFlow"
    )
    expect(resolveCrossPoolFlowType("BPMNSequenceFlow", bpmnNodes, "t1", "t1b")).toBe(
      "BPMNSequenceFlow"
    )
  })

  it("refuses a gateway flow across pools (gateways send no messages)", () => {
    expect(resolveCrossPoolFlowType("BPMNSequenceFlow", bpmnNodes, "gw", "t2")).toBeNull()
    expect(isRefusedCrossPoolFlow(bpmnNodes, "gw", "t2")).toBe(true)
    expect(isRefusedCrossPoolFlow(bpmnNodes, "gw", "t1")).toBe(false)
    expect(refusalReason(bpmnNodes, "gw", "t2")).toBe("bpmnCrossPool")
  })

  it("refuses a message flow inside one pool (end event -> task, task -> start event)", () => {
    const nodes = [
      ...bpmnNodes,
      { id: "end1", type: "bpmnEndEvent", parentId: "p1" },
      { id: "start1", type: "bpmnStartEvent", parentId: "p1" },
      { id: "start2", type: "bpmnStartEvent", parentId: "lane" },
      { id: "loneEnd", type: "bpmnEndEvent" },
      { id: "loneTask", type: "bpmnTask" },
    ]
    // Only a message flow fits these pairs (no sequence flow out of an end
    // event or into a start event), and both ends share a pool.
    expect(resolveCrossPoolFlowType("BPMNMessageFlow", nodes, "end1", "t1")).toBeNull()
    expect(resolveCrossPoolFlowType("BPMNMessageFlow", nodes, "t1", "start1")).toBeNull()
    expect(resolveCrossPoolFlowType("BPMNMessageFlow", nodes, "loneEnd", "loneTask")).toBeNull()
    expect(refusalReason(nodes, "end1", "t1")).toBe("bpmnMessageSamePool")
    expect(refusalReason(nodes, "t1", "start1")).toBe("bpmnMessageSamePool")
    expect(REFUSAL_MESSAGES.bpmnMessageSamePool).toMatch(/different pools/)
    // Across pools it stays a message flow.
    expect(resolveCrossPoolFlowType("BPMNMessageFlow", nodes, "end1", "t2")).toBe("BPMNMessageFlow")
    expect(resolveCrossPoolFlowType("BPMNMessageFlow", nodes, "t1", "start2")).toBe("BPMNMessageFlow")
  })

  it("names why a connection was refused", () => {
    const nodes = [
      { id: "lin", type: "LinearLayer" },
      { id: "ds", type: "TrainingDataset" },
      { id: "a", type: "objectName", data: { classId: "A" } },
      { id: "b", type: "objectName", data: { classId: "B" } },
      { id: "e", type: "class", data: { stereotype: "Enumeration" } },
      { id: "c", type: "class" },
    ]
    expect(refusalReason(nodes, "lin", "ds")).toBe("nnEndpoint")
    expect(refusalReason(nodes, "a", "b")).toBe("objectNoAssociation")
    expect(refusalReason(nodes, "c", "e")).toBe("enumeration")
  })

  it("preselects the association when exactly one joins the two classes", () => {
    const association = {
      id: "assoc-1",
      name: "writtenBy",
      source: { element: "Book" },
      target: { element: "Author" },
    }
    vi.spyOn(diagramBridge, "getAvailableAssociations").mockReturnValue([association])
    const book = { id: "b", type: "objectName", data: { classId: "Book", name: "book_1" } }
    const author = { id: "a", type: "objectName", data: { classId: "Author", name: "author_1" } }
    expect(preselectLinkAssociation(book, author)).toEqual({
      associationId: "assoc-1",
      name: "writtenBy",
    })
    vi.spyOn(diagramBridge, "getAvailableAssociations").mockReturnValue([
      association,
      { ...association, id: "assoc-2" },
    ])
    expect(preselectLinkAssociation(book, author)).toBeUndefined()
  })
})

// ---- Rendered edges -------------------------------------------------------

const node = (id: string, x: number, y: number, type = "State"): Node => ({
  id,
  type,
  position: { x, y },
  width: 160,
  height: 80,
  measured: { width: 160, height: 80 },
  data: { name: id },
})

const renderEdge = (ui: React.ReactElement, nodes: Node[], edges: Edge[]) => {
  const ydoc = new Y.Doc()
  const metadata = createMetadataStore(ydoc)
  const diagram = createDiagramStore(ydoc)
  act(() => {
    diagram.getState().setNodes(nodes)
    diagram.getState().setEdges(edges)
  })
  diagram.getState().initializeUndoManager()
  const utils = render(
    <DiagramStoreContext.Provider value={diagram as StoreApi<DiagramStore>}>
      <MetadataStoreContext.Provider value={metadata}>
        <PopoverStoreContext.Provider value={createPopoverStore()}>
          <AssessmentSelectionStoreContext.Provider value={createAssessmentSelectionStore()}>
            <ReactFlowProvider initialNodes={nodes} initialEdges={edges}>
              <svg>{ui}</svg>
            </ReactFlowProvider>
          </AssessmentSelectionStoreContext.Provider>
        </PopoverStoreContext.Provider>
      </MetadataStoreContext.Provider>
    </DiagramStoreContext.Provider>
  )
  return { diagram, ...utils }
}

describe("rendered edges", () => {
  it("a plain click on a route midpoint handle keeps the route and adds no undo step", () => {
    const points = [
      { x: 166, y: 40 },
      { x: 250, y: 40 },
      { x: 250, y: 190 },
      { x: 400, y: 190 },
    ]
    const edge: Edge = {
      id: "t",
      type: "StateTransition",
      source: "red",
      target: "green",
      sourceHandle: "right",
      targetHandle: "left",
      data: { name: "go", points },
    }
    const { diagram, container } = renderEdge(
      <StateMachineDiagramEdge
        id="t"
        type="StateTransition"
        source="red"
        target="green"
        sourceX={160}
        sourceY={40}
        targetX={400}
        targetY={190}
        sourcePosition={Position.Right}
        targetPosition={Position.Left}
        sourceHandleId="right"
        targetHandleId="left"
        data={edge.data}
        selected
      />,
      [node("red", 0, 0), node("green", 400, 150)],
      [edge]
    )
    // Transitions are floating edges: their bend handles are segment grips.
    const handle = container.querySelector(".edge-segment-handle__hit, circle.edge-circle")!
    expect(handle).not.toBeNull()
    act(() => {
      fireEvent.pointerDown(handle, { clientX: 250, clientY: 115 })
      document.dispatchEvent(new PointerEvent("pointerup", { clientX: 250, clientY: 115 }))
    })
    expect(diagram.getState().edges[0].data?.points).toEqual(points)
    expect(diagram.getState().undoManager!.undoStack.length).toBe(0)
  })

  it("a generalization does not draw role / multiplicity labels left over from an association", () => {
    const data = {
      sourceRole: "library",
      sourceMultiplicity: "1..*",
      targetRole: "books",
      targetMultiplicity: "*",
    }
    const nodes = [node("A", 0, 0, "class"), node("B", 400, 0, "class")]
    const edge: Edge = { id: "g", type: "ClassInheritance", source: "A", target: "B", sourceHandle: "right", targetHandle: "left", data }
    const { container } = renderEdge(
      <ClassDiagramEdge
        id="g"
        type="ClassInheritance"
        source="A"
        target="B"
        sourceX={160}
        sourceY={40}
        targetX={400}
        targetY={40}
        sourcePosition={Position.Right}
        targetPosition={Position.Left}
        sourceHandleId="right"
        targetHandleId="left"
        data={data}
      />,
      nodes,
      [edge]
    )
    const texts = [...container.querySelectorAll("text")].map((t) => t.textContent)
    expect(texts).not.toContain("books")
    expect(texts).not.toContain("1..*")
  })
})
