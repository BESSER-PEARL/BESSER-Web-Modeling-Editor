/**
 * SA-3 round-trip test for the BESSER StateMachineDiagram migration.
 *
 * What it asserts (per the SA-3 brief and `uml-v4-shape.md`):
 *
 *  1. v3 fixture → `migrateStateMachineDiagramV3ToV4` produces a v4
 *     model with the 11 state-machine node types preserved, including
 *     `StateBody` / `StateFallbackBody` / `StateCodeBlock` as separate
 *     React-Flow children with `parentId` pointing at their
 *     containing `State`.
 *  2. `StateObjectNode.classId` survives the migration (resolves spec
 *     open question 4: yes, the link is preserved).
 *  3. `StateTransition` edges round-trip with `name`, `guard`, `params`,
 *     and the BESSER-additional `code` / `eventName` fields.
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

    // 12 element ids in the fixture, all should land as v4 nodes —
    // bodies / fallback-bodies are NOT collapsed (per the SA-3 brief).
    expect(v4.nodes.length).toBe(13)

    // States: Idle (no children), Working (2 bodies + 1 fallback body),
    // Done (no children).
    const idle = v4.nodes.find((n) => n.id === "state-Idle")!
    expect(idle.type).toBe("State")
    expect((idle.data as StateNodeProps).stereotype).toBeFalsy()

    const working = v4.nodes.find((n) => n.id === "state-Working")!
    expect(working.type).toBe("State")
    expect((working.data as StateNodeProps).stereotype).toBe("active")

    // Bodies / fallback-bodies use parentId.
    const body1 = v4.nodes.find((n) => n.id === "body-Working-1")!
    expect(body1.type).toBe("StateBody")
    expect(body1.parentId).toBe("state-Working")
    const body2 = v4.nodes.find((n) => n.id === "body-Working-2")!
    expect(body2.parentId).toBe("state-Working")
    const fallback = v4.nodes.find((n) => n.id === "fallback-Working-1")!
    expect(fallback.type).toBe("StateFallbackBody")
    expect(fallback.parentId).toBe("state-Working")

    // CodeBlock retains its content.
    const code = v4.nodes.find((n) => n.id === "code-Working-1")!
    expect(code.type).toBe("StateCodeBlock")
    expect((code.data as StateCodeBlockProps).code).toContain("def monitor")
    expect((code.data as StateCodeBlockProps).language).toBe("python")

    // Markers map 1:1.
    expect(v4.nodes.find((n) => n.id === "init-1")!.type).toBe("StateInitialNode")
    expect(v4.nodes.find((n) => n.id === "final-1")!.type).toBe("StateFinalNode")
    expect(v4.nodes.find((n) => n.id === "fork-1")!.type).toBe("StateForkNode")
    expect(v4.nodes.find((n) => n.id === "merge-1")!.type).toBe("StateMergeNode")

    // ActionNode preserves `code`.
    const action = v4.nodes.find((n) => n.id === "action-1")!
    expect(action.type).toBe("StateActionNode")
    expect((action.data as { code?: string }).code).toBe("print('logged')")

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
    // BESSER-extra fields surface on edge.data.
    expect((t2.data as { eventName?: string }).eventName).toBe("BeginEvent")
    expect((t2.data as { code?: string }).code).toBe("println('starting')")
    expect((t2.data as { guard?: string }).guard).toBe("ready")
    const t2Params = (t2.data as { params?: Record<string, string> }).params!
    expect(t2Params["0"]).toBe("x")
    expect(t2Params["1"]).toBe("y")
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
