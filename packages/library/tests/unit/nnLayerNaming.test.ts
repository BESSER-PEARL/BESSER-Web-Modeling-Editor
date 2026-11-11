/** New NN layer names are unique within one NN, whatever the layer kind. */
import { describe, expect, it } from "vitest"
import type { Node } from "@xyflow/react"
import { finalizeNewNode } from "@/components/DraggableGhost"

const nn = (
  id: string,
  type: string,
  name: string,
  parentId?: string,
  data: Record<string, unknown> = {}
): Node => ({
  id,
  type,
  position: { x: 0, y: 0 },
  width: 120,
  height: 60,
  ...(parentId && { parentId }),
  data: { name, attributes: { name }, ...data },
})

describe("new layer names", () => {
  const existing = [
    nn("main", "NNContainer", "main"),
    nn("sub", "NNContainer", "sub"),
    nn("a", "Conv2DLayer", "block", "main"),
  ]
  const nameOf = (node: Node) => (node.data as { name: string }).name

  it("are unique across layer kinds within one NN", () => {
    expect(nameOf(finalizeNewNode(nn("n", "LinearLayer", "block", "main"), existing))).toBe("block2")
  })

  it("may repeat in another NN and do not collide with container names", () => {
    expect(nameOf(finalizeNewNode(nn("n", "LinearLayer", "block", "sub"), existing))).toBe("block")
    expect(nameOf(finalizeNewNode(nn("n", "LinearLayer", "main", "main"), existing))).toBe("main")
  })
})
