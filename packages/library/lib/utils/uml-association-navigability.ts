/**
 * Navigability rules for class-diagram associations (v4 wire shape).
 *
 * - A plain association is always a `ClassBidirectional`; which ends can be
 *   navigated to is stored as an explicit boolean on the edge data:
 *   `edge.data.sourceNavigable` / `edge.data.targetNavigable`.
 * - The legacy `ClassUnidirectional` type is read as a `ClassBidirectional`
 *   whose source end is not navigable and whose target end is navigable.
 * - In a composition the diamond sits on the target end (the composite, the
 *   "whole"), so the source end is the part and always stays navigable.
 * - At least one end of an association must be navigable.
 *
 * Everything here is pure and structurally typed, so it works on React Flow
 * edges, plain v4 JSON and (through the `*V3*` helpers) legacy v3
 * relationships alike.
 */

export type AssociationEnd = "source" | "target"

export type AssociationNavigability = { source: boolean; target: boolean }

/** Any v4 edge-shaped value; the data fields are read loosely. */
export type NavigableEdgeLike = {
  type?: string
  data?: object | null
}

/** A v3 relationship-shaped value (ends carry `navigable`). */
export type NavigableV3RelationshipLike = {
  type: string
  source?: object | null
  target?: object | null
}

const readBoolean = (value: unknown): boolean | undefined =>
  typeof value === "boolean" ? value : undefined

const readEdgeFlag = (
  edge: NavigableEdgeLike,
  end: AssociationEnd
): boolean | undefined =>
  readBoolean(
    (edge.data as Record<string, unknown> | null | undefined)?.[
      end === "source" ? "sourceNavigable" : "targetNavigable"
    ]
  )

const readV3Flag = (end: object | null | undefined): boolean | undefined =>
  readBoolean((end as { navigable?: unknown } | null | undefined)?.navigable)

/** Relationship types whose ends carry a meaningful navigability flag. */
export const NAVIGABLE_ASSOCIATION_TYPES: ReadonlyArray<string> = [
  "ClassBidirectional",
  "ClassUnidirectional",
  "ClassComposition",
  "ClassAggregation",
]

export const supportsNavigability = (type: string | undefined): boolean =>
  !!type && NAVIGABLE_ASSOCIATION_TYPES.includes(type)

/** Maps the legacy `ClassUnidirectional` type to `ClassBidirectional`; other types are returned unchanged. */
export const normalizeAssociationType = <T extends string | undefined>(
  type: T
): T => (type === "ClassUnidirectional" ? "ClassBidirectional" : type) as T

/**
 * Applies the editor's rules to a pair of navigability flags: the part end of a
 * composition is always navigable, and at least one end stays navigable. When
 * both ends would end up non-navigable, the end that was not just changed is
 * made navigable again (the target end if no change is given).
 */
export const enforceNavigabilityRules = (
  type: string | undefined,
  navigability: AssociationNavigability,
  changedEnd?: AssociationEnd
): AssociationNavigability => {
  let { source, target } = navigability
  if (type === "ClassComposition") {
    source = true
  }
  if (!source && !target) {
    if (changedEnd === "target") {
      source = true
    } else {
      target = true
    }
  }
  return { source, target }
}

const resolveFromFlags = (
  type: string | undefined,
  source: boolean | undefined,
  target: boolean | undefined
): AssociationNavigability => {
  const legacyUnidirectional = type === "ClassUnidirectional"
  return enforceNavigabilityRules(type, {
    source: source ?? !legacyUnidirectional,
    target: target ?? true,
  })
}

/**
 * Returns the effective navigability of each end of a v4 association edge,
 * filling in missing flags from the legacy defaults and applying the rules.
 */
export const resolveAssociationNavigability = (
  edge: NavigableEdgeLike
): AssociationNavigability =>
  resolveFromFlags(
    edge.type,
    readEdgeFlag(edge, "source"),
    readEdgeFlag(edge, "target")
  )

/** Same as `resolveAssociationNavigability`, for a legacy v3 relationship. */
export const resolveV3AssociationNavigability = (
  relationship: NavigableV3RelationshipLike
): AssociationNavigability =>
  resolveFromFlags(
    relationship.type,
    readV3Flag(relationship.source),
    readV3Flag(relationship.target)
  )

/** Whether the user may toggle the navigability of the given end without breaking a rule. */
export const canToggleNavigability = (
  edge: NavigableEdgeLike,
  end: AssociationEnd
): boolean => {
  if (edge.type === "ClassComposition" && end === "source") {
    return false
  }
  const navigability = resolveAssociationNavigability(edge)
  const other: AssociationEnd = end === "source" ? "target" : "source"
  return !navigability[end] || navigability[other]
}

/**
 * Edge patch for a type change: the new type plus the navigability it
 * requires, so the change is a single update (one undo step) and never leaves
 * an invalid association behind. Types without navigability drop the flags.
 */
