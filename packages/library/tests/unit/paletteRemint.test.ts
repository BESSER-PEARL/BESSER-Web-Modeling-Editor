import { describe, it, expect } from "vitest"
import { cloneDefaultDataWithFreshRowIds } from "@/components/DraggableGhost"

/**
 * Palette drops re-mint every nested id-bearing list (upstream Apollon
 * `instantiatePaletteData`), not just the four hard-coded row keys: two
 * drops of the same pre-populated card must never share a row id.
 */
describe("cloneDefaultDataWithFreshRowIds", () => {
  it("re-mints intent rows, method parameters and OCL rows on every drop", () => {
    const template = {
      name: "Greeting",
      training_phrases: [{ id: "tp", name: "hi" }],
      entity_slots: [{ id: "es", name: "slot" }],
      methods: [{ id: "m", name: "f", parameters: [{ id: "p", name: "x" }] }],
      oclConstraints: [
        { id: "o", name: "pre", expression: "true", targetMethodId: "m" },
      ],
    }
    const a = cloneDefaultDataWithFreshRowIds(template) as typeof template
    const b = cloneDefaultDataWithFreshRowIds(template) as typeof template
    for (const drop of [a, b]) {
      expect(drop.training_phrases[0].id).not.toBe("tp")
      expect(drop.entity_slots[0].id).not.toBe("es")
      expect(drop.methods[0].parameters[0].id).not.toBe("p")
      expect(drop.oclConstraints[0].targetMethodId).toBe(drop.methods[0].id)
    }
    expect(a.methods[0].parameters[0].id).not.toBe(
      b.methods[0].parameters[0].id
    )
    // The palette template itself is never touched.
    expect(template.methods[0].parameters[0].id).toBe("p")
  })
})
