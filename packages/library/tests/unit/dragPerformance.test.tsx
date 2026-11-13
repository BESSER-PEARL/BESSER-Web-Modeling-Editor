import { afterEach, describe, expect, it, vi } from "vitest"
import { act } from "@testing-library/react"
import * as Y from "yjs"
import type { Node, NodeChange } from "@xyflow/react"
import { BesserEditor } from "@/besser-editor"
import { createDiagramStore } from "@/store/diagramStore"
import { deepEqual } from "@/utils/storeUtils"
import { UMLDiagramType } from "@/types"
import type { UMLModel } from "@/typings"

vi.mock("@/App", () => ({ AppWithProvider: () => null }))

/**
 * A drag step must not serialize the whole diagram (develop 4f8ff6b9:
 * "stop serializing the whole diagram on every drag step").
 */

const classNode = (i: number, overrides: Partial<Node> = {}): Node => ({
  id: `n${i}`,
  type: "class",
  position: { x: i * 10, y: 0 },
  width: 160,
  height: 100,
  data: {
    name: `C${i}`,
    attributes: [{ id: `a${i}`, name: "attr: str" }],
    methods: [],
  },
  ...overrides,
})

describe("deepEqual on node lists", () => {
  it("gives the same answer as comparing the full JSON", () => {
    const a = [classNode(1), classNode(2)]
    expect(deepEqual(a, [classNode(1), classNode(2)])).toBe(true)
    expect(deepEqual(a, [classNode(1), classNode(2, { position: { x: 1, y: 0 } })])).toBe(false)
    expect(deepEqual(a, [classNode(1)])).toBe(false)
    expect(deepEqual({ k: 1 }, { k: 1 })).toBe(true)
  })

  it("serializes only the items that changed", () => {
    const before = Array.from({ length: 200 }, (_, i) => classNode(i))
    const after = before.map((n, i) =>
      i === 7 ? { ...n, position: { x: n.position.x + 5, y: 0 } } : n
    )
    const spy = vi.spyOn(JSON, "stringify")
    try {
      expect(deepEqual(before, after)).toBe(false)
      // Two strings for the one changed node -- not two for the whole list.
      expect(spy.mock.calls.map(([value]) => value)).toEqual([before[7], after[7]])
    } finally {
      spy.mockRestore()
    }
  })
})

describe("a drag step", () => {
  it("does not stringify the whole node list in onNodesChange", () => {
    const store = createDiagramStore(new Y.Doc())
    act(() => store.getState().setNodes(Array.from({ length: 200 }, (_, i) => classNode(i))))
    const spy = vi.spyOn(JSON, "stringify")
    try {
      const change: NodeChange = {
        id: "n7",
        type: "position",
        position: { x: 123, y: 45 },
        dragging: true,
      }
      act(() => store.getState().onNodesChange([change]))
      const wholeList = spy.mock.calls.filter(([value]) => Array.isArray(value))
      expect(wholeList).toHaveLength(0)
    } finally {
      spy.mockRestore()
    }
    expect(store.getState().nodes[7].position).toEqual({ x: 123, y: 45 })
  })
})

describe("subscribeToModelChange during a gesture", () => {
  let editor: BesserEditor | null = null
  afterEach(() => {
    act(() => editor?.destroy())
    editor = null
  })

  it("emits once the drag/resize ends, not on every frame", () => {
    const el = document.createElement("div")
    document.body.appendChild(el)
    act(() => {
      editor = new BesserEditor(el, { type: UMLDiagramType.ClassDiagram })
    })
    const store = (
      editor as unknown as {
        diagramStore: { getState: () => { setNodes: (n: Node[]) => void } }
      }
    ).diagramStore.getState()
    const calls: UMLModel[] = []
    editor!.subscribeToModelChange((m) => calls.push(m))

    act(() => store.setNodes([classNode(1)]))
    const settled = calls.length
    expect(settled).toBeGreaterThan(0)

    act(() => store.setNodes([classNode(1, { position: { x: 5, y: 0 }, dragging: true })]))
    act(() => store.setNodes([classNode(1, { position: { x: 9, y: 0 }, dragging: true })]))
    act(() => store.setNodes([classNode(1, { width: 300, resizing: true })]))
    expect(calls).toHaveLength(settled)

    act(() => store.setNodes([classNode(1, { position: { x: 9, y: 0 }, dragging: false })]))
    expect(calls.length).toBeGreaterThan(settled)
    expect(calls[calls.length - 1].nodes[0].position.x).toBe(9)
  })
})
