import { describe, it, expect } from 'vitest';
import { GENERATOR_MENU_CONFIG } from '../menus/generator-menu-config';
import type { GeneratorMenuAction, GeneratorMenuEntry } from '../menus/generator-menu-config';
import type { GeneratorMenuMode } from '../workspace-types';

/** Flatten groups/actions of a menu mode into a single action list. */
const flattenActions = (entries: GeneratorMenuEntry[]): GeneratorMenuAction[] =>
  entries.flatMap((entry) => {
    if (entry.kind === 'action') return [entry];
    if (entry.kind === 'group') return entry.actions;
    return [];
  });

describe('GENERATOR_MENU_CONFIG', () => {
  it('lists Supabase in the class-mode Database group between SQL DDL and SQLAlchemy DDL', () => {
    const databaseGroup = GENERATOR_MENU_CONFIG.class.find(
      (entry) => entry.kind === 'group' && entry.label === 'Database',
    );
    expect(databaseGroup).toBeDefined();
    if (!databaseGroup || databaseGroup.kind !== 'group') throw new Error('Database group missing');

    const generators = databaseGroup.actions.map((a) => a.generator);
    expect(generators).toEqual(['sql', 'supabase', 'sqlalchemy']);

    const supabaseAction = databaseGroup.actions.find((a) => a.generator === 'supabase');
    expect(supabaseAction?.label).toBe('Supabase');
  });

  it('does not expose Supabase in any non-class mode', () => {
    const otherModes = (Object.keys(GENERATOR_MENU_CONFIG) as GeneratorMenuMode[]).filter(
      (mode) => mode !== 'class',
    );
    for (const mode of otherModes) {
      const generators = flattenActions(GENERATOR_MENU_CONFIG[mode]).map((a) => a.generator);
      expect(generators).not.toContain('supabase');
    }
  });
});
