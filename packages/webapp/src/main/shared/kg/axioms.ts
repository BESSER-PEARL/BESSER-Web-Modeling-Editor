/**
 * OWL axioms carried by a Knowledge Graph.
 *
 * Some OWL constructs relate several nodes at once (equivalent or disjoint
 * classes, sub-properties, inverses, property chains, keys). The backend keeps
 * them next to the nodes and edges as `model.axioms`, each a record of a `kind`
 * plus the **node ids** it relates (`class_ids`, `sub_property_id`, ...). The
 * frontend never shows or edits them, but it must carry them: the backend reads
 * them back to find the preflight issues that depend on them
 * (EQUIVALENT_CLASSES, INVERSE_PROPERTY, a property's domain via a
 * sub-property, ...), so a graph stored without them silently loses findings.
 *
 * Because they hold node ids, they have to follow the nodes: renamed when an
 * imported graph is merged, trimmed when a node is deleted. That is all this
 * module does; it knows the id fields by name (`*_id`, `*_ids`) and nothing else
 * about the meaning of a kind, apart from how many ids a kind needs to still
 * say something after a deletion.
 */
import type { KGAxiom } from '../types/project';

/** Kinds that relate a SET of nodes and say nothing with fewer than two. */
const NEEDS_TWO = new Set(['EquivalentClassesAxiom', 'EquivalentPropertiesAxiom', 'DisjointClassesAxiom']);
/** Kinds the frontend knows how to trim. Any other kind is dropped whole when
 *  one of its nodes goes, rather than guessed at. */
const TRIMMABLE = new Set([
  ...NEEDS_TWO,
  'DisjointUnionAxiom',
  'SubPropertyOfAxiom',
  'InversePropertiesAxiom',
  'PropertyChainAxiom',
  'HasKeyAxiom',
  'ImportAxiom',
]);
/** Kinds whose id lists have no order, so `[a, b]` and `[b, a]` are one axiom. */
const UNORDERED = new Set([...NEEDS_TWO]);

const isIdField = (name: string) => name.endsWith('_id') || name.endsWith('_ids');

function rename(id: string, remap: ReadonlyMap<string, string>): string {
  return remap.get(id) ?? id;
}

/** The axiom with node ids renamed through `remap`. The same object when
 *  nothing was renamed. IRIs and other fields are never touched. */
export function remapAxiomNodeIds(axiom: KGAxiom, remap: ReadonlyMap<string, string>): KGAxiom {
  if (remap.size === 0) return axiom;
  let changed = false;
  const out: KGAxiom = { ...axiom };
  for (const [field, value] of Object.entries(axiom)) {
    if (!isIdField(field)) continue;
    if (typeof value === 'string') {
      const next = rename(value, remap);
      if (next !== value) {
        out[field] = next;
        changed = true;
      }
    } else if (Array.isArray(value)) {
      const next = value.map((v) => (typeof v === 'string' ? rename(v, remap) : v));
      if (next.some((v, i) => v !== value[i])) {
        out[field] = next;
        changed = true;
      }
    }
  }
  return changed ? out : axiom;
}

/** The axioms that still make sense once the `removed` nodes are gone: those that
 *  mention none are kept, a larger set loses just the removed members, and one
 *  that depended on a removed node is dropped. The same array when nothing changed. */
export function pruneAxioms(axioms: readonly KGAxiom[], removed: ReadonlySet<string>): KGAxiom[] {
  const result: KGAxiom[] = [];
  let changed = false;
  for (const axiom of axioms) {
    const idFields = Object.entries(axiom).filter(([field]) => isIdField(field));
    const mentions = idFields.some(([, value]) =>
      Array.isArray(value) ? value.some((v) => removed.has(String(v))) : removed.has(String(value)),
    );
    if (!mentions) {
      result.push(axiom);
      continue;
    }
    changed = true;
    if (!TRIMMABLE.has(axiom.kind)) continue;

    const trimmed: KGAxiom = { ...axiom };
    let alive = true;
    for (const [field, value] of idFields) {
      if (Array.isArray(value)) {
        const kept = value.filter((v) => !removed.has(String(v)));
        trimmed[field] = kept;
        if (kept.length < (NEEDS_TWO.has(axiom.kind) ? 2 : 1)) alive = false;
      } else if (removed.has(String(value))) {
        alive = false;
      }
    }
    if (alive) result.push(trimmed);
  }
  return changed ? result : (axioms as KGAxiom[]);
}

/** Identity of an axiom: its kind and ids, with unordered lists sorted, so that
 *  the same statement arriving twice is recognised. */
export function axiomKey(axiom: KGAxiom): string {
  const fields = Object.keys(axiom).sort();
  const parts = fields.map((field) => {
    const value = axiom[field];
    const normalised =
      Array.isArray(value) && UNORDERED.has(axiom.kind) && isIdField(field) ? [...value].map(String).sort() : value;
    return `${field}=${JSON.stringify(normalised)}`;
  });
  return parts.join('|');
}

/** `existing` followed by the `incoming` axioms, renamed through `remap` (the
 *  ids the merge gave to colliding nodes) and without any the graph already has.
 *  `undefined` when neither side has axioms. */
export function mergeAxioms(
  existing: readonly KGAxiom[] | undefined,
  incoming: readonly KGAxiom[] | undefined,
  remap: ReadonlyMap<string, string>,
): KGAxiom[] | undefined {
  if (!existing && !incoming) return undefined;
  const result = [...(existing ?? [])];
  const seen = new Set(result.map(axiomKey));
  for (const axiom of incoming ?? []) {
    const renamed = remapAxiomNodeIds(axiom, remap);
    const key = axiomKey(renamed);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(renamed);
  }
  return result;
}
