/**
 * SA-2 round-trip test for the BESSER ObjectDiagram migration.
 *
 * Verifies the per-instance shape additions vs. ClassDiagram (see
 * `docs/source/migrations/uml-v4-shape.md`, ObjectDiagram §):
 *
 *  - `data.classId` lifts onto the v4 objectName node.
 *  - per-attribute `attributeId` survives.
 *  - the v3 wire form `"attribute = value"` collapses into separate
 *    `name` + `value` fields on v4, and recombines on v4 → v3 emit.
 *  - ObjectIcon child elements collapse into `data.icon` on the owner
 *    node.
 *  - ObjectLink edges round-trip with their source/target.
 *  - PC-4: stereotype band, classId hierarchy hint, visibility leak.
 */
import { describe, it, expect } from "vitest"
import {
  migrateObjectDiagramV3ToV4,
  convertV4ToV3Class,
} from "@/utils/versionConverter"
import { formatObjectMember } from "@/utils/classifierMemberDisplay"
import type { ObjectNodeProps } from "@/types"
import objectDiagramV3 from "../fixtures/v3/objectDiagram.json"

describe("PC-4 Gap 3: formatObjectMember strips visibility / type", () => {
  it("renders `name = value` with no visibility symbol when visibility is set", () => {
    const out = formatObjectMember({
      name: "counter",
      attributeType: "int",
      visibility: "public",
      value: "5",
    })
    expect(out).toBe("counter = 5")
    expect(out).not.toContain("+")
    expect(out).not.toContain(":")
  })

  it("falls back to bare name when no value is set", () => {
    const out = formatObjectMember({
      name: "counter",
      attributeType: "int",
      visibility: "private",
    })
    expect(out).toBe("counter")
    expect(out).not.toContain("-")
    expect(out).not.toContain(":")
  })

  it("treats empty string value as 'no value'", () => {
    const out = formatObjectMember({ name: "x", value: "" })
    expect(out).toBe("x")
  })
})

