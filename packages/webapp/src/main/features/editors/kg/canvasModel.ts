/**
 * Pure model <-> Cytoscape translation for the KG canvas.
 *
 * Kept free of React and of the live Cytoscape instance (a `Core` is only read)
 * so the round trip can be tested: every edit on the canvas goes
 * `cyToModel` -> `mergeWithFullModel` -> storage, and a field lost anywhere in
 * that chain is silently dropped from the user's saved graph.
 *
 * A node carries TWO labels in Cytoscape's `data`:
 *  - `label`        the stored label, exactly as in the model. Round-trips.
 *  - `displayLabel` what the canvas draws (vocabulary prefix + chip, or a name
 *                   derived from the IRI when the stored label is empty).
 *                   Never written back to the model.
 */
import type { Core, ElementDefinition } from 'cytoscape';
import { formatVocabLabel, isMetaVocab } from './edge-rules';
import type { KGEdgeData, KGNodeData, KGNodeType, KnowledgeGraphData } from './types';

export function filterVisible(model: KnowledgeGraphData, visibleIdList: string[]): KnowledgeGraphData {
  const visibleSet = new Set(visibleIdList);
  if (visibleSet.size === 0) return { ...model, nodes: [], edges: [] };
  const visibleNodes = model.nodes.filter((n) => visibleSet.has(n.id));
  const visibleEdges = model.edges.filter((e) => visibleSet.has(e.source) && visibleSet.has(e.target));
  return { ...model, nodes: visibleNodes, edges: visibleEdges };
}

/** Derive a non-empty display label for any node. OWL classes / properties can
 *  come back from the backend with `label = ""` (no rdfs:label, trailing-slash
 *  IRI with an empty local name). An empty label combined with the
 *  `width: 'label'` stylesheet rule renders those nodes as 0×0 pixels — they
 *  are on the canvas but invisible, which looked like "class nodes are hidden". */
export function displayLabel(n: KGNodeData): string {
  // Vocabulary terms (owl:, rdf:, rdfs:, xsd:, sh:) always render with their
  // namespace prefix and a trailing chip glyph so the user can tell them
  // apart from user-defined classes/individuals at a glance. The IRI takes
  // precedence over `n.label` here because the backend often gives vocab
  // nodes a bare local-name label ("Class", "string", …) which would
  // otherwise be indistinguishable from a user concept.
  const vocab = formatVocabLabel(n.iri);
  if (vocab) return `${vocab} Ⓥ`; // U+24CB = encircled latin small v
  const raw = (n.label ?? '').toString().trim();
  if (raw) return raw;
  if (n.nodeType === 'literal') return n.value != null && String(n.value).trim() !== '' ? String(n.value) : '""';
  if (n.nodeType === 'blank') return '_:';
  const iri = (n.iri ?? n.id ?? '').toString();
  if (!iri) return '?';
  if (iri.startsWith('_:')) return iri;
  if (iri.includes('#')) {
    const after = iri.split('#').pop() ?? '';
    if (after) return after;
  }
  if (iri.includes('/')) {
    const parts = iri.split('/').filter(Boolean);
    const last = parts[parts.length - 1];
    if (last) return last;
  }
  return iri;
}

/** The Cytoscape `data` of a node apart from its id: every field `cyToModel`
 *  turns back into the model, plus the derived `displayLabel` / `isVocab`.
 *  Shared by `modelToElements` (first render) and `syncElementData` (an edit
 *  made outside the canvas, e.g. in the inspector) so the two cannot drift. */
function nodeContentData(n: KGNodeData): Record<string, unknown> {
  return {
    // Stored label, untouched; `displayLabel` is what gets drawn.
    label: n.label ?? '',
    displayLabel: displayLabel(n),
    nodeType: n.nodeType,
    iri: n.iri,
    value: n.value,
    datatype: n.datatype,
    // Carry metadata through Cytoscape so cyToModel can put it back on
    // the re-emitted KGNodeData. Critical for constraint nodes, whose
    // `metadata.constraintSpecs` would otherwise be silently dropped on
    // every canvas interaction.
    metadata: n.metadata,
    // Tag vocabulary nodes (owl:/rdf:/rdfs:/xsd:/sh:) so the stylesheet can
    // render them with the "framework" chip treatment. Cytoscape stores
    // booleans as strings in selectors, so we keep this as a literal flag.
    isVocab: isMetaVocab(n.iri),
  };
}

