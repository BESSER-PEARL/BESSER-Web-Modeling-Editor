import type { KnowledgeGraphData } from './types';

/** Remove a selection (nodes and/or relations) from the model.
 *
 *  Deleting a node also deletes every relation attached to it — an edge whose
 *  source or target is gone would be dangling, and the canvas drops those
 *  silently anyway (see `mergeWithFullModel` in `CytoscapeCanvas.tsx`). Doing
 *  it here keeps the confirmation prompt honest about what disappears.
 *
 *  Returns the same object when the selection is empty, so callers can pass
 *  the result straight to `onChange` without triggering a needless save. */
export function deleteSelectionFromModel(
  model: KnowledgeGraphData,
  nodeIds: readonly string[],
  edgeIds: readonly string[],
): KnowledgeGraphData {
  if (nodeIds.length === 0 && edgeIds.length === 0) return model;
  const nodeSet = new Set(nodeIds);
  const edgeSet = new Set(edgeIds);
  return {
    ...model,
    nodes: model.nodes.filter((n) => !nodeSet.has(n.id)),
    edges: model.edges.filter(
      (e) => !edgeSet.has(e.id) && !nodeSet.has(e.source) && !nodeSet.has(e.target),
    ),
  };
}
