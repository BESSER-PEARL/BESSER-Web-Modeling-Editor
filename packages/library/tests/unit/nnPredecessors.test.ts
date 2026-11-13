/**
 * Wave-3 NN-2 — graph-aware predecessor resolution.
 *
 * v3 source of truth: `nn-diagram/nn-component/optional-attribute-row.tsx`
 * `_computePredecessors` (567-609): preorder DFS over incoming `NNNext`
 * edges with a visited set; upstream-only candidates INCLUDING
 * TensorOps; no container/parentId filter; nearest-first order.
 */
import { describe, it, expect } from "vitest"
import {
  computeNNPredecessors,
  type MinimalNNEdge,
  type MinimalNNNode,
} from "@/utils/nnPredecessors"

const node = (id: string, type: string, name = id): MinimalNNNode => ({
  id,
  type,
  data: { name },
})

const next = (source: string, target: string): MinimalNNEdge => ({
  type: "NNNext",
  source,
  target,
})

describe("computeNNPredecessors", () => {
  it("walks a chain A→B→C nearest-first: candidates(C) = [B, A]", () => {
    const nodes = [
      node("a", "Conv2DLayer", "A"),
      node("b", "PoolingLayer", "B"),
      node("c", "LinearLayer", "C"),
    ]
    const edges = [next("a", "b"), next("b", "c")]
    expect(computeNNPredecessors(nodes, edges, "c")).toEqual([
      { id: "b", name: "B" },
      { id: "a", name: "A" },
    ])
  })

  it("includes upstream TensorOps and NNReferences", () => {
    const nodes = [
      node("t", "TensorOp", "Reshape1"),
      node("r", "NNReference", "RefA"),
      node("c", "LinearLayer", "C"),
    ]
    const edges = [next("t", "c"), next("r", "t")]
    expect(computeNNPredecessors(nodes, edges, "c")).toEqual([
      { id: "t", name: "Reshape1" },
      { id: "r", name: "RefA" },
    ])
  })

  it("excludes downstream and unconnected siblings", () => {
    const nodes = [
      node("a", "Conv2DLayer", "A"),
      node("b", "PoolingLayer", "B"),
      node("down", "LinearLayer", "Down"),
      node("island", "DropoutLayer", "Island"),
    ]
    const edges = [next("a", "b"), next("b", "down")]
    expect(computeNNPredecessors(nodes, edges, "b")).toEqual([
      { id: "a", name: "A" },
    ])
  })

  it("resolves nodes outside containers (no parentId filter)", () => {
    // Un-parented nodes were invisible to the old flat-sibling filter.
    const nodes: MinimalNNNode[] = [
      { id: "a", type: "Conv2DLayer", data: { name: "A" } },
      { id: "b", type: "LinearLayer", data: { name: "B" } },
    ]
    expect(computeNNPredecessors(nodes, [next("a", "b")], "b")).toEqual([
      { id: "a", name: "A" },
    ])
  })

  it("is cycle-safe (A→B→A)", () => {
    const nodes = [node("a", "Conv2DLayer", "A"), node("b", "PoolingLayer", "B")]
    const edges = [next("a", "b"), next("b", "a")]
    expect(computeNNPredecessors(nodes, edges, "b")).toEqual([
      { id: "a", name: "A" },
    ])
    expect(computeNNPredecessors(nodes, edges, "a")).toEqual([
      { id: "b", name: "B" },
    ])
  })

  it("skips unnamed upstream nodes but keeps walking through them", () => {
    const nodes: MinimalNNNode[] = [
      { id: "a", type: "Conv2DLayer", data: { name: "A" } },
      { id: "anon", type: "TensorOp", data: { name: "" } },
      { id: "c", type: "LinearLayer", data: { name: "C" } },
    ]
    const edges = [next("a", "anon"), next("anon", "c")]
    expect(computeNNPredecessors(nodes, edges, "c")).toEqual([
      { id: "a", name: "A" },
    ])
  })

  it("ignores non-NNNext edges", () => {
    const nodes = [
      node("cfg", "Configuration", "Cfg"),
      node("k", "NNContainer", "NN"),
      node("c", "LinearLayer", "C"),
    ]
    const edges: MinimalNNEdge[] = [
      { type: "NNComposition", source: "cfg", target: "k" },
      { type: "NNAssociation", source: "k", target: "c" },
    ]
    expect(computeNNPredecessors(nodes, edges, "c")).toEqual([])
  })
})
