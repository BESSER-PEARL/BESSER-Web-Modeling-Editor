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
  AgentState: 'AgentState',
  AgentStateBody: 'AgentStateBody',
  AgentStateFallbackBody: 'AgentStateFallbackBody',
} as const;

export const AgentRelationshipType = {
  AgentStateTransition: 'AgentStateTransition',
  AgentStateTransitionInit: 'AgentStateTransitionInit',
} as const;
