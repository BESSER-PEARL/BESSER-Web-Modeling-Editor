/**
 * SA-FIX-Agent round-trip tests for the BESSER AgentDiagram migration.
 *
 * Asserts (per the SA-FIX-Agent brief):
 *
 *  1. v3 fixture → `migrateAgentDiagramV3ToV4` produces a v4 model
 *     where AgentState body rows are folded onto the parent's
 *     `data.bodies` inline array (no longer separate React-Flow
 *     children). Body rows retain their original v3 ids and
 *     reply-type-driven extras for round-trip parity.
 *  2. `AgentRagElement` retains BOTH `dbCustomName` and `ragDatabaseName`
 *     verbatim (open question #5 resolution).
 *  3. The migrator collapses ALL FIVE legacy `AgentStateTransition`
 *     shapes onto the canonical v4 `AgentStateTransitionData` form.
 *  4. `convertV4ToV3Agent(v4)` is structurally invertible.
 *  5. Editing one transition's `name` is preserved through the cycle.
 *  6. The inverse migrator emits AgentStateBody/Fallback elements back
 *     to v3 with the original ids preserved (key new test).
 */
import { describe, it, expect } from "vitest"
import {
  migrateAgentDiagramV3ToV4,
  convertV4ToV3Agent,
} from "@/utils/versionConverter"
import type {
  AgentRagElementNodeProps,
  AgentStateNodeProps,
  AgentIntentNodeProps,
} from "@/types"
import agentV3 from "../fixtures/v3/agentDiagram.json"
import shape1 from "../fixtures/v3/agentTransitionShape1.json"
import shape2 from "../fixtures/v3/agentTransitionShape2.json"
import shape3 from "../fixtures/v3/agentTransitionShape3.json"
import shape4 from "../fixtures/v3/agentTransitionShape4.json"
import shape5 from "../fixtures/v3/agentTransitionShape5.json"

