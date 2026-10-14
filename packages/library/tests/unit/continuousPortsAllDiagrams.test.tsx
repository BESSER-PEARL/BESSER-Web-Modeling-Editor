import { afterEach, describe, expect, it } from "vitest"
import { act, cleanup, render } from "@testing-library/react"
import * as Y from "yjs"
import { readFileSync } from "fs"
import { resolve } from "path"
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
import { diagramBridge } from "@/services/diagramBridge"
import { AgentDiagramEdge } from "@/edges/edgeTypes/AgentDiagramEdge"
import { isMissingIntent } from "@/utils/agentComponents"
import { computePortGeometry, CURVED_EDGE_TYPES, FLOATING_EDGE_TYPES } from "@/utils/edgePorts"
import { computeFloatingLayout, FLOATING_PORT_DIAGRAMS, nodeRects } from "@/utils/floatingEdges"
import { getDefaultEdgeType } from "@/utils/edgeUtils"
import {
  attachmentRect,
  distanceToOutline,
  nearestOutlinePort,
  NO_PORT_NODE_TYPES,
  nodeShapeOf,
  outlinePoint,
  portOutlinePoint,
} from "@/utils/nodeShapes"
import type { UMLDiagramType } from "@/types"

/**
 * Continuous ports on every diagram type (2026-10-06): ends follow each
 * node's drawn outline (circles, diamonds, rounded corners, NN icon cards),
 * routes stay orthogonal up to the shape, agent curves pick sides that keep
 * them clear of other states, and templates of all types load into clean
 * live routes.
 */

type P = { x: number; y: number }
type R = { x: number; y: number; width: number; height: number }

const diagonalSegments = (pts: P[]) =>
  pts.slice(1).filter((p, i) => Math.abs(p.x - pts[i].x) > 0.5 && Math.abs(p.y - pts[i].y) > 0.5).length

const TEMPLATES = resolve(__dirname, "../../../webapp/src/main/templates/pattern")

/** Every `{ nodes, edges }` model inside a template file (projects hold several). */
const modelsIn = (file: string): { type?: string; nodes: Node[]; edges: Edge[] }[] => {
  const out: { type?: string; nodes: Node[]; edges: Edge[] }[] = []
  const walk = (v: unknown) => {
    if (!v || typeof v !== "object") return
    if (Array.isArray(v)) return v.forEach(walk)
    const o = v as Record<string, unknown>
    if (Array.isArray(o.nodes) && Array.isArray(o.edges)) out.push(o as never)
    else Object.values(o).forEach(walk)
  }
  walk(JSON.parse(readFileSync(resolve(TEMPLATES, file), "utf8")))
  return out
}

