import { describe, expect, it } from "vitest"
import type { BesserEdge, BesserNode, UMLModel } from "../../lib/typings"
import {
  convertV4ToV3Agent,
  normalizeV4Model,
} from "../../lib/utils/versionConverter"

/**
 * The agent's entry state is the initial-node marker wired to a state, as on
 * the state machine canvas. Older v4 saves and the backend's B-UML import
 * flag the state with `data.initial` instead; loading turns the flag into
 * the marker so the initial node shows on the canvas.
 */
const state = (id: string, data: Record<string, unknown> = {}): BesserNode =>
  ({
    id,
    type: "AgentState",
    position: { x: 300, y: 100 },
    width: 160,
    height: 100,
    measured: { width: 160, height: 100 },
    data: { name: id, replyType: "text", ...data },
  }) as BesserNode

const marker = (id: string): BesserNode =>
  ({
    id,
    type: "StateInitialNode",
    position: { x: 0, y: 0 },
    width: 45,
    height: 45,
    measured: { width: 45, height: 45 },
    data: { name: "" },
  }) as BesserNode

const initEdge = (source: string, target: string): BesserEdge =>
  ({
    id: `${source}->${target}`,
    type: "AgentStateTransitionInit",
    source,
    target,
    sourceHandle: "right",
    targetHandle: "left",
    data: { params: {}, points: [] },
  }) as BesserEdge

const agent = (nodes: BesserNode[], edges: BesserEdge[] = []): UMLModel =>
  ({
    version: "4.0.0",
    id: "m",
    title: "",
    type: "AgentDiagram",
    nodes,
    edges,
    assessments: {},
  }) as UMLModel

const initialFlags = (model: UMLModel) =>
  model.nodes.filter((n) => "initial" in (n.data as object))

describe("agent initial marker on load", () => {
  it("draws the initial node for a state flagged initial", () => {
    const out = normalizeV4Model(
      agent([state("Greet", { initial: true }), state("Help", { initial: false })])
    )
    const markers = out.nodes.filter((n) => n.type === "StateInitialNode")
    expect(markers).toHaveLength(1)
    const edge = out.edges.find((e) => e.type === "AgentStateTransitionInit")!
    expect([edge.source, edge.target]).toEqual([markers[0].id, "Greet"])
    // Left of the state, vertically centred on it.
    expect(markers[0].position.x).toBeLessThan(300)
    expect(markers[0].position.y + 22.5).toBe(150)
    expect(initialFlags(out)).toEqual([])
  })

  it("keeps an existing marker instead of adding a second one", () => {
    const out = normalizeV4Model(
      agent([marker("m1"), state("Greet", { initial: true })], [initEdge("m1", "Greet")])
    )
    expect(out.nodes.filter((n) => n.type === "StateInitialNode")).toHaveLength(1)
    expect(out.edges).toHaveLength(1)
    expect(initialFlags(out)).toEqual([])
  })

  it("is idempotent", () => {
    const once = normalizeV4Model(agent([state("Greet", { initial: true })]))
    expect(normalizeV4Model(once)).toEqual(once)
  })

  it("leaves state machine diagrams alone", () => {
    const sm = { ...agent([state("S", { initial: true })]), type: "StateMachineDiagram" } as UMLModel
    expect(normalizeV4Model(sm).nodes).toHaveLength(1)
  })

  it("exports the marker to v3 for a model that still carries the flag", () => {
    const v3 = convertV4ToV3Agent(agent([state("Greet", { initial: true })]))
    const markerEl = Object.values(v3.elements).find((e) => e.type === "StateInitialNode")!
    const rel = Object.values(v3.relationships).find(
      (r) => r.type === "AgentStateTransitionInit"
    )!
    expect(rel.source.element).toBe(markerEl.id)
    expect(rel.target.element).toBe("Greet")
  })
})
