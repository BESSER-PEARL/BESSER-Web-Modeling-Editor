/**
 * Graph-aware NN predecessor resolution. Source-of-truth port of
 * develop's `_computePredecessors`
 * (`nn-diagram/nn-component/optional-attribute-row.tsx`): starting at a
 * layer, transitively walk **incoming `NNNext` edges** (DFS, visited
 * set) and collect every upstream node that carries a non-empty name —
 * TensorOps and NNReferences included, no container/parentId filter.
 *
 * The result feeds the `name_module_input` predecessor dropdown and the
 * TensorOp `layers_of_tensors` dual dropdowns. Order is nearest-first
 * (direct predecessors before their own predecessors), matching
 * develop's DFS emission order. The stored attribute value is the
 * predecessor's **name** string (the backend matches by name).
 *
 * Zero-dependency on React Flow types so pure-helper tests can import
 * it directly (same constraint as `bpmnConstraints.ts`).
 */

export interface MinimalNNNode {
  id: string
  type?: string
  /** Loose payload — `name` is narrowed at read time so React Flow's
   * `Record<string, unknown>` node data is accepted without casts. */
  data?: { name?: unknown } | null
}

export interface MinimalNNEdge {
  type?: string
  source: string
  target: string
}

export interface NNPredecessor {
  id: string
  name: string
}

export function computeNNPredecessors(
  nodes: ReadonlyArray<MinimalNNNode>,
  edges: ReadonlyArray<MinimalNNEdge>,
  targetId: string
): NNPredecessor[] {
  const nodeById = new Map(nodes.map((n) => [n.id, n]))
  const result: NNPredecessor[] = []
  const visited = new Set<string>([targetId])

  // Preorder DFS, exactly like develop's recursive `visit`: each direct
  // predecessor is emitted before its own predecessors are walked.
  const visit = (current: string) => {
    for (const edge of edges) {
      if (edge.type !== "NNNext") continue
      if (edge.target !== current) continue
      const upstreamId = edge.source
      if (visited.has(upstreamId)) continue
      visited.add(upstreamId)
      const name = nodeById.get(upstreamId)?.data?.name
      if (typeof name === "string" && name.length > 0) {
        result.push({ id: upstreamId, name })
      }
      visit(upstreamId)
    }
  }
  visit(targetId)

  return result
}
