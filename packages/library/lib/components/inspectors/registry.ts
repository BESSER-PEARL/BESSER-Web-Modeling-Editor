import type { ComponentType } from "react"
import type { PopoverProps } from "../popovers/types"

/**
 * Inspector kind: which mode the user is in.
 *
 * - `edit`         → modelling mode, the editing form for an element/edge.
 * - `feedbackGive` → assessment mode (read/write), feedback authoring UI.
 * - `feedbackSee`  → assessment mode (read-only), feedback display UI.
 */
export type InspectorKind = "edit" | "feedbackGive" | "feedbackSee"

/**
 * Component contract for an inspector. Same shape as the popover bodies in
 * `components/popovers/`, so existing components can be re-registered here
 * without modification — the `PropertiesPanel` (right rail) and
 * `PopoverManager` (floating popover) both render `<Component
 * elementId={...} />`.
 */
export type InspectorComponent = ComponentType<PopoverProps>

/**
 * Internal registry. One slot per (type, kind). Defaults are seeded
 * during library bootstrap by `seedInspectors()` (see PopoverManager port).
 *
 * The map key is `${type}__${kind}` to keep the registry flat and easy
 * to introspect at debug time.
 */
const _inspectors: Record<string, InspectorComponent> = {}

const slot = (type: string, kind: InspectorKind): string => `${type}__${kind}`

/**
 * Register an inspector for a given element/edge type and kind.
 * Existing entries are overwritten (intentional for component swaps).
 */
export const registerInspector = (
  type: string,
  kind: InspectorKind,
  component: InspectorComponent
): void => {
  _inspectors[slot(type, kind)] = component
}

/**
 * Bulk register a default-only kind: pass `{ type: Component }` to register
 * many entries at once. Used to seed the upstream defaults.
 */
export const registerInspectors = (
  kind: InspectorKind,
  entries: Record<string, InspectorComponent>
): void => {
  for (const [type, component] of Object.entries(entries)) {
    _inspectors[slot(type, kind)] = component
  }
}

/**
 * Type aliases: `aliasType` resolves to whatever is registered for
 * `targetType` (for every kind) when `aliasType` has no slot of its own.
 *
 * Bridges the two lookup keys that exist for the same element: the
 * React-Flow `node.type` (camelCase for most stock diagrams, e.g.
 * `activityMergeNode`, `bpmnTask`) that the right-side `PropertiesPanel`
 * reads, and the popover type (`"default"`, `"BPMNTask"`, …) each node
 * component passes to `PopoverManager`. Resolution happens at lookup time,
 * so a later `registerInspector(targetType, …)` override is picked up by
 * every alias automatically.
 */
const _aliases: Record<string, string> = {}

export const registerInspectorAlias = (
  aliasType: string,
  targetType: string
): void => {
  if (aliasType === targetType) return
  _aliases[aliasType] = targetType
}

export const registerInspectorAliases = (
  entries: Record<string, string>
): void => {
  for (const [aliasType, targetType] of Object.entries(entries)) {
    registerInspectorAlias(aliasType, targetType)
  }
}

/**
 * Per-kind fallback used when neither the type nor its alias has a slot.
 * Assessment mode registers a generic node/edge feedback body here so every
 * element can be assessed (v3 `assessable.tsx` wrapped EVERY element),
 * including diagram packages that only register an `edit` panel.
 * `edit` deliberately gets no fallback: v3 `popups.ts` mapped some element
 * types to `null` (no editor), and those must keep opening nothing.
 */
const _fallbacks: Partial<Record<InspectorKind, InspectorComponent>> = {}

export const registerInspectorFallback = (
  kind: InspectorKind,
  component: InspectorComponent | null
): void => {
  if (component) _fallbacks[kind] = component
  else delete _fallbacks[kind]
}

/** Own slot, then the alias chain (cycle-guarded). No fallback. */
const lookup = (
  type: string,
  kind: InspectorKind
): InspectorComponent | null => {
  let current = type
  const seen = new Set<string>()
  while (!seen.has(current)) {
    seen.add(current)
    const hit = _inspectors[slot(current, kind)]
    if (hit) return hit
    const next = _aliases[current]
    if (!next) break
    current = next
  }
  return null
}

/**
 * Look up an inspector. Resolution order: the type's own slot, then the
 * slot of its alias target (see `registerInspectorAlias`), then the kind's
 * fallback (see `registerInspectorFallback`). Returns `null` when nothing
 * matches, so consumers render nothing.
 */
export const getInspector = (
  type: string,
  kind: InspectorKind
): InspectorComponent | null => lookup(type, kind) ?? _fallbacks[kind] ?? null

/**
 * Resolve the inspector for a concrete diagram element: its React-Flow
 * `type` first (own slot or alias — this is what `PropertiesPanel` uses, so
 * the floating popover and the panel always agree), then the popover type
 * the node component passed (if any), then the kind's fallback.
 */
export const resolveElementInspector = (
  elementType: string | null | undefined,
  kind: InspectorKind,
  popoverType?: string | null
): InspectorComponent | null =>
  (elementType ? lookup(elementType, kind) : null) ??
  (popoverType ? lookup(popoverType, kind) : null) ??
  _fallbacks[kind] ??
  null

/**
 * For debug / introspection: return all registered slots.
 */
export const listInspectors = (): Array<{
  type: string
  kind: InspectorKind
  component: InspectorComponent
}> =>
  Object.entries(_inspectors).map(([key, component]) => {
    const [type, kind] = key.split("__")
    return { type, kind: kind as InspectorKind, component }
  })
