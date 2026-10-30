import type { BesserEdge, BesserNode, UMLModel } from '@besser/wme';

/** Shared builders and queries for the inter-diagram tests (v4 models). */

export type Box = { x: number; y: number; width: number; height: number };

export function makeModel(
  type: string,
  nodes: BesserNode[] = [],
  edges: BesserEdge[] = [],
  extra: Partial<UMLModel> = {},
): UMLModel {
  return { version: '4.0.0', id: 'm', title: 'M', type, nodes, edges, assessments: {}, ...extra } as UMLModel;
}

/** A node; `box` is relative to `parentId`. */
export function makeNode(
  id: string,
  type: string,
  data: Record<string, unknown>,
  box: Box = { x: 0, y: 0, width: 100, height: 60 },
  parentId?: string,
): BesserNode {
  return {
    id,
    type,
    position: { x: box.x, y: box.y },
    width: box.width,
    height: box.height,
    measured: { width: box.width, height: box.height },
    data,
    ...(parentId && { parentId }),
  } as BesserNode;
}

export function makeEdge(
  id: string,
  type: string,
  source: string,
  target: string,
  data: Record<string, unknown> = {},
  [sourceHandle, targetHandle]: [string, string] = ['right', 'left'],
): BesserEdge {
  return { id, type, source, target, sourceHandle, targetHandle, data: { points: [], ...data } } as BesserEdge;
}

export const nodesOfType = (model: UMLModel, type: string): BesserNode[] => model.nodes.filter((n) => n.type === type);

export const nameOf = (node: BesserNode | undefined): string => String(node?.data.name ?? '');

/** First node with this `data.name` (and type, when given). */
export const nodeNamed = (model: UMLModel, name: string, type?: string): BesserNode | undefined =>
  model.nodes.find((n) => n.data.name === name && (type === undefined || n.type === type));

export const nodeById = (model: UMLModel, id: string | undefined): BesserNode | undefined =>
  model.nodes.find((n) => n.id === id);

/** `data[key]` of a node or edge, typed by the caller. */
export const field = <T = unknown>(x: { data: Record<string, unknown> } | undefined, key: string): T =>
  x?.data[key] as T;

/** Absolute box of a node (positions are relative to the parent). */
export function absBox(model: UMLModel, node: BesserNode): Box {
  let { x, y } = node.position;
  const seen = new Set([node.id]);
  for (let p = nodeById(model, node.parentId); p && !seen.has(p.id); p = nodeById(model, p.parentId)) {
    seen.add(p.id);
    x += p.position.x;
    y += p.position.y;
  }
  return { x, y, width: node.width, height: node.height };
}
