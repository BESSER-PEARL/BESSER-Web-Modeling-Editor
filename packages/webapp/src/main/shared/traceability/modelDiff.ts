import type { ChangeKind } from '../types/traceability';

/**
 * What changed between two versions of a model, element by element, whatever the model's notation:
 * each notation's diff (`classModelDiff.ts`, `guiModelDiff.ts`) reduces a version to a snapshot of
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
    if (!old || old.elementType !== now.elementType) {
      if (old) deleted.push({ ...base, kind: 'DELETED', name: old.name, elementType: old.elementType, oldValue: old.name });
      created.push({ ...base, kind: 'CREATED', newValue: now.name });
      continue;
    }
    for (const [feature, current] of Object.entries(now.features)) {
      const previousValue = old.features[feature];
      if (previousValue && previousValue.key !== current.key) {
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
