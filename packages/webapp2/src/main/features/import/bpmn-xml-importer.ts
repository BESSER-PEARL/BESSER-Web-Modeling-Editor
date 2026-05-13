import { UMLModel, UMLElement, UMLRelationship, UMLDiagramType } from '@besser/wme';

// Inverse of bpmn-xml-exporter.ts. See .adem/bpmn/04B-bpmn-xml-import-guide.md.
// BPMN 2.0.2 spec citations follow the convention in 04A1.

export const BPMN_NS = 'http://www.omg.org/spec/BPMN/20100524/MODEL';
export const BPMNDI_NS = 'http://www.omg.org/spec/BPMN/20100524/DI';
export const DC_NS = 'http://www.omg.org/spec/DD/20100524/DC';
export const DI_NS = 'http://www.omg.org/spec/DD/20100524/DI';

export interface ParseWarning {
  code: string;
  message: string;
}

export interface SkippedElement {
  id: string;
  xmlTag: string;
  reason: string;
}

export interface ImportResult {
  model: UMLModel;
  warnings: ParseWarning[];
  skipped: SkippedElement[];
}

// ─── Inverse mapping helpers (mirror exporter §3 table) ─────────────────────

const TASK_ELEMENT_TO_TYPE: Record<string, string> = {
  task: 'default',
  userTask: 'user',
  serviceTask: 'service',
  sendTask: 'send',
  receiveTask: 'receive',
  manualTask: 'manual',
  businessRuleTask: 'business-rule',
  scriptTask: 'script',
};

const GATEWAY_ELEMENT_TO_TYPE: Record<string, string> = {
  exclusiveGateway: 'exclusive',
  parallelGateway: 'parallel',
  inclusiveGateway: 'inclusive',
  eventBasedGateway: 'event-based',
  complexGateway: 'complex',
};

const START_EVENT_DEF_TO_TYPE: Record<string, string> = {
  messageEventDefinition: 'message',
  timerEventDefinition: 'timer',
  signalEventDefinition: 'signal',
  conditionalEventDefinition: 'conditional',
  escalationEventDefinition: 'escalation',
  errorEventDefinition: 'error',
  compensateEventDefinition: 'compensation',
  linkEventDefinition: 'link',
};

const END_EVENT_DEF_TO_TYPE: Record<string, string> = {
  messageEventDefinition: 'message',
  escalationEventDefinition: 'escalation',
  errorEventDefinition: 'error',
  compensateEventDefinition: 'compensation',
  signalEventDefinition: 'signal',
  terminateEventDefinition: 'terminate',
};

// Intermediate events split by direction (catch vs throw) × definition.
// Tag is intermediateCatchEvent or intermediateThrowEvent; def is the child.
function intermediateEventTypeFor(tag: string, defLocalName: string | null): string {
  const dir = tag === 'intermediateThrowEvent' ? 'throw' : 'catch';
  const base = (() => {
    switch (defLocalName) {
      case 'messageEventDefinition': return 'message';
      case 'timerEventDefinition': return 'timer';
      case 'signalEventDefinition': return 'signal';
      case 'conditionalEventDefinition': return 'conditional';
      case 'escalationEventDefinition': return 'escalation';
      case 'compensateEventDefinition': return 'compensation';
      case 'linkEventDefinition': return 'link';
      default: return null;
    }
  })();
  return base ? `${base}-${dir}` : 'default';
}

// BPMN 2.0.2 § 8.3.13: only Exclusive/Inclusive/Complex gateways and Activities
// may carry a default outgoing flow. Mirrors `canCarryDefault` in the exporter.
const DEFAULT_ELIGIBLE_ACTIVITY_TYPES = new Set([
  'BPMNTask', 'BPMNSubprocess', 'BPMNTransaction', 'BPMNCallActivity',
]);
const DEFAULT_ELIGIBLE_GATEWAY_TYPES = new Set(['exclusive', 'inclusive', 'complex']);

function canCarryDefault(el: AnyBPMNElement | undefined): boolean {
  if (!el) return false;
  if (DEFAULT_ELIGIBLE_ACTIVITY_TYPES.has(el.type)) return true;
  if (el.type === 'BPMNGateway') return DEFAULT_ELIGIBLE_GATEWAY_TYPES.has(el.gatewayType ?? '');
  return false;
}

// ─── DOM helpers (namespace-agnostic via localName) ─────────────────────────

function getLocalName(el: Element): string {
  // BPMN files in the wild use varying namespace prefixes (bpmn:, bpmn2:, ns:).
  // localName strips the prefix; works for both prefixed and default-NS files.
  return el.localName;
}

function childByLocalName(parent: Element, localName: string): Element | null {
  for (const c of Array.from(parent.children)) {
    if (getLocalName(c) === localName) return c;
  }
  return null;
}

function childrenByLocalName(parent: Element, localName: string): Element[] {
  return Array.from(parent.children).filter((c) => getLocalName(c) === localName);
}

function findFirstEventDefinitionChild(node: Element): Element | null {
  for (const c of Array.from(node.children)) {
    if (getLocalName(c).endsWith('EventDefinition')) return c;
  }
  return null;
}

// ─── Internal types (closed-over by the parser) ─────────────────────────────

interface AnyBPMNElement extends UMLElement {
  taskType?: string;
  marker?: string;
  gatewayType?: string;
  eventType?: string;
}

interface AnyBPMNFlow extends UMLRelationship {
  flowType?: 'sequence' | 'message' | 'association' | 'data association';
  isDefault?: boolean;
}

interface AbsoluteBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ─── Top-level entry point (filled in Step 5) ───────────────────────────────

export function bpmnXmlToApollon(xml: string): ImportResult {
  throw new Error('not implemented — see Step 5');
}
