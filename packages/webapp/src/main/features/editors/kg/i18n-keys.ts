/** Translation lookups for the KG editor's static data tables.
 *
 * `KG_NODE_TYPES`, `KG_EDGE_RULES`, `CONSTRAINT_CATALOG`, `CATEGORY_LABELS` and
 * `CONSTRAINT_TEMPLATES` are module-level constants, so their English text
 * can't go through `t()` at declaration time. Each entry already carries a
 * unique discriminator (`type` / `kind` / `id` / the category name), so the
 * i18n key is derived from it rather than duplicated as a hand-typed
 * `labelKey` field on every entry.
 *
 * The English literal on the entry stays the `defaultValue`: with
 * `fallbackLng: 'en'`, a key absent from *every* locale would otherwise render
 * as the raw dotted key. `__tests__/i18n-keys.test.ts` asserts en/webapp.json
 * carries a key for every entry, which is what keeps the derivation honest
 * when a discriminator gets renamed.
 */

import type { TFunction } from 'i18next';

import type { ConstraintCatalogEntry, ConstraintCategory, ConstraintTemplate } from './constraint-catalog';
import { KG_EDGE_RULES } from './edge-rules';
import type { KGNodeType } from './types';
import { KG_NODE_TYPES } from './types';

type NodeTypeEntry = (typeof KG_NODE_TYPES)[number];

export const nodeTypeLabel = (t: TFunction, entry: NodeTypeEntry): string =>
  t(`editors.kg.nodeTypes.${entry.type}.label`, { defaultValue: entry.label });

export const nodeTypeDescription = (t: TFunction, entry: NodeTypeEntry): string =>
  t(`editors.kg.nodeTypes.${entry.type}.description`, { defaultValue: entry.description });

/** Why `type` may not be the source of a relation. Render-time counterpart of
 *  `explainEdgeRejection()`, which is singleton-based because it runs inside a
 *  Cytoscape gesture callback. Using this keeps the string subscribed to
 *  `useTranslation` so it re-renders on a language switch. */
export const edgeRuleReason = (t: TFunction, type: KGNodeType): string =>
  t(`editors.kg.edgeRules.${type}.reason`, { defaultValue: KG_EDGE_RULES[type]?.reason ?? '' });

export const catalogLabel = (t: TFunction, entry: ConstraintCatalogEntry): string =>
  t(`editors.kg.constraints.catalog.${entry.kind}.label`, { defaultValue: entry.label });

export const catalogDescription = (t: TFunction, entry: ConstraintCatalogEntry): string =>
  t(`editors.kg.constraints.catalog.${entry.kind}.description`, { defaultValue: entry.description });

export const categoryLabel = (t: TFunction, category: ConstraintCategory, fallback: string): string =>
  t(`editors.kg.constraints.categories.${category}`, { defaultValue: fallback });

export const templateLabel = (t: TFunction, template: ConstraintTemplate): string =>
  t(`editors.kg.constraints.templates.${template.id}.label`, { defaultValue: template.label });

export const templateDescription = (t: TFunction, template: ConstraintTemplate): string =>
  t(`editors.kg.constraints.templates.${template.id}.description`, { defaultValue: template.description });
