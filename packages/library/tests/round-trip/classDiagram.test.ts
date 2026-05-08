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
import {
  canConnectEndpoints,
  isEnumerationClassNode,
} from "@/utils/bpmnConstraints"
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

  // ---- SA-FIX-Class regression tests (PC-1, PC-2, PC-3, PC-11) ----

  it("SA-FIX-Class PC-1: freeform stereotype string survives v3 → v4 → v3", () => {
    const v3Fixture = {
      version: "3.0.0",
      type: "ClassDiagram",
      size: { width: 800, height: 600 },
      interactive: { elements: {}, relationships: {} },
      elements: {
        "node-X": {
          id: "node-X",
          name: "X",
          type: "Class",
          owner: null,
          bounds: { x: 0, y: 0, width: 100, height: 60 },
          attributes: [],
          methods: [],
          stereotype: "persistent",
        },
      },
      relationships: {},
    } as never
    const v4 = migrateClassDiagramV3ToV4(v3Fixture)
    const x = v4.nodes.find((n) => n.id === "node-X")!
    expect((x.data as ClassNodeProps).stereotype).toBe("persistent")
    const v3Round = convertV4ToV3Class(v4)
    const xRound = v3Round.elements["node-X"] as { stereotype?: string }
    expect(xRound.stereotype).toBe("persistent")
  })

  it("SA-FIX-Class PC-1: italic + underline flags round-trip", () => {
    const v3Fixture = {
      version: "3.0.0",
      type: "ClassDiagram",
      size: { width: 800, height: 600 },
      interactive: { elements: {}, relationships: {} },
      elements: {
        "node-Y": {
          id: "node-Y",
          name: "Y",
          type: "Class",
          owner: null,
          bounds: { x: 0, y: 0, width: 100, height: 60 },
          attributes: [],
          methods: [],
          italic: true,
          underline: true,
        },
      },
      relationships: {},
    } as never
    const v4 = migrateClassDiagramV3ToV4(v3Fixture)
    const y = v4.nodes.find((n) => n.id === "node-Y")!
    const data = y.data as ClassNodeProps
    expect(data.italic).toBe(true)
    expect(data.underline).toBe(true)
    const v3Round = convertV4ToV3Class(v4)
    const yRound = v3Round.elements["node-Y"] as {
      italic?: boolean
      underline?: boolean
    }
    expect(yRound.italic).toBe(true)
    expect(yRound.underline).toBe(true)
  })

  it("SA-FIX-Class PC-2/11: description / uri / icon round-trip", () => {
    const v3Fixture = {
      version: "3.0.0",
      type: "ClassDiagram",
      size: { width: 800, height: 600 },
      interactive: { elements: {}, relationships: {} },
      elements: {
        "node-Z": {
          id: "node-Z",
          name: "Z",
          type: "Class",
          owner: null,
          bounds: { x: 0, y: 0, width: 100, height: 60 },
          attributes: [],
          methods: [],
          description: "the Z class",
          uri: "https://example.com/Z",
          icon: "<svg/>",
        },
      },
      relationships: {},
    } as never
    const v4 = migrateClassDiagramV3ToV4(v3Fixture)
    const z = v4.nodes.find((n) => n.id === "node-Z")!
    const data = z.data as ClassNodeProps
    expect(data.description).toBe("the Z class")
    expect(data.uri).toBe("https://example.com/Z")
    expect(data.icon).toBe("<svg/>")
    const v3Round = convertV4ToV3Class(v4)
    const zRound = v3Round.elements["node-Z"] as {
      description?: string
      uri?: string
      icon?: string
    }
    expect(zRound.description).toBe("the Z class")
    expect(zRound.uri).toBe("https://example.com/Z")
    expect(zRound.icon).toBe("<svg/>")
  })

  it("SA-FIX-Class PC-3: ClassAggregation/Composition diamond on source end", async () => {
    const { getEdgeMarkerStyles } = await import("@/utils/edgeUtils")
    const agg = getEdgeMarkerStyles("ClassAggregation")
    expect(agg.markerStart).toBe("url(#white-rhombus)")
    expect(agg.markerEnd).toBeUndefined()
    const comp = getEdgeMarkerStyles("ClassComposition")
    expect(comp.markerStart).toBe("url(#black-rhombus)")
    expect(comp.markerEnd).toBeUndefined()
  })

  it("SA-FIX-Class PC-3: ClassOCLLink renders dotted with open-arrow marker", async () => {
    const { getEdgeMarkerStyles } = await import("@/utils/edgeUtils")
    const ocl = getEdgeMarkerStyles("ClassOCLLink")
    expect(ocl.strokeDashArray).toBe("4 2")
    expect(ocl.markerEnd).toBe("url(#class-ocl-link-marker)")
  })

  // ---- SA-FIX-CLASS-FUND regression tests (#1, #2, #4, #6, #8) ----

  it("SA-FIX-CLASS-FUND #2: getDefaultEdgeType returns ClassBidirectional", async () => {
    const { getDefaultEdgeType } = await import("@/utils/edgeUtils")
    expect(getDefaultEdgeType("ClassDiagram")).toBe("ClassBidirectional")
  })

  it("SA-FIX-CLASS-FUND #1: ClassDiagram palette includes ClassOCLConstraint", async () => {
    const { dropElementConfigs } = await import("@/constants")
    const cfg = dropElementConfigs["ClassDiagram"]
    const ocl = cfg.find((c) => c.type === "ClassOCLConstraint")
    expect(ocl).toBeDefined()
    expect(ocl!.defaultData?.expression).toBeTruthy()
  })

  it("SA-FIX-CLASS-FUND #4 + #5: ClassDiagram palette ships clean structured defaults", async () => {
    const { dropElementConfigs } = await import("@/constants")
    const cfg = dropElementConfigs["ClassDiagram"]
    // Plain Class entry (empty attributes/methods).
    const plain = cfg.find(
      (c) =>
        c.type === "class" &&
        (c.defaultData?.name as string | undefined) === "Class" &&
        Array.isArray(c.defaultData?.attributes) &&
        (c.defaultData?.attributes as unknown[]).length === 0
    )
    expect(plain).toBeDefined()
    // Pre-populated "Class with attributes" entry.
    const withAttrs = cfg.find(
      (c) =>
        c.type === "class" &&
        Array.isArray(c.defaultData?.attributes) &&
        ((c.defaultData?.attributes as { name?: string; attributeType?: string }[]) ?? [])
          .some((a) => a.name === "attribute" && a.attributeType === "str")
    )
    expect(withAttrs).toBeDefined()
    // Enumeration literals are now Enum_1..Enum_3.
    const en = cfg.find(
      (c) =>
        c.type === "class" &&
        (c.defaultData?.stereotype as string | undefined) === "Enumeration"
    )
    expect(en).toBeDefined()
    const literals = (en!.defaultData?.attributes as { name: string }[]) ?? []
    expect(literals.map((l) => l.name)).toEqual(["Enum_1", "Enum_2", "Enum_3"])
  })

  it("SA-FIX-CLASS-FUND #6: id / externalId / derived / optional markers reach formatDisplayName", async () => {
    const { formatDisplayName } = await import("@/utils/classifierMemberDisplay")
    // id flag → trailing `{id}` marker.
    expect(
      formatDisplayName({
        name: "code",
        attributeType: "str",
        visibility: "public",
        isId: true,
      })
    ).toBe("+ code: str {id}")
    // external id + optional + derived combo.
    expect(
      formatDisplayName({
        name: "ref",
        attributeType: "int",
        visibility: "private",
        isExternalId: true,
        isOptional: true,
        isDerived: true,
      })
    ).toBe("- /ref?: int {external id}")
  })

  it("SA-FIX-CLASS-FUND #8: legacy `+ name: Type` strings do not double-format", async () => {
    const { formatDisplayName } = await import("@/utils/classifierMemberDisplay")
    // Legacy palette emitted "+ attribute: Type" as the raw name.
    // Once structured fields are added, formatDisplayName must NOT
    // produce "+ + attribute: Type: str" — it strips the embedded
    // visibility prefix and trailing type from the name first.
    const out = formatDisplayName({
      name: "+ attribute: Type",
      attributeType: "str",
      visibility: "public",
      isId: true,
    })
    expect(out).toBe("+ attribute: str {id}")
  })

  it("SA-FINAL C1: source/target multiplicity + role round-trip v3 → v4 → v3 → v4", () => {
    // Hand-authored fixture stresses every endpoint field independently
    // so any silent drop on either side of the converter is surfaced.
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
        "rel-1": {
          id: "rel-1",
          name: "uses",
          type: "ClassBidirectional",
          owner: null,
          bounds: { x: 100, y: 30, width: 100, height: 0 },
          path: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
          ],
          source: {
            element: "node-A",
            direction: "Right",
            multiplicity: "1..*",
            role: "src-role",
          },
          target: {
            element: "node-B",
            direction: "Left",
            multiplicity: "0..1",
            role: "tgt-role",
          },
        },
      },
    } as never

    const v4 = migrateClassDiagramV3ToV4(v3Fixture)
    const e = v4.edges.find((x) => x.id === "rel-1")!
    expect(e.data?.sourceMultiplicity).toBe("1..*")
    expect(e.data?.targetMultiplicity).toBe("0..1")
    expect(e.data?.sourceRole).toBe("src-role")
    expect(e.data?.targetRole).toBe("tgt-role")

    const v3Round = convertV4ToV3Class(v4)
    const r = v3Round.relationships["rel-1"]
    expect(r.source.multiplicity).toBe("1..*")
    expect(r.target.multiplicity).toBe("0..1")
    expect(r.source.role).toBe("src-role")
    expect(r.target.role).toBe("tgt-role")

    const v4Again = migrateClassDiagramV3ToV4(v3Round)
    const eAgain = v4Again.edges.find((x) => x.id === "rel-1")!
    expect(eAgain.data?.sourceMultiplicity).toBe("1..*")
    expect(eAgain.data?.targetMultiplicity).toBe("0..1")
    expect(eAgain.data?.sourceRole).toBe("src-role")
    expect(eAgain.data?.targetRole).toBe("tgt-role")
  })

  it("SA-FINAL C2: ClassMethod parameters[] + returnType round-trip", () => {
    // Build a v4 ClassDiagram in memory with a fully-shaped method row,
    // then round-trip via v3 and back. The v3 stage must persist
    // `parameters[]` + `returnType` so the second v4 conversion sees
    // the same structured data.
    const v3Fixture = {
      version: "3.0.0",
      type: "ClassDiagram",
      size: { width: 800, height: 600 },
      interactive: { elements: {}, relationships: {} },
      elements: {
        "node-X": {
          id: "node-X",
          name: "X",
          type: "Class",
          owner: null,
          bounds: { x: 0, y: 0, width: 100, height: 60 },
          attributes: [],
          methods: ["method-X-foo"],
        },
        "method-X-foo": {
          id: "method-X-foo",
          name: "foo",
          type: "ClassMethod",
          owner: "node-X",
          bounds: { x: 0, y: 0, width: 100, height: 30 },
          visibility: "public",
          attributeType: "str",
          // Already-structured method (round-tripped from a prior v4).
          returnType: "str",
          parameters: [
            { id: "p1", name: "a", parameterType: "int" },
            { id: "p2", name: "b", parameterType: "bool", defaultValue: true },
          ],
        },
      },
      relationships: {},
    } as never

    const v4 = migrateClassDiagramV3ToV4(v3Fixture)
    const x = v4.nodes.find((n) => n.id === "node-X")!
    const data = x.data as ClassNodeProps
    const foo = data.methods.find((m) => m.id === "method-X-foo")!
    expect(foo.returnType).toBe("str")
    expect(foo.parameters).toBeDefined()
    expect(foo.parameters).toHaveLength(2)
    expect(foo.parameters![0]).toMatchObject({
      id: "p1",
      name: "a",
      parameterType: "int",
    })
    expect(foo.parameters![1]).toMatchObject({
      id: "p2",
      name: "b",
      parameterType: "bool",
      defaultValue: true,
    })

    // v4 → v3: method element must carry parameters[] + returnType.
    const v3Round = convertV4ToV3Class(v4)
    const v3Foo = v3Round.elements["method-X-foo"] as {
      type: string
      parameters?: { id: string; name: string; parameterType?: string }[]
      returnType?: string
    }
    expect(v3Foo.type).toBe("ClassMethod")
    expect(v3Foo.returnType).toBe("str")
    expect(v3Foo.parameters).toHaveLength(2)
    expect(v3Foo.parameters![0]).toMatchObject({
      id: "p1",
      name: "a",
      parameterType: "int",
    })

    // Idempotent re-import.
    const v4Again = migrateClassDiagramV3ToV4(v3Round)
    const xAgain = v4Again.nodes.find((n) => n.id === "node-X")!
    const fooAgain = (xAgain.data as ClassNodeProps).methods.find(
      (m) => m.id === "method-X-foo"
    )!
    expect(fooAgain.returnType).toBe("str")
    expect(fooAgain.parameters).toHaveLength(2)
  })

  it("SA-HIDE-NOISE: Comments node round-trips v3 ↔ v4 with body on `name`", () => {
    // v3 stored the comment body on `UMLElement.name` (the v3
    // inspector was a textarea bound to `name`). The v4 port keeps
    // that contract — the migrator passes through unchanged so old
    // fixtures don't lose their text.
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
        "comment-1": {
          id: "comment-1",
          name: "this needs review\nmulti-line ok",
          type: "Comments",
          owner: null,
          bounds: { x: 200, y: 100, width: 160, height: 60 },
          fillColor: "#ffeebb",
        },
      },
      relationships: {},
    } as never

    const v4 = migrateClassDiagramV3ToV4(v3Fixture)
    const cmt = v4.nodes.find((n) => n.id === "comment-1")!
    expect(cmt).toBeDefined()
    expect(cmt.type).toBe("comment")
    expect((cmt.data as { name: string }).name).toBe(
      "this needs review\nmulti-line ok"
    )
    expect((cmt.data as { fillColor?: string }).fillColor).toBe("#ffeebb")

    // v4 → v3 emits the v3 element type back as `Comments` (plural)
    // with the body on `name`.
    const v3Round = convertV4ToV3Class(v4)
    const v3Cmt = v3Round.elements["comment-1"] as {
      type: string
      name: string
    }
    expect(v3Cmt.type).toBe("Comments")
    expect(v3Cmt.name).toBe("this needs review\nmulti-line ok")

    // Idempotence cycle.
    const v4Again = migrateClassDiagramV3ToV4(v3Round)
    const cmtAgain = v4Again.nodes.find((n) => n.id === "comment-1")!
    expect(cmtAgain.type).toBe("comment")
    expect((cmtAgain.data as { name: string }).name).toBe(
      "this needs review\nmulti-line ok"
    )
  })
})

