/**
 * Wave-3 sweep (A11b): v3's diagram-agnostic comment tether was the
 * generic `Link` relationship (`Comments.supportedRelationships =
 * [Link]`). The v4 spelling is `CommentLink`; before this fix the v3
 * importer let `Link` fall through unmapped to an unregistered edge
 * type that never rendered.
 */
import { describe, it, expect } from "vitest"
import {
  convertV3EdgeTypeToV4,
  convertV3ToV4,
} from "@/utils/versionConverter"

describe("v3 'Link' → v4 'CommentLink' mapping (sweep A11b)", () => {
  it("maps the generic Link edge type to CommentLink", () => {
    expect(convertV3EdgeTypeToV4("Link")).toBe("CommentLink")
  })

  it("passes the v4 spelling through unchanged (round-trip identity)", () => {
    expect(convertV3EdgeTypeToV4("CommentLink")).toBe("CommentLink")
  })

  it("lifts a v3 comment + Link tether into a CommentLink edge", () => {
    const v3Model = {
      version: "3.0.0",
      type: "ClassDiagram",
      size: { width: 800, height: 600 },
      elements: {
        "comment-1": {
          id: "comment-1",
          name: "A sticky note",
          type: "Comments",
          owner: null,
          bounds: { x: 0, y: 0, width: 160, height: 100 },
        },
        "class-1": {
          id: "class-1",
          name: "Person",
          type: "Class",
          owner: null,
          bounds: { x: 300, y: 0, width: 200, height: 100 },
          attributes: [],
          methods: [],
        },
      },
      relationships: {
        "link-1": {
          id: "link-1",
          name: "",
          type: "Link",
          owner: null,
          bounds: { x: 0, y: 0, width: 300, height: 1 },
          path: [
            { x: 0, y: 0 },
            { x: 300, y: 0 },
          ],
          source: { element: "comment-1", direction: "Right" },
          target: { element: "class-1", direction: "Left" },
          isManuallyLayouted: false,
        },
      },
      interactive: { elements: {}, relationships: {} },
      assessments: {},
    }

    const v4 = convertV3ToV4(v3Model as any)

    const tether = v4.edges.find((e) => e.id === "link-1")
    expect(tether).toBeDefined()
    expect(tether!.type).toBe("CommentLink")
    expect(tether!.source).toBe("comment-1")
    expect(tether!.target).toBe("class-1")

    const comment = v4.nodes.find((n) => n.id === "comment-1")
    expect(comment).toBeDefined()
    expect(comment!.type).toBe("comment")
  })
})
