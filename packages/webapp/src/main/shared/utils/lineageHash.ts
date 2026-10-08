import type { UMLModel } from '@besser/wme';

/**
 * Deterministic djb2 hash over a canonical JSON view of the
 * model. NOT cryptographic; just stable equality for staleness
 * detection. Two identical models hash equal; any
 * structural change flips the hash.
 *
 * Canonicalisation strategy:
 *  - object keys sorted at every level and nodes / edges sorted by id
 *    (so insertion order doesn't matter — the editor reorders them over
 *    a session)
 *  - only the persisted node / edge fields are hashed: runtime state
 *    (`selected`, `dragging`, `measured`, ...), `interactive`,
 *    `assessments` and the diagram `id` / `title` never trigger staleness
 *  - positions, sizes and edge points rounded to integer (sub-pixel
 *    drift on save/load shouldn't count as "source changed")
 */
export function hashUmlModel(model: UMLModel): string {
  const canonical = canonicalize(stripVolatile(model));
  return djb2(JSON.stringify(canonical));
}

const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

const roundPoint = (p: { x: number; y: number }) => ({ x: Math.round(p.x), y: Math.round(p.y) });

function stripVolatile(model: UMLModel): unknown {
  const { type, version } = model;
  const nodes = [...(model.nodes ?? [])].sort(byId).map((node) => ({
    id: node.id,
    type: node.type,
    parentId: node.parentId,
    position: roundPoint(node.position),
    width: Math.round(node.width ?? 0),
    height: Math.round(node.height ?? 0),
    data: node.data,
  }));
  const edges = [...(model.edges ?? [])].sort(byId).map((edge) => {
    const data = edge.data ?? { points: [] };
    return {
      id: edge.id,
      type: edge.type,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      data: { ...data, points: Array.isArray(data.points) ? data.points.map(roundPoint) : [] },
    };
  });
  return { type, version, nodes, edges };
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const sortedKeys = Object.keys(obj).sort();
    const out: Record<string, unknown> = {};
    for (const k of sortedKeys) out[k] = canonicalize(obj[k]);
    return out;
  }
  return value;
}

// djb2 — Dan Bernstein's classic; collision-rate fine for our purposes.
function djb2(s: string): string {
  let hash = 5381;
  for (let i = 0; i < s.length; i++) hash = ((hash << 5) + hash + s.charCodeAt(i)) | 0;
  // unsigned hex to keep the string compact
  return (hash >>> 0).toString(16);
}
