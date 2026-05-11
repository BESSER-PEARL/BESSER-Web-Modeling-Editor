/**
 * Inspector registry — public entry point.
 *
 * On import the BESSER inspector seeds run and overwrite the upstream
 * stock `edit` slots for the diagram types BESSER fully owns:
 *
 *   - `class`      → `ClassEditPanel`  (replaces `ClassEditPopover`)
 *   - `objectName` → `ObjectEditPanel` (replaces `ObjectEditPopover`)
 *
 * Both `PropertiesPanel` and `PopoverManager` resolve inspectors from
 * the shared registry (`registry.ts`), so re-registering here is the
 * single switch that makes the new panel-aware bodies render in both
 * surfaces.
 *
 * Registration uses `registerInspector(type, kind, component)` from
 * `registry.ts`. It is idempotent under multiple imports — the registry
 * stores by `${type}__${kind}` slot.
 */
import { registerInspector } from "./registry"
import { ClassEditPanel } from "./classDiagram"
import { ObjectEditPanel } from "./objectDiagram"
// Side-effect import that registers the StateMachineDiagram
// panel-editor bodies. Kept as a side-effect import (rather than a
// per-call `registerInspector` here) so the slot ↔ body wiring lives
// next to the bodies themselves.
import "./stateMachineDiagram"
// Side-effect imports that register the AgentDiagram + UserDiagram
// panel-editor bodies.
import "./agentDiagram"
import "./userDiagram"
// Side-effect import that registers the NNDiagram panel-editor
// bodies. The generic `NNComponentEditPanel` is bound to all 17
// layer-style kinds; `NNContainer` / `NNReference` get dedicated panels.
import "./nnDiagram"
// Shared / cross-diagram inspectors (currently the
// free-form sticky-note `comment` node ported from v3 `common/comments`).
import "./common"

registerInspector("class", "edit", ClassEditPanel)
registerInspector("objectName", "edit", ObjectEditPanel)

export * from "./registry"
export * from "./classDiagram"
export * from "./objectDiagram"
export * from "./stateMachineDiagram"
export * from "./agentDiagram"
export * from "./userDiagram"
export * from "./nnDiagram"
export * from "./common"
