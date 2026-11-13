import { describe, it, expect, vi } from "vitest"
import * as Y from "yjs"

// nodeUtils pulls the node registry (React components); the containment
// helpers only need the type-string record (same mock as nodeUtils.test.ts).
vi.mock("@/nodes", () => ({
  DiagramNodeTypeRecord: {
    package: "package",
    activity: "activity",
    useCaseSystem: "useCaseSystem",
    componentSubsystem: "componentSubsystem",
    deploymentNode: "deploymentNode",
    deploymentComponent: "deploymentComponent",
    bpmnPool: "bpmnPool",
    bpmnSwimlane: "bpmnSwimlane",
    bpmnGroup: "bpmnGroup",
    bpmnSubprocess: "bpmnSubprocess",
    bpmnTransaction: "bpmnTransaction",
    bpmnCallActivity: "bpmnCallActivity",
  },
}))

import {
  adoptBpmnContainment,
  orderParentsFirst,
} from "@/utils/bpmnContainment"
import {
  migrateBpmnDiagramV3ToV4,
  normalizeV4Model,
} from "@/utils/versionConverter"
import { getPositionOnCanvas, resizeAllParents } from "@/utils/nodeUtils"
import { LANE_HEADER_WIDTH } from "@/utils/bpmnConstraints"
import { createDiagramStore } from "@/store/diagramStore"
import type { BesserNode, UMLModel } from "@/typings"
import type { Node } from "@xyflow/react"

const node = (
  id: string,
  type: string,
  x: number,
  y: number,
  width: number,
  height: number,
  extra: Partial<BesserNode> = {}
): BesserNode =>
  ({
    id,
    type,
    position: { x, y },
    width,
    height,
    measured: { width, height },
    data: { name: id },
    ...extra,
  }) as BesserNode

const bpmn = (nodes: BesserNode[]): UMLModel =>
  ({
    version: "4.0.0",
    id: "d",
    title: "t",
    type: "BPMNDiagram",
    nodes,
    edges: [],
    assessments: {},
  }) as UMLModel

const byId = (m: UMLModel) => new Map(m.nodes.map((n) => [n.id, n]))

// Pool at (0,300) 1300x390 with three stacked lanes (lane-relative x = 40).
const lanedPool = () => [
  node("pool", "bpmnPool", 0, 300, 1300, 390),
  node("lane1", "bpmnSwimlane", 40, 0, 1260, 130, { parentId: "pool" }),
  node("lane2", "bpmnSwimlane", 40, 130, 1260, 130, { parentId: "pool" }),
  node("lane3", "bpmnSwimlane", 40, 260, 1260, 130, { parentId: "pool" }),
]

