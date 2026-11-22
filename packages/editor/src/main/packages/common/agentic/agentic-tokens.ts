/**
 * Agentic-swarm token vocabulary for the Component diagram.
 *
 * These strings are the `.value` strings of the BESSER metamodel enums
 * in `besser/BUML/metamodel/uml_component/agentic.py` (AgentCategory,
 * AgenticEdgeKind). The BESSER converter keys entirely on the WME
 * `stereotype` string, so this module is the WME-side mirror of that
 * contract. Keep it in sync if the metamodel enums change.
 *
 * Agentic-ness is *derived* from the stereotype string, never stored as
 * a typed field.
 */

/** AgentCategory — an agent's collaboration role. `none` is the default
 *  ("an agent, role unspecified") and is intentionally not a preset. */
export const AGENT_CATEGORY_TOKENS = ['solution', 'supervision'] as const;

// Human-actor tokens are intentionally absent: a human has no
// implementation and is not shown in the Component view. The BPMN→Component
// derivation skips non-agentic lanes entirely (see bpmn-to-component.ts).

/** Component capability subtypes. `skill`/`tool` ← `agentic.py` Skill/Tool;
 *  `llm`/`db`/`rag` ← agent-diagram body reply-types
 *  (LLMReply/DBReply/RAGReply), surfaced as Components by the BPMN→Component
 *  derivation. All capabilities — NOT agents (no bot icon: isAgentStereotype
 *  keys only on AGENT_CATEGORY_TOKENS). BESSER `uml_component/agentic.py` token
 *  recognition for llm/db/rag is a pending cross-repo follow-up. */
export const CAPABILITY_TOKENS = ['skill', 'tool', 'llm', 'db', 'rag'] as const;

/** Locality — base-MM `Locality` enum. Non-agentic; classifies any
 *  Component. Included as a stereotype suggestion for convenience. */
export const LOCALITY_TOKENS = ['local', 'external', 'hybrid'] as const;

/** AgenticEdgeKind — the kind of an agentic ComponentDependency. */
export const AGENTIC_EDGE_KIND_TOKENS = [
  // agent → agent
  'delegates',
  'supervises',
  'revises',
  'collaborates',
  // agent → capability
  'has',
  'uses',
  'granted',
  // capability
  'implements',
] as const;

/** Suggestions offered in the Component element stereotype field. */
export const COMPONENT_STEREOTYPE_PRESETS: readonly string[] = [
  ...AGENT_CATEGORY_TOKENS,
  ...CAPABILITY_TOKENS,
  ...LOCALITY_TOKENS,
];

/** Suggestions offered in the ComponentDependency stereotype field. */
export const COMPONENT_EDGE_STEREOTYPE_PRESETS: readonly string[] = [...AGENTIC_EDGE_KIND_TOKENS];

/** Split a free-text stereotype into normalised lowercase tokens.
 *  Mirrors the BESSER converter split `[,\s]+`. */
export function stereotypeTokens(stereotype?: string): string[] {
  return (stereotype ?? '')
    .split(/[,\s]+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

/** True when any token names an AgentCategory — i.e. the element is an agent
 *  (would convert to an `AgenticComponent`). `skill` / `tool` / locality
 *  tokens do NOT make an element an agent. */
export function isAgentStereotype(stereotype?: string): boolean {
  const agentTokens = new Set<string>(AGENT_CATEGORY_TOKENS);
  return stereotypeTokens(stereotype).some((t) => agentTokens.has(t));
}

/** True when any token names an AgenticEdgeKind — i.e. the dependency
 *  is an `AgenticEdge`. */
export function isAgenticEdgeStereotype(stereotype?: string): boolean {
  const kinds = new Set<string>(AGENTIC_EDGE_KIND_TOKENS);
  return stereotypeTokens(stereotype).some((t) => kinds.has(t));
}
