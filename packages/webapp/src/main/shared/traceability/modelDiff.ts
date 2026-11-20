import type { ChangeKind } from '../types/traceability';

/**
 * What changed between two versions of a model, element by element, whatever the model's notation:
 * each notation's diff (`classModelDiff.ts`, `guiModelDiff.ts`, `diagramModelDiff.ts` for the other
 * diagram types) reduces a version to a snapshot of
 * its elements, and two snapshots are compared here. Element types are B-UML metaclass names, the
 * same names the backend's trace uses.
 */

export interface ElementChange {
  kind: ChangeKind;
  elementId: string;
  /** B-UML metaclass: `Class`, `Property`, `Method`, `Constraint`, `Screen`, `Table`, `Form`, ... */
  elementType: string;
  /** Display name after the change (before it, for a deletion). */
  name: string;
  /** The owning element (a class for an attribute, a page for a table), or null for a top-level element. */
  parentElementId: string | null;
  /** The owner's metaclass and name, so a recorder can file the change under an owner it has not seen yet. */
  parent?: { elementType: string; name: string };
  feature?: string;
  oldValue?: string;
  newValue?: string;
}

/** A compared value: `key` decides whether it changed, `display` is what is recorded. */
export interface FeatureValue {
  key: string;
  display: string;
}

/** An element of one version of a model, as compared. */
export interface Snapshot {
  elementType: string;
  name: string;
  parentElementId: string | null;
  features: Record<string, FeatureValue>;
  /** Created in this order, deleted in the reverse one: owners before their members. */
  rank: number;
}

/** A value compared and recorded as text; `absent` stands for a missing value (one the editor assumes). */
export const value = (raw: unknown, absent: unknown = ''): FeatureValue => {
  const resolved = raw === undefined || raw === null ? absent : raw;
  const text = String(resolved);
  return { key: text, display: text };
};

/** The feature of the update recording an element's change of metaclass (old and new metaclass as values). */
export const RETYPE_FEATURE = 'elementType';

/** The value of a feature an element does not have. */
const NO_VALUE: FeatureValue = { key: '', display: '' };

/** The changes that turn the `before` snapshot into the `after` one. */
export function diffSnapshots(before: Map<string, Snapshot>, after: Map<string, Snapshot>): ElementChange[] {
  const created: ElementChange[] = [];
  const updated: ElementChange[] = [];
  const deleted: ElementChange[] = [];

  const ownerOf = (parentElementId: string | null, snapshots: Map<string, Snapshot>) => {
    const owner = parentElementId ? snapshots.get(parentElementId) : undefined;
    return owner ? { parent: { elementType: owner.elementType, name: owner.name } } : {};
  };

  for (const [id, now] of after) {
    const old = before.get(id);
    const base = {
      elementId: id, elementType: now.elementType, name: now.name, parentElementId: now.parentElementId,
      ...ownerOf(now.parentElementId, after),
    };
    if (!old) {
      created.push({ ...base, kind: 'CREATED', newValue: now.name });
      continue;
    }
    const retyped = old.elementType !== now.elementType;
    if (retyped) {
      // The same element under another metaclass (a class made an enumeration, an attribute a literal): one
      // update of its metaclass, so it stays the live element it is, and the links from it go out of date.
      updated.push({ ...base, kind: 'UPDATED', feature: RETYPE_FEATURE, oldValue: old.elementType, newValue: now.elementType });
      if (old.name !== now.name) updated.push({ ...base, kind: 'UPDATED', feature: 'name', oldValue: old.name, newValue: now.name });
    }
    // A feature one version has and the other does not (a value set for the first time, or cleared) is
    // compared with an empty value: it changed unless the present value is empty too. After a retype, only the
    // features both metaclasses have are compared.
    const features = retyped
      ? Object.keys(now.features).filter((feature) => feature in old.features && feature !== 'name') // the name: above
      : [...new Set([...Object.keys(old.features), ...Object.keys(now.features)])];
    for (const feature of features) {
      const previousValue = old.features[feature] ?? NO_VALUE;
      const current = now.features[feature] ?? NO_VALUE;
      if (previousValue.key !== current.key) {
        updated.push({ ...base, kind: 'UPDATED', feature, oldValue: previousValue.display, newValue: current.display });
      }
    }
  }
  for (const [id, old] of before) {
    if (!after.has(id)) {
      deleted.push({
        kind: 'DELETED', elementId: id, elementType: old.elementType, name: old.name,
        parentElementId: old.parentElementId, oldValue: old.name, ...ownerOf(old.parentElementId, before),
      });
    }
  }

  const rank = (changes: ElementChange[], snapshots: Map<string, Snapshot>) =>
    changes.sort((a, b) => (snapshots.get(a.elementId)?.rank ?? 0) - (snapshots.get(b.elementId)?.rank ?? 0));
  // Owners are created before their members and deleted after them.
  return [...rank(created, after), ...updated, ...rank(deleted, before).reverse()];
}
