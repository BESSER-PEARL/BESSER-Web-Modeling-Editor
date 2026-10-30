import { describe, expect, it } from 'vitest';

// Every bundled template must store associations in the canonical v4 format:
// ClassBidirectional (never the legacy ClassUnidirectional) with an explicit
// boolean `data.sourceNavigable` / `data.targetNavigable`, at least one end
// navigable, and the part (source) end of a composition navigable.
const templates = import.meta.glob('../pattern/**/*.json', { eager: true, import: 'default' }) as Record<
  string,
  unknown
>;

const ASSOCIATION_TYPES = new Set(['ClassBidirectional', 'ClassUnidirectional', 'ClassComposition', 'ClassAggregation']);

// v4 edges: `source` / `target` are node-id strings (v3 relationships carried
// `{ element }` objects there and must not appear in templates any more).
function collectAssociations(node: unknown, out: any[]): any[] {
  if (Array.isArray(node)) {
    node.forEach((child) => collectAssociations(child, out));
  } else if (node && typeof node === 'object') {
    const obj = node as any;
    if (ASSOCIATION_TYPES.has(obj.type) && typeof obj.source === 'string' && typeof obj.target === 'string') {
      out.push(obj);
    }
    Object.values(obj).forEach((child) => collectAssociations(child, out));
  }
  return out;
}

describe('template associations', () => {
  const entries = Object.entries(templates)
    .map(([path, json]) => [path, collectAssociations(json, [])] as const)
    .filter(([, associations]) => associations.length > 0);

  it('finds templates with associations', () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  it.each(entries)('%s uses explicit per-end navigability', (_path, associations) => {
    for (const edge of associations) {
      expect(edge.type).not.toBe('ClassUnidirectional');
      expect(typeof edge.data?.sourceNavigable).toBe('boolean');
      expect(typeof edge.data?.targetNavigable).toBe('boolean');
      expect(edge.data.sourceNavigable || edge.data.targetNavigable).toBe(true);
      if (edge.type === 'ClassComposition') expect(edge.data.sourceNavigable).toBe(true);
    }
  });

  it('keeps the one-way associations smart-generator authored', () => {
    const oneWay = entries.flatMap(([, associations]) =>
      associations.filter((edge) => edge.data.sourceNavigable !== edge.data.targetNavigable),
    );
    expect(oneWay.length).toBeGreaterThan(0);
  });
});
