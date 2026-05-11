/**
 * Shared / cross-diagram inspector registrations.
 *
 * Imported as a side-effect from `lib/components/inspectors/index.ts`.
 * Currently registers the panel-editor body for the free-form
 * `comment` sticky-note node (ported from v3 `common/comments`).
 */
import { registerInspector } from "../registry"
import { CommentEditPanel } from "./CommentEditPanel"

registerInspector("comment", "edit", CommentEditPanel)

export * from "./CommentEditPanel"
