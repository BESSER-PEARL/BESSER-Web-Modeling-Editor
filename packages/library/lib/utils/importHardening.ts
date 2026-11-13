import type { BesserEdge, BesserNode, UMLModel } from "@/typings"

/**
 * Contract-neutral hardening applied to every model the editor loads
 * (ported from upstream Apollon's `stripRuntimeInteractionState` and the
 * `EdgeTransformer` null-data guard). Neither pass changes what a clean v4
 * model looks like: both return the input by reference when there is
 * nothing to repair, and the repaired shape is exactly what
 * `docs/source/migrations/uml-v4-shape.md` already requires.
 */

type RuntimeFlags = {
  selected?: unknown
  dragging?: unknown
  resizing?: unknown
}

/**
 * Remove React Flow interaction state that older exports, captured fixtures
 * or hand-written templates can carry. A loaded model must contain only
 * durable diagram data -- not the selection or drag state of the editor
 * that produced the file (a persisted `selected: true` would open with the
 * element pre-selected and lift it above its neighbours; a persisted
 * `dragging: true` suppresses discrete-change notifications).
 */
export function stripRuntimeInteractionState(model: UMLModel): UMLModel {
  let changed = false

  const nodes = model.nodes.map((node) => {
    if (!("selected" in node) && !("dragging" in node) && !("resizing" in node)) {
      return node
    }
    changed = true
    const persistent = { ...node } as BesserNode & RuntimeFlags
    delete persistent.selected
    delete persistent.dragging
    delete persistent.resizing
    return persistent as BesserNode
  })

  const edges = model.edges.map((edge) => {
    if (!("selected" in edge)) return edge
    changed = true
    const persistent = { ...edge } as BesserEdge & RuntimeFlags
    delete persistent.selected
    return persistent as BesserEdge
  })

  return changed ? { ...model, nodes, edges } : model
}

/**
 * Legacy / malformed payloads can carry a `null` or absent edge `data`, or
 * data without `points`. Edge renderers and the v4 normalizers dereference
 * `edge.data.points`, so normalize to the canonical empty point list
 * instead of throwing mid-load. Does not mutate the input.
 */
export function hydrateEdgeData(edge: BesserEdge): BesserEdge {
  const data = edge.data as
    | (Record<string, unknown> & { points?: unknown })
    | null
    | undefined
  if (data != null && typeof data === "object" && Array.isArray(data.points)) {
    return edge
  }
  const base = data != null && typeof data === "object" ? data : {}
  return { ...edge, data: { ...base, points: [] } } as BesserEdge
}

/** Run both passes; also tolerates a model missing its node / edge lists. */
export function hardenImportedModel(model: UMLModel): UMLModel {
  const withLists =
    Array.isArray(model.nodes) && Array.isArray(model.edges)
      ? model
      : {
          ...model,
          nodes: Array.isArray(model.nodes) ? model.nodes : [],
          edges: Array.isArray(model.edges) ? model.edges : [],
        }
  const edges = withLists.edges.map(hydrateEdgeData)
  const hydrated = edges.some((edge, i) => edge !== withLists.edges[i])
    ? { ...withLists, edges }
    : withLists
  return stripRuntimeInteractionState(hydrated)
}
