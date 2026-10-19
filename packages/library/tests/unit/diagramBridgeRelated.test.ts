import { afterEach, describe, expect, it } from "vitest"
import { diagramBridge } from "@/services/diagramBridge"

const cls = (id: string) => ({ id, type: "class", data: { name: id, attributes: [] } })
const inherits = (id: string, child: string, parent: string) => ({
  id,
  type: "ClassInheritance",
  source: child,
  target: parent,
})

afterEach(() => diagramBridge.setClassDiagramData({ nodes: [], edges: [] }))

describe("diagramBridge.getRelatedClasses", () => {
  // Review finding: an inheritance cycle (A extends B extends A) recursed
  // without end and overflowed the stack.
  it("terminates on an inheritance cycle", () => {
    diagramBridge.setClassDiagramData({
      nodes: [cls("A"), cls("B"), cls("C")],
      edges: [
        inherits("ab", "A", "B"),
        inherits("ba", "B", "A"),
        { id: "bc", type: "ClassBidirectional", source: "B", target: "C" },
      ],
    } as never)
    expect(diagramBridge.getRelatedClasses("A").map((c) => c.id)).toEqual(["C"])
  })
})
