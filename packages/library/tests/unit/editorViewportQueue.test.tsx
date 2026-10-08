import { afterEach, describe, expect, it, vi } from "vitest"
import { act } from "@testing-library/react"
import type { Node, ReactFlowInstance } from "@xyflow/react"
import { BesserEditor } from "@/besser-editor"
import { UMLDiagramType } from "@/types"
import type { UMLModel } from "@/typings"

vi.mock("@/App", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/App")>()),
  AppWithProvider: () => null,
}))
// Layout itself is not under test: keep positions, return new arrays.
vi.mock("@/utils/autoLayout", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/autoLayout")>()),
  computeAutoLayout: async (nodes: Node[], edges: unknown[]) => ({ nodes: [...nodes], edges: [...edges] }),
}))

type Internals = BesserEditor & {
  diagramStore: { getState: () => { nodes: Node[] } }
  setReactFlowInstance: (instance: ReactFlowInstance) => void
}

let editor: BesserEditor | null = null
afterEach(() => {
  act(() => editor?.destroy())
  editor = null
  document.body.innerHTML = ""
})

const PANE = { x: 380, y: 96, width: 1060, height: 804 }

const mount = () => {
  const el = document.createElement("div")
  // The canvas `fitViewInto` measures (AppWithProvider is mocked out).
  const pane = document.createElement("div")
  pane.className = "react-flow"
  pane.getBoundingClientRect = () => ({ ...PANE, top: PANE.y, left: PANE.x, right: PANE.x + PANE.width, bottom: PANE.y + PANE.height, toJSON: () => ({}) }) as DOMRect
  document.body.appendChild(el)
  act(() => {
    editor = new BesserEditor(el, { type: UMLDiagramType.ClassDiagram })
  })
  el.appendChild(pane)
  return editor as Internals
}

const model = (): UMLModel =>
  ({
    version: "4.0.0",
    id: "m",
    title: "M",
    type: UMLDiagramType.ClassDiagram,
    nodes: [
      { id: "A", type: "class", position: { x: 0, y: 0 }, width: 200, height: 100, data: { name: "A", attributes: [], methods: [] } },
      { id: "B", type: "class", position: { x: 400, y: 200 }, width: 200, height: 100, data: { name: "B", attributes: [], methods: [] } },
    ],
    edges: [],
    assessments: {},
  }) as unknown as UMLModel

const frames = async (n: number) => {
  for (let i = 0; i < n; i++) await new Promise((resolve) => requestAnimationFrame(resolve))
}

const fakeInstance = (getNodes: () => Node[]) =>
  ({
    getNodes,
    getNode: (id: string) => getNodes().find((n) => n.id === id),
    getInternalNode: (id: string) => {
      const node = getNodes().find((n) => n.id === id)
      return node && { ...node, measured: { width: 200, height: 100 } }
    },
    getNodesBounds: () => ({ x: 0, y: 0, width: 600, height: 300 }),
    getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
    fitView: vi.fn(async () => true),
    setViewport: vi.fn(async () => true),
  }) as unknown as ReactFlowInstance & { fitView: ReturnType<typeof vi.fn>; setViewport: ReturnType<typeof vi.fn> }

/** Settles to "pending" when `p` has not resolved after a few frames. */
const settled = async <T,>(p: Promise<T>) => {
  const pending = Symbol("pending")
  const result = await Promise.race([p, frames(6).then(() => pending)])
  return result === pending ? "pending" : result
}

const mountedWithInstance = async () => {
  const e = mount()
  const instance = fakeInstance(() => e.diagramStore.getState().nodes)
  act(() => e.setReactFlowInstance(instance))
  await frames(3)
  return { e, instance }
}

describe("queued viewport moves", () => {
  // A fitView queued behind a load never settled once a later load replaced
  // it, so `await editor.fitView()` hung its caller forever.
  it("a fitView replaced by a later load resolves false", async () => {
    const { e } = await mountedWithInstance()
    act(() => {
      e.model = model()
    })
    const fit = e.fitView({ maxZoom: 1 })
    act(() => {
      e.model = model()
    })
    expect(await settled(fit)).toBe(false)
  })

  it("a fitView replaced by a later viewport move resolves false", async () => {
    const { e } = await mountedWithInstance()
    act(() => {
      e.model = model()
    })
    const first = e.fitView()
    const second = e.fitView({ maxZoom: 1 })
    expect(await settled(first)).toBe(false)
    expect(await settled(second)).toBe(true)
  })

  it("a fitView queued when the editor is destroyed resolves false", async () => {
    const { e } = await mountedWithInstance()
    act(() => {
      e.model = model()
    })
    const fit = e.fitView()
    act(() => e.destroy())
    editor = null
    expect(await settled(fit)).toBe(false)
  })
})

describe("fitViewInto", () => {
  it("centres the diagram in the given client area, capped at 100%", async () => {
    const { e, instance } = await mountedWithInstance()
    act(() => {
      e.model = model()
    })
    await frames(4)
    // The strip left of a 520 px panel on the right of the canvas.
    const area = { x: PANE.x, y: PANE.y, width: 476, height: PANE.height }
    await expect(e.fitViewInto(area)).resolves.toBe(true)

    const [vp] = instance.setViewport.mock.calls.at(-1) as unknown as [{ x: number; y: number; zoom: number }]
    expect(vp.zoom).toBeLessThanOrEqual(1)
    expect(vp.x + 600 * vp.zoom).toBeLessThanOrEqual(476)
    expect(vp.x).toBeGreaterThanOrEqual(0)
    // Centre of the diagram (300, 150) lands in the middle of the strip.
    expect(vp.x + 300 * vp.zoom).toBeCloseTo(238)
    expect(vp.y + 150 * vp.zoom).toBeCloseTo(402)
  })

  it("takes the area from a function of the canvas rect", async () => {
    const { e, instance } = await mountedWithInstance()
    act(() => {
      e.model = model()
    })
    await frames(4)
    // Inset 92 px on the left (a palette strip over the canvas).
    await expect(e.fitViewInto((canvas) => ({ ...canvas, x: canvas.x + 92, width: canvas.width - 92 }))).resolves.toBe(true)
    const [vp] = instance.setViewport.mock.calls.at(-1) as unknown as [{ x: number; zoom: number }]
    expect(vp.x).toBeGreaterThanOrEqual(92)
  })

  it("replaces the post-load fit when called during a load", async () => {
    const { e, instance } = await mountedWithInstance()
    act(() => {
      e.model = model()
    })
    const fit = e.fitViewInto({ x: PANE.x, y: PANE.y, width: 476, height: PANE.height })
    await frames(4)
    await expect(fit).resolves.toBe(true)
    expect(instance.fitView).not.toHaveBeenCalled()
  })
})

describe("autoLayout", () => {
  // Live report: the assistant's first "create a system" zoomed to ~220%:
  // the post-layout fit had no zoom cap.
  it("fits the result without zooming in past 100%", async () => {
    const { e, instance } = await mountedWithInstance()
    act(() => {
      e.model = model()
    })
    await frames(4)
    instance.fitView.mockClear()
    await e.autoLayout()
    await frames(2)
    expect(instance.fitView).toHaveBeenCalledWith(expect.objectContaining({ maxZoom: 1 }))
  })
})
