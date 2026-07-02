/**
 * SA-3 round-trip test for the BESSER StateMachineDiagram migration.
 *
 * What it asserts (per the SA-3 brief and `uml-v4-shape.md`, as later
 * superseded by the inline-row refactor — see the "State" case in
 * `versionConverter.ts::convertV3NodeDataToV4`):
 *
 *  1. v3 fixture → `migrateStateMachineDiagramV3ToV4` produces a v4
 *     model where `StateBody` / `StateFallbackBody` are collapsed onto
 *     their owning `State.data.bodies` / `data.fallbackBodies` inline
 *     arrays (same shape as `AgentState`) rather than emitted as
 *     separate React-Flow child nodes; every other state-machine node
 *     type — including `StateCodeBlock` — stays a free-standing node.
 *  2. `StateObjectNode.classId` survives the migration (resolves spec
 *     open question 4: yes, the link is preserved).
 *  3. `StateTransition` edges round-trip with `name`, `guard`, `params`.
 *     The legacy `code` / `eventName` relationship fields are
 *     BESSER schema-creep with no v3 source, so the v3 → v4 migrator
 *     intentionally does not carry them over (they only round-trip
 *     once authored natively in v4 — see `convertV4ToV3StateMachine`).
 *  4. `convertV4ToV3StateMachine(v4)` is structurally invertible: a
 *     v4 → v3 → v4 cycle produces the same canonical view.
 *  5. Editing one transition's `name` is preserved through the cycle.
 */
import { describe, it, expect } from "vitest"
import {
  migrateStateMachineDiagramV3ToV4,
  convertV4ToV3StateMachine,
} from "@/utils/versionConverter"
import type {
  StateNodeProps,
  StateObjectNodeProps,
  StateCodeBlockProps,
} from "@/types"
import stateMachineV3 from "../fixtures/v3/stateMachineDiagram.json"