/** The Cytoscape `data` of an edge apart from its id and endpoints. */
function edgeContentData(e: KGEdgeData): Record<string, unknown> {
  return { label: e.label, iri: e.iri };
}

export function modelToElements(model: KnowledgeGraphData): ElementDefinition[] {
  // Defensive dedup: Cytoscape silently drops elements with duplicate IDs.
  // OWL imports occasionally produce siblings with the same local name or
  // blank-node handles, and an internal bug anywhere upstream could produce
  // a duplicate — bail it out here so every node survives to the canvas.
  const seenNodes = new Set<string>();
  const nodes: ElementDefinition[] = [];
  for (const n of model.nodes || []) {
    const id = String(n.id ?? '');
    if (!id || seenNodes.has(id)) continue;
    seenNodes.add(id);
    nodes.push({
      group: 'nodes',
      data: { id, ...nodeContentData(n) },
      // Copy the position object — Cytoscape layouts mutate it in place,
      // and React may freeze state-derived objects in dev mode, which
      // would throw `"x" is read-only` on any subsequent layout pass.
      position: n.position ? { x: n.position.x, y: n.position.y } : undefined,
    });
  }

  const seenEdges = new Set<string>();
  const edges: ElementDefinition[] = [];
  for (const e of model.edges || []) {
    const id = String(e.id ?? '');
    if (!id || seenEdges.has(id)) continue;
    // Cytoscape requires both endpoints to already exist; an orphan edge
    // makes cy.add() abort the rest of the batch silently.
    if (!seenNodes.has(e.source) || !seenNodes.has(e.target)) continue;
    seenEdges.add(id);
    edges.push({
      group: 'edges',
      data: { id, source: e.source, target: e.target, ...edgeContentData(e) },
    });
  }

  return [...nodes, ...edges];
}

/** True for the transient elements cytoscape-edgehandles injects while an
 *  edge-drawing gesture is in flight (the invisible ghost node the ghost edge
 *  points at, the ghost edge itself, and the not-yet-committed preview edge).
 *  These live in the Cytoscape instance but must never reach the model. */
function isEdgehandlesTemp(el: { hasClass: (c: string) => boolean }): boolean {
  return (
    el.hasClass('eh-ghost') ||
    el.hasClass('eh-ghost-node') ||
    el.hasClass('eh-ghost-edge') ||
    el.hasClass('eh-preview')
  );
}

export function cyToModel(cy: Core, previous: KnowledgeGraphData): KnowledgeGraphData {
  const realNodes = cy.nodes().filter((n) => !isEdgehandlesTemp(n)).nodes();
  const realEdges = cy.edges().filter((e) => !isEdgehandlesTemp(e)).edges();
  const nodes: KGNodeData[] = realNodes.map((n): KGNodeData => {
    const data = n.data();
    const position = n.position();
    return {
      id: String(data.id),
      label: data.label ?? '',
      nodeType: (data.nodeType as KGNodeType) ?? 'individual',
      iri: data.iri,
      value: data.value,
      datatype: data.datatype,
      // Restore the metadata that modelToElements stashed onto data.metadata.
      // Without this, constraint-bearing nodes lose their `constraintSpecs`
      // every time the canvas re-emits the model, leading to empty
      // constraints downstream in the KG → ClassDiagram conversion.
      metadata: data.metadata,
      position: { x: position.x, y: position.y },
    };
  });
  const edges: KGEdgeData[] = realEdges.map((e): KGEdgeData => {
    const data = e.data();
    return {
      id: String(data.id),
      source: String(data.source),
      target: String(data.target),
      label: data.label,
      iri: data.iri,
    };
  });
  return {
    type: 'KnowledgeGraphDiagram',
    version: previous.version || '1.0.0',
    nodes,
    edges,
    settings: previous.settings,
  };
}

/** Merge canvas-derived (visible-slice) edits back into the full model.
 *
 *  The visible-id set is now tracked in the parent editor, so this is simple:
 *  - Visible slice = ids the editor marked visible (`visibleSet`).
 *  - Canvas edits override visible entries; hidden entries pass through.
 *  - Deletions inside the visible slice are detected by ids that WERE
 *    visible but no longer appear in the canvas output. */
