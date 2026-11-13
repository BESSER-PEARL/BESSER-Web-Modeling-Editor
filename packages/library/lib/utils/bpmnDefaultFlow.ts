/**
 * Default-flow hygiene for BPMN sequence flows (BPMN 2.0.2 § 8.3.13).
 *
 * Ports the old editor's one-default-per-source rule (bpmn-flow-update.tsx),
 * the gateway-type-change clear (bpmn-gateway-update.tsx), the flip clear and
 * the RECONNECT saga (bpmn-flow-default-saga.ts). Without these a stale
 * `data.isDefault` keeps drawing the default slash and only surfaces later as
 * a `default-flow-illegal-source` validation warning.
 *
 * Pure and structurally typed, so it works on React Flow nodes/edges and plain
 * v4 JSON alike. Every helper returns the input array unchanged (same
 * reference) when nothing had to change.
 */
import { canSourceCarryDefault } from "@/services/bpmnFlowValidation"

export interface DefaultFlowEdgeLike {
  id: string
  source: string
  target: string
  type?: string
  data?: Record<string, unknown> | object | null
}

export interface DefaultFlowNodeLike {
  id: string
  type?: string
  data?: Record<string, unknown> | object | null
}

const SEQUENCE_FLOW = "BPMNSequenceFlow"

const isDefaultFlag = (edge: DefaultFlowEdgeLike): boolean =>
  !!(edge.data as { isDefault?: unknown } | null | undefined)?.isDefault

const withDefault = <E extends DefaultFlowEdgeLike>(edge: E, isDefault: boolean): E => ({
  ...edge,
  data: { ...(edge.data ?? {}), isDefault },
})

/**
 * Sets `isDefault` on one sequence flow. Turning it ON clears the flag on
 * every other sequence flow leaving the same source — a source has at most
 * one default flow.
 */
export function setBpmnDefaultFlow<E extends DefaultFlowEdgeLike>(
  edges: E[],
  edgeId: string,
  isDefault: boolean
): E[] {
  const target = edges.find((e) => e.id === edgeId)
  if (!target) return edges
  let changed = false
  const next = edges.map((edge) => {
    if (edge.id === edgeId) {
      if (isDefaultFlag(edge) === isDefault) return edge
      changed = true
      return withDefault(edge, isDefault)
    }
    if (
      isDefault &&
      edge.source === target.source &&
      edge.type === SEQUENCE_FLOW &&
      isDefaultFlag(edge)
    ) {
      changed = true
      return withDefault(edge, false)
    }
    return edge
  })
  return changed ? next : edges
}

/**
 * Clears `isDefault` on every flow whose (current) source cannot carry a
 * default flow, and on any default-flagged edge that is not a sequence flow.
 * Restrict to a set of edge ids / a source node with `options`.
 */
export function clearIneligibleBpmnDefaults<E extends DefaultFlowEdgeLike>(
  nodes: readonly DefaultFlowNodeLike[],
  edges: E[],
  options: { edgeIds?: readonly string[]; sourceId?: string } = {}
): E[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  let changed = false
  const next = edges.map((edge) => {
    if (!isDefaultFlag(edge)) return edge
    if (options.edgeIds && !options.edgeIds.includes(edge.id)) return edge
    if (options.sourceId && edge.source !== options.sourceId) return edge
    const source = byId.get(edge.source)
    const eligible =
      edge.type === SEQUENCE_FLOW &&
      canSourceCarryDefault(source as Parameters<typeof canSourceCarryDefault>[0])
    if (eligible) return edge
    changed = true
    return withDefault(edge, false)
  })
  return changed ? next : edges
}

/**
 * The `isDefault` value a flow should keep once `newSource` becomes its
 * source (flip / reconnect): unchanged when the new source may carry a
 * default, otherwise `false`.
 */
export function defaultFlagAfterSourceChange(
  edge: DefaultFlowEdgeLike,
  newSource: DefaultFlowNodeLike | undefined
): boolean {
  if (!isDefaultFlag(edge)) return false
  return (
    edge.type === SEQUENCE_FLOW &&
    canSourceCarryDefault(newSource as Parameters<typeof canSourceCarryDefault>[0])
  )
}