describe("node outlines (nodeShapes)", () => {
  it("puts circle ends on the circle, moving them inward along the side normal", () => {
    const shape = nodeShapeOf("bpmnStartEvent")
    const box = attachmentRect(shape, { x: 100, y: 100, width: 40, height: 40 })
    expect(outlinePoint(shape, box, "top", 120)).toEqual({ x: 120, y: 100 })
    for (const c of [108, 114, 126, 132]) {
      const q = outlinePoint(shape, box, "top", c)
      expect(q.x).toBe(c)
      expect(Math.hypot(q.x - 120, q.y - 120)).toBeCloseTo(20, 5)
    }
    const r = outlinePoint(shape, box, "right", 128)
    expect(Math.hypot(r.x - 120, r.y - 120)).toBeCloseTo(20, 5)
  })

  it("uses the centred square of a non-square circle / gateway box", () => {
    expect(attachmentRect(nodeShapeOf("bpmnEndEvent"), { x: 0, y: 0, width: 60, height: 40 })).toEqual({
      x: 10,
      y: 0,
      width: 40,
      height: 40,
    })
    expect(attachmentRect(nodeShapeOf("bpmnGateway"), { x: 0, y: 0, width: 50, height: 70 })).toEqual({
      x: 0,
      y: 10,
      width: 50,
      height: 50,
    })
  })

  it("puts diamond ends on the diamond edges", () => {
    const shape = nodeShapeOf("StateMergeNode")
    const box = { x: 0, y: 0, width: 80, height: 60 }
    for (const [side, c] of [["left", 20], ["left", 42], ["top", 30], ["bottom", 55], ["right", 35]] as const) {
      const q = outlinePoint(shape, box, side, c)
      expect(Math.abs(q.x - 40) / 40 + Math.abs(q.y - 30) / 30).toBeCloseTo(1, 5)
    }
  })

  it("follows rounded corners only near the ends of a side", () => {
    const shape = nodeShapeOf("AgentState")
    const box = { x: 0, y: 0, width: 200, height: 100 }
    expect(outlinePoint(shape, box, "top", 100)).toEqual({ x: 100, y: 0 })
    expect(outlinePoint(shape, box, "top", 3).y).toBeGreaterThan(3)
    expect(outlinePoint(shape, box, "left", 97).x).toBeGreaterThan(3)
  })

  it("round-trips the nearest outline point of circles and diamonds", () => {
    for (const type of ["StateInitialNode", "bpmnGateway"]) {
      const shape = nodeShapeOf(type)
      const box = attachmentRect(shape, { x: 0, y: 0, width: 50, height: 50 })
      for (const p of [{ x: 60, y: 10 }, { x: -5, y: 30 }, { x: 25, y: -9 }, { x: 40, y: 49 }, { x: 30, y: 30 }]) {
        const q = portOutlinePoint(shape, box, nearestOutlinePort(shape, box, p))
        expect(distanceToOutline(shape, box, q)).toBeLessThan(0.01)
      }
    }
  })

  it("attaches NN layer edges to the icon square, not the caption below it", () => {
    const box = attachmentRect(nodeShapeOf("Conv2DLayer"), { x: 0, y: 0, width: 110, height: 110 })
    expect(box).toEqual({ x: 20, y: 6, width: 70, height: 70 })
    // Too small for an icon: the card itself.
    expect(attachmentRect(nodeShapeOf("LinearLayer"), { x: 0, y: 0, width: 80, height: 50 })).toEqual({
      x: 0,
      y: 0,
      width: 80,
      height: 50,
    })
    // The container body sits below its name tab.
    expect(attachmentRect(nodeShapeOf("NNContainer"), { x: 0, y: 0, width: 300, height: 200 })).toEqual({
      x: 0,
      y: 24,
      width: 300,
      height: 176,
    })
  })

  it("keeps member rows out of the port bands", () => {
    for (const t of ["StateBody", "StateFallbackBody", "UserModelAttribute", "UserModelIcon"]) {
      expect(NO_PORT_NODE_TYPES.has(t)).toBe(true)
    }
  })
})

