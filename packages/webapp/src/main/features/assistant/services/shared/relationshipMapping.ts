/**
 * Maps the relationship types the modeling assistant sends (e.g. "Association",
 * "Composition", "Inheritance" -- see the modeling-agent's RelationshipSpec) to
 * editor relationship types plus per-end navigability.
 *
 * Plain associations are always emitted as `ClassBidirectional` with explicit
 * `source.navigable` / `target.navigable` flags; `ClassUnidirectional` is a
 * legacy type and is never produced. A "unidirectional" association points from
 * the source class to the target class, so only the target end is navigable.
 * Composition and aggregation keep both ends navigable, which also keeps the
 * part (source) end of a composition navigable as the editor requires.
 */

export interface RelationshipMapping {
  type: string;
  /** Per-end navigability; absent for non-association types (inheritance, ...). */
  navigable?: { source: boolean; target: boolean };
}

export function mapAssistantRelationshipType(type: string | undefined | null): RelationshipMapping {
  // Tolerate editor-style names ("ClassComposition") as well as plain ones.
  const key = (type || '').trim().toLowerCase().replace(/^class/, '');
  switch (key) {
    case 'inheritance':
    case 'generalization':
      return { type: 'ClassInheritance' };
    case 'realization':
      return { type: 'ClassRealization' };
    case 'dependency':
      return { type: 'ClassDependency' };
    case 'composition':
      return { type: 'ClassComposition', navigable: { source: true, target: true } };
    case 'aggregation':
      return { type: 'ClassAggregation', navigable: { source: true, target: true } };
    case 'unidirectional':
      return { type: 'ClassBidirectional', navigable: { source: false, target: true } };
    default:
      // "Association", "Bidirectional" and anything unrecognised.
      return { type: 'ClassBidirectional', navigable: { source: true, target: true } };
  }
}

/**
 * Set a relationship's type and end navigability from an assistant type.
 * Non-association types drop any stale `navigable` flags.
 */
export function applyAssistantRelationshipType(relationship: any, type: string | undefined | null): void {
  const mapping = mapAssistantRelationshipType(type);
  relationship.type = mapping.type;
  for (const end of ['source', 'target'] as const) {
    const endObj = relationship[end];
    if (!endObj) continue;
    if (mapping.navigable) {
      endObj.navigable = mapping.navigable[end];
    } else {
      delete endObj.navigable;
    }
  }
}
