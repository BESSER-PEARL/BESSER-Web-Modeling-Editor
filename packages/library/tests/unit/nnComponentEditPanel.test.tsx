import { describe, it, expect } from "vitest"
import { fireEvent, render, screen, within } from "@testing-library/react"
import * as Y from "yjs"
import type { Edge, Node } from "@xyflow/react"
import type { StoreApi } from "zustand"
import { DiagramStoreContext } from "@/store/context"
import { createDiagramStore, DiagramStore } from "@/store/diagramStore"
import {
  NNComponentEditPanel,
  parseMetricsValue,
  formatMetricsValue,
  parseLayersOfTensors,
  formatLayersOfTensors,
  pruneTensorOpAttributes,
  prunePoolingAttributes,
  pruneDatasetAttributes,
  syncPoolingDimensionAttributes,
} from "@/components/inspectors/nnDiagram/NNComponentEditPanel"
import {
  OPTIMIZER_OPTIONS,
  LOSS_FUNCTION_OPTIONS,
  METRICS_OPTIONS,
} from "@/nodes/nnDiagram/nnAttributeWidgetConfig"

/**
 * Wave-3 NN inspector tests — Configuration whitelists + metrics
 * multiselect (NN-1), graph-aware predecessor dropdowns (NN-2),
 * TensorOp dual layers_of_tensors dropdowns + discriminator pruning
 * (NN-3), pooling dimension sync (NN-8) and the panel-mount legacy
 * normalization (NN-9).
 */

/* ────────────────────────────── helpers ────────────────────────────── */

const nnNode = (
  id: string,
  type: string,
  data: Record<string, unknown>
): Node => ({
  id,
  type,
  position: { x: 0, y: 0 },
  width: 240,
  height: 60,
  data,
})

const nextEdge = (id: string, source: string, target: string): Edge => ({
  id,
  type: "NNNext" as Edge["type"],
  source,
  target,
})

const renderPanel = (
  nodes: Node[],
  edges: Edge[] = [],
  elementId = "node-1"
) => {
  const store = createDiagramStore(new Y.Doc())
  store.getState().setNodes(nodes)
  store.getState().setEdges(edges)
  const utils = render(
    <DiagramStoreContext.Provider value={store as StoreApi<DiagramStore>}>
      <NNComponentEditPanel elementId={elementId} />
    </DiagramStoreContext.Provider>
  )
  return { store, ...utils }
}

const getAttrs = (
  store: StoreApi<DiagramStore>,
  id = "node-1"
): Record<string, unknown> =>
  (store.getState().nodes.find((n) => n.id === id)!.data as {
    attributes: Record<string, unknown>
  }).attributes

/** Open the MUI Select rendered next to the given label text. */
const openSelect = (label: string) => {
  const labelEl = screen.getByText(label)
  const combo = within(labelEl.parentElement as HTMLElement).getByRole(
    "combobox"
  )
  fireEvent.mouseDown(combo)
  return combo
}

/* ───────────────────── pure (de)serialization helpers ──────────────── */

describe("metrics / layers_of_tensors (de)serialization", () => {
  it("parses bracketed and bare metrics strings", () => {
    expect(parseMetricsValue("[accuracy, mae]")).toEqual(["accuracy", "mae"])
    expect(parseMetricsValue("accuracy, recall")).toEqual([
      "accuracy",
      "recall",
    ])
    expect(parseMetricsValue("")).toEqual([])
  })

  it("formats metrics back to the canonical bracketed form", () => {
    expect(formatMetricsValue(["accuracy", "mae"])).toBe("[accuracy, mae]")
    expect(formatMetricsValue([])).toBe("")
  })

  it("parses and formats develop's layers_of_tensors wire form", () => {
    expect(parseLayersOfTensors("['layerA', 'layerB']")).toEqual([
      "layerA",
      "layerB",
    ])
    expect(parseLayersOfTensors("[]")).toEqual([])
    expect(formatLayersOfTensors("a", "b")).toBe("['a', 'b']")
  })
})

/* ─────────────────────── discriminator pruning ─────────────────────── */