describe("ports on shaped nodes (computePortGeometry)", () => {
  const start = { x: 0, y: 30, width: 40, height: 40 }
  const task = { x: 200, y: 0, width: 160, height: 100 }
  const gateway = { x: 500, y: 25, width: 50, height: 50 }
  const shapes = new Map([
    ["s", nodeShapeOf("bpmnStartEvent")],
    ["t", nodeShapeOf("bpmnTask")],
    ["g", nodeShapeOf("bpmnGateway")],
  ])
  const ports = new Map([
    ["s", attachmentRect(shapes.get("s")!, start)],
    ["t", task],
    ["g", attachmentRect(shapes.get("g")!, gateway)],
  ])

  it("ends on the circle and the diamond, with an orthogonal route", () => {
    const g = computePortGeometry(
      ports,
      [
        { id: "a", source: "s", target: "t" },
        { id: "b", source: "t", target: "g" },
      ],
      [start, task, gateway],
      shapes
    )
    const a = g.get("a")!
    expect(Math.hypot(a.source.x - 20, a.source.y - 50)).toBeCloseTo(20, 0)
    expect(diagonalSegments(a.points)).toBe(0)
    const b = g.get("b")!
    expect(Math.abs(b.target.x - 525) / 25 + Math.abs(b.target.y - 50) / 25).toBeCloseTo(1, 1)
    expect(diagonalSegments(b.points)).toBe(0)
  })

  it("keeps a pinned port of a circle on the circle", () => {
    const g = computePortGeometry(
      ports,
      [{ id: "p", source: "s", target: "t", data: { sourcePort: { side: "top", t: 0.75 } } }],
      [start, task],
      shapes
    ).get("p")!
    expect(g.source.pinned).toBe(true)
    expect(g.source.side).toBe("top")
    expect(Math.hypot(g.source.x - 20, g.source.y - 50)).toBeCloseTo(20, 0)
    expect(diagonalSegments(g.points)).toBe(0)
  })

  it("spreads several ends on a small circle within its usable arc", () => {
    const g = computePortGeometry(
      new Map([...ports, ["u", { x: 200, y: 200, width: 160, height: 60 }], ["v", { x: 200, y: -200, width: 160, height: 60 }]]),
      [
        { id: "1", source: "s", target: "t" },
        { id: "2", source: "s", target: "u" },
        { id: "3", source: "s", target: "v" },
      ],
      undefined,
      shapes
    )
    for (const id of ["1", "2", "3"]) {
      const e = g.get(id)!
      expect(Math.hypot(e.source.x - 20, e.source.y - 50)).toBeCloseTo(20, 0)
      expect(diagonalSegments(e.points)).toBe(0)
    }
  })
})

describe("curved (agent) edges", () => {
  const rects = new Map<string, R>([
    ["init", { x: 0, y: 100, width: 160, height: 60 }],
    ["mid", { x: 320, y: 70, width: 210, height: 120 }],
    ["far", { x: 720, y: 0, width: 240, height: 90 }],
  ])

  it("keep facing sides when the curve is clear, and carry no route or bends", () => {
    const g = computePortGeometry(rects, [
      { id: "e", source: "init", target: "mid", curved: true, data: { points: [{ x: 0, y: 0 }, { x: 50, y: 400 }, { x: 600, y: 400 }, { x: 1, y: 1 }] } },
    ]).get("e")!
    expect(g.source.side).toBe("right")
    expect(g.target.side).toBe("left")
    expect(g.points).toHaveLength(2)
    expect(g.hasBends).toBe(false)
  })

  it("arc over or under a state the facing curve would run through", () => {
    const g = computePortGeometry(rects, [{ id: "back", source: "far", target: "init", curved: true }]).get("back")!
    expect([g.source.side, g.target.side]).not.toEqual(["left", "right"])
    expect(g.source.side === g.target.side || g.source.side === "top" || g.target.side === "top").toBe(true)
  })
})

