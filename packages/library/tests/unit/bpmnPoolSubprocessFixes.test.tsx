import { describe, it, expect } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import * as Y from "yjs"
import type { Node } from "@xyflow/react"
import type { StoreApi } from "zustand"
import { DiagramStoreContext } from "@/store/context"
import { createDiagramStore, DiagramStore } from "@/store/diagramStore"
import {
  addPoolLane,
  removePoolLane,
  swapPoolLanes,
} from "@/components/popovers/bpmnDiagram/poolLanes"
import { BPMNPoolEditPopover } from "@/components/popovers/bpmnDiagram/BPMNPoolEditPopover"
import {
  COLLAPSED_ACTIVITY_SIZE,
  EXPANDED_ACTIVITY_MIN_SIZE,
  toggleActivityExpanded,
} from "@/components/popovers/bpmnDiagram/BPMNSubprocessEditPopover"
import { canDropIntoParent } from "@/utils/bpmnConstraints"
import { fitLongestWordFontSize } from "@/components/svgs/nodes/bpmnDiagram/BPMNTaskNodeSVG"
import {
  getAllowedBpmnFlowEdgeTypes,
  resolveBpmnEdgeType,
} from "@/utils/edgeUtils"

/**
 * BPMN review fixes (2026-10-06): lane edits keep the pool wrapping its
 * lanes, expand/collapse resizes the activity, a collapsed activity refuses
 * drops, task names wrap between words, and sequence flows never leave an
 * end event or enter a start event.
 */

const pool = (height = 120): Node => ({
  id: "pool",
  type: "bpmnPool",
  position: { x: 0, y: 0 },
  width: 400,
  height,
  data: { name: "Pool" },
})

const lane = (id: string, y: number, height: number): Node => ({
  id,
  type: "bpmnSwimlane",
  parentId: "pool",
  position: { x: 40, y },
  width: 360,
  height,
  draggable: false,
  data: { name: id },
})

const task = (id: string, parentId: string, x: number, y: number): Node => ({
  id,
  type: "bpmnTask",
  parentId,
  position: { x, y },
  width: 160,
  height: 60,
  data: { name: id },
})

const byId = (nodes: Node[], id: string) => nodes.find((n) => n.id === id)!

const lanesInsidePool = (nodes: Node[]) => {
  const p = byId(nodes, "pool")
  return nodes
    .filter((n) => n.type === "bpmnSwimlane")
    .every((l) => l.position.y >= 0 && l.position.y + l.height! <= p.height!)
}

describe("pool lanes", () => {
  it("a second lane grows the pool instead of hanging below it", () => {
    let nodes = addPoolLane([pool()], "pool", { id: "L1", name: "Lane 1" })
    expect(byId(nodes, "L1").height).toBe(120)
    nodes = addPoolLane(nodes, "pool", { id: "L2", name: "Lane 2" })
    expect(byId(nodes, "pool").height).toBe(200)
    expect(byId(nodes, "L2").position.y).toBe(120)
    expect(lanesInsidePool(nodes)).toBe(true)
  })

  it("the first lane adopts the pool's elements", () => {
    const nodes = addPoolLane([pool(), task("t", "pool", 100, 20)], "pool", {
      id: "L1",
      name: "Lane 1",
    })
    expect(byId(nodes, "t").parentId).toBe("L1")
    expect(byId(nodes, "t").position).toEqual({ x: 60, y: 20 })
  })

  it("deleting an empty lane shrinks the pool and restacks the rest", () => {
    const nodes = removePoolLane(
      [pool(200), lane("L1", 0, 120), lane("L2", 120, 80)],
      "pool",
      "L1"
    )
    expect(nodes.find((n) => n.id === "L1")).toBeUndefined()
    expect(byId(nodes, "pool").height).toBe(80)
    expect(byId(nodes, "L2").position.y).toBe(0)
    expect(lanesInsidePool(nodes)).toBe(true)
  })

  it("deleting an occupied lane merges it into its neighbour without moving content", () => {
    const nodes = removePoolLane(
      [pool(200), lane("L1", 0, 120), lane("L2", 120, 80), task("t", "L2", 50, 10)],
      "pool",
      "L2"
    )
    expect(byId(nodes, "pool").height).toBe(200)
    expect(byId(nodes, "L1").height).toBe(200)
    const t = byId(nodes, "t")
    expect(t.parentId).toBe("L1")
    // Pool-relative y unchanged: 120 + 10 before, 0 + 130 after.
    expect(t.position).toEqual({ x: 50, y: 130 })
  })

  it("swapping lanes swaps their heights too", () => {
    const nodes = swapPoolLanes(
      [pool(200), lane("L1", 0, 120), lane("L2", 120, 80)],
      "pool",
      0,
      1
    )
    expect(byId(nodes, "L2").position.y).toBe(0)
    expect(byId(nodes, "L2").height).toBe(80)
    expect(byId(nodes, "L1").position.y).toBe(80)
    expect(byId(nodes, "L1").height).toBe(120)
    expect(byId(nodes, "pool").height).toBe(200)
  })

  it("the pool editor's Add Lane keeps every lane inside the pool", () => {
    const store = createDiagramStore(new Y.Doc())
    store.getState().setNodes([pool()])
    render(
      <DiagramStoreContext.Provider value={store as StoreApi<DiagramStore>}>
        <BPMNPoolEditPopover elementId="pool" />
      </DiagramStoreContext.Provider>
    )
    fireEvent.click(screen.getByRole("button", { name: "Add Lane" }))
    fireEvent.click(screen.getByRole("button", { name: "Add Lane" }))
    const nodes = store.getState().nodes
    expect(nodes.filter((n) => n.type === "bpmnSwimlane")).toHaveLength(2)
    expect(lanesInsidePool(nodes)).toBe(true)
  })
})

