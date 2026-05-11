/**
 * UserDiagram inspector registrations. Side-effect imported from
 * `lib/components/inspectors/index.ts`; registers panels for
 * `UserModelName` and `UserModelAttribute` (the icon node has no editor
 * — it surfaces via the parent's panel).
 */
import { registerInspector } from "../registry"
import { UserModelNameEditPanel } from "./UserModelNameEditPanel"
import { UserModelAttributeEditPanel } from "./UserModelAttributeEditPanel"

registerInspector("UserModelName", "edit", UserModelNameEditPanel)
registerInspector("UserModelAttribute", "edit", UserModelAttributeEditPanel)

export * from "./UserModelNameEditPanel"
export * from "./UserModelAttributeEditPanel"
