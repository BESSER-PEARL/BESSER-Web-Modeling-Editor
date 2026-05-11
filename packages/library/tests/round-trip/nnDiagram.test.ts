/**
 * SA-5 round-trip test for the BESSER NNDiagram migration.
 *
 * Asserts (per the SA-5 brief and `uml-v4-shape.md`):
 *
 *  1. v3 fixture → `migrateNNDiagramV3ToV4` produces a v4 model with:
 *     - One node per layer / dataset / configuration / container; all
 *       per-attribute UMLElements collapsed onto `data.attributes`.
 *     - Section helpers (`NNSectionTitle`, `NNSectionSeparator`) dropped.
 *     - Layer nodes nested under `NNContainer` get
 *       `parentId = container.id`.
 *  2. Conv2D layer collapses **at least 5 attributes** onto
 *     `data.attributes` (the brief's stress test).
 *  3. Boolean attributes (e.g. `permute_in: 'true'`) normalize to JS
 *     `boolean`.
 *  4. Open question #2: `dimension` slug is qualified per layer kind.
 *     `pooling.dimension` lands on the Pooling layer; the test fixture
 *     proves there's no plain `dimension` collision.
 *  5. `convertV4ToV3NN(v4)` is structurally invertible — the v3 → v4 →
 *     v3 → v4 cycle preserves the canonical `attributes` dict.
 */
import { describe, it, expect } from "vitest"
import {
  migrateNNDiagramV3ToV4,
  convertV4ToV3NN,
} from "@/utils/versionConverter"
import type { NNLayerNodeProps, NNContainerNodeProps } from "@/types"
import { nextUniqueNNLayerName } from "@/nodes/nnDiagram/_NNLayerBase"
import nnV3 from "../fixtures/v3/nnDiagram.json"

