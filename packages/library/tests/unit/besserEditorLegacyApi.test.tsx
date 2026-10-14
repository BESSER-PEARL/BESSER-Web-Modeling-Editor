import { afterEach, describe, expect, it, vi } from "vitest"
import { act } from "@testing-library/react"
import { BesserEditor } from "@/besser-editor"
import { UMLDiagramType } from "@/types"
import type { Assessment, UMLModel } from "@/typings"

// The API under test is store-level; skip mounting the React Flow canvas.
vi.mock("@/App", () => ({ AppWithProvider: () => null }))

/**
 * v3 public-API parity (`apollon-editor.ts`): `subscribeToModelDiscreteChange`,
 * `subscribeToAssessmentChange` and `getScaleFactor`.
 */

type TestEditor = BesserEditor & {
  diagramStore: {
    getState: () => {
      setNodes: (fn: (n: unknown[]) => unknown[]) => void
      setAssessments: (a: Record<string, Assessment>) => void
    }
  }
}

let editor: BesserEditor | null = null

afterEach(() => {
  act(() => editor?.destroy())
  editor = null
})

const node = (overrides: Record<string, unknown> = {}) => ({
  id: "c1",
  type: "class",
  position: { x: 0, y: 0 },
  width: 200,
  height: 100,
  data: { name: "Person", attributes: [], methods: [] },
  ...overrides,
})

const mount = (scale?: number) => {
  const el = document.createElement("div")
  document.body.appendChild(el)
  act(() => {
    editor = new BesserEditor(el, {
      type: UMLDiagramType.ClassDiagram,
      ...(scale !== undefined && { scale }),
    })
  })
  return editor as TestEditor
}

describe("BesserEditor v3 API parity", () => {
  it("getScaleFactor returns options.scale (default 1)", () => {
    expect(mount().getScaleFactor()).toBe(1)
    act(() => editor?.destroy())
    expect(mount(1.5).getScaleFactor()).toBe(1.5)
  })

  it("subscribeToModelDiscreteChange skips drag frames and selection-only changes", () => {
    const e = mount()
    const calls: UMLModel[] = []
    const id = e.subscribeToModelDiscreteChange((m) => calls.push(m))
    const store = e.diagramStore.getState()

    act(() => store.setNodes(() => [node()]))
    expect(calls).toHaveLength(1)

    // Mid-drag frames are not discrete.
    act(() =>
      store.setNodes(() => [node({ position: { x: 5, y: 0 }, dragging: true })])
    )
    act(() =>
      store.setNodes(() => [node({ position: { x: 9, y: 0 }, dragging: true })])
    )
    expect(calls).toHaveLength(1)
    // Drag end → one notification with the final position.
    act(() =>
      store.setNodes(() => [
        node({ position: { x: 9, y: 0 }, dragging: false }),
      ])
    )
    expect(calls).toHaveLength(2)
    expect(calls[1].nodes[0].position.x).toBe(9)

    // Selection-only change → no notification.
    act(() =>
      store.setNodes(() => [node({ position: { x: 9, y: 0 }, selected: true })])
    )
    expect(calls).toHaveLength(2)

    e.unsubscribe(id)
    act(() => store.setNodes(() => [node({ position: { x: 50, y: 0 } })]))
    expect(calls).toHaveLength(2)
  })

  it("subscribeToAssessmentChange reports the assessment list on change", () => {
    const e = mount()
    const calls: Assessment[][] = []
    e.subscribeToAssessmentChange((a) => calls.push(a))
    const assessment: Assessment = {
      modelElementId: "c1",
      elementType: "node",
      score: 1,
      feedback: "ok",
    }
    act(() => e.diagramStore.getState().setAssessments({ c1: assessment }))
    expect(calls).toEqual([[assessment]])
    // Same content again → no duplicate notification.
    act(() =>
      e.diagramStore.getState().setAssessments({ c1: { ...assessment } })
    )
    expect(calls).toHaveLength(1)
  })
})
