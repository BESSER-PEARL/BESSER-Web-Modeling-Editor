/** Visualization-only filtering of RDF/OWL meta-vocabulary nodes.
 *
 * An OWL import is lossless: every triple becomes an edge, so `:Person a
 * owl:Class` materialises an `owl:Class` node with an edge into it. Those
 * declaration nodes are *implied* by the node kind they annotate — a class
 * node is always `rdf:type owl:Class` — so on the canvas they are pure
 * clutter, and in a real ontology they are also the highest-degree nodes in
 * the graph, dragging the layout into a hairball.
 *
 * SHACL shapes work the same way (`:MyShape a sh:NodeShape`). Hidden are the
 * declaration namespaces (owl / rdf / rdfs) plus `sh:NodeShape` and
 * `sh:PropertyShape`; see `HIDDEN_VOCAB_NAMESPACES` and `HIDDEN_VOCAB_IRIS`
 * for why `xsd:` and the rest of `sh:` stay on the canvas.
 *
 * This module only decides what the editor *shows*. The nodes and edges stay
 * in the model, get persisted, and are handed unchanged to the downstream
 * pipelines (RDF export, KG → UML, preflight/consistency checks). The
 * mechanism is the editor's existing visible-id set: a hidden node is simply
 * never added to it, and `mergeWithFullModel` passes anything outside that
 * set through untouched.
 *
 * Users who do want to see them can flip `settings.showMetaVocabNodes` in
 * KG Settings.
 */

import type { KGEdgeData, KGNodeData } from './types';

/** The namespaces whose terms are hidden from the visualization.
 *
 *  Deliberately a *subset* of `META_VOCAB_NAMESPACES` in `edge-rules.ts`:
 *  `xsd:` is left out. An `xsd:string` node is the declared `rdfs:range` of a
 *  datatype property — actual modelled content, not something implied by the
 *  node's own kind — so hiding it would cost information. These three
 *  namespaces only ever carry declarations (`:Person a owl:Class`) that
 *  restate what the node type already says.
 *
 *  `edge-rules.ts` keeps the wider list for its own purposes: `xsd:` terms
 *  still bypass the OWL2 DL edge gate and still render with the `xsd:` prefix
 *  and the Ⓥ chip on the canvas. */
export const HIDDEN_VOCAB_NAMESPACES = [
  'http://www.w3.org/2002/07/owl#',
  'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  'http://www.w3.org/2000/01/rdf-schema#',
] as const;

/** Individually-hidden vocabulary terms, for namespaces we do *not* hide
 *  wholesale.
 *
 *  SHACL: `sh:NodeShape` / `sh:PropertyShape` are declaration targets in
 *  exactly the sense `owl:Class` is — a nodeConstraint node is always
 *  `rdf:type sh:NodeShape`, so drawing the edge restates the node's kind. The
 *  rest of the `sh:` namespace stays visible because those terms appear in
 *  *value* position and carry real constraint content (`sh:IRI`,
 *  `sh:Literal`, `sh:BlankNode` as `sh:nodeKind` values).
 *
 *  Mirrors `SH_NODE_SHAPE` / `SH_PROPERTY_SHAPE` in
 *  `besser/BUML/metamodel/kg/constants.py`. */
export const HIDDEN_VOCAB_IRIS: ReadonlySet<string> = new Set([
  'http://www.w3.org/ns/shacl#NodeShape',
  'http://www.w3.org/ns/shacl#PropertyShape',
]);

function isHiddenVocabIri(iri: string | undefined | null): boolean {
  if (!iri) return false;
  return HIDDEN_VOCAB_IRIS.has(iri) || HIDDEN_VOCAB_NAMESPACES.some((ns) => iri.startsWith(ns));
}

/** True when a node denotes an owl / rdf / rdfs term, or one of the two SHACL
 *  shape types, rather than a user-modelled concept.
 *
 *  Falls back to `id` because OWL-imported nodes use the IRI as their id,
 *  so a node that lost its `iri` field in an older save is still caught. */
export function isMetaVocabNode(n: Pick<KGNodeData, 'iri' | 'id'>): boolean {
  return isHiddenVocabIri(n.iri) || isHiddenVocabIri(n.id);
}

/** Ids of the nodes to keep off the canvas and out of the node list.
 *  Empty when the user has opted into showing vocabulary nodes. */
export function collectHiddenMetaIds(
  nodes: readonly KGNodeData[],
  showMetaVocab: boolean,
): Set<string> {
  if (showMetaVocab) return new Set();
  const hidden = new Set<string>();
  for (const n of nodes) {
    if (isMetaVocabNode(n)) hidden.add(n.id);
  }
  return hidden;
}

/** Drop the hidden nodes and every edge incident to one of them.
 *
 *  Only for read-only consumers (the node list, the header counts). The
 *  Cytoscape canvas must keep receiving the *full* model — it merges its
 *  output back over the model it was given, so feeding it a pruned copy
 *  would delete the vocabulary nodes for real on the next edit. */
export function withoutHiddenNodes<T extends { nodes: KGNodeData[]; edges: KGEdgeData[] }>(
  model: T,
  hiddenIds: ReadonlySet<string>,
): T {
  if (hiddenIds.size === 0) return model;
  return {
    ...model,
    nodes: model.nodes.filter((n) => !hiddenIds.has(n.id)),
    edges: model.edges.filter((e) => !hiddenIds.has(e.source) && !hiddenIds.has(e.target)),
  };
}

/** Remove hidden ids from a list of candidate ids, preserving order. */
export function rejectHidden(ids: readonly string[], hiddenIds: ReadonlySet<string>): string[] {
  if (hiddenIds.size === 0) return ids.slice();
  return ids.filter((id) => !hiddenIds.has(id));
}
