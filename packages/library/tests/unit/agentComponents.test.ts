/**
 * Off-canvas agent components (v4 `model.components`) + the smart-gen
 * body-row / transition fields.
 *
 *  1. `normalizeAgentComponents` moves legacy component nodes (and a legacy
 *     `agentComponents` map) into `components`, keeps payload `width`
 *     (AgentGUI) and drops edges touching moved nodes.
 *  2. `convertV3ToV4` carries v3 `components` verbatim and passes the
 *     session-data-flow / GUI-reply body fields through (both directions).
 *  3. Transition GUI fields (`formGuiId`, `guiEventGuiId`) survive the
 *     lifter and `normalizeAgentModel`.
 *  4. `normalizeAgentBodyRow`: actionType ↔ replyType, legacy prompt on
 *     `name`.
 */
import { describe, expect, it } from "vitest"
import {
  AgentComponentType,
  normalizeAgentComponents,
} from "@/utils/agentComponents"
import {
  convertV3ToV4,
  convertV4ToV3Agent,
  liftAgentTransitionDataToV4,
} from "@/utils/versionConverter"
import {
  normalizeAgentBodyRow,
  normalizeAgentModel,
  normalizeAgentTransitionData,
} from "@/utils/normalizeAgentModel"
import { resolveReplyType, withActionType } from "@/utils/agentActions"
import type { AgentStateNodeProps, UMLModel } from "@/types"

const node = (id: string, type: string, data: Record<string, unknown>, extra = {}) => ({
  id,
  type: type as never,
  position: { x: 10, y: 20 },
  width: 160,
  height: 80,
  measured: { width: 160, height: 80 },
  data,
  ...extra,
})

const baseModel = (overrides: Partial<UMLModel>): UMLModel => ({
  version: "4.0.0",
  id: "m",
  title: "",
  type: "AgentDiagram" as UMLModel["type"],
  nodes: [],
  edges: [],
  assessments: {},
  ...overrides,
})

describe("normalizeAgentComponents", () => {
  it("moves legacy component nodes into components (flat entries, no geometry)", () => {
    const model = baseModel({
      nodes: [
        node("s1", "AgentState", { name: "greet", bodies: [] }),
        node("llm-1", "AgentLLM", { name: "fast", provider: "ollama", parameters: {} }),
        node("i1", "AgentIntent", {
          name: "Greeting",
          intent_description: "hi",
          training_phrases: [
            { id: "p1", name: "hello" },
            { id: "p2", name: "hey" },
          ],
        }),
        node("rag", "AgentRagElement", { name: "docs", use_hybrid_rag: true }),
      ],
      edges: [
        {
          id: "e1",
          source: "i1",
          target: "s1",
          type: "AgentStateTransition" as never,
          sourceHandle: "",
          targetHandle: "",
          data: { points: [] },
        },
      ],
    })
    const out = normalizeAgentComponents(model)
    expect(out.nodes.map((n) => n.id)).toEqual(["s1"])
    expect(out.edges).toHaveLength(0)
    const c = out.components!
    expect(c["llm-1"]).toMatchObject({
      id: "llm-1",
      type: "AgentLLM",
      name: "fast",
      provider: "ollama",
      owner: null,
    })
    expect(c["llm-1"].position).toBeUndefined()
    expect(c["i1"]).toMatchObject({
      type: AgentComponentType.AgentIntent,
      intent_description: "hi",
      bodies: ["p1", "p2"],
    })
    expect(c["i1"].training_phrases).toBeUndefined()
    expect(c["p1"]).toMatchObject({ type: "AgentIntentBody", name: "hello", owner: "i1" })
    expect(c["rag"].use_hybrid_rag).toBe(true)
  })

  it("keeps an AgentGUI payload width (only geometry is stripped)", () => {
    const model = baseModel({
      nodes: [
        node("gui", "AgentGUI", { name: "form", gui_id: "g-1", width: "400px", is_form: true }),
      ],
      agentComponents: {
        g2: { id: "g2", type: "AgentGUI", name: "x", gui_id: "g-2", width: "50%", bounds: { x: 0 } },
      } as never,
    })
    const out = normalizeAgentComponents(model)
    expect(out.components!["gui"].width).toBe("400px")
    expect(out.components!["g2"].width).toBe("50%")
    expect(out.components!["g2"].bounds).toBeUndefined()
    expect((out as { agentComponents?: unknown }).agentComponents).toBeUndefined()
  })

  it("lets existing components win and is a no-op (same reference) when nothing moves", () => {
    const clean = baseModel({ components: { a: { id: "a", type: "AgentTool", name: "t" } } })
    expect(normalizeAgentComponents(clean)).toBe(clean)
    const withBoth = baseModel({
      nodes: [node("a", "AgentTool", { name: "old" })],
      components: { a: { id: "a", type: "AgentTool", name: "new" } },
    })
    expect(normalizeAgentComponents(withBoth).components!["a"].name).toBe("new")
  })

  it("ignores non-agent diagrams", () => {
    const cls = { ...baseModel({}), type: "ClassDiagram" } as UMLModel
    expect(normalizeAgentComponents(cls)).toBe(cls)
  })
})