export function mergeWithFullModel(
  full: KnowledgeGraphData,
  canvas: KnowledgeGraphData,
  visibleSet: Set<string>,
): KnowledgeGraphData {
  const canvasNodeById = new Map(canvas.nodes.map((n) => [n.id, n]));
  const consumed = new Set<string>();
  const mergedNodes: KGNodeData[] = [];
  for (const n of full.nodes) {
    if (canvasNodeById.has(n.id)) {
      const canvasNode = canvasNodeById.get(n.id)!;
      // Defense-in-depth: if the canvas-emitted node lacks metadata (e.g.
      // an older diagram saved before metadata was round-tripped through
      // Cytoscape data), keep the original full-model metadata so
      // constraint specs survive the merge.
      mergedNodes.push(
        canvasNode.metadata === undefined && n.metadata !== undefined
          ? { ...canvasNode, metadata: n.metadata }
          : canvasNode,
      );
      consumed.add(n.id);
    } else if (visibleSet.has(n.id)) {
      // Was visible, now absent → deleted on the canvas. Drop.
      continue;
    } else {
      // Hidden — pass through unchanged.
      mergedNodes.push(n);
    }
  }
  for (const n of canvas.nodes) if (!consumed.has(n.id)) mergedNodes.push(n);

  const allNodeIds = new Set(mergedNodes.map((n) => n.id));
  const canvasEdgeById = new Map(canvas.edges.map((e) => [e.id, e]));
  const takenEdges = new Set<string>();
  const mergedEdges: KGEdgeData[] = [];
  for (const e of full.edges) {
    if (canvasEdgeById.has(e.id)) {
      mergedEdges.push(canvasEdgeById.get(e.id)!);
      takenEdges.add(e.id);
    } else if (visibleSet.has(e.source) && visibleSet.has(e.target)) {
      // Was visible, now absent → deleted on the canvas.
      continue;
    } else {
      mergedEdges.push(e);
    }
  }
  for (const e of canvas.edges) if (!takenEdges.has(e.id)) mergedEdges.push(e);

  const cleanEdges = mergedEdges.filter((e) => allNodeIds.has(e.source) && allNodeIds.has(e.target));
  return { ...full, nodes: mergedNodes, edges: cleanEdges };
}

/** JSON with sorted object keys, so two equal values compare equal whatever
 *  order their keys were written in. `undefined` fields are dropped, as
 *  `JSON.stringify` does. */
function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, (v as Record<string, unknown>)[k]]))
      : v,
  );
}

/** The node fields `cyToModel` round-trips, apart from id and position. */
const nodeContentKey = (n: KGNodeData) =>
  stableStringify([n.label ?? '', n.nodeType, n.iri, n.value, n.datatype, n.metadata]);

/** The edge fields `cyToModel` round-trips, apart from id and endpoints. */
const edgeContentKey = (e: KGEdgeData) => stableStringify([e.label, e.iri]);

/**
 * Same element set on the canvas as in `wanted`: same node ids and same edge
 * ids with the same endpoints, in the same order. Content (labels, IRIs,
 * values, metadata) is not compared here; `syncElementData` patches it in place.
 */
export function sameCanvasStructure(onCanvas: KnowledgeGraphData, wanted: KnowledgeGraphData): boolean {
  if (onCanvas.nodes.length !== wanted.nodes.length || onCanvas.edges.length !== wanted.edges.length) {
    return false;
  }
  for (let i = 0; i < wanted.nodes.length; i++) {
    if (onCanvas.nodes[i].id !== wanted.nodes[i].id) return false;
  }
  for (let i = 0; i < wanted.edges.length; i++) {
    const a = onCanvas.edges[i];
    const b = wanted.edges[i];
    if (a.id !== b.id || a.source !== b.source || a.target !== b.target) return false;
  }
  return true;
}

