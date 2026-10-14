import type { UMLModel } from '@besser/wme';

/**
 * Deterministic djb2 hash over a canonical JSON view of the
 * model. NOT cryptographic; just stable equality for staleness
 * detection. Two identical models hash equal; any
 * structural change flips the hash.
 *
 * Canonicalisation strategy:
 *  - object keys sorted at every level (so insertion order doesn't
 *    matter — the editor reorders elements over a session)
 *  - irrelevant runtime metadata (`interactive`, `assessments`)
 *    excluded so cosmetic state doesn't trigger false staleness
 *  - element bounds rounded to integer (sub-pixel drift on save/load
 *    shouldn't count as "source changed")
 */
export function hashUmlModel(model: UMLModel): string {
  const canonical = canonicalize(stripVolatile(model));
  return djb2(JSON.stringify(canonical));
}

function stripVolatile(model: UMLModel): Partial<UMLModel> {
  const { type, version, elements, relationships } = model;
  return {
    type,
    version,
    elements: roundBoundsRecursively(elements),
    relationships: roundBoundsRecursively(relationships),
  } as Partial<UMLModel>;
}

function roundBoundsRecursively<T extends Record<string, unknown>>(map: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(map)) {
    if (v && typeof v === 'object' && 'bounds' in (v as object)) {
      const cv = v as { bounds?: { x: number; y: number; width: number; height: number } };
      out[k] = {
        ...v,
        bounds: cv.bounds
          ? {
              x: Math.round(cv.bounds.x),
              y: Math.round(cv.bounds.y),
              width: Math.round(cv.bounds.width),
              height: Math.round(cv.bounds.height),
            }
          : undefined,
      };
    } else {
      out[k] = v;
    }
  }
  return out as T;
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
