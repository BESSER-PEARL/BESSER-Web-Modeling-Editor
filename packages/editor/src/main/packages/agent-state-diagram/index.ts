import { AgentState } from "./agent-state/agent-state";
import { AgentIntent } from "./agent-intent-object-component/agent-intent";

export const AgentElementType = {
  State: 'State',
  StateBody: 'StateBody',
  AgentIntentBody: 'AgentIntentBody',
  StateFallbackBody: 'StateFallbackBody',
  StateActionNode: 'StateActionNode',
  StateFinalNode: 'StateFinalNode',
  StateForkNode: 'StateForkNode',
  StateForkNodeHorizontal: 'StateForkNodeHorizontal',
  StateInitialNode: 'StateInitialNode',
  StateMergeNode: 'StateMergeNode',
  StateObjectNode: 'StateObjectNode',
  StateCodeBlock: 'StateCodeBlock',
  AgentIntent: 'AgentIntent',
  AgentRagElement: 'AgentRagElement',
  AgentState: 'AgentState',
  AgentStateBody: 'AgentStateBody',
  AgentStateFallbackBody: 'AgentStateFallbackBody',
  AgentTool: 'AgentTool',
  AgentSkill: 'AgentSkill',
  AgentWorkspace: 'AgentWorkspace',
  AgentReasoningState: 'AgentReasoningState',
  AgentLLM: 'AgentLLM',
  AgentSectionTitle: 'AgentSectionTitle',
  AgentSectionSeparator: 'AgentSectionSeparator',
} as const;

export const AgentRelationshipType = {
  AgentStateTransition: 'AgentStateTransition',
  AgentStateTransitionInit: 'AgentStateTransitionInit',
} as const;
