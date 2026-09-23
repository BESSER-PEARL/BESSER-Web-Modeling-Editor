import { isSupervisorRole } from './types';
import { resolveUpstreamDivergingGateway } from '../bpmn-flow/bpmn-flow-validator';

// Duck-typed read-only view over the unified elements+flows map (same shape the
// upstream-resolution walkers use — on the editor side this is Redux `state.elements`).
type AnyEl = {
  id: string;
  type: string;
  name?: string;
  owner?: string;
  isAgentic?: boolean;
  role?: string;
  trustScore?: number;
  gatewayRole?: string;
};

// govdsl FLOAT requires a decimal point ([0-9]+ '.' [0-9]+) — always emit 2 dp.
const float2 = (n: number): string => n.toFixed(2);

// govdsl ID = [a-zA-Z_][a-zA-Z0-9_/-]*  (spec §4.5). BPMN names allow spaces /
// punctuation; collapse the rest to '_', prefix '_' if it can't lead an ID.
function sanitizeId(raw: string | undefined, fallback: string): string {
  const base = (raw ?? '').trim();
  if (!base) return fallback;
  let s = base.replace(/[^a-zA-Z0-9_/-]/g, '_');
  if (!/^[a-zA-Z_]/.test(s)) s = '_' + s;
  return s || fallback;
}

// The user picks the governance policy directly from the merge-gateway popup
// dropdown. This is the offered set (LazyConsensus / Composed stay manual-only).
// The string values are the govdsl PolicyType keywords, so the mapping is a
// near-identity.
export type GovPolicyType = 'MajorityPolicy' | 'AbsoluteMajorityPolicy' | 'LeaderDrivenPolicy' | 'ConsensusPolicy';

export const GOV_POLICY_TYPES: readonly GovPolicyType[] = [
  'MajorityPolicy',
  'AbsoluteMajorityPolicy',
  'LeaderDrivenPolicy',
  'ConsensusPolicy',
];

interface PolicyChoice {
  policyType: GovPolicyType;
  ratio?: number; // undefined → no Parameters block (leader-driven / consensus)
}

// The chosen policy type IS the policy. ratio is a FIXED default (never
// trustScore-derived). The voting family takes a ratio; the leader-driven and
// consensus skeletons omit Parameters (the user fills them in).
function policyFor(policyType: GovPolicyType): PolicyChoice {
  switch (policyType) {
    case 'MajorityPolicy':
    case 'AbsoluteMajorityPolicy':
      return { policyType, ratio: 0.5 };
    case 'LeaderDrivenPolicy':
    case 'ConsensusPolicy':
      return { policyType };
  }
}

/**
 * Generate a starter Governance-DSL (.gov) instance for an agentic *merging*
 * gateway. Pure: reads the unified elements map, returns a string. The caller
 * persists it onto the gateway's `governanceDsl` field.
 */
