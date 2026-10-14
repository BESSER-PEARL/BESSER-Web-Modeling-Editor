/**
 * ObjectDiagram inspector registrations.
 *
 * Imported as a side-effect from `lib/components/inspectors/index.ts`.
 *
 * `ObjectEditPanel` for `objectName` nodes.
 * `ObjectLinkEditPanel` for the `ObjectLink` edge.
 */
import { registerInspector } from "../registry"
import { ObjectLinkEditPanel } from "./ObjectLinkEditPanel"

registerInspector("ObjectLink", "edit", ObjectLinkEditPanel)

export * from "./ObjectEditPanel"
export * from "./ObjectLinkEditPanel"
