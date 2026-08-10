/** Which nodes win a seat on the canvas when there are more of them than the
 *  limits allow.
 *
 *  A real ontology has far more individuals and literals than classes, and the
 *  schema-level nodes are what a user wants to see first: they carry the shape
 *  of the graph, while instance data is detail you drill into. So every place
 *  that has to truncate a candidate list ranks by this order rather than by
 *  whatever order the nodes happen to sit in the model:
 *
 *    class → property → blank → nodeConstraint → propertyConstraint
 *          → individual → literal
 *
 *  Ranking is always *stable*: within one node type the original model order
 *  survives, so a seed stays reproducible across reloads.
 */

import type { KGNodeData, KGNodeType } from './types';

/** Lower number = shown first. */
export const KG_NODE_DISPLAY_PRIORITY: Record<KGNodeType, number> = {
  class: 0,
  property: 1,
  blank: 2,
  nodeConstraint: 3,
  propertyConstraint: 4,
  individual: 5,
  literal: 6,
};

/** Rank of a node type; unknown / missing types sort last. */
export function kgNodePriority(nodeType: KGNodeType | undefined): number {
  if (!nodeType) return 99;
  return KG_NODE_DISPLAY_PRIORITY[nodeType] ?? 99;
}

/** Copy of `nodes` ordered by display priority, ties keeping model order. */
export function sortNodesByPriority<T extends Pick<KGNodeData, 'nodeType'>>(
  nodes: readonly T[],
): T[] {
  return nodes
    .map((node, index) => ({ node, index }))
    .sort((a, b) => kgNodePriority(a.node.nodeType) - kgNodePriority(b.node.nodeType) || a.index - b.index)
    .map((entry) => entry.node);
}

/** The `limit` highest-priority node ids out of `nodes`. */
export function pickNodeIdsByPriority(
  nodes: readonly KGNodeData[],
  limit: number,
): string[] {
  if (limit <= 0) return [];
  return sortNodesByPriority(nodes).slice(0, limit).map((n) => n.id);
}

/** Order a list of candidate ids by the priority of the nodes they name.
 *  Ids with no matching node keep the "unknown" rank and sort last. */
export function sortIdsByPriority(
  ids: readonly string[],
  nodesById: ReadonlyMap<string, Pick<KGNodeData, 'nodeType'>>,
): string[] {
  return ids
    .map((id, index) => ({ id, index, prio: kgNodePriority(nodesById.get(id)?.nodeType) }))
    .sort((a, b) => a.prio - b.prio || a.index - b.index)
    .map((entry) => entry.id);
}
