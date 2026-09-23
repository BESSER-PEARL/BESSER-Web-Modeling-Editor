import { UMLElementType } from '../../uml-element-type';
import { BPMNFlowType } from './bpmn-flow';
import { getAllowedBpmnFlowTypes } from './bpmn-flow-semantics';

// BPMN 2.0.2 § 8.3.13, p. 98 + §§ 10.5.4 / 10.5.6: a default outgoing sequence
// flow may originate only from an Exclusive/Inclusive/Complex gateway or an
// Activity. This is the single source of truth — previously copy-pasted into
// bpmn-flow-update.tsx, bpmn-xml-exporter.ts and bpmn-xml-importer.ts (04A1 §11).
const DEFAULT_ELIGIBLE_ACTIVITY_TYPES: ReadonlySet<string> = new Set<string>([
  UMLElementType.BPMNTask,
  UMLElementType.BPMNSubprocess,
  UMLElementType.BPMNTransaction,
  UMLElementType.BPMNCallActivity,
]);
const DEFAULT_ELIGIBLE_GATEWAY_TYPES: ReadonlySet<string> = new Set<string>(['exclusive', 'inclusive', 'complex']);

/**
 * Duck-typed source element: works for both editor `UMLElement` instances and
 * the serialized `AnyBPMNElement` plain objects used in the host exporter /
 * importer. `gatewayType` is only present on BPMNGateway.
 */
export interface DefaultFlowSource {
  type: string;
  gatewayType?: string;
}

/** BPMN 2.0.2 § 8.3.13 — can this element be the source of a default sequence flow? */
export function canSourceCarryDefault(source: DefaultFlowSource | undefined): boolean {
  if (!source) return false;
  if (DEFAULT_ELIGIBLE_ACTIVITY_TYPES.has(source.type)) return true;
  if (source.type === UMLElementType.BPMNGateway) {
    return DEFAULT_ELIGIBLE_GATEWAY_TYPES.has(source.gatewayType ?? '');
  }
  return false;
}

export type BPMNFlowValidationCode = 'missing-endpoint' | 'illegal-flow-type' | 'default-flow-illegal-source';

export interface BPMNFlowValidationWarning {
  code: BPMNFlowValidationCode;
  flowId: string;
  sourceElementId: string;
  targetElementId: string;
  message: string;
}

/** Minimal duck-typed shapes — the validator only reads, never constructs. */
type AnyElement = { id: string; type: string; gatewayType?: string };
type AnyFlow = AnyElement & {
  flowType?: BPMNFlowType;
  isDefault?: boolean;
  source: { element: string };
  target: { element: string };
};

/** Validate a single BPMN flow against its endpoints. Returns 0+ warnings. */
export function validateBpmnFlow(flow: AnyFlow, elementsById: Record<string, AnyElement>): BPMNFlowValidationWarning[] {
  const warnings: BPMNFlowValidationWarning[] = [];
  const source = elementsById[flow.source.element];
  const target = elementsById[flow.target.element];

  if (!source || !target) {
    warnings.push({
      code: 'missing-endpoint',
      flowId: flow.id,
      sourceElementId: flow.source.element,
      targetElementId: flow.target.element,
      message: `Flow ${flow.id} references a missing ${!source ? 'source' : 'target'} element.`,
    });
    return warnings; // can't check the rest without endpoints
  }

  const flowType = flow.flowType ?? 'sequence';
  const allowed = getAllowedBpmnFlowTypes(source.type as UMLElementType, target.type as UMLElementType);
  if (!allowed.includes(flowType)) {
    warnings.push({
      code: 'illegal-flow-type',
      flowId: flow.id,
      sourceElementId: source.id,
      targetElementId: target.id,
      message: `Illegal flow type "${flowType}" for ${source.type} → ${target.type} (allowed: ${
        allowed.join(', ') || 'none'
      }).`,
    });
  }

  if (flow.isDefault && (flowType !== 'sequence' || !canSourceCarryDefault(source))) {
    warnings.push({
      code: 'default-flow-illegal-source',
      flowId: flow.id,
      sourceElementId: source.id,
      targetElementId: target.id,
      message: `Flow ${flow.id} is marked default but its source ${source.type} cannot carry a default sequence flow.`,
    });
  }

  return warnings;
}

/** Validate every BPMN flow in an elements map. */
export function validateAllBpmnFlows(elementsById: Record<string, AnyElement>): BPMNFlowValidationWarning[] {
  const out: BPMNFlowValidationWarning[] = [];
  for (const el of Object.values(elementsById)) {
    if (el.type === 'BPMNFlow') {
      out.push(...validateBpmnFlow(el as AnyFlow, elementsById));
    }
  }
  return out;
}