describe("ObjectDiagram v3 → v4 round-trip", () => {
  it("migrates a representative v3 fixture, lifting classId / attributeId / value", () => {
    const v4 = migrateObjectDiagramV3ToV4(objectDiagramV3 as never)

    expect(v4.version).toMatch(/^4\./)
    expect(v4.type).toBe("ObjectDiagram")

    // ObjectAttribute / ObjectMethod / ObjectIcon collapse into owner.
    expect(
      v4.nodes.some((n) =>
        ["ObjectAttribute", "ObjectMethod", "ObjectIcon"].includes(
          n.type as string
        )
      )
    ).toBe(false)

    const rex = v4.nodes.find((n) => n.id === "obj-rex")!
    expect(rex.type).toBe("objectName")
    const rexData = rex.data as ObjectNodeProps
    expect(rexData.classId).toBe("node-Dog")
    expect(rexData.className).toBe("Dog")
    expect(rexData.attributes).toHaveLength(2)

    const rexName = rexData.attributes.find((a) => a.id === "attr-rex-name")!
    expect(rexName.name).toBe("name")
    expect(rexName.value).toBe("Rex")
    expect(rexName.attributeId).toBe("attr-Dog-name")
    expect(rexName.attributeType).toBe("str")

    const rexAge = rexData.attributes.find((a) => a.id === "attr-rex-age")!
    expect(rexAge.name).toBe("age")
    expect(rexAge.value).toBe("3")
    expect(rexAge.attributeType).toBe("int")

    const link = v4.edges.find((e) => e.id === "link-1")!
    expect(link.type).toBe("ObjectLink")
    expect(link.source).toBe("obj-alice")
    expect(link.target).toBe("obj-rex")
  })

  it("preserves an in-place attribute-value edit through a v4→v3→v4 cycle", () => {
    const v4 = migrateObjectDiagramV3ToV4(objectDiagramV3 as never)
    const rex = v4.nodes.find((n) => n.id === "obj-rex")!
    const rexData = rex.data as ObjectNodeProps
    const rexAge = rexData.attributes.find((a) => a.id === "attr-rex-age")!
    rexAge.value = "5"

    const v3Round = convertV4ToV3Class(v4)
    const v4Again = migrateObjectDiagramV3ToV4(v3Round)

    const rexAgeAgain = (
      v4Again.nodes.find((n) => n.id === "obj-rex")!.data as ObjectNodeProps
    ).attributes.find((a) => a.id === "attr-rex-age")!
    expect(rexAgeAgain.value).toBe("5")
    expect(rexAgeAgain.name).toBe("age")
  })

  it("SA-2.1: round-trips ObjectLink.associationId end-to-end", () => {
    // Hand-authored v3 fixture: an ObjectLink with `associationId` set
    // at the relationship root (mirrors v3
    // `packages/editor/.../uml-object-link.ts:9`). Without P2 the field
    // would be silently dropped on import.
    const v3Fixture = {
      version: "3.0.0",
      type: "ObjectDiagram",
      size: { width: 800, height: 600 },
      interactive: { elements: {}, relationships: {} },
      elements: {
        "obj-1": {
          id: "obj-1",
          name: "rex: Dog",
          type: "ObjectName",
          owner: null,
          bounds: { x: 100, y: 100, width: 200, height: 80 },
          attributes: [],
          methods: [],
          classId: "node-Dog",
        },
        "obj-2": {
          id: "obj-2",
          name: "alice: Owner",
          type: "ObjectName",
          owner: null,
          bounds: { x: 400, y: 100, width: 200, height: 80 },
          attributes: [],
          methods: [],
          classId: "node-Owner",
        },
      },
      relationships: {
        "link-assoc": {
          id: "link-assoc",
          name: "owns",
          type: "ObjectLink",
          owner: null,
          bounds: { x: 250, y: 130, width: 0, height: 0 },
          path: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
          ],
          source: { element: "obj-2", direction: "Right" },
          target: { element: "obj-1", direction: "Left" },
          // The crucial field: in v3 this lives at the relationship root.
          associationId: "assoc-Dog-Owner",
        },
      },
    } as never

    const v4 = migrateObjectDiagramV3ToV4(v3Fixture)
    const link = v4.edges.find((e) => e.id === "link-assoc")!
    expect(link.type).toBe("ObjectLink")
    expect((link.data as { associationId?: string }).associationId).toBe(
      "assoc-Dog-Owner"
    )

    // Round-trip back: the v3 emit must put the field back at the root.
    const v3Round = convertV4ToV3Class(v4)
    expect(
      (v3Round.relationships["link-assoc"] as { associationId?: string })
        .associationId
    ).toBe("assoc-Dog-Owner")

    // And one more cycle for full idempotence.
    const v4Again = migrateObjectDiagramV3ToV4(v3Round)
    const linkAgain = v4Again.edges.find((e) => e.id === "link-assoc")!
    expect((linkAgain.data as { associationId?: string }).associationId).toBe(
      "assoc-Dog-Owner"
    )
  })

  it("PC-4 Gap 1: lifts ObjectName.stereotype onto v4 data and round-trips", () => {
    const v3Fixture = {
      version: "3.0.0",
      type: "ObjectDiagram",
      size: { width: 800, height: 600 },
      interactive: { elements: {}, relationships: {} },
      elements: {
        "obj-1": {
          id: "obj-1",
          name: "rex: Dog",
          type: "ObjectName",
          owner: null,
          bounds: { x: 100, y: 100, width: 200, height: 80 },
          attributes: [],
          methods: [],
          // v3 ObjectName extends UMLClassifier and stores stereotype as
          // a free-form string. Migration must preserve it.
          stereotype: "auxiliary",
        },
      },
      relationships: {},
    } as never

    const v4 = migrateObjectDiagramV3ToV4(v3Fixture)
    const node = v4.nodes.find((n) => n.id === "obj-1")!
    expect((node.data as ObjectNodeProps).stereotype).toBe("auxiliary")

    // Round-trip: emit back to v3.
    const v3Round = convertV4ToV3Class(v4)
    expect(
      (v3Round.elements["obj-1"] as { stereotype?: string | null }).stereotype
    ).toBe("auxiliary")

    // And one more cycle for full idempotence.
    const v4Again = migrateObjectDiagramV3ToV4(v3Round)
    expect(
      (v4Again.nodes.find((n) => n.id === "obj-1")!.data as ObjectNodeProps)
        .stereotype
    ).toBe("auxiliary")
  })

  it("PC-4 Gap 1: ObjectNames with no stereotype don't gain one through migration", () => {
    const v4 = migrateObjectDiagramV3ToV4(objectDiagramV3 as never)
    for (const node of v4.nodes) {
      if (node.type === "objectName") {
        const data = node.data as ObjectNodeProps
        // No fixture row sets stereotype -> migration must not invent one.
        expect(data.stereotype ?? null).toBeNull()
      }
    }
  })

  it("is idempotent on a v4 round-trip", () => {
    const v4 = migrateObjectDiagramV3ToV4(objectDiagramV3 as never)
    const v3Round = convertV4ToV3Class(v4)
    const v4Again = migrateObjectDiagramV3ToV4(v3Round)

    const canonical = (m: typeof v4) =>
      m.nodes
        .map((n) => ({
          id: n.id,
          type: n.type,
          classId: (n.data as ObjectNodeProps).classId ?? null,
          className: (n.data as ObjectNodeProps).className ?? null,
          attributes: ((n.data as ObjectNodeProps).attributes ?? [])
            .map((a) => ({
              id: a.id,
              name: a.name,
              attributeType: a.attributeType,
              attributeId: a.attributeId ?? null,
              value: a.value ?? null,
            }))
            .sort((a, b) => a.id.localeCompare(b.id)),
        }))
        .sort((a, b) => a.id.localeCompare(b.id))

    expect(JSON.stringify(canonical(v4Again))).toBe(
      JSON.stringify(canonical(v4))
    )
  })
})
