/**
 * AgentDiagram inspector registrations.
 *
 * Imported as a side-effect from `lib/components/inspectors/index.ts`.
 * Registers the panel-editor bodies against the central inspector
 * registry; both `PropertiesPanel` and `PopoverManager` resolve their
 * bodies from that registry.
 *
 * Removed `AgentStateBodyEditPanel` — body sections edit
 * from `AgentStateEditPanel` since they live inline on
 * `AgentState.data.bodies`. removed
 * `AgentIntentBody` / `AgentIntentDescription` /
 * `AgentIntentObjectComponent` for the same reason — training phrases /
 * entity slots / description now live inline on `AgentIntent.data`.
 */
import { registerInspector } from "../registry"
import { AgentStateEditPanel } from "./AgentStateEditPanel"
import { AgentIntentEditPanel } from "./AgentIntentEditPanel"
import { AgentRagElementEditPanel } from "./AgentRagElementEditPanel"
import { AgentToolEditPanel } from "./AgentToolEditPanel"
import { AgentSkillEditPanel } from "./AgentSkillEditPanel"
import { AgentWorkspaceEditPanel } from "./AgentWorkspaceEditPanel"
import { AgentDiagramEdgeEditPanel } from "./AgentDiagramEdgeEditPanel"
import { AgentDiagramInitEdgeEditPanel } from "./AgentDiagramInitEdgeEditPanel"

// AgentStateEditPanel handles both `stateType: 'standard'` and the folded
// `stateType: 'reasoning'` mode (the former standalone
// `AgentReasoningState` inspector was removed with the node type).
registerInspector("AgentState", "edit", AgentStateEditPanel)
registerInspector("AgentIntent", "edit", AgentIntentEditPanel)
registerInspector("AgentRagElement", "edit", AgentRagElementEditPanel)
registerInspector("AgentTool", "edit", AgentToolEditPanel)
registerInspector("AgentSkill", "edit", AgentSkillEditPanel)
registerInspector("AgentWorkspace", "edit", AgentWorkspaceEditPanel)
registerInspector("AgentStateTransition", "edit", AgentDiagramEdgeEditPanel)
registerInspector(
  "AgentStateTransitionInit",
  "edit",
  AgentDiagramInitEdgeEditPanel
)

export * from "./AgentStateEditPanel"
export * from "./AgentIntentEditPanel"
export * from "./AgentRagElementEditPanel"
export * from "./AgentToolEditPanel"
export * from "./AgentSkillEditPanel"
export * from "./AgentWorkspaceEditPanel"
export * from "./AgentDiagramEdgeEditPanel"
export * from "./AgentDiagramInitEdgeEditPanel"
