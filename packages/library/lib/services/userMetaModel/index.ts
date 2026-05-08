/**
 * SA-FIX-User: helpers for the BESSER user-meta-model JSON.
 *
 * The shipped `usermetamodel.json` is a v3-shape ClassDiagram
 * (`elements` / `relationships` records). The runtime consumers in v4
 * (the diagramBridge, palette previews, inspector lookups) all expect
 * the v4 `{nodes, edges}` arrays. Two helpers are provided:
 *
 *   - `getUserMetaModelClasses()` → walks the flat-element JSON and
 *     produces a list of `Class` rows with their attributes (used by the
 *     dynamic UserDiagram palette to render one preview per
 *     Personal_Information / Skill / Education / Disability …).
 *
 *   - `getUserMetaModelV4()` → converts the entire v3 JSON to the v4
 *     bridge shape (`{nodes, edges}`) so `diagramBridge.setClassDiagramData`
 *     receives a shape its readers (`getAvailableClasses`,
 *     `lookupEnumerationLiterals`) actually understand. Without this the
 *     bridge silently returned `[]` and enum dropdowns / linked-attribute
 *     lookups in `UserModelNameEditPanel` were always empty.
 */
import userMetaModelJson from "./usermetamodel.json"

/* eslint-disable @typescript-eslint/no-explicit-any */

interface FlatElement {
  id: string
  name?: string
  type?: string
  owner?: string | null
  attributeType?: string
  visibility?: string
  attributes?: string[]
  methods?: string[]
  icon?: string
  bounds?: { x: number; y: number; width: number; height: number }
}

interface FlatRelationship {
  id: string
  type?: string
  name?: string
  source?: { element: string; role?: string; multiplicity?: string }
  target?: { element: string; role?: string; multiplicity?: string }
}

const json = userMetaModelJson as unknown as {
  elements: Record<string, FlatElement>
  relationships?: Record<string, FlatRelationship>
}

export interface UserMetaModelClass {
  id: string
  name: string
  icon?: string
  attributes: { id: string; name: string; attributeType: string }[]
}

/**
 * Walk the flat-element JSON and produce a list of `Class` (and
 * `Enumeration`) rows with their attributes folded in. Used by the
 * UserDiagram palette to dynamically generate one drag-source per
 * meta-model class — the v3 behaviour `composeUserModelPreview`
 * provided. We exclude `User` itself (it's the placeholder header that
 * the v3 sidebar also hid).
 */
export function getUserMetaModelClasses(): UserMetaModelClass[] {
  const elements = json.elements ?? {}
  const out: UserMetaModelClass[] = []
  for (const id of Object.keys(elements)) {
    const el = elements[id]
    if (el?.type !== "Class") continue
    if (el.name === "User") continue // skip the placeholder root
    const attrIds = Array.isArray(el.attributes) ? el.attributes : []
    const attrs = attrIds
      .map((aid) => elements[aid])
      .filter((a): a is FlatElement => !!a && a.type === "ClassAttribute")
      .map((a) => ({
        id: a.id,
        name: a.name ?? "",
        attributeType: a.attributeType ?? "str",
      }))
    out.push({
      id: el.id,
      name: el.name ?? "",
      icon: el.icon,
      attributes: attrs,
    })
  }
  // Stable, alphabetical order so palette items don't shuffle between
  // boots (JSON object iteration order is *mostly* insertion-order in
  // modern engines, but we don't want to rely on that).
  out.sort((a, b) => a.name.localeCompare(b.name))
  return out
}

/**
 * Convert the v3-shape user-meta-model JSON to the v4
 * `{nodes, edges}` shape consumed by `diagramBridge.setClassDiagramData`.
 *
 * Each `Class` / `Enumeration` element becomes one v4 node with its
 * `ClassAttribute` children folded onto `data.attributes`. Relationships
 * are passthrough'd best-effort (the bridge only walks `source` /
 * `target` / `type`, so we copy those scalars verbatim).
 *
 * SA-FIX-User Fix #4: closes the bridge-shape mismatch in
 * `UserModelNameEditPanel.lookupEnumerationLiterals` — that consumer
 * walks `data.nodes` and reads `node.data.attributes`, which only works
 * once the JSON has been converted to v4 first.
 */
export function getUserMetaModelV4(): { nodes: any[]; edges: any[] } {
  const elements = json.elements ?? {}
  const relationships = json.relationships ?? {}

  const nodes: any[] = []
  for (const id of Object.keys(elements)) {
    const el = elements[id]
    if (el?.type !== "Class" && el?.type !== "Enumeration") continue
    const attrIds = Array.isArray(el.attributes) ? el.attributes : []
    const attrs = attrIds
      .map((aid) => elements[aid])
      .filter((a): a is FlatElement => !!a && a.type === "ClassAttribute")
      .map((a) => ({
        id: a.id,
        name: a.name ?? "",
        attributeType: a.attributeType ?? "str",
        visibility: a.visibility ?? "public",
      }))
    nodes.push({
      id: el.id,
      type: "class",
      position: el.bounds
        ? { x: el.bounds.x, y: el.bounds.y }
        : { x: 0, y: 0 },
      width: el.bounds?.width ?? 200,
      height: el.bounds?.height ?? 40,
      data: {
        name: el.name ?? "",
        // Tag enumerations so `lookupEnumerationLiterals` can
        // distinguish them from regular classes.
        ...(el.type === "Enumeration" ? { stereotype: "Enumeration" } : {}),
        attributes: attrs,
        icon: el.icon,
      },
    })
  }

  const edges: any[] = []
  for (const id of Object.keys(relationships)) {
    const rel = relationships[id]
    edges.push({
      id: rel.id ?? id,
      type: rel.type ?? "association",
      source: rel.source?.element ?? "",
      target: rel.target?.element ?? "",
      data: {
        name: rel.name,
        sourceRole: rel.source?.role,
        sourceMultiplicity: rel.source?.multiplicity,
        targetRole: rel.target?.role,
        targetMultiplicity: rel.target?.multiplicity,
      },
    })
  }

  return { nodes, edges }
}
