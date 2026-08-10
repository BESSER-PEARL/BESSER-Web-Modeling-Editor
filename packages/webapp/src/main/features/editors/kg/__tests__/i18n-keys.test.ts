import { describe, it, expect } from 'vitest';

import en from '../../../../../../../i18n/en/webapp.json';

import { CONSTRAINT_CATALOG, CATEGORY_LABELS, CONSTRAINT_TEMPLATES } from '../constraint-catalog';
import { KG_EDGE_RULES } from '../edge-rules';
import { KG_NODE_TYPES } from '../types';

/** The KG static tables derive their i18n keys from a discriminator
 *  (`type` / `kind` / `id` / category name) instead of carrying a hand-typed
 *  `labelKey` per entry — see `../i18n-keys.ts`. That keeps ~150 duplicate
 *  string fields out of the source, but nothing in the compiler ties a renamed
 *  discriminator back to `en/webapp.json`; a stale key would quietly render as
 *  its English `defaultValue` forever. These tests are that missing link, in
 *  both directions: every entry needs a key, and no key may outlive its entry.
 */

type LocaleNode = { [key: string]: string | LocaleNode };

const locale = en as unknown as LocaleNode;

/** Resolve a dotted path, returning the string leaf or undefined. */
function str(path: string): string | undefined {
  let node: string | LocaleNode | undefined = locale;
  for (const segment of path.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = node[segment];
  }
  return typeof node === 'string' ? node : undefined;
}

/** Child key names at a dotted path (empty when it isn't an object). */
function keysAt(path: string): string[] {
  let node: string | LocaleNode | undefined = locale;
  for (const segment of path.split('.')) {
    if (typeof node !== 'object' || node === null) return [];
    node = node[segment];
  }
  return typeof node === 'object' && node !== null ? Object.keys(node) : [];
}

const KG = 'editors.kg';

/** Keys under `edgeRules` that are not per-node-type reasons: fallbacks used
 *  when no rule matches at all. Listed here so the stale-key check below can
 *  tell them apart from a reason left behind by a deleted node type. */
const EDGE_RULE_EXTRA_KEYS = ['genericRejection', 'noValidTargets'];

describe('KG static-table i18n keys', () => {
  it('has a label and description for every node type', () => {
    const missing = KG_NODE_TYPES.flatMap((entry) =>
      ['label', 'description']
        .map((field) => `${KG}.nodeTypes.${entry.type}.${field}`)
        .filter((path) => str(path) === undefined),
    );
    expect(missing).toEqual([]);
  });

  it('has a reason for every edge rule, plus the standalone fallbacks', () => {
    const missing = Object.keys(KG_EDGE_RULES)
      .map((type) => `${KG}.edgeRules.${type}.reason`)
      .filter((path) => str(path) === undefined);
    expect(missing).toEqual([]);
    for (const key of EDGE_RULE_EXTRA_KEYS) {
      expect(str(`${KG}.edgeRules.${key}`), key).toBeTypeOf('string');
    }
  });

  it('has a label for every constraint category', () => {
    const missing = Object.keys(CATEGORY_LABELS)
      .map((category) => `${KG}.constraints.categories.${category}`)
      .filter((path) => str(path) === undefined);
    expect(missing).toEqual([]);
  });

  it('has a label and description for every catalog entry', () => {
    const missing = CONSTRAINT_CATALOG.flatMap((entry) =>
      ['label', 'description']
        .map((field) => `${KG}.constraints.catalog.${entry.kind}.${field}`)
        .filter((path) => str(path) === undefined),
    );
    expect(missing).toEqual([]);
  });

  it('has a label and description for every quick-add template', () => {
    const missing = CONSTRAINT_TEMPLATES.flatMap((template) =>
      ['label', 'description']
        .map((field) => `${KG}.constraints.templates.${template.id}.${field}`)
        .filter((path) => str(path) === undefined),
    );
    expect(missing).toEqual([]);
  });

  it('carries no keys for entries that no longer exist', () => {
    const stale = [
      ...keysAt(`${KG}.nodeTypes`).filter((k) => !KG_NODE_TYPES.some((n) => n.type === k)),
      ...keysAt(`${KG}.edgeRules`).filter((k) => !EDGE_RULE_EXTRA_KEYS.includes(k) && !(k in KG_EDGE_RULES)),
      ...keysAt(`${KG}.constraints.categories`).filter((k) => !(k in CATEGORY_LABELS)),
      ...keysAt(`${KG}.constraints.catalog`).filter((k) => !CONSTRAINT_CATALOG.some((e) => e.kind === k)),
      ...keysAt(`${KG}.constraints.templates`).filter((k) => !CONSTRAINT_TEMPLATES.some((tpl) => tpl.id === k)),
    ];
    expect(stale).toEqual([]);
  });

  it('keeps the English source strings and the English locale in sync', () => {
    // The TS literals are the runtime `defaultValue`s, so drift between them
    // and en/webapp.json would show different English text depending on whether
    // i18next resolved the key — the confusing failure mode this rules out.
    const drift = [
      ...KG_NODE_TYPES.filter((e) => str(`${KG}.nodeTypes.${e.type}.label`) !== e.label).map((e) => e.type),
      ...CONSTRAINT_CATALOG.filter((e) => str(`${KG}.constraints.catalog.${e.kind}.label`) !== e.label).map(
        (e) => e.kind,
      ),
      ...CONSTRAINT_TEMPLATES.filter((tpl) => str(`${KG}.constraints.templates.${tpl.id}.label`) !== tpl.label).map(
        (tpl) => tpl.id,
      ),
    ];
    expect(drift).toEqual([]);
  });
});
