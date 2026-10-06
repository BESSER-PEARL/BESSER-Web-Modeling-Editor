import { describe, expect, it } from "vitest"
import type { Edge, Node } from "@xyflow/react"
import {
  BPMN_LANE_HEADER_WIDTH,
  BPMN_LANE_MIN_HEIGHT,
  BPMN_POOL_HEADER_WIDTH,
  computeAutoLayout,
  getAutoLayoutStrategies,
  getLayoutDirection,
  packRectangles,
} from "../../lib/utils/autoLayout"
import { handlePoint } from "../../lib/utils/autoLayoutHandles"
import { routeOrthogonalEdges } from "../../lib/utils/orthogonalRouter"
import { LANE_HEADER_WIDTH } from "../../lib/utils/bpmnConstraints"
import { POOL_HEADER_WIDTH, SWIMLANE_MIN_HEIGHT } from "../../lib/hooks/useSwimlaneLayout"
import { UMLDiagramType } from "../../lib/types"

type P = { x: number; y: number }
type R = { x: number; y: number; width: number; height: number }

const node = (id: string, type: string, overrides: Partial<Node> = {}): Node => ({
  id,
  type,
  position: { x: 0, y: 0 },
  data: { name: id },
  width: 160,
  height: 80,
  measured: { width: 160, height: 80 },
  ...overrides,
})

const sized = (id: string, type: string, w: number, h: number, overrides: Partial<Node> = {}): Node =>
  node(id, type, { width: w, height: h, measured: { width: w, height: h }, ...overrides })

const edge = (id: string, source: string, target: string, type: string, data: Record<string, unknown> = {}): Edge => ({
  id,
  source,
  target,
  type,
  sourceHandle: "top-left",
  targetHandle: "top-left",
  data: { points: [{ x: -999, y: -999 }, { x: -998, y: -999 }], ...data },
})

/** Absolute rects following parentId. */
const rects = (nodes: Node[]): Map<string, R> => {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const out = new Map<string, R>()
  for (const n of nodes) {
    let x = n.position.x
    let y = n.position.y
    let p = n.parentId
    while (p && byId.has(p)) {
      const pn = byId.get(p)!
      x += pn.position.x
      y += pn.position.y
      p = pn.parentId
    }
    out.set(n.id, {
      x,
      y,
      width: n.measured?.width ?? n.width ?? 0,
      height: n.measured?.height ?? n.height ?? 0,
    })
  }
  return out
}

const overlap = (a: R, b: R) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

const inside = (inner: R, outer: R) =>
  inner.x >= outer.x - 0.5 &&
  inner.y >= outer.y - 0.5 &&
  inner.x + inner.width <= outer.x + outer.width + 0.5 &&
  inner.y + inner.height <= outer.y + outer.height + 0.5

const isOrthogonal = (pts: P[]) =>
  pts.every((p, i) => i === 0 || p.x === pts[i - 1].x || p.y === pts[i - 1].y)

/** Does any segment of the route cross the interior of `r`? */
const routeHits = (pts: P[], r: R) =>
  pts.some((p, i) => {
    if (i === 0) return false
    const a = pts[i - 1]
    const minX = Math.min(a.x, p.x)
    const maxX = Math.max(a.x, p.x)
    const minY = Math.min(a.y, p.y)
    const maxY = Math.max(a.y, p.y)
    return maxX > r.x + 1 && minX < r.x + r.width - 1 && maxY > r.y + 1 && minY < r.y + r.height - 1
  })

