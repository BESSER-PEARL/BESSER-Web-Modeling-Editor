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
 * Look up an inspector. Returns `null` if no entry is registered for the
 * (type, kind) pair, so consumers can fall back to a default rendering.
 */
export const getInspector = (
  type: string,
  kind: InspectorKind
): InspectorComponent | null => _inspectors[slot(type, kind)] ?? null

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
