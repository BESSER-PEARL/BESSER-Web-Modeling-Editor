/**
 * Wave-3 NN connection validation tests.
 *
 * v3 source of truth: `nn-diagram/nn-association/nn-association-monitor.tsx`
 *  - `checkAndUpdateAssociations` (122-159) auto-deleted any `NNNext`
 *    touching NNContainer / Configuration / Datasets and any
 *    `NNAssociation` that wasn't Dataset ↔ NNContainer,
 *  - `enforceConfigurationSingleton` (46-65) kept at most one
 *    Configuration per container.
 *
 * The v4 port is the diagram-scoped rule module
 * (`services/connectionRules/nnDiagramRules.ts`) consulted by the
 * shared `canConnectEndpoints` predicate, expressed as up-front
 * `isValidConnection` rejection instead of develop's create-then-delete.
 */
import { describe, it, expect } from "vitest"
import { nnConnectionRule } from "@/services/connectionRules"
import { canConnectEndpoints } from "@/utils/bpmnConstraints"
import type {
  MinimalRuleEdge,
  MinimalRuleNode,
} from "@/services/connectionRules"

const node = (id: string, type: string): MinimalRuleNode => ({
  id,
  type,
  data: { name: id },
})

const NODES: MinimalRuleNode[] = [
  node("container-1", "NNContainer"),
  node("container-2", "NNContainer"),
  node("config-1", "Configuration"),
  node("config-2", "Configuration"),
  node("train-1", "TrainingDataset"),
  node("test-1", "TestDataset"),
  node("conv-1", "Conv2DLayer"),
  node("tensor-1", "TensorOp"),
  node("ref-1", "NNReference"),
  node("comment-1", "comment"),
]

const byId = (id: string) => NODES.find((n) => n.id === id)

const verdict = (
  sourceId: string,
  targetId: string,
  edges: MinimalRuleEdge[] = []
) =>
  nnConnectionRule({
    nodes: NODES,
    sourceNode: byId(sourceId),
    targetNode: byId(targetId),
    edges,
  })

describe("nnConnectionRule — allow matrix", () => {
  it("allows dataset ↔ container (both directions)", () => {
    expect(verdict("train-1", "container-1")).toBe(true)
    expect(verdict("container-1", "train-1")).toBe(true)
    expect(verdict("test-1", "container-1")).toBe(true)
  })

  it("allows container ↔ container (NNComposition)", () => {
    expect(verdict("container-1", "container-2")).toBe(true)
  })

  it("allows config ↔ container when no binding exists", () => {
    expect(verdict("config-1", "container-1")).toBe(true)
    expect(verdict("container-1", "config-1")).toBe(true)
  })

  it("has no opinion on flow ↔ flow (NNNext stays allowed)", () => {
    expect(verdict("conv-1", "tensor-1")).toBeUndefined()
    expect(verdict("tensor-1", "ref-1")).toBeUndefined()
  })

  it("has no opinion on comment tethering", () => {
    expect(verdict("comment-1", "container-1")).toBeUndefined()
    expect(verdict("config-1", "comment-1")).toBeUndefined()
  })
})

describe("nnConnectionRule — reject matrix (develop's auto-deletions)", () => {
  it("rejects dataset ↔ layer", () => {
    expect(verdict("train-1", "conv-1")).toBe(false)
    expect(verdict("conv-1", "train-1")).toBe(false)
  })

  it("rejects configuration ↔ layer", () => {
    expect(verdict("config-1", "conv-1")).toBe(false)
  })

  it("rejects container ↔ layer", () => {
    expect(verdict("container-1", "conv-1")).toBe(false)
    expect(verdict("tensor-1", "container-1")).toBe(false)
  })

  it("rejects dataset ↔ dataset", () => {
    expect(verdict("train-1", "test-1")).toBe(false)
  })

  it("rejects config ↔ config", () => {
    expect(verdict("config-1", "config-2")).toBe(false)
  })

  it("rejects dataset ↔ config", () => {
    expect(verdict("train-1", "config-1")).toBe(false)
  })
})

describe("nnConnectionRule — Configuration singleton", () => {
  const binding = (
    source: string,
    target: string,
    type = "NNComposition"
  ): MinimalRuleEdge => ({ id: `${source}-${target}`, type, source, target })

  it("rejects a second configuration on an already-bound container", () => {
    expect(
      verdict("config-2", "container-1", [binding("config-1", "container-1")])
    ).toBe(false)
    // Either edge direction counts as a binding.
    expect(
      verdict("config-2", "container-1", [binding("container-1", "config-1")])
    ).toBe(false)
  })

  it("rejects binding an already-bound configuration to a second container", () => {
    expect(
      verdict("config-1", "container-2", [binding("config-1", "container-1")])
    ).toBe(false)
  })

  it("allows re-connecting the same config/container pair", () => {
    expect(
      verdict("config-1", "container-1", [binding("config-1", "container-1")])
    ).toBe(true)
  })

  it("ignores non-composition edges when counting bindings", () => {
    expect(
      verdict("config-2", "container-1", [
        binding("train-1", "container-1", "NNAssociation"),
      ])
    ).toBe(true)
  })

  it("allows one config per container across containers", () => {
    expect(
      verdict("config-2", "container-2", [binding("config-1", "container-1")])
    ).toBe(true)
  })
})

describe("canConnectEndpoints — NN rules ride the shared pipeline", () => {
  it("vetoes a dataset → layer drag end-to-end", () => {
    expect(
      canConnectEndpoints(NODES, "train-1", "conv-1", undefined, [])
    ).toBe(false)
  })

  it("threads existing edges into the singleton check", () => {
    const edges: MinimalRuleEdge[] = [
      {
        id: "b1",
        type: "NNComposition",
        source: "config-1",
        target: "container-1",
      },
    ]
    expect(
      canConnectEndpoints(NODES, "config-2", "container-1", undefined, edges)
    ).toBe(false)
    expect(
      canConnectEndpoints(NODES, "config-2", "container-2", undefined, edges)
    ).toBe(true)
  })

  it("defaults to no edge list (endpoint-only callers keep working)", () => {
    expect(canConnectEndpoints(NODES, "config-1", "container-1")).toBe(true)
  })
})
