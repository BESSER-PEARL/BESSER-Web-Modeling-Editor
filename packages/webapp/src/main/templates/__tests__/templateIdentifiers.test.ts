import { describe, expect, it } from 'vitest';

// Generated code reserves `id` for the primary key: a class attribute named
// `id` that is not the identifier makes Django reject the model
// (models.E004), and the backend's validation warns about it, so generating
// from such a template would ask "Generate anyway?" before any edit.
const templates = import.meta.glob('../pattern/**/*.json', { eager: true, import: 'default' }) as Record<
  string,
  unknown
>;

/** The owners of the class attributes named `id` that are not marked as the identifier. */
function unmarkedIds(node: unknown, out: string[]): string[] {
  if (Array.isArray(node)) {
    node.forEach((child) => unmarkedIds(child, out));
  } else if (node && typeof node === 'object') {
    const obj = node as any;
    if (obj.type === 'ClassAttribute' && typeof obj.name === 'string' && obj.name.trim() === 'id' && !obj.isId) {
      out.push(String(obj.owner));
    }
    Object.values(obj).forEach((child) => unmarkedIds(child, out));
  }
  return out;
}

describe('template identifiers', () => {
  const entries = Object.entries(templates);

  it('finds the templates', () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  it.each(entries)('%s marks every `id` attribute as the identifier', (_path, template) => {
    expect(unmarkedIds(template, [])).toEqual([]);
  });
});
