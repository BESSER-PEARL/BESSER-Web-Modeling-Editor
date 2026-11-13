/**
 * UserDiagram inspector registrations. Side-effect imported from
 * `lib/components/inspectors/index.ts`; registers panels for
 * `UserModelName` and `UserModelAttribute` (the icon node has no editor
 * — it surfaces via the parent's panel).
 *
 * `UserModelLink` reuses `ObjectLinkEditPanel` — v3 parity:
 * `uml-relationships.ts` maps `UserModelLink` onto the same
 * `UMLObjectLink` class as `ObjectLink`, so the edit popup (name +
 * association dropdown + flip + colors) is identical.
 */
import { registerInspector } from "../registry"
import { UserModelNameEditPanel } from "./UserModelNameEditPanel"
import { UserModelAttributeEditPanel } from "./UserModelAttributeEditPanel"
import { ObjectLinkEditPanel } from "../objectDiagram/ObjectLinkEditPanel"

registerInspector("UserModelName", "edit", UserModelNameEditPanel)
registerInspector("UserModelAttribute", "edit", UserModelAttributeEditPanel)
registerInspector("UserModelLink", "edit", ObjectLinkEditPanel)

export * from "./UserModelNameEditPanel"
export * from "./UserModelAttributeEditPanel"