describe("diagram coverage", () => {
  it("every exposed diagram type uses continuous ports for its default edge", () => {
    for (const t of ["ClassDiagram", "ObjectDiagram", "UserDiagram", "StateMachineDiagram", "AgentDiagram", "BPMNDiagram", "NNDiagram"]) {
      expect(FLOATING_PORT_DIAGRAMS.has(t)).toBe(true)
      expect(FLOATING_EDGE_TYPES.has(getDefaultEdgeType(t as UMLDiagramType))).toBe(true)
    }
    for (const t of ["BPMNMessageFlow", "BPMNAssociationFlow", "BPMNDataAssociationFlow", "NNComposition", "NNAssociation", "ObjectLink", "AgentStateTransitionInit"]) {
      expect(FLOATING_EDGE_TYPES.has(t)).toBe(true)
    }
    expect([...CURVED_EDGE_TYPES].every((t) => t.startsWith("AgentStateTransition"))).toBe(true)
  })

  const files = [
    "statemachine/traficlight.json",
    "agent/greetingagent.json",
    "agent/gymagent.json",
    "agent/chatbotagent.json",
    "bpmn/car_wash.json",
    "bpmn/pizza_store.json",
    "bpmn/parallel_review.json",
    "nn/alexnet_nn.json",
    "nn/lstm_nn.json",
    "nn/tutorial_example.json",
    "project/personalized_gym_agent.json",
  ]
  for (const file of files) {
    it(`loads ${file} into live routes: every edge placed, ends on outlines, no diagonals`, () => {
      for (const model of modelsIn(file)) {
        const layout = computeFloatingLayout(model.nodes, model.edges)
        const boxes = nodeRects(model.nodes)
        const typeOf = new Map(model.nodes.map((n) => [n.id, n.type]))
        for (const edge of model.edges) {
          if (!boxes.has(edge.source) || !boxes.has(edge.target)) continue
          const g = layout.get(edge.id)
          expect(g, `${file}: ${edge.type} ${edge.id}`).toBeDefined()
          if (!CURVED_EDGE_TYPES.has(edge.type ?? "")) {
            expect(diagonalSegments(g!.points), `${file}: ${edge.id}`).toBe(0)
          } else {
            expect(g!.points).toHaveLength(2)
          }
          for (const [end, id] of [[g!.source, edge.source], [g!.target, edge.target]] as const) {
            const shape = nodeShapeOf(typeOf.get(id))
            const box = attachmentRect(shape, boxes.get(id)!)
            expect(distanceToOutline(shape, box, end), `${file}: ${edge.id} end on ${typeOf.get(id)}`).toBeLessThan(0.6)
          }
        }
      }
    })
  }

  it("routes a message flow across lanes and pools without detouring around them", () => {
    const [model] = modelsIn("bpmn/pizza_store.json")
    const layout = computeFloatingLayout(model.nodes, model.edges)
    const message = model.edges.filter((e) => e.type === "BPMNMessageFlow")
    expect(message.length).toBeGreaterThan(0)
    const pools = model.nodes.filter((n) => n.type === "bpmnPool" || n.type === "bpmnSwimlane").length
    expect(pools).toBeGreaterThan(0)
    for (const e of message) {
      const pts = layout.get(e.id)!.points
      // A straight or single-jog connector: pools / lanes are not obstacles.
      expect(pts.length, e.id).toBeLessThanOrEqual(4)
    }
  })
})

const node = (id: string, x: number, y: number): Node => ({
  id,
  type: "AgentState",
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
  return render(
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
}

describe("agent transition to a deleted intent", () => {
  afterEach(() => {
    cleanup()
    diagramBridge.setAgentIntents([])
  })

  it("isMissingIntent: unknown names are missing, an empty list is unknown", () => {
    expect(isMissingIntent("bye", [{ name: "greet" }])).toBe(true)
    expect(isMissingIntent("greet", [{ name: "greet" }])).toBe(false)
    expect(isMissingIntent("bye", [])).toBe(false)
    expect(isMissingIntent(undefined, [{ name: "greet" }])).toBe(false)
  })

  const strokeOf = (intentName: string) => {
    const data = {
      transitionType: "predefined",
      predefined: { predefinedType: "when_intent_matched", intentName },
    }
    const edge: Edge = { id: "t", type: "AgentStateTransition", source: "a", target: "b", data }
    const { container } = renderEdge(
      <AgentDiagramEdge
        id="t"
        type="AgentStateTransition"
        source="a"
        target="b"
        sourceX={160}
        sourceY={40}
        targetX={400}
        targetY={40}
        sourcePosition={Position.Right}
        targetPosition={Position.Left}
        data={data}
      />,
      [node("a", 0, 0), node("b", 400, 0)],
      [edge]
    )
    return container.querySelector("path.react-flow__edge-path")?.getAttribute("style") ?? ""
  }

  it("renders a transition naming a deleted intent as invalid", () => {
    diagramBridge.setAgentIntents([{ name: "greet", id: "i1" }])
    expect(strokeOf("bye")).toMatch(/#ef4444|239, 68, 68/)
  })

  it("keeps a transition naming an existing intent valid", () => {
    diagramBridge.setAgentIntents([{ name: "greet", id: "i1" }])
    expect(strokeOf("greet")).not.toMatch(/#ef4444|239, 68, 68/)
  })
})