export const applyAssociationTypeChange = <E extends NavigableEdgeLike>(
  edge: E,
  newType: string
): E => {
  const type = normalizeAssociationType(newType)
  const data = { ...((edge.data ?? {}) as Record<string, unknown>) }
  if (!supportsNavigability(type)) {
    delete data.sourceNavigable
    delete data.targetNavigable
    return { ...edge, type, data } as E
  }
  // A legacy ClassUnidirectional keeps its one-way reading when the user
  // switches it to another association kind.
  const navigability = resolveFromFlags(
    type,
    readEdgeFlag(edge, "source") ??
      (edge.type === "ClassUnidirectional" ? false : undefined),
    readEdgeFlag(edge, "target")
  )
  return {
    ...edge,
    type,
    data: {
      ...data,
      sourceNavigable: navigability.source,
      targetNavigable: navigability.target,
    },
  } as E
}

/**
 * Edge patch for a navigability checkbox toggle. Returns the edge unchanged
 * when the toggle is not allowed (see `canToggleNavigability`).
 */
export const applyNavigabilityToggle = <E extends NavigableEdgeLike>(
  edge: E,
  end: AssociationEnd,
  checked: boolean
): E => {
  if (!canToggleNavigability(edge, end)) {
    return edge
  }
  const navigability = enforceNavigabilityRules(
    edge.type,
    { ...resolveAssociationNavigability(edge), [end]: checked },
    end
  )
  return {
    ...edge,
    type: normalizeAssociationType(edge.type),
    data: {
      ...((edge.data ?? {}) as Record<string, unknown>),
      sourceNavigable: navigability.source,
      targetNavigable: navigability.target,
    },
  } as E
}

/**
 * Returns the edge with a normalized type and explicit, rule-abiding
 * `sourceNavigable` / `targetNavigable` flags. Edges whose type has no
 * navigability are returned as-is, and so is an edge that is already
 * normalized (same object).
 */
export const normalizeEdgeNavigability = <E extends NavigableEdgeLike>(
  edge: E
): E => {
  if (!supportsNavigability(edge.type)) {
    return edge
  }
  const type = normalizeAssociationType(edge.type)
  const navigability = resolveAssociationNavigability(edge)
  if (
    type === edge.type &&
    readEdgeFlag(edge, "source") === navigability.source &&
    readEdgeFlag(edge, "target") === navigability.target
  ) {
    return edge
  }
  return {
    ...edge,
    type,
    data: {
      ...((edge.data ?? {}) as Record<string, unknown>),
      sourceNavigable: navigability.source,
      targetNavigable: navigability.target,
    },
  } as E
}

/**
 * Normalizes every association edge (see `normalizeEdgeNavigability`).
 * Returns the same array when nothing had to change.
 */
export const normalizeEdgesNavigability = <E extends NavigableEdgeLike>(
  edges: E[]
): E[] => {
  let changed = false
  const out = edges.map((edge) => {
    const normalized = normalizeEdgeNavigability(edge)
    changed = changed || normalized !== edge
    return normalized
  })
  return changed ? out : edges
}

/**
 * Normalizes every association of a v4 model (`{ edges }`). Returns the same
 * model object when nothing had to change.
 */
export const normalizeModelAssociationNavigability = <
  M extends { edges?: NavigableEdgeLike[] },
>(
  model: M
): M => {
  if (!Array.isArray(model.edges)) {
    return model
  }
  const edges = normalizeEdgesNavigability(model.edges)
  return edges === model.edges ? model : { ...model, edges }
}

/**
 * v3 → v4 lift for one relationship: the v4 edge type plus the
 * `edge.data` navigability fields (empty for types without navigability).
 */
export const liftV3AssociationNavigability = (
  relationship: NavigableV3RelationshipLike
): {
  type: string
  data: { sourceNavigable?: boolean; targetNavigable?: boolean }
} => {
  if (!supportsNavigability(relationship.type)) {
    return { type: relationship.type, data: {} }
  }
  const navigability = resolveV3AssociationNavigability(relationship)
  return {
    type: normalizeAssociationType(relationship.type),
    data: {
      sourceNavigable: navigability.source,
      targetNavigable: navigability.target,
    },
  }
}

/**
 * The end markers drawn for an association, following UML notation: an open
 * arrowhead at a navigable end when the other end is not navigable (no arrows
 * when both ends are navigable). The diamond of an aggregation or composition
 * always stays on the target (whole) end; for an aggregation whose only
 * navigable end is the whole, the arrowhead is drawn in front of the diamond
 * (`arrowBeforeEndMarker`). Returns `undefined` for relationship types
 * without navigability, which keep their type-based markers.
 */
export const getAssociationMarkers = (
  edge: NavigableEdgeLike
):
  | { markerStart?: string; markerEnd?: string; arrowBeforeEndMarker: boolean }
  | undefined => {
  if (!supportsNavigability(edge.type)) {
    return undefined
  }
  const navigability = resolveAssociationNavigability(edge)
  const onlySource = navigability.source && !navigability.target
  const onlyTarget = navigability.target && !navigability.source
  const diamond =
    edge.type === "ClassComposition"
      ? "url(#black-rhombus)"
      : edge.type === "ClassAggregation"
        ? "url(#white-rhombus)"
        : undefined
  return {
    markerStart: onlySource ? "url(#black-arrow)" : undefined,
    markerEnd: diamond ?? (onlyTarget ? "url(#black-arrow)" : undefined),
    arrowBeforeEndMarker: onlyTarget && edge.type === "ClassAggregation",
  }
}
