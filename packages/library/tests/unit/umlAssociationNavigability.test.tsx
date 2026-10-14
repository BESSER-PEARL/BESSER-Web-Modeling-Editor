import { describe, it, expect } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import * as Y from "yjs"
import type { Edge } from "@xyflow/react"
import type { StoreApi } from "zustand"
import { DiagramStoreContext } from "@/store/context"
import { createDiagramStore, DiagramStore } from "@/store/diagramStore"
import { ClassEdgeEditPanel } from "@/components/inspectors/classDiagram/ClassEdgeEditPanel"
import {
  NAVIGABLE_ASSOCIATION_TYPES,
  applyAssociationTypeChange,
  canToggleNavigability,
  getAssociationMarkers,
  normalizeEdgeNavigability,
  normalizeModelAssociationNavigability,
  resolveAssociationNavigability,
} from "@/utils/uml-association-navigability"
import {
  convertV3ToV4,
  convertV4ToV3Class,
  importDiagram,
} from "@/utils/versionConverter"
import { getEdgeMarkerStyles } from "@/utils/edgeUtils"
import {
  getUserMetaModelV4,
} from "@/services/userMetaModel"
import userMetaModelJson from "@/services/userMetaModel/usermetamodel.json"

/**
 * Per-end association navigability — port of the smart-generator editor
 * tests `uml-association-navigability-test.ts`,
 * `uml-association-component-test.tsx` and
 * `usermetamodel-navigability-test.ts` to the v4 shape
 * (`edge.data.sourceNavigable` / `edge.data.targetNavigable`).
 */

const v3End = (element: string, navigable?: boolean) => ({
  element,
  direction: "Up",
  multiplicity: "",
  role: "",
  ...(navigable === undefined ? {} : { navigable }),
})

const v3Relationship = (
  id: string,
  type: string,
  sourceNavigable?: boolean,
  targetNavigable?: boolean
) => ({
  id,
  name: "",
  type,
  owner: null,
  bounds: { x: 0, y: 0, width: 100, height: 1 },
  path: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
  ],
  source: v3End("a", sourceNavigable),
  target: v3End("b", targetNavigable),
})

const v3Model = (...relationships: ReturnType<typeof v3Relationship>[]) =>
  ({
    version: "3.0.0",
    type: "ClassDiagram",
    size: { width: 0, height: 0 },
    interactive: { elements: {}, relationships: {} },
    elements: {
      a: {
        id: "a",
        name: "A",
        type: "Class",
        owner: null,
        bounds: { x: 0, y: 0, width: 100, height: 100 },
        attributes: [],
        methods: [],
      },
      b: {
        id: "b",
        name: "B",
        type: "Class",
        owner: null,
        bounds: { x: 300, y: 0, width: 100, height: 100 },
        attributes: [],
        methods: [],
      },
    },
    relationships: Object.fromEntries(relationships.map((r) => [r.id, r])),
    assessments: {},
  }) as never

const edge = (
  type: string,
  sourceNavigable?: boolean,
  targetNavigable?: boolean,
  id = "e"
): Edge => ({
  id,
  type,
  source: "a",
  target: "b",
  data: {
    ...(sourceNavigable === undefined ? {} : { sourceNavigable }),
    ...(targetNavigable === undefined ? {} : { targetNavigable }),
  },
})

const flags = (e: { data?: unknown }) => {
  const d = e.data as { sourceNavigable?: boolean; targetNavigable?: boolean }
  return [d.sourceNavigable, d.targetNavigable]
}

describe("association navigability migration (v3 → v4)", () => {
  it("loads a legacy ClassUnidirectional as ClassBidirectional with the source end not navigable", () => {
    const v4 = convertV3ToV4(v3Model(v3Relationship("r", "ClassUnidirectional")))
    const r = v4.edges.find((e) => e.id === "r")!
    expect(r.type).toBe("ClassBidirectional")
    expect(flags(r)).toEqual([false, true])
  })

  it("fills in both ends navigable for a ClassBidirectional without flags", () => {
    const v4 = convertV3ToV4(v3Model(v3Relationship("r", "ClassBidirectional")))
    expect(flags(v4.edges[0])).toEqual([true, true])
  })

  it("keeps explicit v3 flags", () => {
    const v4 = convertV3ToV4(
      v3Model(v3Relationship("r", "ClassBidirectional", false, true))
    )
    expect(flags(v4.edges[0])).toEqual([false, true])
  })

  it("repairs invalid flags (composition part end, both ends off)", () => {
    const v4 = convertV3ToV4(
      v3Model(
        v3Relationship("c", "ClassComposition", false, true),
        v3Relationship("b", "ClassBidirectional", false, false)
      )
    )
    const c = v4.edges.find((e) => e.id === "c")!
    const b = v4.edges.find((e) => e.id === "b")!
    expect(flags(c)[0]).toBe(true)
    expect(flags(b)[1]).toBe(true)
  })

  it("does not add navigability to relationships without it", () => {
    const v4 = convertV3ToV4(v3Model(v3Relationship("d", "ClassDependency")))
    expect(v4.edges[0].data).not.toHaveProperty("sourceNavigable")
    expect(v4.edges[0].data).not.toHaveProperty("targetNavigable")
  })

  it("writes the flags back to v3 end `navigable`", () => {
    const v4 = convertV3ToV4(v3Model(v3Relationship("r", "ClassUnidirectional")))
    const v3 = convertV4ToV3Class(v4)
    const r = v3.relationships.r as unknown as {
      type: string
      source: { navigable?: boolean }
      target: { navigable?: boolean }
    }
    expect(r.type).toBe("ClassBidirectional")
    expect([r.source.navigable, r.target.navigable]).toEqual([false, true])
  })
})