describe("NNDiagram v3 → v4 round-trip", () => {
  it("migrates the v3 fixture to v4 with structural fidelity", () => {
    const v4 = migrateNNDiagramV3ToV4(nnV3 as never)

    expect(v4.version).toMatch(/^4\./)
    expect(v4.type).toBe("NNDiagram")

    // Node count: 1 container + 4 layers (Conv2D, Pooling, Linear,
    // Dropout) + 1 TrainingDataset + 1 TestDataset + 1 Configuration =
    // 8. Section helpers (NNSectionTitle, NNSectionSeparator) dropped.
    // Per-attribute children also dropped (collapsed onto layers).
    expect(v4.nodes.length).toBe(8)

    // Container survives with its name + entryLayerId.
    const container = v4.nodes.find((n) => n.id === "container-1")!
    expect(container.type).toBe("NNContainer")
    expect((container.data as NNContainerNodeProps).name).toBe("MyCNN")
    expect((container.data as NNContainerNodeProps).entryLayerId).toBe(
      "layer-conv2d"
    )

    // 4 layers nested under the container via parentId.
    const conv2d = v4.nodes.find((n) => n.id === "layer-conv2d")!
    expect(conv2d.type).toBe("Conv2DLayer")
    expect(conv2d.parentId).toBe("container-1")
    expect((conv2d.data as NNLayerNodeProps).name).toBe("Conv2D_1")

    const pool = v4.nodes.find((n) => n.id === "layer-pooling")!
    expect(pool.type).toBe("PoolingLayer")
    expect(pool.parentId).toBe("container-1")

    const linear = v4.nodes.find((n) => n.id === "layer-linear")!
    expect(linear.type).toBe("LinearLayer")
    expect(linear.parentId).toBe("container-1")

    const dropout = v4.nodes.find((n) => n.id === "layer-dropout")!
    expect(dropout.type).toBe("DropoutLayer")
    expect(dropout.parentId).toBe("container-1")

    // Datasets / Configuration are top-level (no parentId).
    const training = v4.nodes.find((n) => n.id === "training-1")!
    expect(training.type).toBe("TrainingDataset")
    expect(training.parentId).toBeUndefined()

    const test = v4.nodes.find((n) => n.id === "test-1")!
    expect(test.type).toBe("TestDataset")
    expect(test.parentId).toBeUndefined()

    const cfg = v4.nodes.find((n) => n.id === "configuration-1")!
    expect(cfg.type).toBe("Configuration")
    expect(cfg.parentId).toBeUndefined()

    // Section title was dropped.
    expect(v4.nodes.find((n) => n.id === "section-title-1")).toBeUndefined()

    // 5 edges (3 NNNext between layers + 2 NNAssociation between
    // datasets and the container).
    expect(v4.edges).toHaveLength(5)
    expect(v4.edges.filter((e) => e.type === "NNNext")).toHaveLength(3)
    expect(v4.edges.filter((e) => e.type === "NNAssociation")).toHaveLength(2)
  })

  it("collapses Conv2D's 5+ attributes onto data.attributes (the stress test)", () => {
    const v4 = migrateNNDiagramV3ToV4(nnV3 as never)
    const conv2d = v4.nodes.find((n) => n.id === "layer-conv2d")!
    const attrs = (conv2d.data as NNLayerNodeProps).attributes

    // Fixture has 6 attribute child elements — name folds onto the
    // layer's `name`, leaving 5 keys on `data.attributes`.
    expect(Object.keys(attrs).length).toBeGreaterThanOrEqual(5)
    expect(attrs["kernel_dim"]).toBe("[3, 3]")
    expect(attrs["out_channels"]).toBe("32")
    expect(attrs["stride_dim"]).toBe("[1, 1]")
    expect(attrs["actv_func"]).toBe("relu")
    // Boolean normalisation: v3 stores 'true', v4 emits true.
    expect(attrs["permute_in"]).toBe(true)

    // Name was redundant with the layer's own `name` field — not in
    // the dict.
    expect("name" in attrs).toBe(false)
  })

  it("disambiguates the `dimension` slug per the layer-kind suffix (open question #2)", () => {
    const v4 = migrateNNDiagramV3ToV4(nnV3 as never)
    const pool = v4.nodes.find((n) => n.id === "layer-pooling")!
    const attrs = (pool.data as NNLayerNodeProps).attributes

    expect(attrs["pooling.dimension"]).toBe("2D")
    expect(attrs["pooling_type"]).toBe("max")
    // No bare `dimension` key — that would make Pooling/BatchNorm
    // ambiguous.
    expect("dimension" in attrs).toBe(false)
  })

  it("collapses Configuration's 6 mandatory training fields", () => {
    const v4 = migrateNNDiagramV3ToV4(nnV3 as never)
    const cfg = v4.nodes.find((n) => n.id === "configuration-1")!
    const attrs = (cfg.data as NNLayerNodeProps).attributes
    expect(attrs["batch_size"]).toBe("64")
    expect(attrs["epochs"]).toBe("20")
    expect(attrs["learning_rate"]).toBe("0.001")
    expect(attrs["optimizer"]).toBe("adam")
    expect(attrs["loss_function"]).toBe("cross_entropy")
    expect(attrs["metrics"]).toBe("accuracy")
  })

  it("collapses dataset attributes including the path", () => {
    const v4 = migrateNNDiagramV3ToV4(nnV3 as never)
    const training = v4.nodes.find((n) => n.id === "training-1")!
    const attrs = (training.data as NNLayerNodeProps).attributes
    expect(attrs["path_data"]).toBe("data/train")
    expect(attrs["task_type"]).toBe("multi_class")
  })

  it("round-trips v4 → v3 → v4 with structural equality", () => {
    const v4 = migrateNNDiagramV3ToV4(nnV3 as never)
    const v3Round = convertV4ToV3NN(v4)
    const v4Again = migrateNNDiagramV3ToV4(v3Round)

    // Normalization: compare the canonical view (id, type, name,
    // parentId, attributes) — order-independent. The inverse
    // migrator reconstructs different attribute-element ids
    // (`<layer>-attr-<slug>`) than the original fixture, so we ignore
    // those and only compare the resulting `data.attributes` dict.
    const canonical = (m: typeof v4) => ({
      type: m.type,
      nodes: m.nodes
        .map((n) => {
          const d = n.data as Record<string, unknown> & {
            attributes?: Record<string, unknown>
          }
          return {
            id: n.id,
            type: n.type,
            parentId: n.parentId ?? null,
            name: (d.name as string) ?? "",
            attributes: d.attributes
              ? Object.fromEntries(
                  Object.entries(d.attributes).sort(([a], [b]) =>
                    a.localeCompare(b)
                  )
                )
              : undefined,
          }
        })
        .sort((a, b) => a.id.localeCompare(b.id)),
      edges: m.edges
        .map((e) => ({
          id: e.id,
          type: e.type,
          source: e.source,
          target: e.target,
        }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    })

    expect(JSON.stringify(canonical(v4Again))).toBe(
      JSON.stringify(canonical(v4))
    )
  })

  it("preserves a Conv2D attribute edit through a v4 → v3 → v4 cycle", () => {
    const v4 = migrateNNDiagramV3ToV4(nnV3 as never)
    const conv2d = v4.nodes.find((n) => n.id === "layer-conv2d")!
    ;(conv2d.data as NNLayerNodeProps).attributes = {
      ...(conv2d.data as NNLayerNodeProps).attributes,
      out_channels: "64",
    }

    const v3Round = convertV4ToV3NN(v4)
    const v4Again = migrateNNDiagramV3ToV4(v3Round)
    const conv2dAgain = v4Again.nodes.find((n) => n.id === "layer-conv2d")!
    expect((conv2dAgain.data as NNLayerNodeProps).attributes["out_channels"])
      .toBe("64")
  })
})

/**
 * SA-FIX-NN (PC-10) — auto-name uniqueness regression. v3 dedup logic in
 * `nn-component-update.tsx:561-585` suffixed `Conv2D` → `Conv2D2` →
 * `Conv2D3` on collision; the v4 helper at
 * `_NNLayerBase.tsx:nextUniqueNNLayerName` reproduces that.
 */
describe("NNDiagram auto-name uniqueness on layer drop", () => {
  it("returns the base name when no sibling collides", () => {
    expect(
      nextUniqueNNLayerName("Conv2D", "Conv2DLayer", [
        { id: "x1", type: "Conv1DLayer", data: { name: "Conv1D" } },
        { id: "x2", type: "PoolingLayer", data: { name: "Pooling" } },
      ])
    ).toBe("Conv2D")
  })

  it("suffixes 2 on the first collision", () => {
    expect(
      nextUniqueNNLayerName("Conv2D", "Conv2DLayer", [
        { id: "x1", type: "Conv2DLayer", data: { name: "Conv2D" } },
      ])
    ).toBe("Conv2D2")
  })

  it("suffixes 3 when both Conv2D and Conv2D2 are taken", () => {
    expect(
      nextUniqueNNLayerName("Conv2D", "Conv2DLayer", [
        { id: "x1", type: "Conv2DLayer", data: { name: "Conv2D" } },
        { id: "x2", type: "Conv2DLayer", data: { name: "Conv2D2" } },
      ])
    ).toBe("Conv2D3")
  })

  it("walks past gaps to the first available index", () => {
    // Conv2D and Conv2D3 taken — Conv2D2 is free, pick it (matches v3
    // counter-loop behaviour).
    expect(
      nextUniqueNNLayerName("Conv2D", "Conv2DLayer", [
        { id: "x1", type: "Conv2DLayer", data: { name: "Conv2D" } },
        { id: "x2", type: "Conv2DLayer", data: { name: "Conv2D3" } },
      ])
    ).toBe("Conv2D2")
  })

  it("only collides with same-kind siblings", () => {
    // Same name, different layer kind — no collision.
    expect(
      nextUniqueNNLayerName("Pooling", "PoolingLayer", [
        { id: "x1", type: "Conv2DLayer", data: { name: "Pooling" } },
      ])
    ).toBe("Pooling")
  })

  it("ignores the calling node when re-rendering an existing layer", () => {
    // The node currently named "Conv2D" with id "self" must not collide
    // with itself when the effect re-runs.
    expect(
      nextUniqueNNLayerName(
        "Conv2D",
        "Conv2DLayer",
        [{ id: "self", type: "Conv2DLayer", data: { name: "Conv2D" } }],
        "self"
      )
    ).toBe("Conv2D")
  })
})

/**
 * SA-FIX-NN-DROPS regression — palette drops onto an `NNContainer`
 * must propagate `parentId` so layers nest visually inside the
 * container. Before the fix, neither `isParentNodeType` nor
 * `canDropIntoParent` knew about NN node types, so the drop-handler
 * in `DraggableGhost.tsx` skipped parent assignment and every layer
 * landed at the canvas root.
 *
 * The user-reported symptom was "I can't even put them into the
 * canvas" — drops succeeded technically but appeared at unexpected
 * positions, which read as failure.
 */
import { isParentNodeType } from "@/utils/nodeUtils"
import { canDropIntoParent } from "@/utils/bpmnConstraints"

describe("SA-FIX-NN-DROPS: container drop validation", () => {
  it("treats NNContainer / State / AgentIntent as parent node types", () => {
    expect(isParentNodeType("NNContainer")).toBe(true)
    expect(isParentNodeType("State")).toBe(true)
    expect(isParentNodeType("AgentIntent")).toBe(true)
    // SA-FINAL-3 Tier 5 #19: AgentState bodies are inlined on
    // `data.bodies`, so AgentState is no longer surfaced as a parent
    // here. The drop-handler in `DraggableGhost.tsx` short-circuits
    // before reaching `canDropIntoParent("AgentState", …)`.
    expect(isParentNodeType("AgentState")).toBe(false)
  })

  it("does not surface unrelated nodes as parent types", () => {
    expect(isParentNodeType("Conv2DLayer")).toBe(false)
    expect(isParentNodeType("StateBody")).toBe(false)
    expect(isParentNodeType(undefined)).toBe(false)
  })

  it("allows every NN layer kind into NNContainer", () => {
    const allowed = [
      "Conv1DLayer",
      "Conv2DLayer",
      "Conv3DLayer",
      "PoolingLayer",
      "RNNLayer",
      "LSTMLayer",
      "GRULayer",
      "LinearLayer",
      "FlattenLayer",
      "EmbeddingLayer",
      "DropoutLayer",
      "LayerNormalizationLayer",
      "BatchNormalizationLayer",
      "TensorOp",
      "NNReference",
    ]
    for (const kind of allowed) {
      expect(canDropIntoParent(kind, "NNContainer")).toBe(true)
    }
  })

  it("rejects datasets and configuration from nesting in NNContainer", () => {
    // These bind via NNAssociation edges, not by parentId nesting.
    expect(canDropIntoParent("TrainingDataset", "NNContainer")).toBe(false)
    expect(canDropIntoParent("TestDataset", "NNContainer")).toBe(false)
    expect(canDropIntoParent("Configuration", "NNContainer")).toBe(false)
  })

  it("allows the three legacy body shapes inside a State", () => {
    expect(canDropIntoParent("StateBody", "State")).toBe(true)
    expect(canDropIntoParent("StateFallbackBody", "State")).toBe(true)
    expect(canDropIntoParent("StateCodeBlock", "State")).toBe(true)
    // Nothing else should land inside a State.
    expect(canDropIntoParent("Conv2DLayer", "State")).toBe(false)
    expect(canDropIntoParent("class", "State")).toBe(false)
  })

  it("allows AgentIntent body / description / object component nesting", () => {
    expect(canDropIntoParent("AgentIntentBody", "AgentIntent")).toBe(true)
    expect(canDropIntoParent("AgentIntentDescription", "AgentIntent")).toBe(
      true
    )
    expect(
      canDropIntoParent("AgentIntentObjectComponent", "AgentIntent")
    ).toBe(true)
    expect(canDropIntoParent("Conv2DLayer", "AgentIntent")).toBe(false)
  })

  it("rejects every drop into AgentState (bodies are inlined)", () => {
    // SA-FIX-Agent collapsed entry/do/exit/on/fallback rows onto
    // `AgentState.data.bodies`. AgentState is no longer a real
    // React-Flow parent — return false to prevent accidental nesting
    // when the drop-handler walks intersecting parent candidates.
    expect(canDropIntoParent("AgentIntentBody", "AgentState")).toBe(false)
    expect(canDropIntoParent("AgentIntent", "AgentState")).toBe(false)
  })
})
