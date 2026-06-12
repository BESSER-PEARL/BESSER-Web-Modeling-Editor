/**
 * AgentDiagram node-type registrations.
 *
 * Importing this barrel as a side-effect (from `lib/nodes/index.ts`)
 * extends the central `_nodeTypeRegistry` in `nodes/types.ts` with the
 * BESSER agent-diagram node types per `docs/source/migrations/uml-v4-shape.md`.
 *
 * Removed the standalone `AgentStateBody` /
 * `AgentStateFallbackBody` types — body rows live inline on the parent
 * AgentState's `data.bodies` array.
 *
 * Removed the standalone `AgentIntentBody` /
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
import { AgentReasoningState } from "./AgentReasoningState"
import { AgentTool } from "./AgentTool"
import { AgentSkill } from "./AgentSkill"
import { AgentWorkspace } from "./AgentWorkspace"
import { AgentLLM } from "./AgentLLM"

registerNodeTypes({
  AgentState,
  AgentIntent,
  AgentRagElement,
  // Reasoning primitives (develop parity — Reasoning / Capabilities
  // palette sections).
  AgentReasoningState,
  AgentTool,
  AgentSkill,
  AgentWorkspace,
  // Data-only LLM definition (renders null; no palette entry —
  // managed from the webapp's Agent Customization panel).
  AgentLLM,
})

export * from "./AgentState"
export * from "./AgentIntent"
export * from "./AgentRagElement"
export * from "./AgentReasoningState"
export * from "./AgentTool"
export * from "./AgentSkill"
export * from "./AgentWorkspace"
export * from "./AgentLLM"
export * from "./agentPrimitiveColors"
