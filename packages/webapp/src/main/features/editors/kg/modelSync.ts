/**
 * Helpers for keeping the editor's local model in step with the project store.
 *
 * The editor persists its model (debounced) and then receives the saved
 * diagram back through the store. It must tell "the store echoed what I just
 * saved" apart from "something else replaced the model", because the second
 * case resets editor state and the first must not.
 */
import type { KgSelection } from './KnowledgeGraphInspector';
import type { KnowledgeGraphData } from './types';

/** JSON with object keys sorted, so equal content compares equal whatever order
 *  the pieces were assembled in (spread, storage round trip, Cytoscape). */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/** The model minus `settings.visibleIds`. Which nodes are on the canvas is view
 *  state the editor owns in React state and merely writes into the saved
 *  settings, so a difference there is not a change to the graph. */
function withoutViewState(model: KnowledgeGraphData): KnowledgeGraphData {
  if (!model.settings) return model;
  const settings = { ...model.settings };
  delete settings.visibleIds;
  const copy = { ...model };
  if (Object.keys(settings).length > 0) copy.settings = settings;
  else delete copy.settings;
  return copy;
}

/** True when two models hold the same graph and settings, ignoring visibleIds. */
export function sameKgContent(a: KnowledgeGraphData, b: KnowledgeGraphData): boolean {
  return stableStringify(withoutViewState(a)) === stableStringify(withoutViewState(b));
}

/** Keep the part of `selection` that still exists in `model`; null if none does.
 *  Returns the very same object when nothing was pruned. */
export function pruneSelection(selection: KgSelection, model: KnowledgeGraphData): KgSelection {
  if (!selection) return selection;
  const nodeIds = new Set(model.nodes.map((n) => n.id));
  const edgeIds = new Set(model.edges.map((e) => e.id));
  switch (selection.kind) {
    case 'node':
      return nodeIds.has(selection.id) ? selection : null;
    case 'edge':
      return edgeIds.has(selection.id) ? selection : null;
    case 'multi': {
      const keptNodes = selection.nodeIds.filter((id) => nodeIds.has(id));
      const keptEdges = selection.edgeIds.filter((id) => edgeIds.has(id));
      if (keptNodes.length === 0 && keptEdges.length === 0) return null;
      if (keptNodes.length === selection.nodeIds.length && keptEdges.length === selection.edgeIds.length) {
        return selection;
      }
      return { kind: 'multi', nodeIds: keptNodes, edgeIds: keptEdges };
    }
  }
}
