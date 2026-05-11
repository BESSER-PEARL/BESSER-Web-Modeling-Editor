/**
 * UserDiagram node-type registrations.
 *
 * Side-effect imported from `lib/nodes/index.ts`. Registers the three
 * BESSER user-modelling node types per the spec at
 * `docs/source/migrations/uml-v4-shape.md` (UserDiagram §). Visuals are
 * derived from `ObjectName` — the user model is structurally a
 * special case of object diagram with semantic constraints validated
 * server-side via `services/userMetaModel/usermetamodel.json`.
 */
import { registerNodeTypes } from "../types"
import { UserModelName } from "./UserModelName"
import { UserModelAttribute } from "./UserModelAttribute"
import { UserModelIcon } from "./UserModelIcon"

registerNodeTypes({
  UserModelName,
  UserModelAttribute,
  UserModelIcon,
})

export * from "./UserModelName"
export * from "./UserModelAttribute"
export * from "./UserModelIcon"