describe("association navigability on v4 load", () => {
  it("normalizes a v4 ClassUnidirectional edge on import", () => {
    const model = importDiagram({
      version: "4.0.0",
      id: "m",
      title: "",
      type: "ClassDiagram",
      nodes: [],
      edges: [edge("ClassUnidirectional")],
      assessments: {},
    })
    expect(model.edges[0].type).toBe("ClassBidirectional")
    expect(flags(model.edges[0])).toEqual([false, true])
  })

  it("returns an already normalized model unchanged", () => {
    const model = {
      edges: [edge("ClassBidirectional", false, true), edge("ClassDependency")],
    }
    expect(normalizeModelAssociationNavigability(model)).toBe(model)
  })
})

describe("navigability rules", () => {
  it("resolves legacy defaults", () => {
    expect(resolveAssociationNavigability(edge("ClassUnidirectional"))).toEqual({
      source: false,
      target: true,
    })
    expect(resolveAssociationNavigability(edge("ClassAggregation"))).toEqual({
      source: true,
      target: true,
    })
  })

  it("never lets the last navigable end or the composition part end be switched off", () => {
    const oneWay = edge("ClassBidirectional", false, true)
    expect(canToggleNavigability(oneWay, "source")).toBe(true)
    expect(canToggleNavigability(oneWay, "target")).toBe(false)
    const composition = edge("ClassComposition", true, true)
    expect(canToggleNavigability(composition, "source")).toBe(false)
    expect(canToggleNavigability(composition, "target")).toBe(true)
  })

  it("leaves relationships without navigability untouched", () => {
    const dependency = edge("ClassDependency")
    expect(normalizeEdgeNavigability(dependency)).toBe(dependency)
  })

  it("a type change carries the required navigability and drops it for inheritance", () => {
    const composition = applyAssociationTypeChange(
      edge("ClassBidirectional", false, true),
      "ClassComposition"
    )
    expect(composition.type).toBe("ClassComposition")
    expect(flags(composition)).toEqual([true, true])
    const inheritance = applyAssociationTypeChange(composition, "ClassInheritance")
    expect(inheritance.data).not.toHaveProperty("sourceNavigable")
    const legacy = applyAssociationTypeChange(
      edge("ClassUnidirectional"),
      "ClassBidirectional"
    )
    expect(flags(legacy)).toEqual([false, true])
  })
})

