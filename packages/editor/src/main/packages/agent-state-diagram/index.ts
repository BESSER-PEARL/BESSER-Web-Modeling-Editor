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
  AgentLLM: 'AgentLLM',
  AgentSectionTitle: 'AgentSectionTitle',
  AgentSectionSeparator: 'AgentSectionSeparator',
} as const;

export const AgentRelationshipType = {
  AgentStateTransition: 'AgentStateTransition',
  AgentStateTransitionInit: 'AgentStateTransitionInit',
} as const;

/**
 * Element types of the off-canvas agent components (stored in `UMLModel.components`, edited in
 * the webapp's agent components panel). Every value except `AgentGUI` is also an
 * `AgentElementType` (legacy models kept them in `model.elements`). `AgentGUI` exists only as a
 * component: it has no editor element class, so it is deliberately not part of `AgentElementType`
 * (which feeds the exhaustive element/component/popup registries).
 */
export const AgentComponentType = {
  AgentLLM: AgentElementType.AgentLLM,
  AgentIntent: AgentElementType.AgentIntent,
  AgentIntentBody: AgentElementType.AgentIntentBody,
  AgentRagElement: AgentElementType.AgentRagElement,
  AgentTool: AgentElementType.AgentTool,
  AgentSkill: AgentElementType.AgentSkill,
  AgentWorkspace: AgentElementType.AgentWorkspace,
  AgentGUI: 'AgentGUI',
} as const;

export type AgentComponentType = (typeof AgentComponentType)[keyof typeof AgentComponentType];
