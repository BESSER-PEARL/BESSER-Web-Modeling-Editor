// Merge an imported Knowledge Graph into an existing one ("import alongside").
//
// The two graphs come from independent parses of unrelated files, so their
// identifiers only partly mean the same thing:
//
//   - IRI-backed nodes (class / property / individual) use the IRI itself as
//     the id, and literals use a content hash (``lit:<sha1>``). A collision
//     there means the two files really are talking about the same term, so we
//     keep the node we already have and drop the incoming duplicate.
//   - Everything else — blank nodes (``_:b0``) and the constraint nodes lifted
//     out of OWL restrictions / SHACL shapes (``nc:<class>#1``, ``pc:shacl:…``)
//     — is numbered per parse. The same id in two files is two *different*
//     things, so the incoming one gets a fresh id and every reference to it is
//     rewritten (edge endpoints and the ``ref`` slots of nested SHACL shapes).
//   - Edge ids (``edge:7``, ``cedge:3``) are pure counters and carry no
//     meaning at all: every incoming edge is renumbered. Edges are instead
//     deduplicated by the triple they represent — (source, predicate, target)
//     — because RDF graphs are sets of triples and a shared statement should
//     not become two parallel arrows.
import type {
  KGConstraintSpec,
  KGEdgeData,
  KGNodeData,
  KnowledgeGraphData,
} from '../../shared/types/project';

export interface KgMergeResult {
  model: KnowledgeGraphData;
  /** Ids (in the merged model) of the nodes contributed by the import. */
  addedNodeIds: string[];
  addedNodeCount: number;
  addedEdgeCount: number;
  /** Incoming nodes recognised as terms the current graph already had. */
  duplicateNodeCount: number;
  /** Incoming edges whose (source, predicate, target) triple was already present. */
  duplicateEdgeCount: number;
}

/** Nodes whose id is derived from their content, and therefore means the same
 *  thing in every file it appears in. */
function isStableId(node: KGNodeData): boolean {
  if (node.iri) return true;
  return node.nodeType === 'literal' && node.id.startsWith('lit:');
}

/** True when an incoming node with a colliding id denotes the same term as the
 *  node already in the graph. */
function isSameTerm(existing: KGNodeData, incoming: KGNodeData): boolean {
  if (!isStableId(existing) || !isStableId(incoming)) return false;
  if (existing.iri && incoming.iri) return existing.iri === incoming.iri;
  return (
    existing.nodeType === 'literal' &&
    incoming.nodeType === 'literal' &&
    existing.value === incoming.value &&
    existing.datatype === incoming.datatype
  );
}

function freshId(base: string, taken: ReadonlySet<string>): string {
  let candidate = `${base}#imported`;
  let n = 2;
  while (taken.has(candidate)) {
    candidate = `${base}#imported-${n}`;
    n += 1;
  }
  return candidate;
}

/** Rewrite the ``{ ref: <nodeId> }`` slots of SHACL logical operators
 *  (sh:not / sh:and / sh:or / sh:xone) through the id remapping. The nested
 *  shapes are recursive: a slot is either a ref or an inline shape carrying
 *  its own specs. */
function remapSpecs(
  specs: KGConstraintSpec[],
  remap: ReadonlyMap<string, string>,
): KGConstraintSpec[] {
  return specs.map((spec) => {
    if (!Array.isArray(spec.value)) return spec;
    let changed = false;
    const value = spec.value.map((slot) => {
      if (!slot || typeof slot !== 'object') return slot;
      const shape = slot as { ref?: string; specs?: KGConstraintSpec[] };
      if (typeof shape.ref === 'string') {
        const mapped = remap.get(shape.ref);
        if (mapped) {
          changed = true;
          return { ...shape, ref: mapped };
        }
        return slot;
      }
      if (Array.isArray(shape.specs)) {
        const nested = remapSpecs(shape.specs, remap);
        if (nested.some((s, i) => s !== shape.specs![i])) {
          changed = true;
          return { ...shape, specs: nested };
        }
      }
      return slot;
    });
    return changed ? { ...spec, value } : spec;
  });
}