describe("association end markers follow navigability", () => {
  it("draws no arrow when both ends of an association are navigable", () => {
    const m = getAssociationMarkers(edge("ClassBidirectional", true, true))!
    expect(m.markerStart).toBeUndefined()
    expect(m.markerEnd).toBeUndefined()
  })

  it("draws an arrow at the target when only the target is navigable", () => {
    const m = getAssociationMarkers(edge("ClassBidirectional", false, true))!
    expect(m.markerStart).toBeUndefined()
    expect(m.markerEnd).toBe("url(#black-arrow)")
  })

  it("draws an arrow at the source when only the source is navigable", () => {
    const m = getAssociationMarkers(edge("ClassBidirectional", true, false))!
    expect(m.markerStart).toBe("url(#black-arrow)")
    expect(m.markerEnd).toBeUndefined()
  })

  it("keeps the composition diamond on the target and adds an arrow at the part end when the whole is not navigable", () => {
    const both = getAssociationMarkers(edge("ClassComposition", true, true))!
    expect(both.markerStart).toBeUndefined()
    expect(both.markerEnd).toBe("url(#black-rhombus)")
    const partOnly = getAssociationMarkers(edge("ClassComposition", true, false))!
    expect(partOnly.markerStart).toBe("url(#black-arrow)")
    expect(partOnly.markerEnd).toBe("url(#black-rhombus)")
  })

  it("applies navigability to aggregations without touching the diamond", () => {
    const both = getAssociationMarkers(edge("ClassAggregation", true, true))!
    expect(both.markerStart).toBeUndefined()
    expect(both.markerEnd).toBe("url(#white-rhombus)")
    expect(both.arrowBeforeEndMarker).toBe(false)
    const partOnly = getAssociationMarkers(edge("ClassAggregation", true, false))!
    expect(partOnly.markerStart).toBe("url(#black-arrow)")
    expect(partOnly.markerEnd).toBe("url(#white-rhombus)")
    const wholeOnly = getAssociationMarkers(edge("ClassAggregation", false, true))!
    expect(wholeOnly.markerStart).toBeUndefined()
    expect(wholeOnly.markerEnd).toBe("url(#white-rhombus)")
    expect(wholeOnly.arrowBeforeEndMarker).toBe(true)
  })

  it("leaves other relationship types to their type-based markers", () => {
    expect(getAssociationMarkers(edge("ClassInheritance"))).toBeUndefined()
    expect(getEdgeMarkerStyles("ClassComposition").markerEnd).toBe(
      "url(#black-rhombus)"
    )
  })
})

describe("ClassEdgeEditPanel navigability checkboxes", () => {
  const renderPanel = (edges: Edge[]) => {
    const store = createDiagramStore(new Y.Doc())
    store.getState().setEdges(edges)
    render(
      <DiagramStoreContext.Provider value={store as StoreApi<DiagramStore>}>
        <ClassEdgeEditPanel elementId="e" />
      </DiagramStoreContext.Provider>
    )
    return store
  }
  const checkbox = (end: "source" | "target") =>
    screen
      .getByTestId(`${end}-navigable`)
      .querySelector("input") as HTMLInputElement
  const current = (store: StoreApi<DiagramStore>) =>
    store.getState().edges.find((e) => e.id === "e")!

  it("toggles one end in a single update and locks the last navigable end", () => {
    const store = renderPanel([edge("ClassBidirectional", true, true)])
    expect(checkbox("source").checked).toBe(true)
    fireEvent.click(checkbox("source"))
    expect(flags(current(store))).toEqual([false, true])
    expect(checkbox("target").disabled).toBe(true)
  })

  it("shows a legacy ClassUnidirectional as a one-way Association", () => {
    renderPanel([edge("ClassUnidirectional")])
    expect(checkbox("source").checked).toBe(false)
    expect(checkbox("target").checked).toBe(true)
    expect(screen.getByText("Association", { selector: "div[role=combobox]" }))
      .toBeDefined()
  })

  it("keeps the composition part end locked", () => {
    renderPanel([edge("ClassComposition", true, true)])
    expect(checkbox("source").disabled).toBe(true)
    expect(checkbox("target").disabled).toBe(false)
  })

  it("hides the checkboxes for inheritance", () => {
    renderPanel([edge("ClassInheritance")])
    expect(screen.queryByTestId("source-navigable")).toBeNull()
  })
})

describe("user metamodel associations", () => {
  const relationships = Object.values(
    (userMetaModelJson as unknown as {
      relationships: Record<
        string,
        {
          type: string
          source: { navigable?: boolean }
          target: { navigable?: boolean }
        }
      >
    }).relationships
  )

  it("uses explicit per-end navigability", () => {
    const associations = relationships.filter((r) =>
      NAVIGABLE_ASSOCIATION_TYPES.includes(r.type)
    )
    expect(associations.length).toBeGreaterThan(0)
    for (const rel of associations) {
      expect(rel.type).not.toBe("ClassUnidirectional")
      expect(typeof rel.source.navigable).toBe("boolean")
      expect(typeof rel.target.navigable).toBe("boolean")
      expect(rel.source.navigable || rel.target.navigable).toBe(true)
      if (rel.type === "ClassComposition") expect(rel.source.navigable).toBe(true)
    }
  })

  it("carries the flags into the v4 bridge shape", () => {
    const { edges } = getUserMetaModelV4()
    const associations = edges.filter((e) => e.type === "ClassBidirectional")
    expect(associations.length).toBeGreaterThan(0)
    for (const e of associations) {
      expect(typeof e.data.sourceNavigable).toBe("boolean")
      expect(typeof e.data.targetNavigable).toBe("boolean")
    }
    expect(associations.some((e) => e.data.sourceNavigable === false)).toBe(true)
  })
})
