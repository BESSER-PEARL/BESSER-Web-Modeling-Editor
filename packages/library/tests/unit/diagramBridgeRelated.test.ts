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

describe("diagramBridge.getRelationshipDisplayName", () => {
  // Live: the default link name "book_1-author_1" failed backend validation
  // ("Hyphens are not allowed"). Every generated name must be a valid B-UML name.
  const assoc = (over: Partial<{ role: [string, string]; mult: [string, string] }> = {}) => ({
    id: "3f2a9c1e-77aa-4b1d-9d0e-111111111111",
    source: { element: "Book", role: over.role?.[0], multiplicity: over.mult?.[0] },
    target: { element: "Author", role: over.role?.[1], multiplicity: over.mult?.[1] },
  })
  const valid = /^[\p{L}_][\p{L}\p{N}_]*$/u

  it.each([
    ["object names", assoc(), "book_1", "author_1"],
    ["object names with spaces", assoc(), "my book", "an-author"],
    ["role names", assoc({ role: ["books", "written by"] }), "b", "a"],
    ["multiplicities only", assoc({ mult: ["1", "0..*"] }), "book_1", "author_1"],
    ["nothing", assoc(), undefined, undefined],
  ])("%s: yields a name without spaces or hyphens", (_label, a, s, t) => {
    expect(diagramBridge.getRelationshipDisplayName(a, s, t)).toMatch(valid)
  })

  it("joins the parts with an underscore", () => {
    expect(diagramBridge.getRelationshipDisplayName(assoc(), "book_1", "author_1")).toBe(
      "book_1_author_1"
    )
    expect(
      diagramBridge.getRelationshipDisplayName(assoc({ role: ["books", "author"] }))
    ).toBe("books_author")
  })

  it("keeps an explicit association name", () => {
    expect(diagramBridge.getRelationshipDisplayName({ ...assoc(), name: "writes" })).toBe("writes")
  })
})
