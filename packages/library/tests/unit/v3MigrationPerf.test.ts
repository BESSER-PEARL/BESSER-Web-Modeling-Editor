import { describe, it, expect } from "vitest"
import { migrateClassDiagramV3ToV4 } from "@/utils/versionConverter"

describe("migration cost is linear in the element count", () => {
  it("1500 classes with 6 attributes each migrate in well under a second", () => {
    const elements: Record<string, unknown> = {}
    const relationships: Record<string, unknown> = {}
    for (let i = 0; i < 1500; i++) {
      const attrs: string[] = []
      for (let j = 0; j < 6; j++) {
        const id = `a${i}_${j}`
        attrs.push(id)
        elements[id] = {
          id, name: `f${j}`, type: "ClassAttribute", owner: `c${i}`,
          bounds: { x: 0, y: 0, width: 10, height: 10 },
          visibility: "public", attributeType: "int",
        }
      }
      elements[`c${i}`] = {
        id: `c${i}`, name: `C${i}`, type: "Class", owner: null,
        bounds: { x: i * 10, y: 0, width: 100, height: 100 },
        attributes: attrs, methods: [],
      }
      if (i) {
        relationships[`r${i}`] = {
          id: `r${i}`, name: "", type: "ClassBidirectional", owner: null,
          bounds: { x: 0, y: 0, width: 1, height: 1 },
          path: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
          source: { element: `c${i - 1}`, direction: "Up", multiplicity: "1", role: "a" },
          target: { element: `c${i}`, direction: "Down", multiplicity: "*", role: "b" },
        }
      }
    }
    const model = {
      version: "3.0.0",
      type: "ClassDiagram",
      size: { width: 1, height: 1 },
      interactive: { elements: {}, relationships: {} },
      elements,
      relationships,
      assessments: {},
    }
    const t0 = performance.now()
    const v4 = migrateClassDiagramV3ToV4(
      model as unknown as Parameters<typeof migrateClassDiagramV3ToV4>[0]
    )
    const ms = performance.now() - t0
    expect(v4.nodes).toHaveLength(1500)
    expect((v4.nodes[1499].data as { attributes: unknown[] }).attributes).toHaveLength(6)
    // Was ~7.5 s with the per-classifier scan over every element.
    expect(ms).toBeLessThan(1000)
  })
})
