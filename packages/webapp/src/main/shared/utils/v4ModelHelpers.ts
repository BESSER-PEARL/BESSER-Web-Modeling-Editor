/**
 * SA-7b: helpers for walking v4 UMLModel `nodes` / `edges` arrays.
 *
 * v3 stored elements as a `Record<id, UMLElement>` and relationships as a
 * `Record<id, UMLRelationship>`; v4 uses `nodes: BesserNode[]` and
 * `edges: BesserEdge[]`. These helpers cover the common access patterns so
 * call sites don't open-code the same `.find()` / `.filter()` traversals.
 */
import type { BesserEdge, BesserNode, UMLModel } from '@besser/wme';

/** Find a node by id. Returns `undefined` if not present. */
export function findNode(model: Pick<UMLModel, 'nodes'> | undefined, id: string): BesserNode | undefined {
  return model?.nodes?.find((n) => n.id === id);
}

/** Find an edge by id. Returns `undefined` if not present. */
export function findEdge(model: Pick<UMLModel, 'edges'> | undefined, id: string): BesserEdge | undefined {
  return model?.edges?.find((e) => e.id === id);
}

/** Filter nodes by `type`. Empty array if model is undefined. */
export function nodesOfType<T extends string>(
  model: Pick<UMLModel, 'nodes'> | undefined,
  type: T,
): BesserNode[] {
  return (model?.nodes ?? []).filter((n) => n.type === type);
}

/** Filter edges by `type`. Empty array if model is undefined. */
export function edgesOfType<T extends string>(
  model: Pick<UMLModel, 'edges'> | undefined,
  type: T,
): BesserEdge[] {
  return (model?.edges ?? []).filter((e) => e.type === type);
}

/** All edges incident to (touching) a node id. */
export function edgesFor(
  model: Pick<UMLModel, 'edges'> | undefined,
  nodeId: string,
): BesserEdge[] {
  return (model?.edges ?? []).filter((e) => e.source === nodeId || e.target === nodeId);
}

/** Children of a parent node (React-Flow `parentId` lookup). */
export function childrenOf(
  model: Pick<UMLModel, 'nodes'> | undefined,
  parentId: string,
): BesserNode[] {
  return (model?.nodes ?? []).filter((n) => n.parentId === parentId);
}

/** Total number of nodes in a model. Safe on undefined. */
export function nodeCount(model: Pick<UMLModel, 'nodes'> | undefined): number {
  return model?.nodes?.length ?? 0;
}

/** Total number of edges in a model. Safe on undefined. */
export function edgeCount(model: Pick<UMLModel, 'edges'> | undefined): number {
  return model?.edges?.length ?? 0;
}

/** Whether a model has any nodes or edges. Safe on undefined. */
export function hasModelContent(model: Pick<UMLModel, 'nodes' | 'edges'> | undefined): boolean {
  return nodeCount(model) > 0 || edgeCount(model) > 0;
}
