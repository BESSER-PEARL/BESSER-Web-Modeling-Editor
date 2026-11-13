import { afterEach, describe, expect, it, vi } from "vitest"
import { useEffect } from "react"
import type { Node, ReactFlowInstance } from "@xyflow/react"
import { BesserEditor } from "@/besser-editor"
import { UMLDiagramType } from "@/types"
import type { UMLModel } from "@/typings"

const bounds = vi.hoisted(() => ({
  impl: (): { x: number; y: number; width: number; height: number } => ({
    x: 0,
    y: 0,
    width: 100,
    height: 50,
  }),
}))

// A React Flow stand-in that reports every node as measured at once.
vi.mock("@/App", async (importOriginal) => {
  const fakeInstance = {
    getInternalNode: (id: string) => ({
      hidden: false,
      measured: { width: 10, height: 10 },
      position: { x: Number(id === "B") * 400, y: 0 },
    }),
  } as unknown as ReactFlowInstance<Node>
  return {
    ...(await importOriginal<typeof import("@/App")>()),
    AppWithProvider: ({
      onReactFlowInit,
    }: {
      onReactFlowInit: (i: ReactFlowInstance<Node>) => void
    }) => {
      useEffect(() => onReactFlowInit(fakeInstance), [onReactFlowInit])
      return null
    },
  }
})

vi.mock("@/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils")>()),
  getRenderedDiagramBounds: () => bounds.impl(),
}))

const model = (): UMLModel =>
  ({
    version: "4.0.0",
    id: "m",
    title: "M",
    type: UMLDiagramType.ClassDiagram,
    nodes: [
      {
        id: "A",
        type: "class",
        position: { x: 0, y: 0 },
        width: 200,
        height: 100,
        data: { name: "A", attributes: [], methods: [] },
      },
      {
        id: "B",
        type: "class",
        position: { x: 400, y: 0 },
        width: 200,
        height: 100,
        data: { name: "B", attributes: [], methods: [] },
      },
    ],
    edges: [],
    assessments: {},
  }) as unknown as UMLModel

afterEach(() => {
  bounds.impl = () => ({ x: 0, y: 0, width: 100, height: 50 })
  document.body.innerHTML = ""
})

describe("BesserEditor.exportModelAsSvg", () => {
  it("removes its off-screen mount even when the export fails", async () => {
    bounds.impl = () => {
      throw new Error("measure failed")
    }
    await expect(BesserEditor.exportModelAsSvg(model())).rejects.toThrow(
      "measure failed"
    )
    expect(document.body.children).toHaveLength(0)
  })

  it("pads the clip by options.margin, 15 by default (develop parity)", async () => {
    const byDefault = await BesserEditor.exportModelAsSvg(model())
    expect(byDefault.clip).toEqual({ x: -15, y: -15, width: 130, height: 80 })

    const custom = await BesserEditor.exportModelAsSvg(model(), {
      margin: { top: 5, left: 2 },
    })
    expect(custom.clip).toEqual({ x: -2, y: -5, width: 102, height: 55 })
    expect(document.body.children).toHaveLength(0)
  })

  it("runs concurrent exports side by side", async () => {
    const [a, b] = await Promise.all([
      BesserEditor.exportModelAsSvg(model()),
      BesserEditor.exportModelAsSvg(model()),
    ])
    expect(a.clip).toEqual(b.clip)
    expect(document.body.children).toHaveLength(0)
  })
})