describe("auto-layout profiles", () => {
  it("offers per-family strategies with the default first", () => {
    expect(getAutoLayoutStrategies(UMLDiagramType.ClassDiagram)).toEqual(["compact", "hierarchical"])
    expect(getAutoLayoutStrategies(UMLDiagramType.ObjectDiagram)).toEqual(["hierarchical", "compact"])
    expect(getAutoLayoutStrategies(UMLDiagramType.StateMachineDiagram)).toEqual(["horizontal", "vertical"])
    expect(getAutoLayoutStrategies(UMLDiagramType.Sfc)[0]).toBe("vertical")
    expect(getAutoLayoutStrategies(UMLDiagramType.BPMN)).toEqual(["horizontal"])
    expect(getAutoLayoutStrategies(UMLDiagramType.SyntaxTree)).toEqual(["vertical"])
    expect(getLayoutDirection(UMLDiagramType.UseCaseDiagram)).toBe("RIGHT")
    expect(getLayoutDirection(UMLDiagramType.ComponentDiagram)).toBe("DOWN")
  })

  it("keeps the BPMN header constants in sync with the editor", () => {
    expect(BPMN_POOL_HEADER_WIDTH).toBe(POOL_HEADER_WIDTH)
    expect(BPMN_LANE_HEADER_WIDTH).toBe(LANE_HEADER_WIDTH)
    expect(BPMN_LANE_MIN_HEIGHT).toBe(SWIMLANE_MIN_HEIGHT)
  })
})

describe("class diagram default strategy", () => {
  const classes = ["A", "B", "C", "D"].map((id) => node(id, "class"))
  const positions = (out: { nodes: Node[] }) => out.nodes.map((n) => [n.id, n.position.x, n.position.y])

  it("lays out an association-heavy class diagram with Compact when no strategy is given", async () => {
    const assoc = [
      edge("1", "A", "B", "ClassBidirectional"),
      edge("2", "A", "C", "ClassBidirectional"),
      edge("3", "B", "D", "ClassComposition"),
      edge("4", "C", "D", "ClassBidirectional"),
    ]
    const auto = await computeAutoLayout(classes, assoc, UMLDiagramType.ClassDiagram)
    const compact = await computeAutoLayout(classes, assoc, UMLDiagramType.ClassDiagram, { strategy: "compact" })
    expect(positions(auto)).toEqual(positions(compact))
  })

  it("keeps the top-down hierarchy when generalizations dominate", async () => {
    const tree = [
      edge("1", "B", "A", "ClassInheritance"),
      edge("2", "C", "A", "ClassInheritance"),
      edge("3", "D", "B", "ClassBidirectional"),
    ]
    const auto = await computeAutoLayout(classes, tree, UMLDiagramType.ClassDiagram)
    const hier = await computeAutoLayout(classes, tree, UMLDiagramType.ClassDiagram, { strategy: "hierarchical" })
    expect(positions(auto)).toEqual(positions(hier))
  })
})

