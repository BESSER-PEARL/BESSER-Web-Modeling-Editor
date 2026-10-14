import { describe, expect, it, vi } from "vitest"
import type { Node } from "@xyflow/react"
import { UMLDiagramType } from "@/types"

// ELK is ~1.3 MB: it must load on the first auto-layout, not with the module
// (develop 52dd8ba8). The mock factory runs when elkjs is first imported.
const elkLoaded = vi.hoisted(() => ({ value: false }))
vi.mock("elkjs/lib/elk.bundled.js", async (importOriginal) => {
  elkLoaded.value = true
  return importOriginal()
})

const node = (id: string, x: number): Node => ({
  id,
  type: "class",
  position: { x, y: 0 },
  data: { name: id },
  measured: { width: 200, height: 120 },
})

describe("ELK loading", () => {
  it("is deferred until the first auto-layout", async () => {
    const { computeAutoLayout } = await import("@/utils/autoLayout")
    expect(elkLoaded.value).toBe(false)

    const result = await computeAutoLayout(
      [node("A", 0), node("B", 0)],
      [{ id: "e", source: "A", target: "B" }],
      UMLDiagramType.ClassDiagram
    )
    expect(elkLoaded.value).toBe(true)
    expect(result.nodes).toHaveLength(2)
  })
})