describe("adoptBpmnContainment", () => {
  it("parents a node inside a lane to that lane with a lane-relative position", () => {
    const out = adoptBpmnContainment(
      bpmn([...lanedPool(), node("t", "bpmnTask", 520, 465, 110, 60)])
    )
    const t = byId(out).get("t")!
    expect(t.parentId).toBe("lane2")
    // abs (520,465) − lane2 abs (40, 430)
    expect(t.position).toEqual({ x: 480, y: 35 })
  })

  it("keeps lane children out of the lane header strip", () => {
    const out = adoptBpmnContainment(
      bpmn([...lanedPool(), node("e", "bpmnStartEvent", 50, 340, 40, 40)])
    )
    const e = byId(out).get("e")!
    expect(e.parentId).toBe("lane1")
    expect(e.position).toEqual({ x: LANE_HEADER_WIDTH, y: 40 })
  })

  it("parents a node inside a pool without lanes to the pool", () => {
    const out = adoptBpmnContainment(
      bpmn([
        node("pool", "bpmnPool", 0, 0, 1300, 260),
        node("t", "bpmnTask", 150, 100, 110, 60),
        node("outside", "bpmnTask", 150, 400, 110, 60),
      ])
    )
    const m = byId(out)
    expect(m.get("t")!.parentId).toBe("pool")
    expect(m.get("t")!.position).toEqual({ x: 150, y: 100 })
    expect(m.get("outside")!.parentId).toBeUndefined()
  })

  it("uses the lane under the centre when a node straddles a lane border", () => {
    const out = adoptBpmnContainment(
      bpmn([...lanedPool(), node("t", "bpmnTask", 300, 410, 110, 60)])
    )
    // centre y = 440 → lane2 (430..560)
    expect(byId(out).get("t")!.parentId).toBe("lane2")
  })

  it("nests into the innermost container (expanded subprocess inside a lane)", () => {
    const out = adoptBpmnContainment(
      bpmn([
        ...lanedPool(),
        node("sp", "bpmnSubprocess", 200, 440, 400, 110, {
          data: { name: "sp", isExpanded: true },
        }),
        node("inner", "bpmnTask", 250, 460, 110, 60),
      ])
    )
    const m = byId(out)
    expect(m.get("sp")!.parentId).toBe("lane2")
    expect(m.get("sp")!.position).toEqual({ x: 160, y: 10 })
    expect(m.get("inner")!.parentId).toBe("sp")
    expect(m.get("inner")!.position).toEqual({ x: 50, y: 20 })
    // Absolute geometry is preserved.
    expect(
      getPositionOnCanvas(m.get("inner") as unknown as Node, out.nodes as never)
    ).toEqual({ x: 250, y: 460 })
  })

  it("does not adopt into a collapsed subprocess", () => {
    const out = adoptBpmnContainment(
      bpmn([
        node("sp", "bpmnSubprocess", 0, 0, 400, 200, {
          data: { name: "sp", isExpanded: false },
        }),
        node("t", "bpmnTask", 50, 50, 110, 60),
      ])
    )
    expect(byId(out).get("t")!.parentId).toBeUndefined()
  })

  it("never touches already-parented nodes", () => {
    const parented = node("t", "bpmnTask", 5, 5, 110, 60, { parentId: "pool" })
    const input = bpmn([
      node("pool", "bpmnPool", 0, 0, 1300, 260),
      node("other", "bpmnPool", 0, 300, 1300, 260),
      parented,
    ])
    const out = adoptBpmnContainment(input)
    expect(out).toBe(input)
    expect(byId(out).get("t")).toBe(parented)
  })

  it("is idempotent", () => {
    const once = adoptBpmnContainment(
      bpmn([
        ...lanedPool(),
        node("pool2", "bpmnPool", 0, 0, 1300, 260),
        node("a", "bpmnTask", 150, 100, 110, 60),
        node("b", "bpmnTask", 520, 465, 110, 60),
      ])
    )
    const twice = adoptBpmnContainment(once)
    expect(twice).toBe(once)
  })

  it("orders parents before children in the node array", () => {
    const out = adoptBpmnContainment(
      bpmn([
        node("t", "bpmnTask", 150, 100, 110, 60),
        node("pool", "bpmnPool", 0, 0, 1300, 260),
        node("t2", "bpmnTask", 300, 100, 110, 60),
      ])
    )
    expect(out.nodes.map((n) => n.id)).toEqual(["pool", "t", "t2"])
  })

  it("leaves non-BPMN diagrams untouched", () => {
    const input = {
      ...bpmn([
        node("p", "package", 0, 0, 500, 500),
        node("c", "class", 10, 10, 100, 100),
      ]),
      type: "ClassDiagram",
    } as UMLModel
    expect(adoptBpmnContainment(input)).toBe(input)
  })

  it("does not adopt pools or lanes, and ignores call activities / groups as containers", () => {
    const out = adoptBpmnContainment(
      bpmn([
        node("pool", "bpmnPool", 0, 0, 1300, 600),
        node("innerPool", "bpmnPool", 50, 50, 400, 200),
        node("ca", "bpmnCallActivity", 600, 50, 400, 300),
        node("g", "bpmnGroup", 600, 400, 400, 150),
        node("t1", "bpmnTask", 650, 100, 110, 60),
        node("t2", "bpmnTask", 650, 420, 110, 60),
      ])
    )
    const m = byId(out)
    expect(m.get("innerPool")!.parentId).toBeUndefined()
    expect(m.get("t1")!.parentId).toBe("pool")
    expect(m.get("t2")!.parentId).toBe("pool")
    expect(m.get("g")!.parentId).toBe("pool")
  })
})