// ─── Agentic collaboration-mode resolution (04D2-followup F1) ───────────────
//
// SEAA'25 § 4.3: a collaboration block is enclosed between a diverging and a
// merging gateway. The diverging gateway carries the `CollaborationMode`;
// the merging gateway and any agentic task inside the block *inherit* it.
// These helpers resolve that inheritance from a unified elements+flows map
// (same shape used by validateAllBpmnFlows).

type AnyAgenticGateway = AnyElement & {
  isAgentic?: boolean;
  gatewayRole?: 'diverging' | 'merging';
  gatewayType?: string;
};

type AnyAgenticTask = AnyElement & { isAgentic?: boolean };

// Max BFS depth — guards against degenerate flow graphs. Typical BPMN
// diagrams stay well under this.
const MAX_COLLAB_WALK_DEPTH = 50;

/**
 * Internal: backward BFS from `elementId` via incoming sequence flows. Returns
 * the ID of the nearest *enclosing* agentic diverging gateway, or undefined.
 *
 * Nested collaboration handling (04D2-followup post-O3 fix): when the walk
 * encounters an agentic *merging* gateway, it recurses on that merging to
 * find the inner block's paired diverging gateway, then resumes the walk from
 * the predecessors of that inner diverging — effectively jumping past the
 * inner block. This guarantees that an outer merging gateway resolves to the
 * outer diverging gateway, not to the inner one.
 *
 * `visited` is shared across the recursion so each node is explored at most
 * once per top-level resolution. Cycle-safe.
 */
function findUpstreamDivergingGatewayId(
  elementId: string,
  elementsById: Record<string, AnyElement>,
  visited: Set<string> = new Set(),
): string | undefined {
  let frontier: string[] = [elementId];
  for (let depth = 0; depth < MAX_COLLAB_WALK_DEPTH && frontier.length > 0; depth++) {
    const next: string[] = [];
    for (const id of frontier) {
      if (visited.has(id)) continue;
      visited.add(id);
      for (const el of Object.values(elementsById)) {
        if (el.type !== 'BPMNFlow') continue;
        const flow = el as AnyFlow;
        if (flow.flowType !== 'sequence') continue;
        if (flow.target.element !== id) continue;
        const srcId = flow.source.element;
        if (visited.has(srcId)) continue;
        const src = elementsById[srcId] as AnyAgenticGateway | undefined;
        if (src && src.type === 'BPMNGateway' && src.isAgentic === true) {
          if (src.gatewayRole === 'diverging') {
            return srcId;
          }
          if (src.gatewayRole === 'merging') {
            // Inner block boundary — recurse to find its paired diverging,
            // then continue the outer walk from that diverging's predecessors.
            const innerDiverging = findUpstreamDivergingGatewayId(srcId, elementsById, visited);
            if (innerDiverging !== undefined && !visited.has(innerDiverging)) {
              next.push(innerDiverging);
              continue;
            }
          }
        }
        next.push(srcId);
      }
    }
    frontier = next;
  }
  return undefined;
}

/**
 * Internal: forward BFS from `divergingGatewayId` via outgoing sequence flows.
 * Returns the ID of the first downstream agentic *merging* gateway (the
 * paired one in standard BPMN), or undefined. Skips past nested diverging
 * blocks via mutual recursion. `visited` is shared across the recursion.
 */
function findPairedMergingGatewayId(
  divergingGatewayId: string,
  elementsById: Record<string, AnyElement>,
  visited: Set<string> = new Set(),
): string | undefined {
  let frontier: string[] = [divergingGatewayId];
  for (let depth = 0; depth < MAX_COLLAB_WALK_DEPTH && frontier.length > 0; depth++) {
    const next: string[] = [];
    for (const id of frontier) {
      if (visited.has(id)) continue;
      visited.add(id);
      for (const el of Object.values(elementsById)) {
        if (el.type !== 'BPMNFlow') continue;
        const flow = el as AnyFlow;
        if (flow.flowType !== 'sequence') continue;
        if (flow.source.element !== id) continue;
        const tgtId = flow.target.element;
        if (visited.has(tgtId)) continue;
        const tgt = elementsById[tgtId] as AnyAgenticGateway | undefined;
        if (tgt && tgt.type === 'BPMNGateway' && tgt.isAgentic === true) {
          if (tgt.gatewayRole === 'merging') {
            return tgtId;
          }
          if (tgt.gatewayRole === 'diverging') {
            const innerMerging = findPairedMergingGatewayId(tgtId, elementsById, visited);
            if (innerMerging !== undefined && !visited.has(innerMerging)) {
              next.push(innerMerging);
              continue;
            }
          }
        }
        next.push(tgtId);
      }
    }
    frontier = next;
  }
  return undefined;
}