describe("class diagrams (hierarchical)", () => {
  // Inheritance edges go child (source) → parent (target).
  const nodes = [
    node("Animal", "class"),
    node("Mammal", "class"),
    node("Bird", "class"),
    node("Dog", "class"),
    node("Cat", "class"),
    node("Owner", "class"),
    node("Status", "class", { data: { name: "Status", stereotype: "Enumeration" } }),
  ]
  const edges = [
    edge("i1", "Mammal", "Animal", "ClassInheritance"),
    edge("i2", "Bird", "Animal", "ClassInheritance"),
    edge("i3", "Dog", "Mammal", "ClassInheritance"),
    edge("i4", "Cat", "Mammal", "ClassRealization"),
    edge("a1", "Dog", "Owner", "ClassBidirectional", { sourceMultiplicity: "*", targetMultiplicity: "1" }),
    edge("a2", "Owner", "Cat", "ClassBidirectional"),
  ]

  it("places every generalization parent above its child", async () => {
    const out = await computeAutoLayout(nodes, edges, UMLDiagramType.ClassDiagram, { strategy: "hierarchical" })
    const r = rects(out.nodes)
    for (const e of edges.filter((x) => x.type !== "ClassBidirectional")) {
      const child = r.get(e.source)!
      const parent = r.get(e.target)!
      expect(parent.y + parent.height).toBeLessThanOrEqual(child.y)
    }
  })

  it("stores ELK's orthogonal route as absolute waypoints ending on the chosen handles", async () => {
    const out = await computeAutoLayout(nodes, edges, UMLDiagramType.ClassDiagram, { strategy: "hierarchical" })
    const r = rects(out.nodes)
    for (const e of out.edges) {
      const pts = (e.data as { points: P[] }).points
      expect(pts.length).toBeGreaterThanOrEqual(2)
      expect(isOrthogonal(pts)).toBe(true)
      // Ports were mapped back to handles: the route starts/ends exactly there.
      const s = handlePoint(r.get(e.source)!, e.sourceHandle)
      const t = handlePoint(r.get(e.target)!, e.targetHandle)
      expect(Math.abs(pts[0].x - s.x)).toBeLessThanOrEqual(1)
      expect(Math.abs(pts[0].y - s.y)).toBeLessThanOrEqual(1)
      expect(Math.abs(pts[pts.length - 1].x - t.x)).toBeLessThanOrEqual(1)
      expect(Math.abs(pts[pts.length - 1].y - t.y)).toBeLessThanOrEqual(1)
      // ... and never runs through another node.
      for (const n of out.nodes) {
        if (n.id === e.source || n.id === e.target) continue
        expect(routeHits(pts, r.get(n.id)!)).toBe(false)
      }
    }
  })

  it("maps the three ELK ports on a parent's bottom side to three distinct handles", async () => {
    const out = await computeAutoLayout(
      [node("P", "class"), node("A", "class"), node("B", "class"), node("C", "class")],
      [
        edge("x", "A", "P", "ClassInheritance"),
        edge("y", "B", "P", "ClassInheritance"),
        edge("z", "C", "P", "ClassInheritance"),
      ],
      UMLDiagramType.ClassDiagram
    )
    const handles = out.edges.map((e) => e.targetHandle)
    expect(new Set(handles)).toEqual(new Set(["bottom-left", "bottom", "bottom-right"]))
    // Children enter from the top.
    out.edges.forEach((e) => expect(e.sourceHandle).toMatch(/^top/))
  })

  it("packs isolated elements (enumerations) without overlaps next to the graph", async () => {
    const enums = Array.from({ length: 8 }, (_, i) => node(`E${i}`, "class", { data: { name: `E${i}`, stereotype: "Enumeration" } }))
    const out = await computeAutoLayout([...nodes, ...enums], edges, UMLDiagramType.ClassDiagram)
    const r = rects(out.nodes)
    const list = [...r.values()]
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) expect(overlap(list[i], list[j])).toBe(false)
    }
    // Not one long row: the enums use more than one row.
    const enumRows = new Set(enums.map((e) => r.get(e.id)!.y))
    expect(enumRows.size).toBeGreaterThan(1)
  })

  it("compact strategy: no overlaps, orthogonal routes around the nodes", async () => {
    const out = await computeAutoLayout(nodes, edges, UMLDiagramType.ClassDiagram, { strategy: "compact" })
    const r = rects(out.nodes)
    const list = [...r.entries()]
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) expect(overlap(list[i][1], list[j][1])).toBe(false)
    }
    for (const e of out.edges) {
      const pts = (e.data as { points: P[] }).points
      expect(isOrthogonal(pts)).toBe(true)
      for (const [id, rect] of list) {
        if (id === e.source || id === e.target) continue
        expect(routeHits(pts, rect)).toBe(false)
      }
    }
  })

  it("drops stale waypoints for straight / bézier edge renderers", async () => {
    const agent = await computeAutoLayout(
      [node("s1", "AgentState", { data: { name: "s1", initial: true } }), node("s2", "AgentState")],
      [edge("t", "s1", "s2", "AgentStateTransition")],
      UMLDiagramType.AgentDiagram
    )
    expect((agent.edges[0].data as { points: P[] }).points).toEqual([])
    const useCase = await computeAutoLayout(
      [node("actor", "useCaseActor"), node("uc", "useCase")],
      [edge("u", "actor", "uc", "UseCaseAssociation")],
      UMLDiagramType.UseCaseDiagram
    )
    expect((useCase.edges[0].data as { points: P[] }).points).toEqual([])
    // Use cases only expose side-centre handles.
    expect(useCase.edges[0].targetHandle).toBe("left")
  })
})

