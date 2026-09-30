/**
 * ActivityDiagram inspector registrations.
 *
 * Imported as a side-effect from `lib/components/inspectors/index.ts`.
 * The other activity node types resolve to the name + colours default
 * popup via `nodeTypeInspectorAliases.ts`; only the decision / merge node
 * has a dedicated body (v3 `UMLActivityMergeNodeUpdate`).
 */
import { registerInspector } from "../registry"
import { ActivityMergeNodeEditPanel } from "./ActivityMergeNodeEditPanel"

registerInspector("activityMergeNode", "edit", ActivityMergeNodeEditPanel)

export * from "./ActivityMergeNodeEditPanel"
