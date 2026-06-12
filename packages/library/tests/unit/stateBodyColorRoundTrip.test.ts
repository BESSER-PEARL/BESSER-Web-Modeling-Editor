/**
 * Wave-3 sweep (A2a): per-StateBody fill / text colors must survive the
 * v3 → v4 → v3 cycle. Develop's `uml-state-body-update.tsx` styled every
 * body / fallback-body row with fillColor / textColor; the v4 inline
 * `StateBodyRow` carries them and the inverse migrator re-emits them on
 * the expanded `UMLStateBody` / `UMLStateFallbackBody` elements.
 */
import { describe, it, expect } from "vitest"
import {
  convertV3ToV4,
  convertV4ToV3StateMachine,
} from "@/utils/versionConverter"
import type { StateNodeProps } from "@/types"

const v3StateMachine = {
  version: "3.0.0",
  type: "StateMachineDiagram",
  size: { width: 800, height: 600 },
  elements: {
    "state-1": {
      id: "state-1",
      name: "Working",
      type: "State",
      owner: null,
      bounds: { x: 0, y: 0, width: 200, height: 150 },
      bodies: ["body-1"],
      fallbackBodies: ["fb-1"],
    },
    "body-1": {
      id: "body-1",
      name: "entry / start()",
      type: "StateBody",
      owner: "state-1",
      bounds: { x: 0, y: 40, width: 200, height: 30 },
      fillColor: "#ffeeaa",
      textColor: "#112233",
    },
    "fb-1": {
      id: "fb-1",
      name: "fallback action",
      type: "StateFallbackBody",
      owner: "state-1",
      bounds: { x: 0, y: 70, width: 200, height: 30 },
      fillColor: "#aaeeff",
    },
  },
  relationships: {},
  interactive: { elements: {}, relationships: {} },
  assessments: {},
}

describe("StateBody row colors v3 → v4 → v3 (sweep A2a)", () => {
  it("preserves fillColor / textColor on the v4 inline rows", () => {
    const v4 = convertV3ToV4(v3StateMachine as any)

    const state = v4.nodes.find((n) => n.id === "state-1")!
    const data = state.data as StateNodeProps
    expect(data.bodies).toHaveLength(1)
    expect(data.bodies![0]).toMatchObject({
      id: "body-1",
      name: "entry / start()",
      fillColor: "#ffeeaa",
      textColor: "#112233",
    })
    expect(data.fallbackBodies).toHaveLength(1)
    expect(data.fallbackBodies![0]).toMatchObject({
      id: "fb-1",
      fillColor: "#aaeeff",
    })
    expect(data.fallbackBodies![0].textColor).toBeUndefined()
  })

  it("re-emits the rows as v3 elements with colors on export", () => {
    const v4 = convertV3ToV4(v3StateMachine as any)
    const v3Again = convertV4ToV3StateMachine(v4)

    const body = v3Again.elements["body-1"] as Record<string, unknown>
    expect(body).toBeDefined()
    expect(body.type).toBe("StateBody")
    expect(body.owner).toBe("state-1")
    expect(body.name).toBe("entry / start()")
    expect(body.fillColor).toBe("#ffeeaa")
    expect(body.textColor).toBe("#112233")

    const fb = v3Again.elements["fb-1"] as Record<string, unknown>
    expect(fb).toBeDefined()
    expect(fb.type).toBe("StateFallbackBody")
    expect(fb.fillColor).toBe("#aaeeff")

    const state = v3Again.elements["state-1"] as Record<string, unknown> & {
      bodies?: string[]
      fallbackBodies?: string[]
    }
    expect(state.bodies).toEqual(["body-1"])
    expect(state.fallbackBodies).toEqual(["fb-1"])
    expect(state.hasBody).toBe(true)
    expect(state.hasFallbackBody).toBe(true)
  })

  it("is stable across a second v3 → v4 cycle (identity)", () => {
    const v4a = convertV3ToV4(v3StateMachine as any)
    const v4b = convertV3ToV4(convertV4ToV3StateMachine(v4a) as any)

    const a = v4a.nodes.find((n) => n.id === "state-1")!.data as StateNodeProps
    const b = v4b.nodes.find((n) => n.id === "state-1")!.data as StateNodeProps
    expect(b.bodies).toEqual(a.bodies)
    expect(b.fallbackBodies).toEqual(a.fallbackBodies)
  })
})
