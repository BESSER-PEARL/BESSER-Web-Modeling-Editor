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
