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
 * the serialized `AnyBPMNElement` plain objects used in webapp2's exporter /
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
