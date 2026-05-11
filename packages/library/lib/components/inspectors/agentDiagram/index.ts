/**
 * AgentDiagram inspector registrations.
 *
 * Imported as a side-effect from `lib/components/inspectors/index.ts`.
 * Registers the panel-editor bodies against the central inspector
 * registry; both `PropertiesPanel` and `PopoverManager` resolve their
 * bodies from that registry.
 *
 * SA-FIX-Agent removed `AgentStateBodyEditPanel` — body sections edit
 * from `AgentStateEditPanel` since they live inline on
 * `AgentState.data.bodies`. SA-FIX-INTENT-INLINE removed
 * `AgentIntentBody` / `AgentIntentDescription` /
 * `AgentIntentObjectComponent` for the same reason — training phrases /
 * entity slots / description now live inline on `AgentIntent.data`.
 */
import { registerInspector } from "../registry"
import { AgentStateEditPanel } from "./AgentStateEditPanel"
import { AgentIntentEditPanel } from "./AgentIntentEditPanel"
import { AgentRagElementEditPanel } from "./AgentRagElementEditPanel"
import { AgentDiagramEdgeEditPanel } from "./AgentDiagramEdgeEditPanel"
import { AgentDiagramInitEdgeEditPanel } from "./AgentDiagramInitEdgeEditPanel"

registerInspector("AgentState", "edit", AgentStateEditPanel)
registerInspector("AgentIntent", "edit", AgentIntentEditPanel)
registerInspector("AgentRagElement", "edit", AgentRagElementEditPanel)
registerInspector("AgentStateTransition", "edit", AgentDiagramEdgeEditPanel)
registerInspector(
  "AgentStateTransitionInit",
  "edit",
  AgentDiagramInitEdgeEditPanel
)

export * from "./AgentStateEditPanel"
export * from "./AgentIntentEditPanel"
export * from "./AgentRagElementEditPanel"
export * from "./AgentDiagramEdgeEditPanel"
export * from "./AgentDiagramInitEdgeEditPanel"
