import { describe, expect, it } from "vitest"
import {
  normalizeAgentModel,
  normalizeAgentTransitionData,
} from "../../lib/utils/normalizeAgentModel"
import type { BesserEdge, BesserNode, UMLModel } from "../../lib/typings"
import { UMLDiagramType } from "../../lib/types"

type AnyModel = Record<string, any>

// ─── v3 fixtures (develop-era flat shape) ───────────────────────────────────

function flatTransition(id: string, condition: string, conditionValue: unknown): AnyModel {
  return {
    id,
    name: "",
    type: "AgentStateTransition",
    owner: null,
    bounds: { x: 0, y: 0, width: 1, height: 1 },
    source: { element: `${id}-src`, direction: "Right" },
    target: { element: `${id}-tgt`, direction: "Left" },
    path: [{ x: 0, y: 0 }],
    isManuallyLayouted: false,
    condition,
    conditionValue,
  }
}

function v3State(id: string): AnyModel {
  return {
    id,
    name: id,
    type: "AgentState",
    owner: null,
    bounds: { x: 0, y: 0, width: 160, height: 100 },
    bodies: [],
    fallbackBodies: [],
  }
}

function v3AgentModel(relationships: Record<string, AnyModel>): AnyModel {
  const elements: Record<string, AnyModel> = {}
  for (const rel of Object.values(relationships)) {
    elements[rel.source.element] = v3State(rel.source.element)
    elements[rel.target.element] = v3State(rel.target.element)
  }
  return {
    version: "3.0.0",
    type: "AgentDiagram",
    size: { width: 100, height: 100 },
    elements,
    interactive: { elements: {}, relationships: {} },
    relationships,
    assessments: {},
  }
}

// ─── v4 fixtures ────────────────────────────────────────────────────────────

const state = (id: string): BesserNode => ({
  id,
  type: "AgentState" as BesserNode["type"],
  position: { x: 0, y: 0 },
  width: 160,
  height: 100,
  measured: { width: 160, height: 100 },
  data: { name: id, bodies: [], fallbackBodies: [] },
})

const transition = (id: string, data: Record<string, unknown>): BesserEdge => ({
  id,
  type: "AgentStateTransition" as BesserEdge["type"],
  source: `${id}-src`,
  target: `${id}-tgt`,
  sourceHandle: "right",
  targetHandle: "left",
  data: { name: "", label: "", points: [], ...data },
})

const v4AgentModel = (edges: BesserEdge[]): UMLModel => ({
  version: "4.0.0",
  id: "m",
  title: "Agent",
  type: UMLDiagramType.AgentDiagram,
  nodes: edges.flatMap((e) => [state(e.source), state(e.target)]),
  edges,
  assessments: {},
})

const edgeById = (m: UMLModel, id: string): BesserEdge => {
  const edge = m.edges.find((e) => e.id === id)
  if (!edge) throw new Error(`edge ${id} missing`)
  return edge
}