describe("expandable activities", () => {
  const sub = (isExpanded?: boolean): Node => ({
    id: "sp",
    type: "bpmnSubprocess",
    position: { x: 0, y: 0 },
    width: 160,
    height: 60,
    data: { name: "Sub", ...(isExpanded !== undefined && { isExpanded }) },
  })

  it("expanding grows the activity to hold its children", () => {
    const nodes = toggleActivityExpanded(
      [sub(), task("c", "sp", 300, 200)],
      "sp"
    )
    const sp = byId(nodes, "sp")
    expect(sp.data.isExpanded).toBe(true)
    expect(sp.width).toBeGreaterThanOrEqual(EXPANDED_ACTIVITY_MIN_SIZE.width)
    expect(sp.width).toBeGreaterThanOrEqual(300 + 160)
    expect(sp.height).toBeGreaterThanOrEqual(200 + 60)
  })

  it("collapsing shrinks it back to task size", () => {
    const expanded = { ...sub(true), width: 500, height: 300 }
    const sp = byId(toggleActivityExpanded([expanded], "sp"), "sp")
    expect(sp.data.isExpanded).toBe(false)
    expect({ width: sp.width, height: sp.height }).toEqual(
      COLLAPSED_ACTIVITY_SIZE
    )
  })

  it("a collapsed activity refuses drops when its data is given", () => {
    expect(canDropIntoParent("bpmnTask", "bpmnSubprocess", {})).toBe(false)
    expect(
      canDropIntoParent("bpmnTask", "bpmnTransaction", { isExpanded: false })
    ).toBe(false)
    expect(
      canDropIntoParent("bpmnTask", "bpmnSubprocess", { isExpanded: true })
    ).toBe(true)
    // Type-only callers keep the previous answer.
    expect(canDropIntoParent("bpmnTask", "bpmnSubprocess")).toBe(true)
  })
})

describe("task name wrapping", () => {
  const measure = (word: string, size: number) => word.length * size * 0.6

  it("keeps the full size when every word fits", () => {
    expect(fitLongestWordFontSize("Verify customer", 120, 16, 12, measure)).toBe(16)
  })

  it("shrinks so the longest word is not broken", () => {
    const size = fitLongestWordFontSize(
      "Internationalization review",
      120,
      16,
      9,
      measure
    )
    expect(size).toBeLessThan(16)
    expect(measure("Internationalization", size)).toBeLessThanOrEqual(120)
  })
})

describe("BPMN flow legality around start / end events", () => {
  it("no sequence flow out of an end event or into a start event", () => {
    expect(getAllowedBpmnFlowEdgeTypes("bpmnEndEvent", "bpmnTask")).not.toContain(
      "BPMNSequenceFlow"
    )
    expect(
      getAllowedBpmnFlowEdgeTypes("bpmnTask", "bpmnStartEvent")
    ).not.toContain("BPMNSequenceFlow")
  })

  it("start events only catch messages, end events only throw them", () => {
    expect(getAllowedBpmnFlowEdgeTypes("bpmnStartEvent", "bpmnTask")).toEqual([
      "BPMNSequenceFlow",
    ])
    expect(getAllowedBpmnFlowEdgeTypes("bpmnTask", "bpmnEndEvent")).toEqual([
      "BPMNSequenceFlow",
    ])
    expect(getAllowedBpmnFlowEdgeTypes("bpmnEndEvent", "bpmnTask")).toEqual([
      "BPMNMessageFlow",
    ])
  })

  it("an end event no longer defaults to a sequence flow", () => {
    expect(
      resolveBpmnEdgeType("bpmnEndEvent", "bpmnTask", "BPMNSequenceFlow")
    ).toBe("BPMNMessageFlow")
    // Gateways exchange no messages: nothing legal is left, the rule vetoes.
    expect(getAllowedBpmnFlowEdgeTypes("bpmnEndEvent", "bpmnGateway")).toEqual([])
    expect(getAllowedBpmnFlowEdgeTypes("bpmnGateway", "bpmnStartEvent")).toEqual([])
    expect(
      resolveBpmnEdgeType("bpmnTask", "bpmnTask", "BPMNSequenceFlow")
    ).toBe("BPMNSequenceFlow")
  })
})
