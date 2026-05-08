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
 */
import { describe, it, expect } from "vitest"
import {
  migrateObjectDiagramV3ToV4,
  convertV4ToV3Class,
} from "@/utils/versionConverter"
import type { ObjectNodeProps } from "@/types"
import objectDiagramV3 from "../fixtures/v3/objectDiagram.json"

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