describe("normalizeAgentModel — v3 input", () => {
  it("returns canonical v4 arrays", () => {
    const out = normalizeAgentModel(v3AgentModel({ r1: flatTransition("r1", "auto", "") }))
    expect(out.version).toBe("4.0.0")
    expect(Array.isArray(out.nodes)).toBe(true)
    expect(Array.isArray(out.edges)).toBe(true)
    expect("relationships" in (out as AnyModel)).toBe(false)
  })

  it("upgrades a flat when_intent_matched transition to the nested shape", () => {
    const out = normalizeAgentModel(
      v3AgentModel({ r1: flatTransition("r1", "when_intent_matched", "Greeting_intent") })
    )
    const data = edgeById(out, "r1").data
    expect(data.transitionType).toBe("predefined")
    expect((data.predefined as AnyModel).predefinedType).toBe("when_intent_matched")
    expect((data.predefined as AnyModel).intentName).toBe("Greeting_intent")
    // Flat keys are gone.
    expect("condition" in data).toBe(false)
    expect("conditionValue" in data).toBe(false)
  })

  it("upgrades when_no_intent_matched and auto transitions", () => {
    const out = normalizeAgentModel(
      v3AgentModel({
        a: flatTransition("a", "when_no_intent_matched", ""),
        b: flatTransition("b", "auto", ""),
      })
    )
    expect((edgeById(out, "a").data.predefined as AnyModel).predefinedType).toBe("when_no_intent_matched")
    expect((edgeById(out, "b").data.predefined as AnyModel).predefinedType).toBe("auto")
  })

  it("maps an object conditionValue onto variable-operation fields", () => {
    const out = normalizeAgentModel(
      v3AgentModel({
        v: flatTransition("v", "when_variable_operation_matched", {
          variable: "count",
          operator: ">",
          targetValue: "3",
        }),
      })
    )
    const predefined = edgeById(out, "v").data.predefined as AnyModel
    expect(predefined.predefinedType).toBe("when_variable_operation_matched")
    expect(predefined.conditionValue).toEqual({ variable: "count", operator: ">", targetValue: "3" })
  })

  it("lifts a flat custom_transition to the custom block", () => {
    const out = normalizeAgentModel(
      v3AgentModel({
        c: {
          ...flatTransition("c", "custom_transition", ""),
          customEvent: "ReceiveTextEvent",
          customConditions: ["len(msg) > 3"],
        },
      })
    )
    const data = edgeById(out, "c").data
    expect(data.transitionType).toBe("custom")
    expect(data.custom).toEqual({ event: "ReceiveTextEvent", condition: ["len(msg) > 3"] })
    expect("customEvent" in data).toBe(false)
    expect("customConditions" in data).toBe(false)
  })

  it("preserves the edge id and endpoints", () => {
    const out = normalizeAgentModel(
      v3AgentModel({ r1: flatTransition("r1", "when_intent_matched", "X") })
    )
    const edge = edgeById(out, "r1")
    expect(edge.source).toBe("r1-src")
    expect(edge.target).toBe("r1-tgt")
  })

  it("is idempotent on already-nested input", () => {
    const once = normalizeAgentModel(
      v3AgentModel({ r1: flatTransition("r1", "when_intent_matched", "X") })
    )
    const twice = normalizeAgentModel(once)
    expect(twice).toEqual(once)
  })

  it("does not mutate the input model", () => {
    const input = v3AgentModel({ r1: flatTransition("r1", "auto", "") })
    normalizeAgentModel(input)
    expect(input.relationships.r1.condition).toBe("auto")
    expect("elements" in input).toBe(true)
  })
})