function remapNode(node: KGNodeData, remap: ReadonlyMap<string, string>): KGNodeData {
  const id = remap.get(node.id) ?? node.id;
  const specs = node.metadata?.constraintSpecs;
  if (!Array.isArray(specs) || remap.size === 0) {
    return id === node.id ? node : { ...node, id };
  }
  const remapped = remapSpecs(specs, remap);
  const unchanged = remapped.every((s, i) => s === specs[i]);
  if (unchanged && id === node.id) return node;
  return {
    ...node,
    id,
    metadata: unchanged ? node.metadata : { ...node.metadata, constraintSpecs: remapped },
  };
}

/** Key identifying the RDF statement an edge stands for.
 *  The separator is written as an escape, never as a literal byte: a raw NUL
 *  makes git classify this file as binary, which kills diff, blame and grep. */
function edgeKey(edge: Pick<KGEdgeData, 'source' | 'target' | 'iri' | 'label'>): string {
  return `${edge.source}\u0000${edge.iri ?? edge.label ?? ''}\u0000${edge.target}`;
}

function nextEdgeId(taken: ReadonlySet<string>, counter: { value: number }): string {
  let candidate = `edge:${counter.value}`;
  while (taken.has(candidate)) {
    counter.value += 1;
    candidate = `edge:${counter.value}`;
  }
  counter.value += 1;
  return candidate;
}

/**
 * Merge `incoming` into `existing`, keeping the existing graph authoritative
 * for anything the two share. Neither input is mutated.
 */
export function mergeKnowledgeGraphs(
  existing: KnowledgeGraphData,
  incoming: KnowledgeGraphData,
): KgMergeResult {
  const existingById = new Map(existing.nodes.map((n) => [n.id, n]));
  const takenNodeIds = new Set(existingById.keys());

  // Pass 1 — decide, for every incoming node, whether it is a term we already
  // have (drop it) or a new one (keep it, renaming on id collision).
  const remap = new Map<string, string>();
  const keptIncoming: KGNodeData[] = [];
  let duplicateNodeCount = 0;

  for (const node of incoming.nodes) {
    const clash = existingById.get(node.id);
    if (clash) {
      if (isSameTerm(clash, node)) {
        duplicateNodeCount += 1;
        continue;
      }
      const id = freshId(node.id, takenNodeIds);
      remap.set(node.id, id);
      takenNodeIds.add(id);
      keptIncoming.push(node);
      continue;
    }
    takenNodeIds.add(node.id);
    keptIncoming.push(node);
  }

  // Pass 2 — apply the remapping to the kept nodes (ids + nested shape refs).
  const addedNodes = keptIncoming.map((n) => remapNode(n, remap));
  const addedNodeIds = addedNodes.map((n) => n.id);

  // Edges: renumber, redirect endpoints, drop statements we already carry.
  // Endpoints pointing at a dropped duplicate resolve to the existing node,
  // which is exactly what we want — the incoming statement attaches to the
  // term already on the canvas.
  const takenEdgeIds = new Set(existing.edges.map((e) => e.id));
  const seenTriples = new Set(existing.edges.map(edgeKey));
  const counter = { value: existing.edges.length + 1 };
  const addedEdges: KGEdgeData[] = [];
  let duplicateEdgeCount = 0;

  for (const edge of incoming.edges) {
    const source = remap.get(edge.source) ?? edge.source;
    const target = remap.get(edge.target) ?? edge.target;
    const key = edgeKey({ ...edge, source, target });
    if (seenTriples.has(key)) {
      duplicateEdgeCount += 1;
      continue;
    }
    seenTriples.add(key);
    const id = nextEdgeId(takenEdgeIds, counter);
    takenEdgeIds.add(id);
    addedEdges.push({ ...edge, id, source, target });
  }

  return {
    model: {
      ...existing,
      type: 'KnowledgeGraphDiagram',
      version: existing.version || incoming.version || '1.0.0',
      nodes: [...existing.nodes, ...addedNodes],
      edges: [...existing.edges, ...addedEdges],
    },
    addedNodeIds,
    addedNodeCount: addedNodes.length,
    addedEdgeCount: addedEdges.length,
    duplicateNodeCount,
    duplicateEdgeCount,
  };
}
