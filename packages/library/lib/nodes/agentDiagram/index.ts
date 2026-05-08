/**
 * SA-4 AgentDiagram node-type registrations.
 *
 * Importing this barrel as a side-effect (from `lib/nodes/index.ts`)
 * extends the central `_nodeTypeRegistry` in `nodes/types.ts` with the
 * 8 BESSER agent-diagram node types per the spec at
 * `docs/source/migrations/uml-v4-shape.md` (AgentDiagram §). Mirrors
 * SA-3's StateMachineDiagram registration pattern.
 *
 * Notes on parent/child:
 *  - `AgentState` is a parent for `AgentStateBody` /
 *    `AgentStateFallbackBody` (and may contain an `AgentRagElement`
 *    inside it via `parentId`).
 *  - `AgentIntent` is a parent for `AgentIntentBody` /
 *    `AgentIntentDescription`. `AgentIntentObjectComponent` is
 *    free-standing (slot binding rendered next to the intent).
 *  - The ParcelId pattern matches SA-3: bodies / descriptions are kept
 *    as separate React-Flow nodes (NOT collapsed onto the parent's
 *    `data`) so the v3 reorder/auto-grow semantics survive.
 */
import { registerNodeTypes } from "../types"
import { AgentState } from "./AgentState"
import { AgentStateBody } from "./AgentStateBody"
import { AgentStateFallbackBody } from "./AgentStateFallbackBody"
import { AgentIntent } from "./AgentIntent"
import { AgentIntentBody } from "./AgentIntentBody"
import { AgentIntentDescription } from "./AgentIntentDescription"
import { AgentIntentObjectComponent } from "./AgentIntentObjectComponent"
import { AgentRagElement } from "./AgentRagElement"

registerNodeTypes({
  AgentState,
  AgentStateBody,
  AgentStateFallbackBody,
  AgentIntent,
  AgentIntentBody,
  AgentIntentDescription,
  AgentIntentObjectComponent,
  AgentRagElement,
})

export * from "./AgentState"
export * from "./AgentStateBody"
export * from "./AgentStateFallbackBody"
export * from "./AgentIntent"
export * from "./AgentIntentBody"
export * from "./AgentIntentDescription"
export * from "./AgentIntentObjectComponent"
export * from "./AgentRagElement"
