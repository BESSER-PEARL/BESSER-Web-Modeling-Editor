/**
 * Maps the relationship types the modeling assistant sends (e.g. "Association",
 * "Composition", "Inheritance" -- see the modeling-agent's RelationshipSpec) to
 * editor relationship types plus per-end navigability.
 *
 * Plain associations are always emitted as `ClassBidirectional` with explicit
 * per-end navigability (v4: `edge.data.sourceNavigable` /
 * `edge.data.targetNavigable`); `ClassUnidirectional` is a legacy type and is
 * never produced. A "unidirectional" association points from the source class
 * to the target class, so only the target end is navigable. Composition and
 * aggregation keep both ends navigable, which also keeps the part (source) end
 * of a composition navigable as the editor requires.
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
 * Set a v4 edge's type and end navigability (`data.sourceNavigable` /
 * `data.targetNavigable`) from an assistant type. Non-association types drop
 * any stale navigability flags. Mutates the edge in place.
 */
export function applyAssistantRelationshipType(edge: any, type: string | undefined | null): void {
  const mapping = mapAssistantRelationshipType(type);
  edge.type = mapping.type;
  const data = (edge.data ??= {});
  if (mapping.navigable) {
    data.sourceNavigable = mapping.navigable.source;
    data.targetNavigable = mapping.navigable.target;
  } else {
    delete data.sourceNavigable;
    delete data.targetNavigable;
  }
}