describe("discriminator pruning (develop monitor parity)", () => {
  it("tns_type reshape→permute deletes reshape_dim, keeps layers_of_tensors", () => {
    const next = pruneTensorOpAttributes(
      {
        tns_type: "permute",
        reshape_dim: "[-1]",
        permute_dim: "[0, 1, 2]",
        layers_of_tensors: "['a', 'b']",
      },
      "permute"
    )
    expect("reshape_dim" in next).toBe(false)
    expect(next["permute_dim"]).toBe("[0, 1, 2]")
    expect(next["layers_of_tensors"]).toBe("['a', 'b']")
  })

  it("tns_type concatenate keeps concatenate_dim + layers_of_tensors only", () => {
    const next = pruneTensorOpAttributes(
      {
        concatenate_dim: "0",
        layers_of_tensors: "['a', 'b']",
        transpose_dim: "[0, 1]",
      },
      "concatenate"
    )
    expect(next["concatenate_dim"]).toBe("0")
    expect(next["layers_of_tensors"]).toBe("['a', 'b']")
    expect("transpose_dim" in next).toBe(false)
  })

  it("tns_type multiply keeps no *_dim attrs", () => {
    const next = pruneTensorOpAttributes(
      { reshape_dim: "[-1]", permute_dim: "[0, 1, 2]" },
      "multiply"
    )
    expect("reshape_dim" in next).toBe(false)
    expect("permute_dim" in next).toBe(false)
  })

  it("pooling max→global_max deletes the 5 hidden keys", () => {
    const next = prunePoolingAttributes(
      {
        "pooling.dimension": "2D",
        kernel_dim: "[3, 3]",
        stride_dim: "[1, 1]",
        padding_amount: "0",
        padding_type: "valid",
        output_dim: "[16, 16]",
      },
      "global_max"
    )
    expect(Object.keys(next)).toEqual(["pooling.dimension"])
  })

  it("pooling adaptive_average keeps output_dim", () => {
    const next = prunePoolingAttributes(
      { kernel_dim: "[3, 3]", output_dim: "[16, 16]" },
      "adaptive_average"
    )
    expect("kernel_dim" in next).toBe(false)
    expect(next["output_dim"]).toBe("[16, 16]")
  })

  it("pooling average deletes output_dim only", () => {
    const next = prunePoolingAttributes(
      { kernel_dim: "[3, 3]", output_dim: "[16, 16]" },
      "average"
    )
    expect(next["kernel_dim"]).toBe("[3, 3]")
    expect("output_dim" in next).toBe(false)
  })

  it("dataset csv deletes shape / normalize", () => {
    const next = pruneDatasetAttributes(
      { shape: "[32, 32, 3]", normalize: true, path_data: "p" },
      "csv"
    )
    expect("shape" in next).toBe(false)
    expect("normalize" in next).toBe(false)
    expect(next["path_data"]).toBe("p")
  })
})

/* ─────────────────────── pooling dimension sync ────────────────────── */

describe("pooling dimension sync (NN-8)", () => {
  it("rewrites present kernel/stride/output dims to the new arity", () => {
    const next = syncPoolingDimensionAttributes(
      {
        "pooling.dimension": "1D",
        kernel_dim: "[3, 3]",
        stride_dim: "[1, 1]",
        output_dim: "[16, 16]",
      },
      "1D"
    )
    expect(next["kernel_dim"]).toBe("[3]")
    expect(next["stride_dim"]).toBe("[1]")
    expect(next["output_dim"]).toBe("[16]")
  })

  it("leaves absent siblings absent", () => {
    const next = syncPoolingDimensionAttributes(
      { "pooling.dimension": "3D", kernel_dim: "[3, 3]" },
      "3D"
    )
    expect(next["kernel_dim"]).toBe("[3, 3, 3]")
    expect("output_dim" in next).toBe(false)
    expect("stride_dim" in next).toBe(false)
  })

  it("wires the sync into the panel's dimension dropdown", () => {
    const { store } = renderPanel([
      nnNode("node-1", "PoolingLayer", {
        name: "Pool1",
        attributes: {
          pooling_type: "max",
          "pooling.dimension": "2D",
          kernel_dim: "[3, 3]",
          stride_dim: "[1, 1]",
        },
      }),
    ])
    openSelect("dimension")
    fireEvent.click(screen.getByRole("option", { name: "1D" }))
    const attrs = getAttrs(store)
    expect(attrs["pooling.dimension"]).toBe("1D")
    expect(attrs["kernel_dim"]).toBe("[3]")
    expect(attrs["stride_dim"]).toBe("[1]")
  })

  it("BatchNorm dimension change touches nothing else", () => {
    const { store } = renderPanel([
      nnNode("node-1", "BatchNormalizationLayer", {
        name: "BN1",
        attributes: {
          num_features: "128",
          "batch_normalization.dimension": "2D",
        },
      }),
    ])
    openSelect("dimension")
    fireEvent.click(screen.getByRole("option", { name: "3D" }))
    const attrs = getAttrs(store)
    expect(attrs["batch_normalization.dimension"]).toBe("3D")
    expect(attrs["num_features"]).toBe("128")
  })
})

