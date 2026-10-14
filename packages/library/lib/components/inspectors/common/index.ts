/**
 * Shared / cross-diagram inspector registrations.
 *
 * Imported as a side-effect from `lib/components/inspectors/index.ts`.
 * Registers the panel-editor bodies for the free-form `comment`
 * sticky-note node (ported from v3 `common/comments`) and its dashed
 * `CommentLink` tether edge (v3 `GeneralRelationshipType.Link`).
 */
import { registerInspector } from "../registry"
import { CommentEditPanel } from "./CommentEditPanel"
import { CommentLinkEditPanel } from "./CommentLinkEditPanel"

registerInspector("comment", "edit", CommentEditPanel)
registerInspector("CommentLink", "edit", CommentLinkEditPanel)

export * from "./CommentEditPanel"
export * from "./CommentLinkEditPanel"