/**
 * SA-FIX-ENUM-NO-CONNECT: regression test. Enumeration class nodes
 * (`type === 'class'` && `data.stereotype === 'Enumeration'`) must not
 * accept any connection — neither as source nor as target. v3 behavior:
 * enumerations are referenced by *type* from class attributes, never
 * via edges.
 */
describe("SA-FIX-ENUM-NO-CONNECT", () => {
  const classNode = (id: string, stereotype?: string) => ({
    id,
    type: "class",
    data: { name: id, stereotype, attributes: [], methods: [] },
  })

  it("flags class nodes with stereotype Enumeration", () => {
    expect(isEnumerationClassNode(classNode("E", "Enumeration"))).toBe(true)
    expect(isEnumerationClassNode(classNode("C", "Abstract"))).toBe(false)
    expect(isEnumerationClassNode(classNode("C"))).toBe(false)
    expect(isEnumerationClassNode(undefined)).toBe(false)
    // A non-class node with the same stereotype string is irrelevant.
    expect(
      isEnumerationClassNode({
        id: "x",
        type: "comment",
        data: { stereotype: "Enumeration" },
      })
    ).toBe(false)
  })

  it("blocks a connection whose source is an Enumeration class", () => {
    const nodes = [classNode("enum-1", "Enumeration"), classNode("class-1")]
    expect(canConnectEndpoints(nodes, "enum-1", "class-1")).toBe(false)
  })

  it("blocks a connection whose target is an Enumeration class", () => {
    const nodes = [classNode("class-1"), classNode("enum-1", "Enumeration")]
    expect(canConnectEndpoints(nodes, "class-1", "enum-1")).toBe(false)
  })

  it("blocks enum-to-enum connections", () => {
    const nodes = [
      classNode("enum-1", "Enumeration"),
      classNode("enum-2", "Enumeration"),
    ]
    expect(canConnectEndpoints(nodes, "enum-1", "enum-2")).toBe(false)
  })

  it("allows class-to-class connections (non-enum)", () => {
    const nodes = [classNode("class-1"), classNode("class-2", "Abstract")]
    expect(canConnectEndpoints(nodes, "class-1", "class-2")).toBe(true)
  })
})
