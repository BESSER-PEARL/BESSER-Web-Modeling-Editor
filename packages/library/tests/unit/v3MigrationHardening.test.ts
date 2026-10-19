import { describe, it, expect } from "vitest"
import {
  convertV3ToV4,
  migrateBpmnDiagramV3ToV4,
  migrateClassDiagramV3ToV4,
} from "@/utils/versionConverter"

type Row = Record<string, unknown>
// Loosely typed so a test can break any field.
type Fixture = Row & {
  elements: Record<string, Row | null>
  relationships: Record<string, Row | null>
}
const el = (m: Fixture, id: string) => m.elements[id] as Row
const rel = (m: Fixture, id: string) => m.relationships[id] as Row
const toV3 = (m: Fixture) => m as unknown as Parameters<typeof convertV3ToV4>[0]

// A small valid v3 class diagram: two classes with one attribute each and
// one association between them.
function classModel(): Fixture {
  return {
    version: "3.0.0",
    type: "ClassDiagram",
    size: { width: 800, height: 600 },
    interactive: { elements: {}, relationships: {} },
    elements: {
      c1: {
        id: "c1", name: "Ship", type: "Class", owner: null,
        bounds: { x: 0, y: 0, width: 100, height: 60 },
        attributes: ["a1"], methods: [],
      },
      a1: {
        id: "a1", name: "name", type: "ClassAttribute", owner: "c1",
        bounds: { x: 0, y: 30, width: 100, height: 30 },
        visibility: "public", attributeType: "str",
      },
      c2: {
        id: "c2", name: "Port", type: "Class", owner: null,
        bounds: { x: 300, y: 0, width: 100, height: 60 },
        attributes: [], methods: [],
      },
    },
    relationships: {
      r1: {
        id: "r1", name: "", type: "ClassBidirectional", owner: null,
        bounds: { x: 100, y: 30, width: 200, height: 1 },
        path: [{ x: 0, y: 0 }, { x: 200, y: 0 }],
        source: { element: "c1", direction: "Right", multiplicity: "1", role: "" },
        target: { element: "c2", direction: "Left", multiplicity: "*", role: "" },
      },
    },
    assessments: {},
  }
}

// The review probe (rfreview r1) threw on each of these and so failed the
// whole diagram; now the bad entry is skipped and reported.
describe("convertV3ToV4 skips malformed entries", () => {
  const cases: Array<[string, (m: Fixture) => void, { nodes: number; edges: number }]> = [
    ["null element", (m) => { m.elements.zz = null }, { nodes: 2, edges: 1 }],
    ["null relationship", (m) => { m.relationships.zz = null }, { nodes: 2, edges: 1 }],
    ["relationship without source", (m) => { delete rel(m, "r1").source }, { nodes: 2, edges: 0 }],
    ["relationship without target", (m) => { delete rel(m, "r1").target }, { nodes: 2, edges: 0 }],
    ["element without type", (m) => { delete el(m, "c2").type }, { nodes: 1, edges: 1 }],
  ]

  for (const [label, mutate, expected] of cases) {
    it(`${label}: converts the rest and collects a warning`, () => {
      const m = classModel()
      mutate(m)
      const warnings: string[] = []
      const v4 = convertV3ToV4(toV3(m), { warnings })
      expect(v4.nodes).toHaveLength(expected.nodes)
      expect(v4.edges).toHaveLength(expected.edges)
      expect(warnings.length).toBeGreaterThan(0)
    })
  }

  it("null path point: drops the point, keeps the edge", () => {
    const m = classModel()
    rel(m, "r1").path = [null, { x: 1, y: 1 }]
    const warnings: string[] = []
    const v4 = convertV3ToV4(toV3(m), { warnings })
    expect(v4.edges).toHaveLength(1)
    expect((v4.edges[0].data as { points: unknown[] }).points).toHaveLength(1)
    expect(warnings.length).toBeGreaterThan(0)
  })

  it("non-array path: drops the path, keeps the edge", () => {
    const m = classModel()
    rel(m, "r1").path = "abc"
    const warnings: string[] = []
    const v4 = convertV3ToV4(toV3(m), { warnings })
    expect(v4.edges).toHaveLength(1)
    expect(warnings.length).toBeGreaterThan(0)
  })

  it("valid model: no warnings", () => {
    const warnings: string[] = []
    convertV3ToV4(toV3(classModel()), { warnings })
    expect(warnings).toEqual([])
  })
})

describe("per-type migrators take the expected type", () => {
  it("missing model.type is filled from the migrator", () => {
    const m = classModel()
    delete m.type
    const warnings: string[] = []
    const v4 = migrateClassDiagramV3ToV4(toV3(m), { warnings })
    expect(v4.type).toBe("ClassDiagram")
    expect(v4.nodes).toHaveLength(2)
    expect(warnings.length).toBeGreaterThan(0)
  })

  // An ObjectDiagram stored in the ClassDiagram slot is a different model,
  // not a typo: it must fail (read-only path), not be silently converted.
  it("a mismatched model.type fails the migration", () => {
    const m = classModel()
    m.type = "ObjectDiagram"
    expect(() => migrateClassDiagramV3ToV4(toV3(m), { warnings: [] })).toThrow(
      /ObjectDiagram/
    )
    expect(() =>
      convertV3ToV4(toV3(m), { expectedType: "ClassDiagram", warnings: [] })
    ).toThrow(/ObjectDiagram/)
  })

  it("the legacy BPMN alias still migrates as BPMNDiagram", () => {
    const warnings: string[] = []
    const v4 = migrateBpmnDiagramV3ToV4(
      toV3({ ...classModel(), type: "BPMN", elements: {}, relationships: {} }),
      { warnings }
    )
    expect(v4.type).toBe("BPMNDiagram")
    expect(warnings).toEqual([])
  })
})