/**
 * Resolve the nearest *enclosing* agentic diverging gateway by walking back
 * from `elementId` via incoming sequence flows. Returns the gateway element
 * or undefined. Correctly handles nested collaboration blocks — the outer
 * merging gateway resolves to the outer diverging gateway, the inner block's
 * constructs to the inner diverging gateway.
 */
export function resolveUpstreamDivergingGateway(
  elementId: string,
  elementsById: Record<string, AnyElement>,
): AnyElement | undefined {
  const divergingId = findUpstreamDivergingGatewayId(elementId, elementsById);
  if (divergingId === undefined) return undefined;
  return elementsById[divergingId];
}

/**
 * Forward-walk from a diverging gateway via outgoing sequence flows. Collect
 * every agentic task + merging gateway *within this collaboration block*:
 * - Skips past nested diverging blocks via their paired merging gateway
 *   (inner block's constructs belong to the inner diverging, not this one).
 * - Records the paired merging gateway and STOPS descending past it (anything
 *   downstream belongs to the next enclosing block, not this one).
 *
 * Used by the diverging-gateway popup to propagate `collaborationMode` and
 * `gatewayType` changes to constructs that genuinely inherit from this
 * gateway.
 */
export function findDownstreamAgenticConstructs(
  divergingGatewayId: string,
  elementsById: Record<string, AnyElement>,
): { taskIds: string[]; mergingGatewayIds: string[] } {
  const visited = new Set<string>([divergingGatewayId]);
  const queue: string[] = [divergingGatewayId];
  const taskIds: string[] = [];
  const mergingGatewayIds: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const el of Object.values(elementsById)) {
      if (el.type !== 'BPMNFlow') continue;
      const flow = el as AnyFlow;
      if (flow.flowType !== 'sequence') continue;
      if (flow.source.element !== current) continue;
      const tgtId = flow.target.element;
      if (visited.has(tgtId)) continue;
      visited.add(tgtId);
      const tgt = elementsById[tgtId] as AnyAgenticGateway | AnyAgenticTask | undefined;
      if (!tgt) continue;
      // Nested-block boundary: skip past the inner diverging via its paired
      // merging. Don't record either — the inner block belongs to the inner
      // diverging. Continue the outer walk past the inner-merging.
      if (
        tgt.type === 'BPMNGateway' &&
        (tgt as AnyAgenticGateway).isAgentic === true &&
        (tgt as AnyAgenticGateway).gatewayRole === 'diverging'
      ) {
        const innerMerging = findPairedMergingGatewayId(tgtId, elementsById);
        if (innerMerging !== undefined && !visited.has(innerMerging)) {
          visited.add(innerMerging);
          queue.push(innerMerging);
        }
        continue;
      }
      // Paired merging (end of THIS block): record and STOP descending.
      if (
        tgt.type === 'BPMNGateway' &&
        (tgt as AnyAgenticGateway).isAgentic === true &&
        (tgt as AnyAgenticGateway).gatewayRole === 'merging'
      ) {
        mergingGatewayIds.push(tgtId);
        continue;
      }
      if (tgt.type === 'BPMNTask' && (tgt as AnyAgenticTask).isAgentic === true) {
        taskIds.push(tgtId);
      }
      queue.push(tgtId);
    }
  }
  return { taskIds, mergingGatewayIds };
}

/**
 * Return the IDs of every agentic merging gateway in the model whose upstream
 * resolution yields no agentic diverging gateway. Used by the importer to
 * surface a validation warning (04D2-followup F3).
 */
export function findOrphanedMergingGateways(elementsById: Record<string, AnyElement>): string[] {
  const orphans: string[] = [];
  for (const el of Object.values(elementsById)) {
    if (el.type !== 'BPMNGateway') continue;
    const gw = el as AnyAgenticGateway;
    if (gw.isAgentic !== true || gw.gatewayRole !== 'merging') continue;
    if (resolveUpstreamDivergingGateway(gw.id, elementsById) === undefined) {
      orphans.push(gw.id);
    }
  }
  return orphans;
}
