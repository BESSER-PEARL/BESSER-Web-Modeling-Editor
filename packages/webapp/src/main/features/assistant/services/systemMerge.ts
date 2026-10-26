/**
 * Merging an assistant-built system into the open diagram ("Keep and add alongside").
 */

import type { BesserNode } from '@besser/wme';
import type { BESSERModel } from './UMLModelingService';

/** Vertical gap between the existing content and the elements a merge adds. */
const MERGE_GAP_Y = 100;

/** Rows of `incoming` whose id `existing` lacks, appended to `existing`. */
const addMissingRows = (existing: unknown, incoming: unknown) => {
  if (!Array.isArray(existing) || !Array.isArray(incoming)) return existing;
  const ids = new Set(existing.map((row: any) => row?.id));
  return [...existing, ...incoming.filter((row: any) => !ids.has(row?.id))];
};

/**
 * Merge a complete system (v4 model) into an existing model. Elements the
 * system shares with the model (same id) keep their current state; a shared
 * class only gains the attributes and methods it did not have.
 */
export function mergeSystemIntoModel(currentModel: BESSERModel, systemData: any): BESSERModel {
  const current = currentModel as any;
  const nodes: any[] = [...(current.nodes ?? [])];
  const indexById = new Map(nodes.map((node, index) => [node.id, index]));
  for (const node of (systemData?.nodes ?? []) as any[]) {
    const index = indexById.get(node.id);
    if (index === undefined) {
      nodes.push(node);
      continue;
    }
    const data = { ...nodes[index].data };
    for (const key of ['attributes', 'methods']) {
      data[key] = addMissingRows(data[key], node.data?.[key]);
    }
    nodes[index] = { ...nodes[index], data };
  }
  const edgeIds = new Set((current.edges ?? []).map((edge: any) => edge.id));
  const edges = [
    ...(current.edges ?? []),
    ...((systemData?.edges ?? []) as any[]).filter((edge) => !edgeIds.has(edge.id)),
  ];
  return {
    ...current,
    nodes,
    edges,
    // AgentDiagram: off-canvas components (intents, LLMs, ...); existing entries win.
    ...(systemData?.components && { components: { ...systemData.components, ...(current.components ?? {}) } }),
  } as BESSERModel;
}

const extent = (nodes: BesserNode[]) => {
  if (!nodes.length) return null;
  return {
    minX: Math.min(...nodes.map((n) => n.position.x)),
    minY: Math.min(...nodes.map((n) => n.position.y)),
    maxY: Math.max(...nodes.map((n) => n.position.y + (n.height ?? n.measured?.height ?? 0))),
  };
};

/** Move the top-level nodes of ``system`` that ``existingModel`` lacks below the existing content (in place). */
export function placeBelow(system: any, existingModel: any): any {
  const existingNodes: BesserNode[] = (existingModel?.nodes ?? []).filter((n: BesserNode) => !n.parentId);
  const existingIds = new Set((existingModel?.nodes ?? []).map((n: BesserNode) => n.id));
  const added: BesserNode[] = (system?.nodes ?? []).filter(
    (n: BesserNode) => !n.parentId && !existingIds.has(n.id),
  );
  const existing = extent(existingNodes);
  const incoming = extent(added);
  if (!existing || !incoming) return system;
  const dx = existing.minX - incoming.minX;
  const dy = existing.maxY + MERGE_GAP_Y - incoming.minY;
  added.forEach((n) => {
    n.position = { x: n.position.x + dx, y: n.position.y + dy };
  });
  return system;
}
