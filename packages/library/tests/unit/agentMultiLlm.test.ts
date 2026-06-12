/**
 * Wave-2 multi-LLM — `AgentLLM` data-only definition nodes plus the
 * `llm_name` references they anchor.
 *
 * Asserts (develop parity, `agent-state-diagram` package):
 *
 *  1. v3 → v4 migration maps `AgentLLM` elements to v4 nodes with the
 *     develop deserialize defaults applied (`agent-llm.ts`).
 *  2. `llm_name` passes through on `AgentStateBody` rows (folded onto
 *     the parent's `bodies` / `fallbackBodies`) and on
 *     `AgentRagElement`.
 *  3. v4 → v3 inverse emits the develop serialize() wire form for
 *     `AgentLLM` and re-emits `llm_name` on body rows / RAG elements.
 *  4. v3 → v4 → v3 keeps every multi-LLM field intact.
 *  5. `normalizeV4Model` seeds AgentLLM deserialize defaults on partial
 *     v4 nodes — with a fresh `parameters` object per node.
 */
import { describe, it, expect } from "vitest"
import {
  convertV4ToV3Agent,
  migrateAgentDiagramV3ToV4,
  normalizeV4Model,
} from "@/utils/versionConverter"
import type {
  AgentLLMNodeProps,
  AgentRagElementNodeProps,
  AgentStateNodeProps,
  UMLModel,
} from "@/types"

/* ────────────────────────────── fixtures ───────────────────────────── */

const bounds = (x: number, y: number, w = 200, h = 90) => ({
  x,
  y,
  width: w,
  height: h,
})

/** v3 AgentDiagram with two LLM definitions, an LLM-reply state whose
 * body references one of them, and a RAG element bound to the other. */
const multiLlmV3 = {
  version: "3.0.0",
  type: "AgentDiagram",
  size: { width: 1400, height: 740 },
  interactive: { elements: {}, relationships: {} },
  elements: {
    "llm-1": {
      id: "llm-1",
      name: "fast",
      type: "AgentLLM",
      owner: null,
      bounds: bounds(40, 40),
      provider: "openai",
      parameters: { model: "gpt-4o-mini", temperature: 0.2 },
      num_previous_messages: 3,
      global_context: "Be terse.",
    },
    "llm-2": {
      id: "llm-2",
      name: "big",
      type: "AgentLLM",
      owner: null,
      bounds: bounds(40, 150),
      provider: "replicate",
      parameters: {},
      num_previous_messages: 1,
      global_context: "",
    },
    "state-1": {
      id: "state-1",
      name: "answer",
      type: "AgentState",
      owner: null,
      bounds: bounds(300, 40, 200, 100),
      replyType: "llm",
      bodies: ["body-1"],
      fallbackBodies: ["fb-1"],
    },
    "body-1": {
      id: "body-1",
      name: "AI response 🪄",
      type: "AgentStateBody",
      owner: "state-1",
      bounds: bounds(0, 0, 0, 0),
      replyType: "llm",
      llm_name: "fast",
    },
    "fb-1": {
      id: "fb-1",
      name: "DB action using Default database (LLM query, Any)",
      type: "AgentStateFallbackBody",
      owner: "state-1",
      bounds: bounds(0, 0, 0, 0),
      replyType: "db_reply",
      dbSelectionType: "default",
      dbQueryMode: "llm_query",
      dbOperation: "any",
      llm_name: "big",
    },
    "rag-1": {
      id: "rag-1",
      name: "manuals",
      type: "AgentRagElement",
      owner: null,
      bounds: bounds(600, 40, 120, 110),
      llm_name: "big",
    },
  },
  relationships: {},
  assessments: {},
} as never

/* ───────────────────────────── v3 → v4 ─────────────────────────────── */

describe("AgentDiagram multi-LLM v3 → v4", () => {
  const v4 = migrateAgentDiagramV3ToV4(multiLlmV3)

  it("migrates AgentLLM elements with every develop field", () => {
    const llm = v4.nodes.find((n) => n.id === "llm-1")!
    expect(llm).toBeDefined()
    expect(llm.type).toBe("AgentLLM")
    const data = llm.data as AgentLLMNodeProps
    expect(data.name).toBe("fast")
    expect(data.provider).toBe("openai")
    expect(data.parameters).toEqual({ model: "gpt-4o-mini", temperature: 0.2 })
    expect(data.num_previous_messages).toBe(3)
    expect(data.global_context).toBe("Be terse.")
  })

  it("applies develop deserialize defaults when v3 fields are absent", () => {
    const partial = {
      version: "3.0.0",
      type: "AgentDiagram",
      size: { width: 100, height: 100 },
      interactive: { elements: {}, relationships: {} },
      elements: {
        "llm-x": {
          id: "llm-x",
          name: "bare",
          type: "AgentLLM",
          owner: null,
          bounds: bounds(0, 0, 0, 0),
        },
      },
      relationships: {},
      assessments: {},
    } as never
    const out = migrateAgentDiagramV3ToV4(partial)
    const data = out.nodes.find((n) => n.id === "llm-x")!
      .data as AgentLLMNodeProps
    expect(data.provider).toBe("openai")
    expect(data.parameters).toEqual({})
    expect(data.num_previous_messages).toBe(1)
    expect(data.global_context).toBe("")
  })

  it("folds llm_name onto the AgentState body / fallback rows", () => {
    const state = v4.nodes.find((n) => n.id === "state-1")!
    const data = state.data as AgentStateNodeProps
    expect(data.bodies?.[0]?.llm_name).toBe("fast")
    expect(data.fallbackBodies?.[0]?.llm_name).toBe("big")
  })

  it("passes llm_name through on AgentRagElement", () => {
    const rag = v4.nodes.find((n) => n.id === "rag-1")!
    const data = rag.data as AgentRagElementNodeProps
    expect(data.llm_name).toBe("big")
  })
})

