import { ClassRelationshipType } from '../../uml-class-diagram';

/**
 * Navigability rules for class-diagram associations.
 *
 * - A plain association is always a `ClassBidirectional`; which ends can be
 *   navigated to is stored as an explicit boolean `navigable` on each end.
 * - The legacy `ClassUnidirectional` type is read as a `ClassBidirectional`
 *   whose source end is not navigable and whose target end is navigable.
 * - In a composition the diamond sits on the target end (the composite, the
 *   "whole"), so the source end is the part and always stays navigable.
 * - At least one end of an association must be navigable.
 */

export type AssociationEnd = 'source' | 'target';

export type AssociationNavigability = { source: boolean; target: boolean };

/** Any relationship-shaped value; ends are read loosely so plain JSON and editor instances both fit. */
export type NavigableAssociationLike = {
  type: string;
  source?: object | null;
  target?: object | null;
};

const readNavigable = (end: object | null | undefined): boolean | undefined => {
  const value = (end as { navigable?: unknown } | null | undefined)?.navigable;
  return typeof value === 'boolean' ? value : undefined;
};

/** Relationship types whose ends carry a meaningful `navigable` flag. */
export const NAVIGABLE_ASSOCIATION_TYPES: ReadonlyArray<string> = [
  ClassRelationshipType.ClassBidirectional,
  ClassRelationshipType.ClassUnidirectional,
  ClassRelationshipType.ClassComposition,
  ClassRelationshipType.ClassAggregation,
];

export const supportsNavigability = (type: string): boolean => NAVIGABLE_ASSOCIATION_TYPES.includes(type);

/** Maps the legacy `ClassUnidirectional` type to `ClassBidirectional`; other types are returned unchanged. */
export const normalizeAssociationType = <T extends string>(type: T): T =>
  (type === ClassRelationshipType.ClassUnidirectional ? ClassRelationshipType.ClassBidirectional : type) as T;

/**
 * Applies the editor's rules to a pair of navigability flags: the part end of a
 * composition is always navigable, and at least one end stays navigable. When
 * both ends would end up non-navigable, the end that was not just changed is
 * made navigable again (the target end if no change is given).
 */
export const enforceNavigabilityRules = (
  type: string,
  navigability: AssociationNavigability,
  changedEnd?: AssociationEnd,
): AssociationNavigability => {
  let { source, target } = navigability;
  if (type === ClassRelationshipType.ClassComposition) {
    source = true;
  }
  if (!source && !target) {
    if (changedEnd === 'target') {
      source = true;
    } else {
      target = true;
    }
  }
  return { source, target };
};

/**
 * Returns the effective navigability of each end of an association, filling in
 * missing flags from the legacy defaults and applying the editor's rules.
 */
export const resolveAssociationNavigability = (association: NavigableAssociationLike): AssociationNavigability => {
  const legacyUnidirectional = association.type === ClassRelationshipType.ClassUnidirectional;
  return enforceNavigabilityRules(association.type, {
    source: readNavigable(association.source) ?? !legacyUnidirectional,
    target: readNavigable(association.target) ?? true,
  });
};

/** Whether the user may toggle the navigability of the given end without breaking a rule. */
export const canToggleNavigability = (association: NavigableAssociationLike, end: AssociationEnd): boolean => {
  if (association.type === ClassRelationshipType.ClassComposition && end === 'source') {
    return false;
  }
  const navigability = resolveAssociationNavigability(association);
  const other: AssociationEnd = end === 'source' ? 'target' : 'source';
  return !navigability[end] || navigability[other];
};

/**
 * Returns the association with a normalized type and explicit, rule-abiding
 * `navigable` flags on both ends. Relationships whose type has no navigability
 * are returned as-is, and so is an association that is already normalized.
 */
export const normalizeAssociationNavigability = <T extends NavigableAssociationLike>(association: T): T => {
  if (!supportsNavigability(association.type) || !association.source || !association.target) {
    return association;
  }
  const type = normalizeAssociationType(association.type);
  const navigability = resolveAssociationNavigability(association);
  if (
    type === association.type &&
    readNavigable(association.source) === navigability.source &&
    readNavigable(association.target) === navigability.target
  ) {
    return association;
  }
  return {
    ...association,
    type,
    source: { ...association.source, navigable: navigability.source },
    target: { ...association.target, navigable: navigability.target },
  };
};

/**
 * Normalizes every association of a model (see `normalizeAssociationNavigability`).
 * Returns the same model object when nothing had to change.
 */
export const normalizeModelAssociationNavigability = <
  M extends { relationships?: { [id: string]: NavigableAssociationLike } },
>(
  model: M,
): M => {
  if (!model.relationships) {
    return model;
  }
  let changed = false;
  const relationships: { [id: string]: NavigableAssociationLike } = {};
  for (const [id, relationship] of Object.entries(model.relationships)) {
    const normalized = normalizeAssociationNavigability(relationship);
    changed = changed || normalized !== relationship;
    relationships[id] = normalized;
  }
  return changed ? { ...model, relationships } : model;
};
