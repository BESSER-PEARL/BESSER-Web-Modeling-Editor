import { afterEach, describe, expect, it, vi } from "vitest"
import { act } from "@testing-library/react"
import { BesserEditor } from "@/besser-editor"
import { UMLDiagramType } from "@/types"
import type { UMLModel } from "@/typings"
import {
  hardenImportedModel,
  hydrateEdgeData,
  stripRuntimeInteractionState,
} from "@/utils/importHardening"
import { createOffscreenExportContainer } from "@/utils/exportContainer"

// Store-level API under test; skip mounting the React Flow canvas.
vi.mock("@/App", () => ({ AppWithProvider: () => null }))

/**
 * Upstream Apollon import hardening (contract-neutral): strip runtime
 * interaction flags on load (`stripRuntimeInteractionState`) and guard
 * edges with null `data` / missing `points` (EdgeTransformer guard). Plus
 * the #841 off-screen export container.
 */

const baseModel = (over: Partial<UMLModel> = {}): UMLModel =>
  ({
    version: "4.0.0",
    id: "m",
    title: "T",
    type: UMLDiagramType.ClassDiagram,
    nodes: [],
    edges: [],
    assessments: {},
    ...over,
  }) as UMLModel

const classNode = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  type: "class",
  position: { x: 0, y: 0 },
  width: 200,
  height: 100,
  measured: { width: 200, height: 100 },
  data: { name: id, attributes: [], methods: [] },
  ...extra,
})

describe("stripRuntimeInteractionState", () => {
  it("removes selected / dragging / resizing from nodes and selected from edges", () => {
    const model = baseModel({
      nodes: [
        classNode("a", { selected: true, dragging: true, resizing: false }),
        classNode("b"),
      ] as UMLModel["nodes"],
      edges: [
        {
          id: "e",
          source: "a",
          target: "b",
          type: "ClassBidirectional",
          sourceHandle: "",
          targetHandle: "",
          data: { points: [] },
          selected: true,
        },
      ] as unknown as UMLModel["edges"],
    })
    const out = stripRuntimeInteractionState(model)
    expect("selected" in out.nodes[0]).toBe(false)
    expect("dragging" in out.nodes[0]).toBe(false)
    expect("resizing" in out.nodes[0]).toBe(false)
    expect("selected" in out.edges[0]).toBe(false)
    // Untouched elements keep their identity; the input is not mutated.
    expect(out.nodes[1]).toBe(model.nodes[1])
    expect("selected" in model.nodes[0]).toBe(true)
  })

  it("returns a clean model by reference", () => {
    const model = baseModel({ nodes: [classNode("a")] as UMLModel["nodes"] })
    expect(stripRuntimeInteractionState(model)).toBe(model)
    expect(hardenImportedModel(model)).toBe(model)
  })
})

describe("hydrateEdgeData", () => {
  const edge = (data: unknown) =>
    ({
      id: "e",
      source: "a",
      target: "b",
      type: "ClassBidirectional",
      sourceHandle: "",
      targetHandle: "",
      data,
    }) as unknown as UMLModel["edges"][number]

  it("turns null / absent data into { points: [] }", () => {
    expect(hydrateEdgeData(edge(null)).data).toEqual({ points: [] })
    expect(hydrateEdgeData(edge(undefined)).data).toEqual({ points: [] })
  })

  it("adds missing points but keeps the other data fields", () => {
    expect(hydrateEdgeData(edge({ name: "x" })).data).toEqual({
      name: "x",
      points: [],
    })
    expect(hydrateEdgeData(edge({ points: "bad" })).data).toEqual({
      points: [],
    })
  })

  it("leaves a well-formed edge untouched", () => {
    const e = edge({ points: [{ x: 1, y: 2 }] })
    expect(hydrateEdgeData(e)).toBe(e)
  })
})

describe("BesserEditor load path", () => {
  let editor: BesserEditor | null = null
  afterEach(() => {
    act(() => editor?.destroy())
    editor = null
  })

  it("`model = ...` strips runtime flags and repairs edge data before the store sees them", () => {
    const el = document.createElement("div")
    document.body.appendChild(el)
    act(() => {
      editor = new BesserEditor(el, { type: UMLDiagramType.ClassDiagram })
    })
    act(() => {
      editor!.model = baseModel({
        nodes: [
          classNode("a", { selected: true, dragging: true }),
          classNode("b"),
        ] as UMLModel["nodes"],
        edges: [
          {
            id: "e",
            source: "a",
            target: "b",
            type: "ClassBidirectional",
            sourceHandle: "",
            targetHandle: "",
            data: null,
            selected: true,
          },
        ] as unknown as UMLModel["edges"],
      })
    })
    const state = (
      editor as unknown as {
        diagramStore: {
          getState: () => { nodes: Record<string, unknown>[]; edges: Record<string, unknown>[] }
        }
      }
    ).diagramStore.getState()
    expect(state.nodes.find((n) => n.id === "a")?.selected).toBeUndefined()
    expect(state.nodes.find((n) => n.id === "a")?.dragging).toBeUndefined()
    expect(state.edges[0].selected).toBeUndefined()
    expect((state.edges[0].data as { points: unknown }).points).toEqual([])
  })
})

describe("off-screen export container (#841)", () => {
  it("is fixed, pointer-inert and hidden from assistive tech", () => {
    const container = createOffscreenExportContainer()
    expect(container.style.position).toBe("fixed")
    expect(container.style.pointerEvents).toBe("none")
    expect(container.getAttribute("aria-hidden")).toBe("true")
    expect(container.style.width).toBe("4000px")
    // Never visibility:hidden -- it would propagate into the inlined SVG.
    expect(container.style.visibility).toBe("")
  })
})