/**
 * Write into the canvas the content of every element whose round-tripped
 * fields differ from `wanted` (an edit made in the inspector: label, value,
 * IRI, constraint specs, edge IRI ...), in place, recomputing `displayLabel`.
 * Without this the canvas keeps the old data and the next drag, which emits
 * the model from Cytoscape, silently reverts the edit. Elements are matched
 * by id; ones not on the canvas are ignored. Returns the number updated.
 *
 * `shown` is what the canvas holds (`cyToModel(cy, ...)`); a caller that has
 * just computed it passes it in rather than reading the canvas a second time.
 */
export function syncElementData(
  cy: Core,
  wanted: KnowledgeGraphData,
  shown: KnowledgeGraphData = cyToModel(cy, wanted),
): number {
  const shownNodes = new Map(shown.nodes.map((n) => [n.id, nodeContentKey(n)]));
  const shownEdges = new Map(shown.edges.map((e) => [e.id, edgeContentKey(e)]));
  let updated = 0;
  cy.batch(() => {
    for (const n of wanted.nodes) {
      const current = shownNodes.get(n.id);
      if (current === undefined || current === nodeContentKey(n)) continue;
      cy.getElementById(n.id).data(nodeContentData(n));
      updated++;
    }
    for (const e of wanted.edges) {
      const current = shownEdges.get(e.id);
      if (current === undefined || current === edgeContentKey(e)) continue;
      cy.getElementById(e.id).data(edgeContentData(e));
      updated++;
    }
  });
  return updated;
}

export function defaultLabelFor(nodeType: KGNodeType): string {
  switch (nodeType) {
    case 'class': return 'Class';
    case 'individual': return 'individual';
    case 'property': return 'property';
    case 'literal': return 'literal';
    case 'blank': return '_:b';
    case 'nodeConstraint': return 'NodeConstraint';
    case 'propertyConstraint': return 'PropertyConstraint';
  }
}

/** Cytoscape element for a node created on the canvas (palette drop), built
 *  through the same path as loaded nodes so it gets a `displayLabel` too. */
export function newNodeElement(
  id: string,
  nodeType: KGNodeType,
  position: { x: number; y: number },
): ElementDefinition {
  const label = defaultLabelFor(nodeType);
  const node: KGNodeData = { id, nodeType, label, ...(nodeType === 'literal' ? { value: label } : {}) };
  const [element] = modelToElements({ version: '1.0.0', nodes: [node], edges: [] });
  return { ...element, position: { x: position.x, y: position.y } };
}

/** Positions closer than this (in model units) count as equal. Cytoscape and the
 *  stored model round-trip positions through floats, and moving a node for a
 *  sub-pixel difference would only add noise. */
const POSITION_TOLERANCE = 0.5;

/**
 * Nodes whose position on the canvas differs from the one `wanted` holds. Used
 * after the model was replaced from outside without any structural change (an
 * undo of a drag or of a layout): the canvas then has to be told to move them.
 * Matched by id; a node without a usable wanted position, or not on the canvas,
 * is left out.
 */
export function nodesToReposition(
  onCanvas: readonly KGNodeData[],
  wanted: readonly KGNodeData[],
): Array<{ id: string; x: number; y: number }> {
  const shown = new Map(onCanvas.map((n) => [n.id, n.position]));
  const out: Array<{ id: string; x: number; y: number }> = [];
  for (const node of wanted) {
    const target = node.position;
    if (!target || !Number.isFinite(target.x) || !Number.isFinite(target.y)) continue;
    if (!shown.has(node.id)) continue;
    const current = shown.get(node.id);
    const same =
      current &&
      Math.abs(current.x - target.x) <= POSITION_TOLERANCE &&
      Math.abs(current.y - target.y) <= POSITION_TOLERANCE;
    if (!same) out.push({ id: node.id, x: target.x, y: target.y });
  }
  return out;
}

/** `fn`, run once after a burst of calls instead of once per call. Dragging
 *  several selected nodes ends with one event per node; as a single user action
 *  it must be a single undo step. */
export function coalesceToNextTick(fn: () => void): (() => void) & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const run = () => {
    if (timer !== null) return;
    timer = setTimeout(() => {
      timer = null;
      fn();
    }, 0);
  };
  run.cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  return run;
}

/** Extra information a canvas change carries to the editor. */
export interface CanvasChangeOptions {
  /** `false` for a change the user did not make (an automatic layout): it
   *  updates the model but is not an undo step. Default `true`. */
  undoable?: boolean;
}
