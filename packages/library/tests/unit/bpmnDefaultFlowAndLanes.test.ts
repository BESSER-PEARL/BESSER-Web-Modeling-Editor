import { describe, it, expect } from "vitest"
import {
  clearIneligibleBpmnDefaults,
  defaultFlagAfterSourceChange,
  setBpmnDefaultFlow,
} from "@/utils/bpmnDefaultFlow"
import {
  LANE_HEADER_WIDTH,
  canDropIntoParent,
  clampIntoLaneBody,
  requiresParent,
} from "@/utils/bpmnConstraints"
import {
  POOL_HEADER_WIDTH,
  SWIMLANE_MIN_HEIGHT,
  stackPoolLanes,
} from "@/hooks/useSwimlaneLayout"
import { dropElementConfigs } from "@/constants"
import { UMLDiagramType } from "@/types"

const flow = (id: string, source: string, target: string, isDefault = false, type = "BPMNSequenceFlow") => ({
  id,
  source,
  target,
  type,
  data: { isDefault, points: [] },
})

const isDefault = (edges: { id: string; data?: unknown }[], id: string) =>
  !!(edges.find((e) => e.id === id)?.data as { isDefault?: boolean } | undefined)?.isDefault

// ---------------------------------------------------------------------------
// Default-flow hygiene (smart-gen 51bc76b7 / 3446a61f / 5af7ddcb / d18328b1)
// ---------------------------------------------------------------------------

describe("setBpmnDefaultFlow – one default per source", () => {
  it("ticking a flow clears the default on its siblings", () => {
    const edges = [flow("a", "g", "t1", true), flow("b", "g", "t2"), flow("c", "other", "t3", true)]
    const next = setBpmnDefaultFlow(edges, "b", true)
    expect(isDefault(next, "b")).toBe(true)
    expect(isDefault(next, "a")).toBe(false)
    // Another source keeps its own default.
    expect(isDefault(next, "c")).toBe(true)
  })

  it("unticking only clears the flow itself", () => {
    const edges = [flow("a", "g", "t1", true), flow("b", "g", "t2")]
    const next = setBpmnDefaultFlow(edges, "a", false)
    expect(isDefault(next, "a")).toBe(false)
    expect(next[1]).toBe(edges[1])
  })

  it("returns the same array when nothing changes", () => {
    const edges = [flow("a", "g", "t1", true)]
    expect(setBpmnDefaultFlow(edges, "a", true)).toBe(edges)
    expect(setBpmnDefaultFlow(edges, "missing", true)).toBe(edges)
  })
})

describe("clearIneligibleBpmnDefaults – gateway type change", () => {
  const edges = [flow("a", "g", "t1", true), flow("b", "task", "t2", true)]

  it.each(["parallel", "event-based"])("clears the default when the gateway becomes %s", (gatewayType) => {
    const nodes = [
      { id: "g", type: "bpmnGateway", data: { gatewayType } },
      { id: "task", type: "bpmnTask", data: {} },
    ]
    const next = clearIneligibleBpmnDefaults(nodes, edges, { sourceId: "g" })
    expect(isDefault(next, "a")).toBe(false)
    expect(isDefault(next, "b")).toBe(true)
  })

  it.each(["exclusive", "inclusive", "complex"])("keeps the default on a %s gateway", (gatewayType) => {
    const nodes = [{ id: "g", type: "bpmnGateway", data: { gatewayType } }]
    expect(clearIneligibleBpmnDefaults(nodes, edges, { sourceId: "g" })).toBe(edges)
  })
})

