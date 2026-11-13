import { describe, expect, it } from "vitest"
import * as Y from "yjs"
import type { Node } from "@xyflow/react"
import { createDiagramStore } from "@/store/diagramStore"

/**
 * Nodes loaded from a saved project come from the webapp's Redux state,
 * which Redux Toolkit deep-freezes. React Flow's `applyNodeChanges` writes
 * a resize into `node.measured` in place, so every loaded node threw
 * "Cannot assign to read only property 'width'" and could not be resized.
 */
const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === "object") {
    Object.values(value).forEach(deepFreeze)
    Object.freeze(value)
  }
  return value
}

describe("resizing a node loaded from frozen state", () => {
  it("applies the new size instead of throwing", () => {
    const store = createDiagramStore(new Y.Doc())
    const node = deepFreeze({
      id: "c",
      type: "class",
      position: { x: 0, y: 0 },
      width: 160,
      height: 70,
      measured: { width: 160, height: 70 },
      data: { name: "Order", attributes: [], methods: [] },
    }) as Node
    store.getState().setNodes([node])

    store.getState().onNodesChange([
      {
        id: "c",
        type: "dimensions",
        resizing: true,
        setAttributes: true,
        dimensions: { width: 240, height: 70 },
      },
    ])
    store.getState().onNodesChange([
      { id: "c", type: "dimensions", resizing: false },
    ])

    const resized = store.getState().nodes.find((n) => n.id === "c")!
    expect(resized.width).toBe(240)
    expect(resized.measured?.width).toBe(240)
  })
})
