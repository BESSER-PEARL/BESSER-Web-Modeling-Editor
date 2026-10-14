import { afterEach, describe, expect, it } from "vitest"
import { act } from "@testing-library/react"
import { BesserEditor } from "@/besser-editor"
import { UMLDiagramType } from "@/types"
import type { UMLModel } from "@/typings"

/**
 * Live: an NN layer card (icon above its name) connected only from its top.
 * The connect band followed the icon square inside the card, so a drag from
 * the left, right or bottom of the card frame (what the selection shows)
 * moved the node or did nothing. The frame connects on every side, and the
 * icon outline keeps its band.
 */

let editor: BesserEditor | null = null
afterEach(() => {
  act(() => editor?.destroy())
  editor = null
  document.body.innerHTML = ""
})

const model = {
  version: "4.0.0",
  id: "m",
  title: "M",
  type: UMLDiagramType.NNDiagram,
  nodes: [
    { id: "l1", type: "LinearLayer", position: { x: 0, y: 0 }, width: 110, height: 110, data: { name: "l1" } },
    { id: "l2", type: "LSTMLayer", position: { x: 300, y: 0 }, width: 110, height: 110, data: { name: "l2" } },
  ],
  edges: [],
  assessments: {},
} as unknown as UMLModel

describe("NN layer connect band", () => {
  it("covers every side of the card frame and the icon outline", async () => {
    const el = document.createElement("div")
    document.body.appendChild(el)
    act(() => {
      editor = new BesserEditor(el, { type: UMLDiagramType.NNDiagram, model })
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })
    for (const id of ["l1", "l2"]) {
      const band = el.querySelector(`.react-flow__node[data-id="${id}"] .besser-port-band`)
      expect(band, id).not.toBeNull()
      expect(band!.querySelector(".besser-port-band__ring"), `${id} icon ring`).not.toBeNull()
      for (const side of ["top", "right", "bottom", "left"]) {
        expect(band!.querySelector(`.besser-port-band__strip--${side}`), `${id} ${side}`).not.toBeNull()
      }
    }
  })
})