describe("flow diagrams", () => {
  it("state machine: initial first, final last, left-to-right, self loop kept", async () => {
    const nodes = [
      sized("final", "StateFinalNode", 40, 40),
      node("B", "State"),
      node("A", "State"),
      sized("init", "StateInitialNode", 40, 40),
    ]
    const edges = [
      edge("t0", "init", "A", "StateTransition"),
      edge("t1", "A", "B", "StateTransition", { label: "go" }),
      edge("t2", "B", "A", "StateTransition", { label: "back" }),
      edge("t3", "B", "B", "StateTransition", { label: "stay" }),
      edge("t4", "B", "final", "StateTransition"),
    ]
    const out = await computeAutoLayout(nodes, edges, UMLDiagramType.StateMachineDiagram)
    const r = rects(out.nodes)
    const x = (id: string) => r.get(id)!.x
    expect(x("init")).toBeLessThan(x("A"))
    expect(x("A")).toBeLessThan(x("B"))
    expect(x("B")).toBeLessThan(x("final"))
    const self = out.edges.find((e) => e.id === "t3")!
    expect((self.data as { points: P[] }).points.length).toBeGreaterThanOrEqual(2)
  })

  it("agent diagram: the initial state starts the flow even inside a cycle", async () => {
    const nodes = [node("idle", "AgentState"), node("other", "AgentState"), node("hello", "AgentState", { data: { name: "hello", initial: true } })]
    const edges = [
      edge("a", "hello", "idle", "AgentStateTransition"),
      edge("b", "idle", "other", "AgentStateTransition"),
      edge("c", "other", "idle", "AgentStateTransition"),
    ]
    const out = await computeAutoLayout(nodes, edges, UMLDiagramType.AgentDiagram)
    const r = rects(out.nodes)
    expect(r.get("hello")!.x).toBeLessThan(r.get("idle")!.x)
    expect(r.get("idle")!.x).toBeLessThan(r.get("other")!.x)
  })

  it("vertical strategy flips the flow top-to-bottom", async () => {
    const out = await computeAutoLayout(
      [node("a", "State"), node("b", "State")],
      [edge("t", "a", "b", "StateTransition")],
      UMLDiagramType.StateMachineDiagram,
      { strategy: "vertical" }
    )
    const r = rects(out.nodes)
    expect(r.get("b")!.y).toBeGreaterThan(r.get("a")!.y + r.get("a")!.height - 1)
  })
})

describe("NN containers", () => {
  it("lays layers out left-to-right inside the container, which grows to fit", async () => {
    const nodes = [
      sized("net", "NNContainer", 200, 150),
      sized("l1", "Conv2DLayer", 110, 110, { parentId: "net" }),
      sized("l2", "PoolingLayer", 110, 110, { parentId: "net" }),
      sized("l3", "LinearLayer", 110, 110, { parentId: "net" }),
      sized("data", "TrainingDataset", 110, 110),
    ]
    const edges = [
      edge("n1", "l1", "l2", "NNNext"),
      edge("n2", "l2", "l3", "NNNext"),
      edge("d", "data", "net", "NNAssociation"),
    ]
    const out = await computeAutoLayout(nodes, edges, UMLDiagramType.NNDiagram)
    const r = rects(out.nodes)
    const net = r.get("net")!
    expect(net.width).toBeGreaterThan(3 * 110)
    for (const id of ["l1", "l2", "l3"]) expect(inside(r.get(id)!, net)).toBe(true)
    expect(r.get("l1")!.x).toBeLessThan(r.get("l2")!.x)
    expect(r.get("l2")!.x).toBeLessThan(r.get("l3")!.x)
    expect(out.nodes.find((n) => n.id === "l1")!.parentId).toBe("net")
    expect(overlap(r.get("data")!, net)).toBe(false)
  })
})