/* ───────────────────────────── v4 → v3 ─────────────────────────────── */

describe("AgentDiagram multi-LLM v4 → v3 inverse", () => {
  const v4 = migrateAgentDiagramV3ToV4(multiLlmV3)
  const v3 = convertV4ToV3Agent(v4)

  it("re-emits AgentLLM elements on the v3 wire form", () => {
    const llm = v3.elements["llm-1"] as Record<string, unknown>
    expect(llm).toBeDefined()
    expect(llm.type).toBe("AgentLLM")
    expect(llm.name).toBe("fast")
    expect(llm.provider).toBe("openai")
    expect(llm.parameters).toEqual({ model: "gpt-4o-mini", temperature: 0.2 })
    expect(llm.num_previous_messages).toBe(3)
    expect(llm.global_context).toBe("Be terse.")
  })

  it("applies serialize defaults for partial AgentLLM v4 nodes", () => {
    const minimal: UMLModel = {
      version: "4.0.0",
      id: "m",
      title: "",
      type: "AgentDiagram" as UMLModel["type"],
      nodes: [
        {
          id: "llm-min",
          type: "AgentLLM" as never,
          position: { x: 0, y: 0 },
          width: 200,
          height: 90,
          measured: { width: 200, height: 90 },
          data: { name: "bare" },
        },
      ],
      edges: [],
      assessments: {},
    }
    const out = convertV4ToV3Agent(minimal)
    const llm = out.elements["llm-min"] as Record<string, unknown>
    expect(llm.provider).toBe("openai")
    expect(llm.parameters).toEqual({})
    expect(llm.num_previous_messages).toBe(1)
    expect(llm.global_context).toBe("")
  })

  it("re-emits llm_name on body rows and RAG elements", () => {
    const body = v3.elements["body-1"] as Record<string, unknown>
    expect(body.llm_name).toBe("fast")
    const fb = v3.elements["fb-1"] as Record<string, unknown>
    expect(fb.llm_name).toBe("big")
    const rag = v3.elements["rag-1"] as Record<string, unknown>
    expect(rag.llm_name).toBe("big")
  })

  it("v3 → v4 → v3 keeps the multi-LLM fields intact", () => {
    const llm2 = v3.elements["llm-2"] as Record<string, unknown>
    expect(llm2.provider).toBe("replicate")
    expect(llm2.parameters).toEqual({})
    expect(llm2.num_previous_messages).toBe(1)
    expect(llm2.global_context).toBe("")
    // Body ids and owners survive the trip.
    expect((v3.elements["body-1"] as Record<string, unknown>).owner).toBe(
      "state-1"
    )
    expect((v3.elements["fb-1"] as Record<string, unknown>).owner).toBe(
      "state-1"
    )
  })
})

/* ─────────────────────────── normalizeV4Model ──────────────────────── */

describe("normalizeV4Model — AgentLLM defaults", () => {
  const partialNode = (id: string) => ({
    id,
    type: "AgentLLM" as never,
    position: { x: 0, y: 0 },
    width: 200,
    height: 90,
    measured: { width: 200, height: 90 },
    data: { name: id },
  })

  const model: UMLModel = {
    version: "4.0.0",
    id: "m",
    title: "",
    type: "AgentDiagram" as UMLModel["type"],
    nodes: [partialNode("llm-a"), partialNode("llm-b")],
    edges: [],
    assessments: {},
  }

  it("seeds develop deserialize defaults on partial AgentLLM nodes", () => {
    const out = normalizeV4Model(model)
    const a = out.nodes.find((n) => n.id === "llm-a")!.data as AgentLLMNodeProps
    expect(a.provider).toBe("openai")
    expect(a.parameters).toEqual({})
    expect(a.num_previous_messages).toBe(1)
    expect(a.global_context).toBe("")
  })

  it("seeds a fresh parameters object per node (no shared reference)", () => {
    const out = normalizeV4Model(model)
    const a = out.nodes.find((n) => n.id === "llm-a")!.data as AgentLLMNodeProps
    const b = out.nodes.find((n) => n.id === "llm-b")!.data as AgentLLMNodeProps
    expect(a.parameters).not.toBe(b.parameters)
  })

  it("leaves fully-specified AgentLLM nodes untouched (reference-equal)", () => {
    const full: UMLModel = {
      ...model,
      nodes: [
        {
          ...partialNode("llm-full"),
          data: {
            name: "full",
            provider: "huggingface",
            parameters: { model: "x" },
            num_previous_messages: 2,
            global_context: "ctx",
          },
        },
      ],
    }
    const out = normalizeV4Model(full)
    expect(out.nodes[0]).toBe(full.nodes[0])
  })
})