describe("normalizeAgentModel — v4 input", () => {
  it("lifts a flat v4 edge to the nested shape and drops the flat keys", () => {
    const out = normalizeAgentModel(
      v4AgentModel([
        transition("r1", { condition: "when_intent_matched", conditionValue: "Hello" }),
      ])
    )
    const data = edgeById(out, "r1").data
    expect(data.transitionType).toBe("predefined")
    expect(data.predefined).toEqual({ predefinedType: "when_intent_matched", intentName: "Hello" })
    expect("condition" in data).toBe(false)
    expect("conditionValue" in data).toBe(false)
    // Non-transition data is preserved.
    expect(data.points).toEqual([])
    expect(data.label).toBe("")
  })

  it("lifts the flat predefinedType + variable shape", () => {
    const out = normalizeAgentModel(
      v4AgentModel([
        transition("r1", {
          predefinedType: "when_variable_operation_matched",
          variable: "n",
          operator: "==",
          targetValue: "1",
        }),
      ])
    )
    expect(edgeById(out, "r1").data.predefined).toEqual({
      predefinedType: "when_variable_operation_matched",
      conditionValue: { variable: "n", operator: "==", targetValue: "1" },
    })
  })

  it("lifts the flat when_file_received shape", () => {
    const out = normalizeAgentModel(
      v4AgentModel([transition("r1", { predefinedType: "when_file_received", fileType: "pdf" })])
    )
    expect(edgeById(out, "r1").data.predefined).toEqual({
      predefinedType: "when_file_received",
      fileType: "pdf",
    })
  })

  it("keeps an explicit predefined mode even when a stale custom block is present", () => {
    // The inspector keeps the other block around when switching modes; the
    // explicit transitionType must win, never the presence of `custom`.
    const out = normalizeAgentModel(
      v4AgentModel([
        transition("r1", {
          transitionType: "predefined",
          predefined: { predefinedType: "auto" },
          custom: { event: "WildcardEvent", condition: [] },
        }),
      ])
    )
    const data = edgeById(out, "r1").data
    expect(data.transitionType).toBe("predefined")
    expect(data.predefined).toEqual({ predefinedType: "auto", conditionValue: "" })
  })

  it("keeps an explicit custom mode and its conditions", () => {
    const out = normalizeAgentModel(
      v4AgentModel([
        transition("r1", {
          transitionType: "custom",
          custom: { event: "ReceiveMessageEvent", condition: ["a", "b"] },
          predefined: { predefinedType: "when_intent_matched", intentName: "x" },
        }),
      ])
    )
    const data = edgeById(out, "r1").data
    expect(data.transitionType).toBe("custom")
    expect(data.custom).toEqual({ event: "ReceiveMessageEvent", condition: ["a", "b"] })
  })

  it("does not lift other agent edge types (init edges fold into the state's initial marker)", () => {
    // `normalizeV4Model` canonicalises the legacy `AgentStateTransitionInit`
    // edge into `data.initial` on its target state — the transition lifter
    // must never run on it (no `transitionType` / `predefined` appear).
    const init: BesserEdge = {
      id: "init",
      type: "AgentStateTransitionInit" as BesserEdge["type"],
      source: "s",
      target: "t",
      sourceHandle: "",
      targetHandle: "",
      data: { points: [], condition: "auto" },
    }
    const m = v4AgentModel([])
    const out = normalizeAgentModel({ ...m, nodes: [state("s"), state("t")], edges: [init] })
    expect(out.edges.some((e) => "transitionType" in e.data)).toBe(false)
    expect(out.nodes.find((n) => n.id === "t")?.data.initial).toBe(true)
  })

  it("is idempotent and does not mutate v4 input", () => {
    const input = v4AgentModel([transition("r1", { condition: "auto", conditionValue: "" })])
    const once = normalizeAgentModel(input)
    const twice = normalizeAgentModel(once)
    expect(twice).toEqual(once)
    expect(input.edges[0].data.condition).toBe("auto")
    expect(input.edges[0].data.transitionType).toBeUndefined()
  })

  it("returns non-model input untouched", () => {
    expect(normalizeAgentModel(null)).toBeNull()
    expect(normalizeAgentModel(undefined)).toBeUndefined()
    const junk = { hello: "world" }
    expect(normalizeAgentModel(junk)).toBe(junk)
  })
})

describe("normalizeAgentTransitionData", () => {
  it("normalises params from string / array to a dict", () => {
    expect(normalizeAgentTransitionData({ params: "x", condition: "auto" }).params).toEqual({ "0": "x" })
    expect(normalizeAgentTransitionData({ params: ["a", "b"], condition: "auto" }).params).toEqual({
      "0": "a",
      "1": "b",
    })
    expect(normalizeAgentTransitionData({ params: { k: "v" }, condition: "auto" }).params).toEqual({ k: "v" })
  })

  it("defaults an empty bag to a predefined when_intent_matched transition", () => {
    expect(normalizeAgentTransitionData(undefined)).toEqual({
      transitionType: "predefined",
      predefined: { predefinedType: "when_intent_matched", intentName: "" },
    })
  })
})