describe("AgentDiagram v3 → v4 round-trip", () => {
  it("migrates the v3 fixture to v4 with structural fidelity", () => {
    const v4 = migrateAgentDiagramV3ToV4(agentV3 as never)

    expect(v4.version).toMatch(/^4\./)
    expect(v4.type).toBe("AgentDiagram")

    // SA-FIX-Agent: AgentStateBody / AgentStateFallbackBody rows are
    // folded onto the parent's `data.bodies` array, so the 14 v3
    // element ids land as 11 v4 nodes (the 3 body/fallback rows are
    // absorbed into their parent state).
    expect(v4.nodes.length).toBe(11)

    // AgentState — retains stereotype/replyType + inline bodies.
    const greet = v4.nodes.find((n) => n.id === "as-Greet")!
    expect(greet.type).toBe("AgentState")
    const greetData = greet.data as AgentStateNodeProps
    expect(greetData.replyType).toBe("text")
    expect(greetData.bodies).toBeDefined()
    expect(greetData.bodies!.length).toBe(2)
    const greetBody = greetData.bodies!.find((b) => b.kind !== "fallback")!
    expect(greetBody.id).toBe("asb-Greet-1")
    expect(greetBody.name).toBe("Hello there!")
    expect(greetBody.replyType).toBe("text")
    const greetFallback = greetData.bodies!.find((b) => b.kind === "fallback")!
    expect(greetFallback.id).toBe("asfb-Greet-1")

    const help = v4.nodes.find((n) => n.id === "as-Help")!
    expect(help.type).toBe("AgentState")
    const helpData = help.data as AgentStateNodeProps
    expect(helpData.replyType).toBe("rag")
    expect(helpData.bodies?.length).toBe(1)
    expect(helpData.bodies?.[0].id).toBe("asb-Help-1")
    expect(helpData.bodies?.[0].replyType).toBe("rag")

    // Body rows must NOT exist as standalone v4 nodes anymore.
    expect(v4.nodes.find((n) => n.id === "asb-Greet-1")).toBeUndefined()
    expect(v4.nodes.find((n) => n.id === "asfb-Greet-1")).toBeUndefined()
    expect(v4.nodes.find((n) => n.id === "asb-Help-1")).toBeUndefined()

    // Intent + intent body + description.
    const greetIntent = v4.nodes.find((n) => n.id === "ai-Greeting")!
    expect(greetIntent.type).toBe("AgentIntent")
    expect((greetIntent.data as AgentIntentNodeProps).intent_description).toBe(
      "User says hello."
    )
    const intentBody = v4.nodes.find((n) => n.id === "aib-Greeting-1")!
    expect(intentBody.type).toBe("AgentIntentBody")
    expect(intentBody.parentId).toBe("ai-Greeting")
    const intentDesc = v4.nodes.find((n) => n.id === "aid-Greeting-1")!
    expect(intentDesc.type).toBe("AgentIntentDescription")
    expect(intentDesc.parentId).toBe("ai-Greeting")

    // RAG element — open question #5: BOTH names preserved verbatim.
    const rag = v4.nodes.find((n) => n.id === "rag-1")!
    expect(rag.type).toBe("AgentRagElement")
    const ragData = rag.data as AgentRagElementNodeProps
    expect(ragData.ragDatabaseName).toBe("kb_main")
    expect(ragData.dbCustomName).toBe("knowledge_corpus_v2")
    expect(ragData.dbSelectionType).toBe("custom")
    expect(ragData.dbQueryMode).toBe("llm_query")

    // Init edge.
    const initEdge = v4.edges.find((e) => e.id === "init-edge-1")!
    expect(initEdge.type).toBe("AgentStateTransitionInit")

    // 4 transitions — covering all five legacy shapes.
    const trans = v4.edges.filter((e) => e.type === "AgentStateTransition")
    expect(trans).toHaveLength(4)

    // Shape #1 — canonical predefined.
    const t1 = v4.edges.find((e) => e.id === "trans-shape1")!
    expect((t1.data as { transitionType: string }).transitionType).toBe(
      "predefined"
    )
    expect(
      (
        t1.data as {
          predefined: { predefinedType?: string; intentName?: string }
        }
      ).predefined.intentName
    ).toBe("Greeting")

    // Shape #2 — canonical custom.
    const t2 = v4.edges.find((e) => e.id === "trans-shape2")!
    expect((t2.data as { transitionType: string }).transitionType).toBe(
      "custom"
    )
    expect(
      (t2.data as { custom: { event: string; condition: string[] } }).custom
        .event
    ).toBe("ReceiveTextEvent")
    expect(
      (t2.data as { custom: { event: string; condition: string[] } }).custom
        .condition[0]
    ).toBe("len(msg) > 0")

    // Shape #3 — flat predefined with variable/operator/targetValue.
    const t3 = v4.edges.find((e) => e.id === "trans-shape3")!
    expect((t3.data as { transitionType: string }).transitionType).toBe(
      "predefined"
    )
    const t3pre = (t3.data as { predefined: any }).predefined
    expect(t3pre.predefinedType).toBe("when_variable_operation_matched")
    expect(t3pre.conditionValue).toEqual({
      variable: "score",
      operator: ">=",
      targetValue: "10",
    })

    // Shape #4 — legacy flat custom.
    const t4 = v4.edges.find((e) => e.id === "trans-shape4")!
    expect((t4.data as { transitionType: string }).transitionType).toBe(
      "custom"
    )
    expect(
      (t4.data as { custom: { event: string; condition: string[] } }).custom
        .event
    ).toBe("WildcardEvent")
    expect(
      (t4.data as { custom: { event: string; condition: string[] } }).custom
        .condition[0]
    ).toBe("x == 1")
  })

  it("round-trips v4 → v3 → v4 with structural equality", () => {
    const v4 = migrateAgentDiagramV3ToV4(agentV3 as never)
    const v3Round = convertV4ToV3Agent(v4)
    const v4Again = migrateAgentDiagramV3ToV4(v3Round)

    const canonical = (m: typeof v4) => ({
      type: m.type,
      nodes: m.nodes
        .filter(
          (n) =>
            n.type !== "AgentIntentDescription" &&
            n.type !== "AgentIntentObjectComponent"
        )
        .map((n) => ({
          id: n.id,
          type: n.type,
          parentId: n.parentId ?? null,
          name: (n.data as { name?: string }).name ?? "",
          replyType: (n.data as { replyType?: string }).replyType ?? null,
          ragDatabaseName:
            (n.data as { ragDatabaseName?: string }).ragDatabaseName ?? null,
          dbCustomName:
            (n.data as { dbCustomName?: string }).dbCustomName ?? null,
          intent_description:
            (n.data as { intent_description?: string })
              .intent_description ?? null,
          // SA-FIX-Agent: inline bodies — compare by id + key fields.
          bodies: (
            (n.data as {
              bodies?: Array<{
                id: string
                kind: string
                name?: string
                replyType?: string
                ragDatabaseName?: string
                dbCustomName?: string
              }>
            }).bodies ?? []
          )
            .map((b) => ({
              id: b.id,
              kind: b.kind,
              name: b.name ?? "",
              replyType: b.replyType ?? null,
              ragDatabaseName: b.ragDatabaseName ?? null,
              dbCustomName: b.dbCustomName ?? null,
            }))
            .sort((a, b) => a.id.localeCompare(b.id)),
        }))
        .sort((a, b) => a.id.localeCompare(b.id)),
      edges: m.edges
        .map((e) => {
          const d = (e.data ?? {}) as {
            name?: string
            transitionType?: string
            predefined?: {
              predefinedType?: string
              intentName?: string
              fileType?: string
              conditionValue?: unknown
            }
            custom?: { event?: string; condition?: string[] }
          }
          return {
            id: e.id,
            type: e.type,
            source: e.source,
            target: e.target,
            name: d.name ?? "",
            transitionType: d.transitionType ?? null,
            predefinedType: d.predefined?.predefinedType ?? null,
            intentName: d.predefined?.intentName ?? null,
            fileType: d.predefined?.fileType ?? null,
            conditionValue: d.predefined?.conditionValue ?? null,
            customEvent: d.custom?.event ?? null,
            customCondition: d.custom?.condition ?? null,
          }
        })
        .sort((a, b) => a.id.localeCompare(b.id)),
    })

    expect(JSON.stringify(canonical(v4Again))).toBe(
      JSON.stringify(canonical(v4))
    )
  })

  it("preserves a transition rename through a v4 → v3 → v4 cycle", () => {
    const v4 = migrateAgentDiagramV3ToV4(agentV3 as never)
    const t = v4.edges.find((e) => e.id === "trans-shape2")!
    ;(t.data as { name?: string }).name = "renamed-custom-edge"

    const v3Round = convertV4ToV3Agent(v4)
    const v4Again = migrateAgentDiagramV3ToV4(v3Round)

    const tAgain = v4Again.edges.find((e) => e.id === "trans-shape2")!
    expect((tAgain.data as { name?: string }).name).toBe(
      "renamed-custom-edge"
    )
  })

  it("re-emits inline bodies as v3 elements with original ids preserved", () => {
    // SA-FIX-Agent key new test.
    const v4 = migrateAgentDiagramV3ToV4(agentV3 as never)
    const v3Round = convertV4ToV3Agent(v4)

    expect(v3Round.elements["asb-Greet-1"]).toBeDefined()
    expect(v3Round.elements["asb-Greet-1"].type).toBe("AgentStateBody")
    expect(v3Round.elements["asb-Greet-1"].owner).toBe("as-Greet")

    expect(v3Round.elements["asfb-Greet-1"]).toBeDefined()
    expect(v3Round.elements["asfb-Greet-1"].type).toBe(
      "AgentStateFallbackBody"
    )
    expect(v3Round.elements["asfb-Greet-1"].owner).toBe("as-Greet")

    expect(v3Round.elements["asb-Help-1"]).toBeDefined()
    expect(v3Round.elements["asb-Help-1"].type).toBe("AgentStateBody")
    expect(v3Round.elements["asb-Help-1"].owner).toBe("as-Help")

    const greet = v3Round.elements["as-Greet"] as {
      bodies?: string[]
      fallbackBodies?: string[]
    }
    expect(greet.bodies).toEqual(["asb-Greet-1"])
    expect(greet.fallbackBodies).toEqual(["asfb-Greet-1"])
  })
})

