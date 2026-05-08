/**
 * SA-FIX-Agent AgentDiagram node-type registrations.
 *
 * Importing this barrel as a side-effect (from `lib/nodes/index.ts`)
 * extends the central `_nodeTypeRegistry` in `nodes/types.ts` with the
 * BESSER agent-diagram node types per `docs/source/migrations/uml-v4-shape.md`.
 *
 * SA-FIX-Agent removed the standalone `AgentStateBody` /
 * `AgentStateFallbackBody` node types — the v3 visual rendered body
 * sections inline (entry / do / exit / on / fallback) like a Class node
 * renders attribute / method rows. Those rows now live on the parent's
 * `data.bodies` array and are rendered by `AgentState.tsx` directly.
 *
 * Notes on parent/child:
 *  - `AgentIntent` is a parent for `AgentIntentBody` /
 *    `AgentIntentDescription`. `AgentIntentObjectComponent` is
 *    free-standing (slot binding rendered next to the intent).
 *  - `AgentRagElement` is free-standing.
 */
import { registerNodeTypes } from "../types"
import { AgentState } from "./AgentState"
import { AgentIntent } from "./AgentIntent"
import { AgentIntentBody } from "./AgentIntentBody"
import { AgentIntentDescription } from "./AgentIntentDescription"
import { AgentIntentObjectComponent } from "./AgentIntentObjectComponent"
import { AgentRagElement } from "./AgentRagElement"

registerNodeTypes({
  AgentState,
  AgentIntent,
  AgentIntentBody,
  AgentIntentDescription,
  AgentIntentObjectComponent,
  AgentRagElement,
})

export * from "./AgentState"
export * from "./AgentIntent"
export * from "./AgentIntentBody"
export * from "./AgentIntentDescription"
export * from "./AgentIntentObjectComponent"
export * from "./AgentRagElement"
