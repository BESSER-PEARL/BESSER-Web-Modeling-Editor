import { describe, expect, it } from 'vitest';

// Every bundled template must store associations in the canonical format:
// ClassBidirectional (never the legacy ClassUnidirectional) with an explicit
// boolean `navigable` on both ends, at least one end navigable, and the part
// (source) end of a composition navigable.
const templates = import.meta.glob('../pattern/**/*.json', { eager: true, import: 'default' }) as Record<
  string,
  unknown
>;

const ASSOCIATION_TYPES = new Set(['ClassBidirectional', 'ClassUnidirectional', 'ClassComposition', 'ClassAggregation']);

function collectAssociations(node: unknown, out: any[]): any[] {
  if (Array.isArray(node)) {
    node.forEach((child) => collectAssociations(child, out));
  } else if (node && typeof node === 'object') {
    const obj = node as any;
    if (ASSOCIATION_TYPES.has(obj.type) && obj.source?.element !== undefined && obj.target?.element !== undefined) {
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
    for (const rel of associations) {
      expect(rel.type).not.toBe('ClassUnidirectional');
      expect(typeof rel.source.navigable).toBe('boolean');
      expect(typeof rel.target.navigable).toBe('boolean');
      expect(rel.source.navigable || rel.target.navigable).toBe(true);
      if (rel.type === 'ClassComposition') expect(rel.source.navigable).toBe(true);
    }
  });
});