/**
 * Parameterized round-trip test for the 5 legacy `AgentStateTransition`
 * shapes.
 */
describe("AgentStateTransition shape parameterized round-trip", () => {
  type ShapeCase = {
    name: string
    fixture: unknown
    expectedTransitionType: "predefined" | "custom"
    verify: (data: any) => void
  }

  const cases: ShapeCase[] = [
    {
      name: "Shape 1 — canonical predefined",
      fixture: shape1,
      expectedTransitionType: "predefined",
      verify: (d) => {
        expect(d.predefined.predefinedType).toBe("when_intent_matched")
        expect(d.predefined.intentName).toBe("greet")
      },
    },
    {
      name: "Shape 2 — canonical custom",
      fixture: shape2,
      expectedTransitionType: "custom",
      verify: (d) => {
        expect(d.custom.event).toBe("ReceiveTextEvent")
        expect(d.custom.condition).toEqual(["len(msg) > 0"])
      },
    },
    {
      name: "Shape 3 — legacy flat predefined (variable/operator/target)",
      fixture: shape3,
      expectedTransitionType: "predefined",
      verify: (d) => {
        expect(d.predefined.predefinedType).toBe(
          "when_variable_operation_matched"
        )
        expect(d.predefined.conditionValue).toEqual({
          variable: "score",
          operator: ">=",
          targetValue: "10",
        })
      },
    },
    {
      name: "Shape 4 — legacy flat custom (`condition: 'custom_transition'`)",
      fixture: shape4,
      expectedTransitionType: "custom",
      verify: (d) => {
        expect(d.custom.event).toBe("WildcardEvent")
        expect(d.custom.condition).toEqual(["x == 1"])
      },
    },
    {
      name: "Shape 5 — legacy nested `conditionValue.events`/`conditions`",
      fixture: shape5,
      expectedTransitionType: "custom",
      verify: (d) => {
        expect(d.custom.event).toBe("ReceiveMessageEvent")
        expect(d.custom.condition).toEqual(["msg == 'hi'"])
      },
    },
  ]

  cases.forEach((c) => {
    it(c.name, () => {
      const v4 = migrateAgentDiagramV3ToV4(c.fixture as never)
      const transition = v4.edges.find(
        (e) => e.type === "AgentStateTransition"
      )!
      expect((transition.data as any).transitionType).toBe(
        c.expectedTransitionType
      )
      c.verify(transition.data)

      const v3Round = convertV4ToV3Agent(v4)
      const v4Again = migrateAgentDiagramV3ToV4(v3Round)
      const tAgain = v4Again.edges.find(
        (e) => e.type === "AgentStateTransition"
      )!
      expect((tAgain.data as any).transitionType).toBe(
        c.expectedTransitionType
      )
      c.verify(tAgain.data)
    })
  })
})

