/**
 * SA-FIX-Agent AgentDiagram inspector registrations.
 *
 * Imported as a side-effect from `lib/components/inspectors/index.ts`,
 * which in turn is imported from `App.tsx`. Registers the panel-editor
 * bodies against the central inspector registry from SA-1
 * (`registry.ts`); both `PropertiesPanel` and `PopoverManager` resolve
 * their bodies from that registry.
 *
 * SA-FIX-Agent removed the `AgentStateBodyEditPanel` — body sections
 * are now edited from `AgentStateEditPanel` (the parent inspector),
 * since the bodies live inline on `AgentState.data.bodies` rather than
 * as separate React Flow nodes.
 */
import { registerInspector } from "../registry"
import { AgentStateEditPanel } from "./AgentStateEditPanel"
import { AgentIntentEditPanel } from "./AgentIntentEditPanel"
import { AgentIntentBodyEditPanel } from "./AgentIntentBodyEditPanel"
import { AgentIntentDescriptionEditPanel } from "./AgentIntentDescriptionEditPanel"
import { AgentIntentObjectComponentEditPanel } from "./AgentIntentObjectComponentEditPanel"
import { AgentRagElementEditPanel } from "./AgentRagElementEditPanel"
import { AgentDiagramEdgeEditPanel } from "./AgentDiagramEdgeEditPanel"
import { AgentDiagramInitEdgeEditPanel } from "./AgentDiagramInitEdgeEditPanel"

registerInspector("AgentState", "edit", AgentStateEditPanel)
registerInspector("AgentIntent", "edit", AgentIntentEditPanel)
registerInspector("AgentIntentBody", "edit", AgentIntentBodyEditPanel)
registerInspector(
  "AgentIntentDescription",
  "edit",
  AgentIntentDescriptionEditPanel
)
registerInspector(
  "AgentIntentObjectComponent",
  "edit",
  AgentIntentObjectComponentEditPanel
)
registerInspector("AgentRagElement", "edit", AgentRagElementEditPanel)
registerInspector("AgentStateTransition", "edit", AgentDiagramEdgeEditPanel)
registerInspector(
  "AgentStateTransitionInit",
  "edit",
  AgentDiagramInitEdgeEditPanel
)

export * from "./AgentStateEditPanel"
export * from "./AgentIntentEditPanel"
export * from "./AgentIntentBodyEditPanel"
export * from "./AgentIntentDescriptionEditPanel"
export * from "./AgentIntentObjectComponentEditPanel"
export * from "./AgentRagElementEditPanel"
export * from "./AgentDiagramEdgeEditPanel"
export * from "./AgentDiagramInitEdgeEditPanel"
