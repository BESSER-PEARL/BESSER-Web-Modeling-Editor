/**
 * AgentDiagram node-type registrations.
 *
 * Importing this barrel as a side-effect (from `lib/nodes/index.ts`)
 * extends the central `_nodeTypeRegistry` in `nodes/types.ts` with the
 * BESSER agent-diagram node types per `docs/source/migrations/uml-v4-shape.md`.
 *
 * SA-FIX-Agent removed the standalone `AgentStateBody` /
 * `AgentStateFallbackBody` types — body rows live inline on the parent
 * AgentState's `data.bodies` array.
 *
 * SA-FIX-INTENT-INLINE removed the standalone `AgentIntentBody` /
 * `AgentIntentDescription` / `AgentIntentObjectComponent` types — training
 * phrases / description / entity slots live inline on the parent
 * AgentIntent's `data` arrays and are rendered by `AgentIntent.tsx`
 * directly. Legacy v3 / v4 models that ship those as separate children
 * are folded by `normalizeV4Model` on every import.
 */
import { registerNodeTypes } from "../types"
import { AgentState } from "./AgentState"
import { AgentIntent } from "./AgentIntent"
import { AgentRagElement } from "./AgentRagElement"

registerNodeTypes({
  AgentState,
  AgentIntent,
  AgentRagElement,
})

export * from "./AgentState"
export * from "./AgentIntent"
export * from "./AgentRagElement"