describe("orderParentsFirst", () => {
  it("is stable and tolerates dangling parents / cycles", () => {
    const ordered = orderParentsFirst([
      { id: "c", parentId: "b" },
      { id: "a" },
      { id: "b", parentId: "a" },
      { id: "x", parentId: "missing" },
      { id: "y", parentId: "z" },
      { id: "z", parentId: "y" },
    ])
    expect(ordered.map((n) => n.id)).toEqual(["a", "b", "c", "x", "z", "y"])
  })
})

describe("normalizeV4Model / migrateBpmnDiagramV3ToV4 run the adoption", () => {
  it("normalizeV4Model adopts BPMN content", () => {
    const out = normalizeV4Model(
      bpmn([
        node("pool", "bpmnPool", 0, 0, 1300, 260),
        node("t", "bpmnTask", 150, 100, 110, 60),
      ])
    )
    expect(byId(out).get("t")!.parentId).toBe("pool")
  })

  it("v3 owner:null flow nodes inside pools/lanes are adopted on migration", () => {
    const b = (x: number, y: number, width: number, height: number) => ({
      x,
      y,
      width,
      height,
    })
    const v4 = migrateBpmnDiagramV3ToV4({
      version: "3.0.0",
      type: "BPMN",
      size: { width: 1400, height: 700 },
      interactive: { elements: {}, relationships: {} },
      assessments: {},
      elements: {
        pool: {
          id: "pool",
          name: "Vendor",
          type: "BPMNPool",
          owner: null,
          bounds: b(0, 300, 1300, 390),
        },
        lane: {
          id: "lane",
          name: "Chef",
          type: "BPMNSwimlane",
          owner: "pool",
          bounds: b(40, 300, 1260, 390),
        },
        t: {
          id: "t",
          name: "Bake",
          type: "BPMNTask",
          owner: null,
          bounds: b(520, 465, 110, 60),
          taskType: "default",
          marker: "none",
        },
      },
      relationships: {},
    } as never)
    const t = byId(v4).get("t")!
    expect(t.parentId).toBe("lane")
    expect(t.position).toEqual({ x: 480, y: 165 })
  })
})

describe("moving containers (store level)", () => {
  it("moving a pool keeps its adopted children relative, so they follow", () => {
    const model = adoptBpmnContainment(
      bpmn([...lanedPool(), node("t", "bpmnTask", 520, 465, 110, 60)])
    )
    const store = createDiagramStore(new Y.Doc())
    store.getState().setNodesAndEdges(model.nodes as Node[], [])
    store.getState().onNodesChange([
      {
        type: "position",
        id: "pool",
        position: { x: 100, y: 500 },
        dragging: false,
      },
    ])
    const nodes = store.getState().nodes
    const t = nodes.find((n) => n.id === "t")!
    expect(t.position).toEqual({ x: 480, y: 35 })
    expect(getPositionOnCanvas(t, nodes)).toEqual({ x: 620, y: 665 })
  })
})

describe("resizeAllParents leaves BPMN pools and lanes alone", () => {
  it("does not fit a lane / pool to a moved child", () => {
    const nodes = adoptBpmnContainment(
      bpmn([...lanedPool(), node("t", "bpmnTask", 520, 465, 110, 60)])
    ).nodes.map((n) => structuredClone(n)) as unknown as Node[]
    const t = nodes.find((n) => n.id === "t")!
    t.position = { x: 1200, y: 100 } // past the lane's right/bottom edges
    resizeAllParents(t, nodes)
    const lane2 = nodes.find((n) => n.id === "lane2")!
    const pool = nodes.find((n) => n.id === "pool")!
    expect(lane2.position).toEqual({ x: 40, y: 130 })
    expect([lane2.width, lane2.height]).toEqual([1260, 130])
    expect(pool.position).toEqual({ x: 0, y: 300 })
    expect([pool.width, pool.height]).toEqual([1300, 390])
  })
})
