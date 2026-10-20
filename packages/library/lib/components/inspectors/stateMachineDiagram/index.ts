/**
 * StateMachineDiagram inspector registrations.
 *
 * Imported as a side-effect from `lib/components/inspectors/index.ts`,
 * which in turn is imported from `App.tsx`. Registers the panel-editor
 * bodies against the central inspector registry
 * (`registry.ts`); both `PropertiesPanel` and `PopoverManager` resolve
 * their bodies from that registry.
 *
 * Slot keys mirror the v4 `node.type` / `edge.type` strings declared in
 * `nodes/stateMachineDiagram/index.ts` and the spec at
 * `docs/source/migrations/uml-v4-shape.md`.
 */
import { registerInspector } from "../registry"
import { StateEditPanel } from "./StateEditPanel"
import { StateBodyEditPanel } from "./StateBodyEditPanel"
import { StateActionNodeEditPanel } from "./StateActionNodeEditPanel"
import { StateObjectNodeEditPanel } from "./StateObjectNodeEditPanel"
import { StateCodeBlockEditPanel } from "./StateCodeBlockEditPanel"
import { StateLabelEditPanel } from "./StateLabelEditPanel"
import { StateMergeNodeEditPanel } from "./StateMergeNodeEditPanel"
import { StateMachineDiagramEdgeEditPanel } from "./StateMachineDiagramEdgeEditPanel"

registerInspector("State", "edit", StateEditPanel)
registerInspector("StateBody", "edit", StateBodyEditPanel)
registerInspector("StateFallbackBody", "edit", StateBodyEditPanel)
registerInspector("StateActionNode", "edit", StateActionNodeEditPanel)
registerInspector("StateObjectNode", "edit", StateObjectNodeEditPanel)
registerInspector("StateCodeBlock", "edit", StateCodeBlockEditPanel)
// Initial / Final / Fork / ForkHorizontal are
// non-updatable in v3; `StateLabelEditPanel` short-circuits to NULL
// for those types so the inspector renders the empty state.
registerInspector("StateInitialNode", "edit", StateLabelEditPanel)
registerInspector("StateFinalNode", "edit", StateLabelEditPanel)
// Dedicated decisions editor for merge nodes.
registerInspector("StateMergeNode", "edit", StateMergeNodeEditPanel)
registerInspector("StateForkNode", "edit", StateLabelEditPanel)
registerInspector("StateForkNodeHorizontal", "edit", StateLabelEditPanel)
registerInspector("StateTransition", "edit", StateMachineDiagramEdgeEditPanel)

export * from "./StateEditPanel"
export * from "./StateBodyEditPanel"
export * from "./StateActionNodeEditPanel"
export * from "./StateObjectNodeEditPanel"
export * from "./StateCodeBlockEditPanel"
export * from "./StateLabelEditPanel"
export * from "./StateMergeNodeEditPanel"
export * from "./StateMachineDiagramEdgeEditPanel"