describe("defaultFlagAfterSourceChange – flip / reconnect", () => {
  it("drops the flag when the new source cannot carry a default", () => {
    const edge = flow("a", "task", "end", true)
    expect(defaultFlagAfterSourceChange(edge, { id: "end", type: "bpmnEndEvent" })).toBe(false)
    expect(
      defaultFlagAfterSourceChange(edge, { id: "g", type: "bpmnGateway", data: { gatewayType: "parallel" } })
    ).toBe(false)
  })

  it("keeps the flag for an activity or an exclusive gateway", () => {
    const edge = flow("a", "task", "t2", true)
    expect(defaultFlagAfterSourceChange(edge, { id: "t2", type: "bpmnTask" })).toBe(true)
    expect(
      defaultFlagAfterSourceChange(edge, { id: "g", type: "bpmnGateway", data: { gatewayType: "exclusive" } })
    ).toBe(true)
  })

  it("is false for a flow that was not default", () => {
    expect(defaultFlagAfterSourceChange(flow("a", "x", "t"), { id: "t", type: "bpmnTask" })).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Lane header strip (smart-gen 1264cb89) + standalone lane palette entry
// ---------------------------------------------------------------------------

describe("clampIntoLaneBody", () => {
  it("snaps a lane child that lands in the header strip to the body", () => {
    expect(clampIntoLaneBody({ x: 5, y: 12 }, "bpmnSwimlane")).toEqual({ x: LANE_HEADER_WIDTH, y: 12 })
    expect(clampIntoLaneBody({ x: -40, y: 0 }, "bpmnSwimlane").x).toBe(LANE_HEADER_WIDTH)
  })

  it("leaves positions already in the body, and other parents, untouched", () => {
    const inBody = { x: LANE_HEADER_WIDTH + 1, y: 0 }
    expect(clampIntoLaneBody(inBody, "bpmnSwimlane")).toBe(inBody)
    const inPool = { x: 2, y: 0 }
    expect(clampIntoLaneBody(inPool, "bpmnPool")).toBe(inPool)
    expect(clampIntoLaneBody(inPool, undefined)).toBe(inPool)
  })
})

describe("lanes only live inside pools", () => {
  it("a lane requires a parent and only a pool accepts it", () => {
    expect(requiresParent("bpmnSwimlane")).toBe(true)
    expect(requiresParent("bpmnTask")).toBe(false)
    expect(canDropIntoParent("bpmnSwimlane", "bpmnPool")).toBe(true)
    expect(canDropIntoParent("bpmnSwimlane", "bpmnGroup")).toBe(false)
    expect(canDropIntoParent("bpmnSwimlane", "bpmnSwimlane")).toBe(false)
    expect(canDropIntoParent("bpmnSwimlane", "bpmnSubprocess")).toBe(false)
  })

  it("the BPMN palette offers a standalone lane", () => {
    const lane = dropElementConfigs[UMLDiagramType.BPMN].find((c) => c.type === "bpmnSwimlane")
    expect(lane).toBeDefined()
    expect(lane?.nameKey).toBe("packages.BPMNDiagram.BPMNSwimlane")
  })
})

describe("stackPoolLanes", () => {
  const pool = { id: "p", type: "bpmnPool", position: { x: 0, y: 0 }, width: 400, height: 200 }

  it("a first lane fills the pool and is locked to the header", () => {
    const lane = { id: "l1", type: "bpmnSwimlane", parentId: "p", position: { x: 90, y: 50 }, width: 200, height: 80 }
    const next = stackPoolLanes([pool, lane], "p")
    const laid = next.find((n) => n.id === "l1")!
    expect(laid.position).toEqual({ x: POOL_HEADER_WIDTH, y: 0 })
    expect(laid.width).toBe(400 - POOL_HEADER_WIDTH)
    expect(laid.height).toBe(200)
    expect(next.find((n) => n.id === "p")!.height).toBe(200)
  })

  it("further lanes stack in drop order and grow the pool", () => {
    const l1 = { id: "l1", type: "bpmnSwimlane", parentId: "p", position: { x: 40, y: 0 }, width: 360, height: 200 }
    const l2 = { id: "l2", type: "bpmnSwimlane", parentId: "p", position: { x: 70, y: 150 }, width: 200, height: 80 }
    const next = stackPoolLanes([pool, l1, l2], "p")
    expect(next.find((n) => n.id === "l2")!.position).toEqual({ x: POOL_HEADER_WIDTH, y: 200 })
    expect(next.find((n) => n.id === "p")!.height).toBe(200 + SWIMLANE_MIN_HEIGHT)
  })

  it("returns the input unchanged for a pool without lanes", () => {
    const nodes = [pool]
    expect(stackPoolLanes(nodes, "p")).toBe(nodes)
  })
})
