import { describe, it, expect } from "vitest"
import { fireEvent, render, screen, within } from "@testing-library/react"
import * as Y from "yjs"
import { ReactFlowProvider, type Node } from "@xyflow/react"
import type { StoreApi } from "zustand"
import {
  AssessmentSelectionStoreContext,
  DiagramStoreContext,
  MetadataStoreContext,
  PopoverStoreContext,
} from "@/store/context"
import { createAssessmentSelectionStore } from "@/store/assessmentSelectionStore"
import { createDiagramStore, DiagramStore } from "@/store/diagramStore"
import { createMetadataStore } from "@/store/metadataStore"
import { createPopoverStore } from "@/store/popoverStore"
import {
  fitNNLayerLabel,
  makeNNLayerComponent,
} from "@/nodes/nnDiagram/_NNLayerBase"
import { NNComponentEditPanel } from "@/components/inspectors/nnDiagram/NNComponentEditPanel"

/**
 * NN review fixes (2026-10-06): layer names readable in dark mode, default
 * names fitting the 90px card, and the inspector's duplicate name field,
 * "unchecked" filler, non-label option names and stale validation errors.
 */

const withStores = (ui: React.ReactElement, nodes: Node[]) => {
  const ydoc = new Y.Doc()
  const diagram = createDiagramStore(ydoc)
  diagram.getState().setNodes(nodes)
  const utils = render(
    <DiagramStoreContext.Provider value={diagram as StoreApi<DiagramStore>}>
      <MetadataStoreContext.Provider value={createMetadataStore(ydoc)}>
        <PopoverStoreContext.Provider value={createPopoverStore()}>
          <AssessmentSelectionStoreContext.Provider
            value={createAssessmentSelectionStore()}
          >
            <ReactFlowProvider>{ui}</ReactFlowProvider>
          </AssessmentSelectionStoreContext.Provider>
        </PopoverStoreContext.Provider>
      </MetadataStoreContext.Provider>
    </DiagramStoreContext.Provider>
  )
  return { diagram, ...utils }
}

const layer = (type: string, data: Record<string, unknown>): Node => ({
  id: "node-1",
  type,
  position: { x: 0, y: 0 },
  width: 90,
  height: 100,
  data,
})

describe("NN layer card label", () => {
  // ~0.6em per glyph, a stable stand-in for canvas measurement.
  const measure = (text: string, size: number) => text.length * size * 0.6

  it("keeps a short name at the requested size", () => {
    expect(fitNNLayerLabel("dataset", 82, 13, measure)).toEqual({
      text: "dataset",
      fontSize: 13,
      truncated: false,
    })
  })

  it("shrinks the font before truncating", () => {
    const fit = fitNNLayerLabel("conv1d_layer", 82, 13, measure)
    expect(fit.truncated).toBe(false)
    expect(fit.fontSize).toBeLessThan(13)
    expect(measure(fit.text, fit.fontSize)).toBeLessThanOrEqual(82)
  })

  it("truncates with an ellipsis once the minimum size still overflows", () => {
    const fit = fitNNLayerLabel("layernormalization_layer", 82, 13, measure)
    expect(fit.truncated).toBe(true)
    expect(fit.text.endsWith("…")).toBe(true)
    expect(measure(fit.text, fit.fontSize)).toBeLessThanOrEqual(82)
  })

  it("an icon card's name follows the theme text colour (no forced dark text)", () => {
    const Conv1D = makeNNLayerComponent("Conv1DLayer", "Conv1D", "#E3F2FD")
    const data = { name: "conv1d_layer" }
    const { container } = withStores(
      <Conv1D {...({ id: "node-1", width: 90, height: 100, data } as never)} />,
      [layer("Conv1DLayer", data)]
    )
    const text = container.querySelector("svg text")!
    expect(text.getAttribute("fill")).not.toBe("#1f2937")
    expect(text.getAttribute("fill")).toContain("--besser-primary-contrast")
  })

  it("a pastel kind card (no icon) keeps dark text", () => {
    const Plain = makeNNLayerComponent("PlainKind", "Plain", "#FFF3E0")
    const data = { name: "x" }
    const { container } = withStores(
      <Plain {...({ id: "node-1", width: 90, height: 100, data } as never)} />,
      [layer("PlainKind", data)]
    )
    expect(container.querySelector("svg text")!.getAttribute("fill")).toBe(
      "#1f2937"
    )
  })

  it("a long default name is truncated inside the 90px card with a tooltip", () => {
    const Norm = makeNNLayerComponent("LayerNormalizationLayer", "LayerNorm")
    const data = { name: "layernorm_layer" }
    const { container } = withStores(
      <Norm {...({ id: "node-1", width: 90, height: 100, data } as never)} />,
      [layer("LayerNormalizationLayer", data)]
    )
    const text = container.querySelector("svg text")!
    expect(text.querySelector("title")?.textContent).toBe("layernorm_layer")
    expect(text.textContent).toContain("…")
  })
})

describe("NN inspector", () => {
  const renderPanel = () =>
    withStores(<NNComponentEditPanel elementId="node-1" />, [
      layer("Conv1DLayer", {
        name: "conv1d_layer",
        attributes: { name: "conv1d_layer" },
      }),
    ])

  it("shows the layer name once (no second 'name' field)", () => {
    renderPanel()
    const nameInputs = screen
      .getAllByRole("textbox")
      .filter((el) => (el as HTMLInputElement).value === "conv1d_layer")
    expect(nameInputs).toHaveLength(1)
    expect(screen.queryByLabelText("name")).toBeNull()
  })

  it("an unchecked optional field shows no 'unchecked' filler", () => {
    renderPanel()
    expect(screen.queryByText("unchecked")).toBeNull()
  })

  it("an optional field's name is the checkbox label", () => {
    renderPanel()
    const checkbox = screen.getByLabelText("stride_dim") as HTMLInputElement
    expect(checkbox.type).toBe("checkbox")
    expect(checkbox.checked).toBe(false)
    fireEvent.click(screen.getByText("stride_dim"))
    expect((screen.getByLabelText("stride_dim") as HTMLInputElement).checked).toBe(
      true
    )
  })

  it("an invalid value that reverts says so instead of leaving a stale error", () => {
    renderPanel()
    const row = screen.getByText("out_channels").parentElement as HTMLElement
    const input = within(row).getByRole("textbox")
    fireEvent.change(input, { target: { value: "-3" } })
    fireEvent.keyDown(input, { key: "Enter" })
    expect((input as HTMLInputElement).value).toBe("16")
    expect(screen.getByText(/Reverted to 16\./)).toBeTruthy()
  })
})