describe("v3 ↔ v4 agent migration — components and smart-gen row fields", () => {
  const v3 = {
    version: "3.0.0",
    type: "AgentDiagram",
    size: { width: 100, height: 100 },
    interactive: { elements: {}, relationships: {} },
    elements: {
      s1: {
        id: "s1",
        name: "ask",
        type: "AgentState",
        owner: null,
        bounds: { x: 0, y: 0, width: 200, height: 100 },
        bodies: ["b1", "b2"],
        fallbackBodies: [],
      },
      b1: {
        id: "b1",
        name: "LLM Reply",
        type: "AgentStateBody",
        owner: "s1",
        bounds: { x: 0, y: 0, width: 0, height: 0 },
        actionType: "LLMReplyAction",
        replyType: "llm",
        system_message: "Be kind",
        inputPromptMode: "custom",
        customInputPrompt: "Summarise {user_message}",
        customInputPromptUseSessionVars: true,
        systemPromptUseSessionVars: true,
        storeInSession: "summary",
        sendReply: false,
      },
      b2: {
        id: "b2",
        name: "GUI Reply: form",
        type: "AgentStateBody",
        owner: "s1",
        bounds: { x: 0, y: 0, width: 0, height: 0 },
        actionType: "GUIReplyAction",
        guiId: "g-1",
      },
    },
    components: {
      g: { id: "g", type: "AgentGUI", name: "", owner: null, gui_id: "g-1", width: "300px", is_form: true },
    },
    relationships: {},
    assessments: {},
  }

  const v4 = convertV3ToV4(v3 as never)

  it("carries v3 components verbatim", () => {
    expect(v4.components).toEqual(v3.components)
  })

  it("passes the session-data-flow and GUI fields through on body rows", () => {
    const state = v4.nodes.find((n) => n.id === "s1")!.data as AgentStateNodeProps
    expect(state.bodies![0]).toMatchObject({
      replyType: "llm",
      actionType: "LLMReplyAction",
      system_message: "Be kind",
      inputPromptMode: "custom",
      customInputPrompt: "Summarise {user_message}",
      customInputPromptUseSessionVars: true,
      systemPromptUseSessionVars: true,
      storeInSession: "summary",
      sendReply: false,
    })
    // actionType-only row → replyType derived from the class name.
    expect(state.bodies![1]).toMatchObject({ replyType: "gui_reply", guiId: "g-1" })
  })

  it("re-emits the fields and components on the way back to v3", () => {
    const back = convertV4ToV3Agent(v4)
    expect(back.elements["b1"]).toMatchObject({
      storeInSession: "summary",
      sendReply: false,
      inputPromptMode: "custom",
    })
    expect(back.elements["b2"]).toMatchObject({ guiId: "g-1", actionType: "GUIReplyAction" })
    expect((back as { components?: unknown }).components).toEqual(v3.components)
  })
})

describe("transition GUI fields", () => {
  it("lifts flat formGuiId / guiEventGuiId into the canonical blocks", () => {
    const pre = liftAgentTransitionDataToV4({
      id: "t",
      type: "AgentStateTransition",
      predefinedType: "when_form_submitted",
      formGuiId: "form-1",
    } as never)
    expect(pre.predefined).toMatchObject({
      predefinedType: "when_form_submitted",
      formGuiId: "form-1",
    })
    const cus = liftAgentTransitionDataToV4({
      id: "t",
      type: "AgentStateTransition",
      transitionType: "custom",
      custom: { event: "GUIEvent", condition: [], guiEventGuiId: "g-2" },
    } as never)
    expect(cus.custom).toMatchObject({ event: "GUIEvent", guiEventGuiId: "g-2" })
  })

  it("keeps them through normalizeAgentTransitionData", () => {
    expect(
      normalizeAgentTransitionData({
        transitionType: "predefined",
        predefined: { predefinedType: "when_form_submitted", formGuiId: "f" },
      }).predefined
    ).toEqual({ predefinedType: "when_form_submitted", formGuiId: "f" })
    expect(
      normalizeAgentTransitionData({
        transitionType: "custom",
        custom: { event: "GUIEvent", condition: [], guiEventGuiId: "g" },
      }).custom
    ).toEqual({ event: "GUIEvent", condition: [], guiEventGuiId: "g" })
  })
})

describe("body-row action types", () => {
  it("resolves replyType from actionType and stamps both", () => {
    expect(resolveReplyType({ actionType: "WebCrawlLLMAction" })).toBe("web_crawl_llm")
    expect(resolveReplyType({})).toBe("text")
    expect(withActionType({ replyType: "db_reply" })).toEqual({
      replyType: "db_reply",
      actionType: "DBAction",
    })
  })

  it("normalizeAgentBodyRow takes a legacy LLM prompt from name, but not the placeholder", () => {
    expect(normalizeAgentBodyRow({ id: "r", replyType: "llm", name: "Answer briefly" })).toMatchObject({
      system_message: "Answer briefly",
      actionType: "LLMReplyAction",
    })
    expect(
      normalizeAgentBodyRow({ id: "r", replyType: "llm", name: "AI response 🪄" }).system_message
    ).toBe("")
    expect(
      normalizeAgentBodyRow({ id: "r", replyType: "llm", name: "x", system_message: "kept" }).system_message
    ).toBe("kept")
  })

  it("normalizeAgentModel canonicalises body rows on v4 input", () => {
    const out = normalizeAgentModel(
      baseModel({
        nodes: [
          node("s", "AgentState", {
            name: "s",
            bodies: [{ id: "r1", name: "Reply", actionType: "TextReplyAction" }],
          }),
        ],
      })
    )
    const row = (out.nodes[0].data as AgentStateNodeProps).bodies![0]
    expect(row).toMatchObject({ replyType: "text", actionType: "TextReplyAction" })
  })
})
