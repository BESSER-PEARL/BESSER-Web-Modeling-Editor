/**
 * SA-4 round-trip tests for the BESSER AgentDiagram migration.
 *
 * Asserts (per the SA-4 brief and `uml-v4-shape.md`):
 *
 *  1. v3 fixture → `migrateAgentDiagramV3ToV4` produces a v4 model with
 *     8 BESSER agent node types preserved, including bodies / intent
 *     bodies / descriptions as separate React-Flow children with
 *     `parentId` (mirrors SA-3's State pattern).
 *  2. `AgentRagElement` retains BOTH `dbCustomName` and `ragDatabaseName`
 *     verbatim (open question #5 resolution).
 *  3. The migrator collapses ALL FIVE legacy `AgentStateTransition`
 *     shapes onto the canonical v4 `AgentStateTransitionData` form. A
 *     dedicated parameterized test covers each shape individually.
 *  4. `convertV4ToV3Agent(v4)` is structurally invertible — the v4 → v3
 *     → v4 cycle produces the same canonical view (compared via a
 *     normalization function, not strict equality, because the inverse
 *     migrator emits ONE canonical v3 shape).
 *  5. Editing one transition's `name` is preserved through the cycle.
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

    // 14 element ids in the fixture, all should land as v4 nodes
    // (bodies / intent bodies / descriptions are NOT collapsed per
    // the SA-4 brief, mirroring SA-3's pattern).
    expect(v4.nodes.length).toBe(14)

    // AgentState — retains stereotype/replyType.
    const greet = v4.nodes.find((n) => n.id === "as-Greet")!
    expect(greet.type).toBe("AgentState")
    expect((greet.data as AgentStateNodeProps).replyType).toBe("text")

    const help = v4.nodes.find((n) => n.id === "as-Help")!
    expect(help.type).toBe("AgentState")
    expect((help.data as AgentStateNodeProps).replyType).toBe("rag")

    // Bodies / fallback-bodies via parentId.
    const body1 = v4.nodes.find((n) => n.id === "asb-Greet-1")!
    expect(body1.type).toBe("AgentStateBody")
    expect(body1.parentId).toBe("as-Greet")
    const fallback1 = v4.nodes.find((n) => n.id === "asfb-Greet-1")!
    expect(fallback1.type).toBe("AgentStateFallbackBody")
    expect(fallback1.parentId).toBe("as-Greet")

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

    // 4 transitions — covering all five legacy shapes (shape5 lives in
    // the dedicated parametric test below).
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

    // Shape #4 — legacy flat custom (`condition: 'custom_transition'`).
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

    // Normalization function — strips `legacyShape` and `legacy` from
    // edge data, since the inverse migrator emits one canonical v3
    // shape rather than reproducing the original. Compares the
    // information-equivalent canonical fields only.
    //
    // SA-2.2 #28: `AgentIntentDescription` and `AgentIntentObjectComponent`
    // are EXTRA-in-v4 child types — v3 has no matching element type
    // (see `agent-state-diagram/index.ts:AgentElementType`). The
    // exporter drops them and rolls description text up to the parent
    // intent's `intent_description`, so they're filtered out of the
    // round-trip equality check.
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
          // Agent-specific fields we care about for round-trip.
          replyType: (n.data as { replyType?: string }).replyType ?? null,
          ragDatabaseName:
            (n.data as { ragDatabaseName?: string }).ragDatabaseName ?? null,
          dbCustomName:
            (n.data as { dbCustomName?: string }).dbCustomName ?? null,
          intent_description:
            (n.data as { intent_description?: string })
              .intent_description ?? null,
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
})

/**
 * Parameterized round-trip test for the 5 legacy `AgentStateTransition`
 * shapes. Each fixture covers exactly one historical wire form; the
 * migrator must collapse them all to the canonical v4 shape and round
 * trip via the inverse migrator + a second migration.
 */
describe("AgentStateTransition shape parameterized round-trip", () => {
  type ShapeCase = {
    name: string
    fixture: unknown
    expectedTransitionType: "predefined" | "custom"
    /** Predicate to verify the canonical v4 shape after migration. */
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
      // First migration: v3 → v4
      const v4 = migrateAgentDiagramV3ToV4(c.fixture as never)
      const transition = v4.edges.find(
        (e) => e.type === "AgentStateTransition"
      )!
      expect((transition.data as any).transitionType).toBe(
        c.expectedTransitionType
      )
      c.verify(transition.data)

      // Round-trip: v4 → v3 → v4
      const v3Round = convertV4ToV3Agent(v4)
      const v4Again = migrateAgentDiagramV3ToV4(v3Round)
      const tAgain = v4Again.edges.find(
        (e) => e.type === "AgentStateTransition"
      )!
      expect((tAgain.data as any).transitionType).toBe(
        c.expectedTransitionType
      )
      // Canonical fields must be preserved.
      c.verify(tAgain.data)
    })
  })
})

/**
 * SA-2.2 #28 regression: ensure the v4-only `AgentIntentDescription` /
 * `AgentIntentObjectComponent` child types are dropped on export AND
 * their text-bearing data is preserved on the parent intent's v3
 * `intent_description` field. The v3 `AgentElementType` registry
 * (`packages/editor/.../agent-state-diagram/index.ts`) does NOT include
 * either child type, so emitting them through the v3 wire form would
 * cause silent data loss when v3 deserialisers see an unknown element
 * type.
 */
describe("AgentIntentDescription / ObjectComponent v4 → v3 export safety", () => {
  it("rolls AgentIntentDescription child name up to the parent intent's intent_description on export, and skips both EXTRA-in-v4 child types", () => {
    // Build a v4-shaped fixture directly (synthetic — we don't need a v3
    // file because the codepath under test is v4 → v3).
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
          // Note: parent intent_description left undefined to force the
          // exporter to roll up the child's `name` instead.
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

    // The parent intent must carry the description text on the v3 wire.
    const v3Intent = v3.elements["ai-Test"] as {
      intent_description?: string
    }
    expect(v3Intent).toBeDefined()
    expect(v3Intent.intent_description).toBe(
      "Description rolled up to parent"
    )

    // Both EXTRA-in-v4 child types must be absent from the v3 elements
    // map — emitting them would produce v3-side data corruption.
    expect(v3.elements["aid-Test-1"]).toBeUndefined()
    expect(v3.elements["aioc-Test-1"]).toBeUndefined()

    // The legitimate v3 child type (AgentIntentBody) must survive.
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
