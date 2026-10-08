export type BPMNMarkerType = 'none' | 'parallel multi instance' | 'sequential multi instance' | 'loop';

// Agentic BPMN attributes (SEAA'25 extension — paper §4.1–§4.2).
// Folded into the base BPMNSwimlane / BPMNTask as an `isAgentic` flag rather
// than separate element types.
// - BPMNAgentRole: the lane's authorable profile is deliberately small
//   (solution / supervision). It uses the established Component AgentCategory
//   vocabulary directly at derivation time.
// - BPMNReflectionMode: the SelfReflection / CrossReflection / HumanReflection
//   subclasses flattened to an attribute enum; 'none' covers the optional case.
// - clampTrustScore: trustScore is a 0–100 percentage (paper §4.1 / §4.2).
export type BPMNAgentProfile = 'solution' | 'supervision';
// The role field is open like a Component stereotype. The two profile types above
// are presets, while a custom role remains valid persisted model data.
export type BPMNAgentRole = string;

export function isSupervisorRole(role: unknown): boolean {
  return role === 'supervisor' || role === 'supervision';
}

/** Map the BPMN lane profile to the Component/BESSER AgentCategory token. */
export function componentStereotypeForLaneRole(role: unknown): string {
  if (role === 'supervisor' || role === 'supervision') return 'supervision';
  if (typeof role === 'string' && role.trim() !== '') return role.trim();
  return 'solution';
}

// Legacy → new role migration. Older diagrams / .bpmn files / modeling-agent
// output carry the old binary enum; map it on every input boundary (JSON
// deserialize, XML import, agent injection) so the role is never silently
// dropped. Custom values remain intact because the role field is deliberately open.
const LEGACY_ROLE_MAP: Record<string, BPMNAgentRole> = {
  worker: 'solution',
  manager: 'supervision',
  // Accept the brief supervisor spelling as input, but keep existing projects and
  // XML exports on the long-standing supervision token.
  supervisor: 'supervision',
};

export function migrateLegacyRole(role: unknown): BPMNAgentRole {
  if (typeof role !== 'string') return 'solution';
  const normalized = role.trim();
  if (normalized === '') return 'solution';
  return LEGACY_ROLE_MAP[normalized] ?? normalized;
}

export type BPMNReflectionMode = 'none' | 'self' | 'cross' | 'human';

export const clampTrustScore = (n: number): number => Math.min(100, Math.max(0, Math.round(n)));

// Agentic lane multiplicity: the swarm-size count — how many identical copies
// of this agent form the swarm. Integer ≥ 1, default 1, no upper cap.
export const clampMultiplicity = (n: number): number => Math.max(1, Math.round(n));

// Agentic BPMN — gateway role. The diverging-vs-merging split classifies an
// agentic gateway and drives the governance section on the merging side. The
// merge axis speaks governance (the Governance DSL), not invented BPMN
// vocabulary.
export type BPMNGatewayRole = 'diverging' | 'merging';

// Agentic BPMN extension (paper §5, BPMN 2.0.2 § 8.2.3 extension mechanism).
// Custom namespace declared at <bpmn:definitions>; each agentic construct emits
// a `<bpmn:extensionElements><agentic:agentic .../></...>` block as its first
// child, using a flat-attribute shape.
export const AGENTIC_NS_URI = 'https://www.besser-pearl.org/bpmn/agentic';
export const AGENTIC_NS_PREFIX = 'agentic';