describe("BPMN", () => {
  // Pool "C" (no lanes) above pool "V" with two lanes; flow nodes are
  // root-level and placed geometrically inside their lane (template style),
  // except `v2` which is a real child of the second lane.
  const buildModel = () => {
    const nodes: Node[] = [
      sized("C", "bpmnPool", 800, 200, { position: { x: 0, y: 0 } }),
      sized("c1", "bpmnStartEvent", 40, 40, { position: { x: 60, y: 80 } }),
      sized("c2", "bpmnTask", 110, 60, { position: { x: 200, y: 70 } }),
      sized("c3", "bpmnEndEvent", 40, 40, { position: { x: 400, y: 80 } }),
      sized("V", "bpmnPool", 800, 300, { position: { x: 0, y: 300 } }),
      sized("laneA", "bpmnSwimlane", 760, 150, { parentId: "V", position: { x: 40, y: 0 } }),
      sized("laneB", "bpmnSwimlane", 760, 150, { parentId: "V", position: { x: 40, y: 150 } }),
      sized("v1", "bpmnTask", 110, 60, { position: { x: 120, y: 340 } }),
      sized("v2", "bpmnTask", 110, 60, { parentId: "laneB", position: { x: 200, y: 40 } }),
      sized("v3", "bpmnEndEvent", 40, 40, { position: { x: 500, y: 350 } }),
      sized("timer", "bpmnIntermediateEvent", 30, 30, { position: { x: 180, y: 380 } }), // on v1's border
    ]
    const edges: Edge[] = [
      edge("f1", "c1", "c2", "BPMNSequenceFlow"),
      edge("f2", "c2", "c3", "BPMNSequenceFlow"),
      edge("f3", "v1", "v2", "BPMNSequenceFlow"),
      edge("f4", "v2", "v3", "BPMNSequenceFlow"),
      edge("m1", "c2", "v1", "BPMNMessageFlow"),
    ]
    return { nodes, edges }
  }

  it("keeps lanes (order, header strip) and every element inside its lane / pool", async () => {
    const { nodes, edges } = buildModel()
    const out = await computeAutoLayout(nodes, edges, UMLDiagramType.BPMN)
    const r = rects(out.nodes)
    const C = r.get("C")!
    const V = r.get("V")!
    const laneA = r.get("laneA")!
    const laneB = r.get("laneB")!
    // Pools stacked, not overlapping, same width.
    expect(C.y + C.height).toBeLessThanOrEqual(V.y)
    expect(C.width).toBe(V.width)
    // Lanes: order kept, stacked, locked to the pool header, pool = sum of lanes.
    const byId = new Map(out.nodes.map((n) => [n.id, n]))
    expect(byId.get("laneA")!.position.x).toBe(BPMN_POOL_HEADER_WIDTH)
    expect(byId.get("laneA")!.position.y).toBe(0)
    expect(laneB.y).toBe(laneA.y + laneA.height)
    expect(V.height).toBe(laneA.height + laneB.height)
    expect(laneA.width).toBe(V.width - BPMN_POOL_HEADER_WIDTH)
    // Membership kept (geometric for root nodes, real parent for v2).
    for (const id of ["c1", "c2", "c3"]) expect(inside(r.get(id)!, C)).toBe(true)
    expect(inside(r.get("v1")!, laneA)).toBe(true)
    expect(inside(r.get("v3")!, laneB) || inside(r.get("v3")!, laneA)).toBe(true)
    expect(inside(r.get("v2")!, laneB)).toBe(true)
    expect(byId.get("v2")!.parentId).toBe("laneB")
    expect(byId.get("v1")!.parentId).toBeUndefined()
    // Lane header strip stays clear.
    for (const id of ["v1", "v2", "v3"]) {
      expect(r.get(id)!.x).toBeGreaterThanOrEqual(laneA.x + BPMN_LANE_HEADER_WIDTH)
    }
    // Flow order left-to-right inside the pools.
    expect(r.get("c1")!.x).toBeLessThan(r.get("c2")!.x)
    expect(r.get("c2")!.x).toBeLessThan(r.get("c3")!.x)
    expect(r.get("v1")!.x).toBeLessThan(r.get("v2")!.x)
  })

  it("routes message flows vertically between pools and keeps boundary events attached", async () => {
    const { nodes, edges } = buildModel()
    const before = rects(nodes)
    const offset = {
      x: before.get("timer")!.x - before.get("v1")!.x,
      y: before.get("timer")!.y - before.get("v1")!.y,
    }
    const out = await computeAutoLayout(nodes, edges, UMLDiagramType.BPMN)
    const r = rects(out.nodes)
    expect(r.get("timer")!.x - r.get("v1")!.x).toBe(offset.x)
    expect(r.get("timer")!.y - r.get("v1")!.y).toBe(offset.y)
    const m = out.edges.find((e) => e.id === "m1")!
    expect(m.sourceHandle).toMatch(/^bottom/)
    expect(m.targetHandle).toMatch(/^top/)
    const pts = (m.data as { points: P[] }).points
    expect(isOrthogonal(pts)).toBe(true)
  })
})

