/**
 * SA-4 AgentDiagram inspector registrations.
 *
 * Imported as a side-effect from `lib/components/inspectors/index.ts`,
 * which in turn is imported from `App.tsx`. Registers the panel-editor
 * bodies against the central inspector registry from SA-1
 * (`registry.ts`); both `PropertiesPanel` and `PopoverManager` resolve
 * their bodies from that registry.
 *
 * Slot keys mirror the v4 `node.type` / `edge.type` strings declared in
 * `nodes/agentDiagram/index.ts` and the spec at
 * `docs/source/migrations/uml-v4-shape.md`.
 */
import { registerInspector } from "../registry"
import { AgentStateEditPanel } from "./AgentStateEditPanel"
import { AgentStateBodyEditPanel } from "./AgentStateBodyEditPanel"
import { AgentIntentEditPanel } from "./AgentIntentEditPanel"
import { AgentIntentBodyEditPanel } from "./AgentIntentBodyEditPanel"
import { AgentIntentDescriptionEditPanel } from "./AgentIntentDescriptionEditPanel"
import { AgentIntentObjectComponentEditPanel } from "./AgentIntentObjectComponentEditPanel"
import { AgentRagElementEditPanel } from "./AgentRagElementEditPanel"
import { AgentDiagramEdgeEditPanel } from "./AgentDiagramEdgeEditPanel"
import { AgentDiagramInitEdgeEditPanel } from "./AgentDiagramInitEdgeEditPanel"

registerInspector("AgentState", "edit", AgentStateEditPanel)
// AgentStateBody and AgentStateFallbackBody share the same panel body.
registerInspector("AgentStateBody", "edit", AgentStateBodyEditPanel)
registerInspector("AgentStateFallbackBody", "edit", AgentStateBodyEditPanel)
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
export * from "./AgentStateBodyEditPanel"
export * from "./AgentIntentEditPanel"
export * from "./AgentIntentBodyEditPanel"
export * from "./AgentIntentDescriptionEditPanel"
export * from "./AgentIntentObjectComponentEditPanel"
export * from "./AgentRagElementEditPanel"
export * from "./AgentDiagramEdgeEditPanel"
export * from "./AgentDiagramInitEdgeEditPanel"
