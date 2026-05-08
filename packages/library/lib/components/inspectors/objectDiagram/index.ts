/**
 * SA-2 / SA-2.1 ObjectDiagram inspector registrations.
 *
 * Imported as a side-effect from `lib/components/inspectors/index.ts`.
 *
 * SA-2: `ObjectEditPanel` for `objectName` nodes.
 * SA-2.1: `ObjectLinkEditPanel` for the `ObjectLink` edge.
 */
import { registerInspector } from "../registry"
import { ObjectLinkEditPanel } from "./ObjectLinkEditPanel"

registerInspector("ObjectLink", "edit", ObjectLinkEditPanel)

export * from "./ObjectEditPanel"
export * from "./ObjectLinkEditPanel"