describe("StateMachineDiagram v3 → v4 round-trip", () => {
  it("migrates the v3 fixture to v4 with structural fidelity", () => {
    const v4 = migrateStateMachineDiagramV3ToV4(stateMachineV3 as never)

    expect(v4.version).toMatch(/^4\./)
    expect(v4.type).toBe("StateMachineDiagram")

    // 13 v3 elements collapse to 10 v4 nodes: `body-Working-1`,
    // `body-Working-2` and `fallback-Working-1` fold onto
    // `state-Working.data.bodies` / `.fallbackBodies` instead of
    // surviving as separate nodes (see the "State" case in
    // `convertV3NodeDataToV4`).
    expect(v4.nodes.length).toBe(10)

    // States: Idle (no children), Working (2 bodies + 1 fallback body),
    // Done (no children).
    const idle = v4.nodes.find((n) => n.id === "state-Idle")!
    expect(idle.type).toBe("State")
    expect((idle.data as StateNodeProps).stereotype).toBeFalsy()

    const working = v4.nodes.find((n) => n.id === "state-Working")!
    expect(working.type).toBe("State")
    expect((working.data as StateNodeProps).stereotype).toBe("active")

    // Bodies / fallback-bodies survive as inline data rows on the
    // parent State — not as separate nodes with `parentId`.
    expect(v4.nodes.find((n) => n.id === "body-Working-1")).toBeUndefined()
    expect(v4.nodes.find((n) => n.id === "body-Working-2")).toBeUndefined()
    expect(
      v4.nodes.find((n) => n.id === "fallback-Working-1")
    ).toBeUndefined()
    const workingData = working.data as StateNodeProps
    expect(workingData.bodies).toEqual([
      { id: "body-Working-1", name: "entry / startMotor()" },
      { id: "body-Working-2", name: "do / monitor()" },
    ])
    expect(workingData.fallbackBodies).toEqual([
      { id: "fallback-Working-1", name: "fallback / safeStop()" },
    ])

    // CodeBlock retains its content and stays a free-standing node.
    const code = v4.nodes.find((n) => n.id === "code-Working-1")!
    expect(code.type).toBe("StateCodeBlock")
    expect((code.data as StateCodeBlockProps).code).toContain("def monitor")
    expect((code.data as StateCodeBlockProps).language).toBe("python")

    // Markers map 1:1.
    expect(v4.nodes.find((n) => n.id === "init-1")!.type).toBe("StateInitialNode")
    expect(v4.nodes.find((n) => n.id === "final-1")!.type).toBe("StateFinalNode")
    expect(v4.nodes.find((n) => n.id === "fork-1")!.type).toBe("StateForkNode")
    expect(v4.nodes.find((n) => n.id === "merge-1")!.type).toBe("StateMergeNode")

    // ActionNode: v3 parity means only `name` survives — `code` is
    // BESSER schema-creep with no v3 source (`StateActionNodeProps`
    // is a plain `DefaultNodeProps`, no `code` field).
    const action = v4.nodes.find((n) => n.id === "action-1")!
    expect(action.type).toBe("StateActionNode")
    expect((action.data as { code?: string }).code).toBeUndefined()

    // ObjectNode preserves `classId` + `className` (spec open question 4).
    const obj = v4.nodes.find((n) => n.id === "obj-1")!
    expect(obj.type).toBe("StateObjectNode")
    const objData = obj.data as StateObjectNodeProps
    expect(objData.classId).toBe("node-Context")
    expect(objData.className).toBe("Context")

    // 4 transitions.
    expect(v4.edges).toHaveLength(4)
    const t2 = v4.edges.find((e) => e.id === "trans-2")!
    expect(t2.type).toBe("StateTransition")
    expect(t2.source).toBe("state-Idle")
    expect(t2.target).toBe("state-Working")
    // `code` / `eventName` are BESSER schema-creep with no v3 source —
    // the migrator intentionally does not carry them over from a
    // legacy v3 fixture (see `convertV3RelationshipToV4Edge`).
    expect((t2.data as { eventName?: string }).eventName).toBeUndefined()
    expect((t2.data as { code?: string }).code).toBeUndefined()
    expect((t2.data as { guard?: string }).guard).toBe("ready")
    const t2Params = (t2.data as { params?: string[] }).params!
    expect(t2Params).toEqual(["x", "y"])
  })

  it("round-trips v4 → v3 → v4 with structural equality", () => {
    const v4 = migrateStateMachineDiagramV3ToV4(stateMachineV3 as never)
    const v3Round = convertV4ToV3StateMachine(v4)
    const v4Again = migrateStateMachineDiagramV3ToV4(v3Round)

    const canonical = (m: typeof v4) => ({
      type: m.type,
      nodes: m.nodes
        .map((n) => ({
          id: n.id,
          type: n.type,
          parentId: n.parentId ?? null,
          name: (n.data as { name?: string }).name ?? "",
          classId: (n.data as { classId?: string }).classId ?? null,
          code: (n.data as { code?: string }).code ?? null,
          stereotype:
            (n.data as { stereotype?: string | null }).stereotype ?? null,
        }))
        .sort((a, b) => a.id.localeCompare(b.id)),
      edges: m.edges
        .map((e) => ({
          id: e.id,
          type: e.type,
          source: e.source,
          target: e.target,
          name: (e.data as { name?: string }).name ?? "",
          guard: (e.data as { guard?: string }).guard ?? null,
          eventName: (e.data as { eventName?: string }).eventName ?? null,
          code: (e.data as { code?: string }).code ?? null,
          params: (e.data as { params?: Record<string, string> }).params ?? {},
        }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    })

    expect(JSON.stringify(canonical(v4Again))).toBe(
      JSON.stringify(canonical(v4))
    )
  })

  it("preserves a transition rename through a v4 → v3 → v4 cycle", () => {
    const v4 = migrateStateMachineDiagramV3ToV4(stateMachineV3 as never)
    const t3 = v4.edges.find((e) => e.id === "trans-3")!
    ;(t3.data as { name?: string }).name = "completedSuccessfully"

    const v3Round = convertV4ToV3StateMachine(v4)
    const v4Again = migrateStateMachineDiagramV3ToV4(v3Round)

    const t3Again = v4Again.edges.find((e) => e.id === "trans-3")!
    expect((t3Again.data as { name?: string }).name).toBe(
      "completedSuccessfully"
    )
  })
})

/* ───────────── transition params / guard (Wave-3 SM-1) ───────────── */

/** Minimal v3 model with a single State→State transition carrying the
 *  given extra relationship fields. */
const v3WithTransition = (extra: Record<string, unknown>) => ({
  version: "3.0.0",
  type: "StateMachineDiagram",
  size: { width: 800, height: 600 },
  interactive: { elements: {}, relationships: {} },
  elements: {
    "s-a": {
      id: "s-a",
      name: "A",
      type: "State",
      owner: null,
      bounds: { x: 0, y: 0, width: 200, height: 80 },
    },
    "s-b": {
      id: "s-b",
      name: "B",
      type: "State",
      owner: null,
      bounds: { x: 400, y: 0, width: 200, height: 80 },
    },
  },
  relationships: {
    "t-1": {
      id: "t-1",
      name: "go",
      type: "StateTransition",
      owner: null,
      bounds: { x: 200, y: 40, width: 200, height: 0 },
      path: [
        { x: 0, y: 0 },
        { x: 200, y: 0 },
      ],
      source: { element: "s-a", direction: "Right" },
      target: { element: "s-b", direction: "Left" },
      ...extra,
    },
  },
  assessments: {},
})

const transitionData = (m: ReturnType<typeof migrateStateMachineDiagramV3ToV4>) =>
  m.edges.find((e) => e.id === "t-1")!.data as {
    params?: string[] | string | Record<string, string>
    guard?: string
  }

describe("StateTransition params / guard lift (v3 → v4)", () => {
  it("lifts a v3 params array + guard to an ordered array and string", () => {
    const v4 = migrateStateMachineDiagramV3ToV4(
      v3WithTransition({ params: ["a", "b"], guard: "x > 1" }) as never
    )
    expect(transitionData(v4).params).toEqual(["a", "b"])
    expect(transitionData(v4).guard).toBe("x > 1")
  })

  it("lifts a v3 single-string params to a one-element array, unsplit", () => {
    // A single v3 param may legally contain commas — never split.
    const v4 = migrateStateMachineDiagramV3ToV4(
      v3WithTransition({ params: "{60}" }) as never
    )
    expect(transitionData(v4).params).toEqual(["{60}"])

    const v4Commas = migrateStateMachineDiagramV3ToV4(
      v3WithTransition({ params: "a, b" }) as never
    )
    expect(transitionData(v4Commas).params).toEqual(["a, b"])
  })

  it("lifts a v3 params dict in key order", () => {
    const v4 = migrateStateMachineDiagramV3ToV4(
      v3WithTransition({ params: { "1": "b", "0": "a" } }) as never
    )
    expect(transitionData(v4).params).toEqual(["a", "b"])
  })

  it("round-trips multi-params and guard through v4 → v3 → v4", () => {
    const v4 = migrateStateMachineDiagramV3ToV4(
      v3WithTransition({ params: ["a", "b"], guard: "x > 1" }) as never
    )
    const v4Again = migrateStateMachineDiagramV3ToV4(
      convertV4ToV3StateMachine(v4)
    )
    expect(transitionData(v4Again).params).toEqual(["a", "b"])
    expect(transitionData(v4Again).guard).toBe("x > 1")
  })

  it("emits develop's richest wire form on v4 → v3 export", () => {
    // n params → string[]; 1 param → plain string; 0 params → omitted
    // (mirrors develop `uml-state-transition.ts::serialize()`).
    const exportParams = (params?: string[]) => {
      const v4 = migrateStateMachineDiagramV3ToV4(
        v3WithTransition(params ? { params } : {}) as never
      )
      const v3 = convertV4ToV3StateMachine(v4)
      return (
        v3.relationships["t-1"] as unknown as {
          params?: string | string[]
        }
      ).params
    }
    expect(exportParams(["a", "b"])).toEqual(["a", "b"])
    expect(exportParams(["{60}"])).toBe("{60}")
    expect(exportParams(undefined)).toBeUndefined()
  })
})

/* ───────────── state stereotype display data (Wave-3 SM-2) ───────────── */

describe("State stereotype round-trip", () => {
  it("survives v3 → v4 → v3", () => {
    const v3 = v3WithTransition({})
    ;(v3.elements["s-a"] as Record<string, unknown>).stereotype = "active"

    const v4 = migrateStateMachineDiagramV3ToV4(v3 as never)
    const sA = v4.nodes.find((n) => n.id === "s-a")!
    expect((sA.data as StateNodeProps).stereotype).toBe("active")

    const v3Round = convertV4ToV3StateMachine(v4)
    expect(
      (v3Round.elements["s-a"] as unknown as { stereotype?: string })
        .stereotype
    ).toBe("active")
  })
})