/* ───────────────── Configuration whitelists + multiselect ──────────── */

describe("Configuration whitelists (NN-1)", () => {
  const configNode = () =>
    nnNode("node-1", "Configuration", {
      name: "Cfg",
      attributes: {
        batch_size: "32",
        epochs: "10",
        learning_rate: "0.001",
        optimizer: "adam",
        loss_function: "crossentropy",
        metrics: "[accuracy]",
      },
    })

  it("offers exactly the backend optimizer whitelist", () => {
    renderPanel([configNode()])
    openSelect("optimizer")
    const options = screen
      .getAllByRole("option")
      .map((o) => o.textContent?.trim())
    expect(options).toEqual([...OPTIMIZER_OPTIONS])
  })

  it("offers exactly the backend loss_function whitelist", () => {
    renderPanel([configNode()])
    openSelect("loss_function")
    const options = screen
      .getAllByRole("option")
      .map((o) => o.textContent?.trim())
    expect(options).toEqual([...LOSS_FUNCTION_OPTIONS])
  })

  it("offers exactly the backend metrics whitelist", () => {
    renderPanel([configNode()])
    openSelect("metrics")
    const options = screen
      .getAllByRole("option")
      .map((o) => o.textContent?.trim())
    expect(options).toEqual([...METRICS_OPTIONS])
  })

  it("metrics toggling produces the canonical bracketed string", () => {
    const { store } = renderPanel([configNode()])
    openSelect("metrics")
    fireEvent.click(screen.getByRole("option", { name: /mae/ }))
    expect(getAttrs(store)["metrics"]).toBe("[accuracy, mae]")
  })

  it("unticking every metric stores the empty string", () => {
    const { store } = renderPanel([configNode()])
    openSelect("metrics")
    fireEvent.click(screen.getByRole("option", { name: /accuracy/ }))
    expect(getAttrs(store)["metrics"]).toBe("")
  })

  it("normalizes a stored legacy 'cross_entropy' on mount (NN-9)", () => {
    const { store } = renderPanel([
      nnNode("node-1", "Configuration", {
        name: "Cfg",
        attributes: {
          batch_size: "32",
          epochs: "10",
          learning_rate: "0.001",
          optimizer: "adam",
          loss_function: "cross_entropy",
          metrics: "[accuracy]",
        },
      }),
    ])
    expect(getAttrs(store)["loss_function"]).toBe("crossentropy")
  })
})

/* ───────────────────── predecessor dropdowns (NN-2) ────────────────── */

describe("predecessor dropdowns (NN-2)", () => {
  const chain = () => [
    nnNode("up-2", "Conv2DLayer", { name: "Conv1", attributes: {} }),
    nnNode("up-1", "TensorOp", {
      name: "Reshape1",
      attributes: { tns_type: "reshape" },
    }),
    nnNode("node-1", "LinearLayer", {
      name: "Lin1",
      attributes: { out_features: "128", name_module_input: "Reshape1" },
    }),
    nnNode("down-1", "DropoutLayer", { name: "Drop1", attributes: {} }),
  ]
  const chainEdges = () => [
    nextEdge("e1", "up-2", "up-1"),
    nextEdge("e2", "up-1", "node-1"),
    nextEdge("e3", "node-1", "down-1"),
  ]

  it("offers transitive upstream candidates including TensorOps", () => {
    renderPanel(chain(), chainEdges())
    openSelect("name_module_input")
    const options = screen
      .getAllByRole("option")
      .map((o) => o.textContent?.trim())
    // Empty item + nearest-first upstream walk; downstream excluded.
    expect(options).toEqual(["— none —", "Reshape1", "Conv1"])
  })

  it("selecting the empty item removes the attribute (develop parity)", () => {
    const { store } = renderPanel(chain(), chainEdges())
    openSelect("name_module_input")
    fireEvent.click(screen.getByRole("option", { name: "— none —" }))
    expect("name_module_input" in getAttrs(store)).toBe(false)
  })

  it("selecting a predecessor stores its name", () => {
    const { store } = renderPanel(chain(), chainEdges())
    openSelect("name_module_input")
    fireEvent.click(screen.getByRole("option", { name: "Conv1" }))
    expect(getAttrs(store)["name_module_input"]).toBe("Conv1")
  })
})