export function generateGovernanceDsl(
  mergingGatewayId: string,
  elementsById: Record<string, AnyEl>,
  policyType: GovPolicyType,
): string {
  const gw = elementsById[mergingGatewayId];
  const trust = typeof gw?.trustScore === 'number' ? gw.trustScore : 0;
  // Back-compat: VotingPolicy is not constructible in govdsl (no case in
  // PolicyCreationListener). Remap silently so old diagrams still generate valid DSL.
  const effectivePolicyType: GovPolicyType = (policyType as string) === 'VotingPolicy' ? 'MajorityPolicy' : policyType;
  const choice = policyFor(effectivePolicyType);

  // Scope = the merging gateway itself (the one-per-block anchor).
  const scopeId = sanitizeId(gw?.name, `MergeDecision_${mergingGatewayId.slice(0, 8)}`);
  const policyId = `${scopeId}Policy`;

  // Participants = the agentic lanes (agents) of the collaboration block —
  // walk forward from the bounding diverging gateway and collect each
  // element's owning lane if the lane is agentic. We check LANE-level isAgentic,
  // not task-level: a normal (non-agentic) task inside an agentic lane is a
  // valid participant because the lane is the agent, not the task.
  const lanes = new Map<string, AnyEl>();
  const diverging = resolveUpstreamDivergingGateway(mergingGatewayId, elementsById);
  if (diverging) {
    // The diverging and merging gateways live in the manager lane and may be
    // the ONLY elements there (no tasks). Seed from both owners explicitly —
    // the diverging is never reached as a BFS target (it is the root), and the
    // merging triggers `continue` before collection, so neither would be picked
    // up by the walk below.
    for (const ownerId of [diverging.owner, elementsById[mergingGatewayId]?.owner]) {
      if (ownerId) {
        const lane = elementsById[ownerId];
        if (lane?.isAgentic) lanes.set(ownerId, lane);
      }
    }

    const bVisited = new Set<string>([diverging.id]);
    const bQueue: string[] = [diverging.id];
    while (bQueue.length > 0) {
      const cur = bQueue.shift()!;
      for (const el of Object.values(elementsById)) {
        if (el.type !== 'BPMNFlow') continue;
        const fl = el as unknown as { flowType?: string; source: { element: string }; target: { element: string } };
        if (fl.flowType !== 'sequence' || fl.source.element !== cur) continue;
        const tgtId = fl.target.element;
        if (bVisited.has(tgtId)) continue;
        bVisited.add(tgtId);
        const tgt = elementsById[tgtId];
        if (!tgt) continue;
        // Stop at the paired agentic merging gateway (block boundary).
        if (tgt.type === 'BPMNGateway' && tgt.isAgentic && tgt.gatewayRole === 'merging') continue;
        // Collect the owner lane for any in-lane element (task, intermediate
        // gateway, event…) — not just BPMNTask.
        if (tgt.owner) {
          const lane = elementsById[tgt.owner];
          if (lane?.isAgentic) lanes.set(tgt.owner, lane);
        }
        bQueue.push(tgtId);
      }
    }
  }

  // For LeaderDrivenPolicy the decision authority is the supervision lane(s).
  // If supervision lanes exist in the block, restrict participants to them;
  // fall back to all agentic lanes when none are present.
  const allLanes = Array.from(lanes.values());
  const supervisionLanes = allLanes.filter((l) => isSupervisorRole(l.role));
  const participantLanes =
    policyType === 'LeaderDrivenPolicy' && supervisionLanes.length > 0 ? supervisionLanes : allLanes;

  const agents: { id: string; confidence: string }[] = [];
  for (const lane of participantLanes) {
    agents.push({
      id: sanitizeId(lane.name, `Agent_${lane.id.slice(0, 8)}`),
      confidence: float2((typeof lane.trustScore === 'number' ? lane.trustScore : 0) / 100),
    });
  }
  const hasAgents = agents.length > 0;

  // ── assemble ──
  const L: string[] = [];
  L.push(`// Generated from agentic merging gateway "${gw?.name ?? mergingGatewayId}"`);
  L.push(`// policyType=${effectivePolicyType}, trustScore=${trust}`);

  L.push('Scopes:');
  L.push('    Tasks:');
  L.push(`        ${scopeId}`);

  L.push('Participants:');
  if (hasAgents) {
    L.push('    Individuals :');
    agents.forEach((a, i) => {
      L.push(`        (Agent) ${a.id} { confidence : ${a.confidence} }${i < agents.length - 1 ? ',' : ''}`);
    });
  } else {
    // Validity fallback (spec §4.2): govdsl requires a non-empty participant set.
    // TODO: Roles : placeholder does not construct in govdsl — replace manually.
    L.push('    Roles : participant');
    L.push('    // TODO: no agentic lanes found in the block — replace this placeholder.');
  }

  const participantList = hasAgents ? agents.map((a) => a.id).join(', ') : 'participant';
  L.push(`${choice.policyType} ${policyId} {`);
  L.push(`    Scope: ${scopeId}`);
  L.push('    DecisionType as BooleanDecision');
  L.push(`    Participant list : ${participantList}`);
  if (choice.ratio !== undefined) {
    L.push('    Parameters:');
    L.push(`        ratio : ${choice.ratio}`);
  }
  L.push('}');
  return L.join('\n');
}