/**
 * SA-2.2 #28 regression: ensure the v4-only `AgentIntentDescription` /
 * `AgentIntentObjectComponent` child types are dropped on export.
 */
describe("AgentIntentDescription / ObjectComponent v4 → v3 export safety", () => {
  it("rolls AgentIntentDescription child name up to the parent intent's intent_description on export, and skips both EXTRA-in-v4 child types", () => {
    const v4 = {
      version: "4.0.0" as const,
      type: "AgentDiagram" as const,
      nodes: [
        {
          id: "ai-Test",
          type: "AgentIntent",
          position: { x: 0, y: 0 },
          width: 200,
          height: 80,
          data: { name: "TestIntent" },
        },
        {
          id: "aib-Test-1",
          type: "AgentIntentBody",
          parentId: "ai-Test",
          position: { x: 0, y: 80 },
          width: 200,
          height: 30,
          data: { name: "hello" },
        },
        {
          id: "aid-Test-1",
          type: "AgentIntentDescription",
          parentId: "ai-Test",
          position: { x: 0, y: 110 },
          width: 200,
          height: 30,
          data: { name: "Description rolled up to parent" },
        },
        {
          id: "aioc-Test-1",
          type: "AgentIntentObjectComponent",
          parentId: "ai-Test",
          position: { x: 0, y: 140 },
          width: 200,
          height: 30,
          data: { name: "slot1", entity: "city", slot: "departure" },
        },
      ],
      edges: [],
    } as never

    const v3 = convertV4ToV3Agent(v4)

    const v3Intent = v3.elements["ai-Test"] as {
      intent_description?: string
    }
    expect(v3Intent).toBeDefined()
    expect(v3Intent.intent_description).toBe(
      "Description rolled up to parent"
    )

    expect(v3.elements["aid-Test-1"]).toBeUndefined()
    expect(v3.elements["aioc-Test-1"]).toBeUndefined()
    expect(v3.elements["aib-Test-1"]).toBeDefined()
  })

  it("prefers the parent's existing intent_description over a child's name when both are set", () => {
    const v4 = {
      version: "4.0.0" as const,
      type: "AgentDiagram" as const,
      nodes: [
        {
          id: "ai-Test",
          type: "AgentIntent",
          position: { x: 0, y: 0 },
          width: 200,
          height: 80,
          data: {
            name: "TestIntent",
            intent_description: "From parent (preferred)",
          },
        },
        {
          id: "aid-Test-1",
          type: "AgentIntentDescription",
          parentId: "ai-Test",
          position: { x: 0, y: 110 },
          width: 200,
          height: 30,
          data: { name: "From child (ignored)" },
        },
      ],
      edges: [],
    } as never

    const v3 = convertV4ToV3Agent(v4)
    const v3Intent = v3.elements["ai-Test"] as {
      intent_description?: string
    }
    expect(v3Intent.intent_description).toBe("From parent (preferred)")
    expect(v3.elements["aid-Test-1"]).toBeUndefined()
  })
})
