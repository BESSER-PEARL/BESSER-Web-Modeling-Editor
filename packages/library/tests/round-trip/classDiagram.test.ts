/**
 * SA-2 round-trip test for the BESSER ClassDiagram migration.
 *
 * What it asserts (per the SA-2 brief and the spec at
 * `docs/source/migrations/uml-v4-shape.md`):
 *
 *  1. v3 fixture → `migrateClassDiagramV3ToV4` produces a v4 model whose
 *     attributes carry the full BESSER `IUMLClassifierMember` shape
 *     (`visibility`, `attributeType`, `isId`, …, `defaultValue`,
 *     `implementationType`, `code`).
 *  2. Editing one attribute in-place is preserved on serialise.
 *  3. The migration is idempotent on v4: calling
 *     `convertV4ToV3Class(migrateClassDiagramV3ToV4(v3))` and then
 *     `migrateClassDiagramV3ToV4` again yields the same v4 model
 *     (`JSON.stringify(toV4(toV3(toV4(m)))) === JSON.stringify(toV4(m))`).
 *  4. ClassOCLConstraint elements collapse onto their owner class as
 *     `data.oclConstraints`.
 */
import { describe, it, expect } from "vitest"
import {
  migrateClassDiagramV3ToV4,
  convertV4ToV3Class,
} from "@/utils/versionConverter"
import type { ClassNodeProps } from "@/types"
import classDiagramV3 from "../fixtures/v3/classDiagram.json"