/* ─────────────── TensorOp layers_of_tensors dual dropdowns ─────────── */

describe("TensorOp layers_of_tensors dual dropdowns (NN-3)", () => {
  const tensorGraph = () => [
    nnNode("a", "Conv2DLayer", { name: "ConvA", attributes: {} }),
    nnNode("b", "Conv2DLayer", { name: "ConvB", attributes: {} }),
    nnNode("node-1", "TensorOp", {
      name: "Concat1",
      attributes: { tns_type: "concatenate" },
    }),
  ]
  const tensorEdges = () => [
    nextEdge("e1", "a", "node-1"),
    nextEdge("e2", "b", "node-1"),
  ]

  const enableRow = () => {
    // The layers_of_tensors row ships disabled; arm it via its checkbox
    // (this must NOT create the attribute yet).
    const label = screen.getByText("layers_of_tensors")
    const row = label.parentElement as HTMLElement
    fireEvent.click(within(row).getByRole("checkbox"))
  }

  it("arming the row does not store the schema default '[]'", () => {
    const { store } = renderPanel(tensorGraph(), tensorEdges())
    enableRow()
    expect("layers_of_tensors" in getAttrs(store)).toBe(false)
  })

  it("persists develop's wire form only once BOTH are selected", () => {
    const { store } = renderPanel(tensorGraph(), tensorEdges())
    enableRow()
    const row = screen.getByText("layers_of_tensors")
      .parentElement as HTMLElement
    const combos = within(row).getAllByRole("combobox")
    expect(combos).toHaveLength(2)

    fireEvent.mouseDown(combos[0])
    fireEvent.click(screen.getByRole("option", { name: "ConvA" }))
    expect("layers_of_tensors" in getAttrs(store)).toBe(false)

    fireEvent.mouseDown(combos[1])
    fireEvent.click(screen.getByRole("option", { name: "ConvB" }))
    expect(getAttrs(store)["layers_of_tensors"]).toBe("['ConvA', 'ConvB']")
  })

  it("clearing either dropdown deletes the attribute", () => {
    const { store } = renderPanel(
      [
        ...tensorGraph().slice(0, 2),
        nnNode("node-1", "TensorOp", {
          name: "Concat1",
          attributes: {
            tns_type: "concatenate",
            layers_of_tensors: "['ConvA', 'ConvB']",
          },
        }),
      ],
      tensorEdges()
    )
    const row = screen.getByText("layers_of_tensors")
      .parentElement as HTMLElement
    const combos = within(row).getAllByRole("combobox")
    // Existing value populates both dropdowns.
    expect(combos[0].textContent).toContain("ConvA")
    expect(combos[1].textContent).toContain("ConvB")

    fireEvent.mouseDown(combos[1])
    fireEvent.click(screen.getByRole("option", { name: "— none —" }))
    expect("layers_of_tensors" in getAttrs(store)).toBe(false)
  })

  it("switching tns_type prunes the now-invalid *_dim attribute", () => {
    const { store } = renderPanel([
      nnNode("node-1", "TensorOp", {
        name: "Op1",
        attributes: { tns_type: "reshape", reshape_dim: "[-1]" },
      }),
    ])
    openSelect("tns_type")
    fireEvent.click(screen.getByRole("option", { name: "permute" }))
    const attrs = getAttrs(store)
    expect(attrs["tns_type"]).toBe("permute")
    expect("reshape_dim" in attrs).toBe(false)
  })
})

/* ──────────────────── pooling enable-path seeding ──────────────────── */

describe("pooling enable-path seeding (NN-8)", () => {
  it("enabling kernel_dim under dimension 3D seeds [3, 3, 3]", () => {
    const { store } = renderPanel([
      nnNode("node-1", "PoolingLayer", {
        name: "Pool1",
        attributes: { pooling_type: "max", "pooling.dimension": "3D" },
      }),
    ])
    // MUI TextField renders the label twice (InputLabel + legend) —
    // anchor on the first and walk up to the row Stack.
    const label = screen.getAllByText("kernel_dim")[0]
    const row = label.closest(".MuiStack-root") as HTMLElement
    fireEvent.click(within(row).getByRole("checkbox"))
    expect(getAttrs(store)["kernel_dim"]).toBe("[3, 3, 3]")
  })
})