describe("syntax tree", () => {
  it("uses a top-down tree with the root above its children", async () => {
    const nodes = [node("leaf1", "syntaxTreeTerminal"), node("root", "syntaxTreeNonterminal"), node("leaf2", "syntaxTreeTerminal")]
    const edges = [edge("l1", "root", "leaf1", "SyntaxTreeLink"), edge("l2", "root", "leaf2", "SyntaxTreeLink")]
    const out = await computeAutoLayout(nodes, edges, UMLDiagramType.SyntaxTree)
    const r = rects(out.nodes)
    expect(r.get("root")!.y + r.get("root")!.height).toBeLessThanOrEqual(r.get("leaf1")!.y)
    expect(r.get("root")!.y + r.get("root")!.height).toBeLessThanOrEqual(r.get("leaf2")!.y)
    out.edges.forEach((e) => expect(e.sourceHandle).toMatch(/^bottom/))
  })
})

describe("helpers", () => {
  it("packRectangles never overlaps items", () => {
    const items = [
      { width: 400, height: 600 },
      ...Array.from({ length: 10 }, (_, i) => ({ width: 100 + i * 7, height: 60 + (i % 3) * 30 })),
    ]
    const pos = packRectangles(items, 20, 900)
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = { ...pos[i], ...items[i] }
        const b = { ...pos[j], ...items[j] }
        expect(overlap(a, b)).toBe(false)
      }
    }
  })

  it("routeOrthogonalEdges goes around an obstacle", () => {
    const obstacles = [
      { x: 0, y: 0, width: 100, height: 60 },
      { x: 200, y: 0, width: 100, height: 60 },
      { x: 400, y: 0, width: 100, height: 60 },
    ]
    const routes = routeOrthogonalEdges(obstacles, [
      {
        id: "e",
        source: { point: { x: 100, y: 30 }, side: "right" },
        target: { point: { x: 400, y: 30 }, side: "left" },
      },
    ])
    const pts = routes.get("e")!
    expect(pts[0]).toEqual({ x: 100, y: 30 })
    expect(pts[pts.length - 1]).toEqual({ x: 400, y: 30 })
    expect(isOrthogonal(pts)).toBe(true)
    expect(routeHits(pts, { x: 200, y: 0, width: 100, height: 60 })).toBe(false)
  })
})