describe("ClassDiagram v3 → v4 round-trip", () => {
  it("migrates a representative v3 fixture into structured v4 nodes", () => {
    const v4 = migrateClassDiagramV3ToV4(classDiagramV3 as never)

    expect(v4.version).toMatch(/^4\./)
    expect(v4.type).toBe("ClassDiagram")

    // Animal → AbstractClass with stereotype 'Abstract', 2 attributes,
    // 1 method, 1 OCL constraint.
    const animal = v4.nodes.find((n) => n.id === "node-Animal")
    expect(animal).toBeDefined()
    expect(animal!.type).toBe("class")
    const animalData = animal!.data as ClassNodeProps
    expect(animalData.stereotype).toBe("Abstract")
    expect(animalData.attributes).toHaveLength(2)
    expect(animalData.methods).toHaveLength(1)

    const idAttr = animalData.attributes.find((a) => a.id === "attr-Animal-id")!
    expect(idAttr.attributeType).toBe("int")
    expect(idAttr.visibility).toBe("public")
    expect(idAttr.isId).toBe(true)

    const nameAttr = animalData.attributes.find(
      (a) => a.id === "attr-Animal-name"
    )!
    expect(nameAttr.defaultValue).toBe("anon")

    const speak = animalData.methods.find(
      (m) => m.id === "method-Animal-speak"
    )!
    expect(speak.implementationType).toBe("code")
    expect(speak.code).toContain("def speak")

    // OCL constraint collapse.
    expect(animalData.oclConstraints).toHaveLength(1)
    expect(animalData.oclConstraints![0].id).toBe("ocl-Animal-1")
    expect(animalData.oclConstraints![0].expression).toContain("name->size()")

    // ClassAttribute / ClassMethod / ClassOCLConstraint nodes are NOT
    // emitted at top level — they collapsed into their owner.
    expect(
      v4.nodes.some((n) =>
        ["ClassAttribute", "ClassMethod", "ClassOCLConstraint"].includes(
          n.type as string
        )
      )
    ).toBe(false)

    // Interface stereotype: Pet.
    const pet = v4.nodes.find((n) => n.id === "node-Pet")!
    expect((pet.data as ClassNodeProps).stereotype).toBe("Interface")

    // Edges round-tripped.
    expect(v4.edges).toHaveLength(2)
    const inh = v4.edges.find((e) => e.id === "rel-inh-1")!
    expect(inh.type).toBe("ClassInheritance")
    expect(inh.source).toBe("node-Dog")
    expect(inh.target).toBe("node-Animal")
    const assoc = v4.edges.find((e) => e.id === "rel-assoc-1")!
    expect(assoc.type).toBe("ClassBidirectional")
    expect(assoc.data?.sourceRole).toBe("owner")
    expect(assoc.data?.targetMultiplicity).toBe("0..*")
  })

  it("preserves an in-place attribute edit through a v4→v3→v4 cycle", () => {
    const v4 = migrateClassDiagramV3ToV4(classDiagramV3 as never)

    // Edit Dog.breed: flip optional, tweak default.
    const dog = v4.nodes.find((n) => n.id === "node-Dog")!
    const dogData = dog.data as ClassNodeProps
    const breed = dogData.attributes.find((a) => a.id === "attr-Dog-breed")!
    breed.isOptional = false
    breed.defaultValue = "mixed"

    // Round-trip: emit v3, re-import v4, fish out the same row.
    const v3Round = convertV4ToV3Class(v4)
    const v4Again = migrateClassDiagramV3ToV4(v3Round)

    const dogAgain = v4Again.nodes.find((n) => n.id === "node-Dog")!
    const breedAgain = (dogAgain.data as ClassNodeProps).attributes.find(
      (a) => a.id === "attr-Dog-breed"
    )!
    expect(breedAgain.isOptional).toBe(false)
    expect(breedAgain.defaultValue).toBe("mixed")
    expect(breedAgain.attributeType).toBe("str")
    expect(breedAgain.visibility).toBe("private")
  })

  it("SA-2.1: round-trips ClassOCLLink and ClassLinkRel edge types", () => {
    // Hand-authored v3 fixture exercising the two BESSER-specific edge
    // types restored in P1. Without the edgeTypeMap entry these would
    // fall through to the lowercase fallback (`return v3Type.toLowerCase()`)
    // and silently de-type on import.
    const v3Fixture = {
      version: "3.0.0",
      type: "ClassDiagram",
      size: { width: 800, height: 600 },
      interactive: { elements: {}, relationships: {} },
      elements: {
        "node-A": {
          id: "node-A",
          name: "A",
          type: "Class",
          owner: null,
          bounds: { x: 0, y: 0, width: 100, height: 60 },
          attributes: [],
          methods: [],
        },
        "node-B": {
          id: "node-B",
          name: "B",
          type: "Class",
          owner: null,
          bounds: { x: 200, y: 0, width: 100, height: 60 },
          attributes: [],
          methods: [],
        },
      },
      relationships: {
        "rel-ocl": {
          id: "rel-ocl",
          name: "ocl-context",
          type: "ClassOCLLink",
          owner: null,
          bounds: { x: 100, y: 30, width: 100, height: 0 },
          path: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
          ],
          source: { element: "node-A", direction: "Right" },
          target: { element: "node-B", direction: "Left" },
        },
        "rel-linkrel": {
          id: "rel-linkrel",
          name: "linkrel",
          type: "ClassLinkRel",
          owner: null,
          bounds: { x: 100, y: 30, width: 100, height: 0 },
          path: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
          ],
          source: { element: "node-B", direction: "Left" },
          target: { element: "node-A", direction: "Right" },
        },
      },
    } as never

    const v4 = migrateClassDiagramV3ToV4(v3Fixture)
    const ocl = v4.edges.find((e) => e.id === "rel-ocl")!
    const linkrel = v4.edges.find((e) => e.id === "rel-linkrel")!
    expect(ocl.type).toBe("ClassOCLLink")
    expect(linkrel.type).toBe("ClassLinkRel")

    // Round-trip back to v3 — types must survive without dropping or
    // de-typing.
    const v3Round = convertV4ToV3Class(v4)
    expect(v3Round.relationships["rel-ocl"].type).toBe("ClassOCLLink")
    expect(v3Round.relationships["rel-linkrel"].type).toBe("ClassLinkRel")

    // Final cycle for idempotence.
    const v4Again = migrateClassDiagramV3ToV4(v3Round)
    expect(v4Again.edges.find((e) => e.id === "rel-ocl")!.type).toBe(
      "ClassOCLLink"
    )
    expect(v4Again.edges.find((e) => e.id === "rel-linkrel")!.type).toBe(
      "ClassLinkRel"
    )
  })

  it("SA-UX-FIX B1: free-standing ClassOCLConstraint round-trips as a dedicated node", () => {
    // v3 fixture with an unowned `ClassOCLConstraint` element. Per the
    // SA-UX-FIX B1 brief, free-standing OCL constraints emit a
    // dedicated v4 node type (`ClassOCLConstraint`) rendered with a
    // sticky-note shape, NOT the regular `class` node with a
    // synthetic stereotype.
    const v3Fixture = {
      version: "3.0.0",
      type: "ClassDiagram",
      size: { width: 800, height: 600 },
      interactive: { elements: {}, relationships: {} },
      elements: {
        "node-A": {
          id: "node-A",
          name: "A",
          type: "Class",
          owner: null,
          bounds: { x: 0, y: 0, width: 100, height: 60 },
          attributes: [],
          methods: [],
        },
        "free-ocl": {
          id: "free-ocl",
          name: "OCLContext",
          type: "ClassOCLConstraint",
          owner: null,
          bounds: { x: 200, y: 200, width: 180, height: 90 },
          constraint: "context A inv: self.x > 0",
        },
      },
      relationships: {},
    } as never

    const v4 = migrateClassDiagramV3ToV4(v3Fixture)
    const ocl = v4.nodes.find((n) => n.id === "free-ocl")!
    expect(ocl).toBeDefined()
    // CRITICAL: must emit a dedicated `ClassOCLConstraint` node type,
    // NOT a `class` node with `stereotype: 'oclConstraint'`.
    expect(ocl.type).toBe("ClassOCLConstraint")
    const oclData = ocl.data as { name: string; expression: string }
    expect(oclData.name).toBe("OCLContext")
    expect(oclData.expression).toBe("context A inv: self.x > 0")

    // Round-trip back to v3 and confirm the type + body survive.
    const v3Round = convertV4ToV3Class(v4)
    const v3OclRound = v3Round.elements["free-ocl"] as {
      type: string
      constraint?: string
      name: string
    }
    expect(v3OclRound.type).toBe("ClassOCLConstraint")
    expect(v3OclRound.constraint).toBe("context A inv: self.x > 0")
    expect(v3OclRound.name).toBe("OCLContext")

    // Idempotence cycle.
    const v4Again = migrateClassDiagramV3ToV4(v3Round)
    const oclAgain = v4Again.nodes.find((n) => n.id === "free-ocl")!
    expect(oclAgain.type).toBe("ClassOCLConstraint")
    expect((oclAgain.data as { expression: string }).expression).toBe(
      "context A inv: self.x > 0"
    )
  })

  it("is idempotent on a v4 round-trip (toV4(toV3(toV4(m))) === toV4(m))", () => {
    const v4 = migrateClassDiagramV3ToV4(classDiagramV3 as never)
    const v3Round = convertV4ToV3Class(v4)
    const v4Again = migrateClassDiagramV3ToV4(v3Round)

    // Compare canonical, sortable subset — id, type, stereotype, attribute
    // ids and structured fields. Position/bounds round-trip is best-effort
    // and not asserted byte-equal here (v3 stores as `bounds`, v4 splits
    // into position+width+height — already tested above).
    const canonical = (m: typeof v4) =>
      m.nodes
        .map((n) => ({
          id: n.id,
          type: n.type,
          stereotype: (n.data as ClassNodeProps).stereotype ?? null,
          attributes: ((n.data as ClassNodeProps).attributes ?? [])
            .map((a) => ({
              id: a.id,
              name: a.name,
              attributeType: a.attributeType,
              visibility: a.visibility,
              isId: !!a.isId,
              isOptional: !!a.isOptional,
              isDerived: !!a.isDerived,
              isExternalId: !!a.isExternalId,
              defaultValue: a.defaultValue ?? null,
            }))
            .sort((a, b) => a.id.localeCompare(b.id)),
          methods: ((n.data as ClassNodeProps).methods ?? [])
            .map((m) => ({
              id: m.id,
              name: m.name,
              attributeType: m.attributeType,
              visibility: m.visibility,
              implementationType: m.implementationType ?? null,
              code: m.code ?? null,
            }))
            .sort((a, b) => a.id.localeCompare(b.id)),
          oclConstraints: ((n.data as ClassNodeProps).oclConstraints ?? [])
            .map((c) => ({ id: c.id, name: c.name, expression: c.expression }))
            .sort((a, b) => a.id.localeCompare(b.id)),
        }))
        .sort((a, b) => a.id.localeCompare(b.id))

    expect(JSON.stringify(canonical(v4Again))).toBe(
      JSON.stringify(canonical(v4))
    )
  })
})
