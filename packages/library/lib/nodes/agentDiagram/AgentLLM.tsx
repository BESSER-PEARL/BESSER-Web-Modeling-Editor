import { NodeProps, type Node } from "@xyflow/react"
import { AgentLLMNodeProps } from "@/types"

/**
 * `AgentLLM` — registered LLM definition. **Data-only**: renders
 * nothing on the canvas. Develop parity: `packages/components.ts`
 * registers `AgentLLMNoopComponent` ("AgentLLM is a data-only element
 * managed exclusively from the agent customization panel") and
 * `popups.ts` maps it to `null`, with every interaction feature
 * disabled on the element class (`agent-llm.ts`).
 *
 * The node still has to be a registered React Flow node type so the
 * canvas does not warn / fall back to the default node renderer when a
 * model containing LLM definitions is loaded. The webapp's Agent
 * Customization panel (LLMs card) is the only editing surface.
 */
export function AgentLLM(_props: NodeProps<Node<AgentLLMNodeProps>>) {
  return null
}
