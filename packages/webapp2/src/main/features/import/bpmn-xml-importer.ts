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
      case 'messageEventDefinition':
        return 'message';
      case 'timerEventDefinition':
        return 'timer';
      case 'signalEventDefinition':
        return 'signal';
      case 'conditionalEventDefinition':
        return 'conditional';
      case 'escalationEventDefinition':
        return 'escalation';
      case 'compensateEventDefinition':
        return 'compensation';
      case 'linkEventDefinition':
        return 'link';
      default:
        return null;
    }
  })();
  return base ? `${base}-${dir}` : 'default';
}

// BPMN 2.0.2 § 8.3.13: only Exclusive/Inclusive/Complex gateways and Activities
// may carry a default outgoing flow. Mirrors `canCarryDefault` in the exporter.
const DEFAULT_ELIGIBLE_ACTIVITY_TYPES = new Set(['BPMNTask', 'BPMNSubprocess', 'BPMNTransaction', 'BPMNCallActivity']);
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

// ─── Semantic walk ──────────────────────────────────────────────────────────

interface SemanticContext {
  warnings: ParseWarning[];
  skipped: SkippedElement[];
  nodes: AnyBPMNElement[]; // pool, lane, flow-node, data, artifact
  edges: AnyBPMNFlow[]; // sequence / message / association / data-assoc
  defaultFlowByOwner: Map<string, string>; // sourceNodeId → defaultFlowId
}

const FLOW_NODE_TAGS = new Set<string>([
  ...Object.keys(TASK_ELEMENT_TO_TYPE),
  'subProcess',
  'transaction',
  'callActivity',
  'startEvent',
  'intermediateCatchEvent',
  'intermediateThrowEvent',
  'endEvent',
  ...Object.keys(GATEWAY_ELEMENT_TO_TYPE),
]);

function parseDefinitions(root: Element, ctx: SemanticContext): void {
  const collaborations = childrenByLocalName(root, 'collaboration');
  const processes = childrenByLocalName(root, 'process');

  // Map processId → participantId (pool). A process without a participant is pool-less.
  const processToPool = new Map<string, string>();
  for (const collab of collaborations) {
    for (const p of childrenByLocalName(collab, 'participant')) {
      const procRef = p.getAttribute('processRef') ?? '';
      const poolId = p.getAttribute('id') ?? '';
      const name = p.getAttribute('name') ?? '';
      if (poolId) {
        processToPool.set(procRef, poolId);
        ctx.nodes.push(makeNode(poolId, 'BPMNPool', name, undefined));
      }
    }
    // Message flows live at the collaboration level.
    for (const mf of childrenByLocalName(collab, 'messageFlow')) {
      ctx.edges.push(makeEdge(mf, 'message'));
    }
  }

  for (const proc of processes) {
    const procId = proc.getAttribute('id') ?? '';
    const poolId = processToPool.get(procId) ?? null;
    parseProcess(proc, poolId, ctx);
  }
}

function parseProcess(proc: Element, poolId: string | null, ctx: SemanticContext): void {
  // 1) Lane set → swimlanes (owner = poolId). Collect flowNodeRef map.
  const laneOf = new Map<string, string>(); // flowNodeId → laneId
  const laneSet = childByLocalName(proc, 'laneSet');
  if (laneSet) {
    for (const lane of childrenByLocalName(laneSet, 'lane')) {
      const laneId = lane.getAttribute('id') ?? '';
      const name = lane.getAttribute('name') ?? '';
      if (!poolId) {
        ctx.warnings.push({ code: 'lane-without-pool', message: `Lane ${laneId} in pool-less process; ignored` });
        continue;
      }
      ctx.nodes.push(makeNode(laneId, 'BPMNSwimlane', name, poolId));
      for (const ref of childrenByLocalName(lane, 'flowNodeRef')) {
        const id = (ref.textContent ?? '').trim();
        if (id) laneOf.set(id, laneId);
      }
    }
  }

  // 2) Flow nodes.
  for (const child of Array.from(proc.children)) {
    const tag = getLocalName(child);
    if (!FLOW_NODE_TAGS.has(tag)) continue;
    const id = child.getAttribute('id') ?? '';
    const name = child.getAttribute('name') ?? '';
    const owner = laneOf.get(id) ?? poolId ?? undefined;
    const node = createFlowNode(child, tag, id, name, owner);
    if (!node) continue;
    ctx.nodes.push(node);

    // Default-flow attribute (BPMN 2.0.2 § 8.3.13).
    const def = child.getAttribute('default');
    if (def) ctx.defaultFlowByOwner.set(id, def);

    // Data associations nested inside flow nodes.
    for (const dia of childrenByLocalName(child, 'dataInputAssociation')) {
      const ref = childByLocalName(dia, 'sourceRef')?.textContent?.trim() ?? '';
      if (ref) ctx.edges.push(makeAssocEdge(dia, ref, id, 'data association'));
    }
    for (const doa of childrenByLocalName(child, 'dataOutputAssociation')) {
      const ref = childByLocalName(doa, 'targetRef')?.textContent?.trim() ?? '';
      if (ref) ctx.edges.push(makeAssocEdge(doa, id, ref, 'data association'));
    }
  }

  // 3) Sequence flows.
  for (const sf of childrenByLocalName(proc, 'sequenceFlow')) {
    ctx.edges.push(makeEdge(sf, 'sequence'));
  }

  // 4) Associations.
  for (const a of childrenByLocalName(proc, 'association')) {
    ctx.edges.push(makeEdge(a, 'association'));
  }

  // 5) Data + artifacts.
  for (const ref of childrenByLocalName(proc, 'dataObjectReference')) {
    ctx.nodes.push(
      makeNode(ref.getAttribute('id') ?? '', 'BPMNDataObject', ref.getAttribute('name') ?? '', poolId ?? undefined),
    );
  }
  for (const ref of childrenByLocalName(proc, 'dataStoreReference')) {
    ctx.nodes.push(
      makeNode(ref.getAttribute('id') ?? '', 'BPMNDataStore', ref.getAttribute('name') ?? '', poolId ?? undefined),
    );
  }
  for (const ta of childrenByLocalName(proc, 'textAnnotation')) {
    const text = childByLocalName(ta, 'text')?.textContent ?? '';
    ctx.nodes.push(makeNode(ta.getAttribute('id') ?? '', 'BPMNAnnotation', text, poolId ?? undefined));
  }
  for (const g of childrenByLocalName(proc, 'group')) {
    ctx.nodes.push(
      makeNode(g.getAttribute('id') ?? '', 'BPMNGroup', g.getAttribute('name') ?? '', poolId ?? undefined),
    );
  }
}

function createFlowNode(
  el: Element,
  tag: string,
  id: string,
  name: string,
  owner: string | undefined,
): AnyBPMNElement | null {
  if (tag in TASK_ELEMENT_TO_TYPE) {
    return {
      ...makeNode(id, 'BPMNTask', name, owner),
      taskType: TASK_ELEMENT_TO_TYPE[tag],
      marker: detectLoopMarker(el),
    };
  }
  if (tag === 'subProcess') return makeNode(id, 'BPMNSubprocess', name, owner);
  if (tag === 'transaction') return makeNode(id, 'BPMNTransaction', name, owner);
  if (tag === 'callActivity') return makeNode(id, 'BPMNCallActivity', name, owner);
  if (tag in GATEWAY_ELEMENT_TO_TYPE) {
    return { ...makeNode(id, 'BPMNGateway', name, owner), gatewayType: GATEWAY_ELEMENT_TO_TYPE[tag] };
  }
  if (tag === 'startEvent') {
    const defLocal = findFirstEventDefinitionChild(el)?.localName ?? null;
    return {
      ...makeNode(id, 'BPMNStartEvent', name, owner),
      eventType: defLocal ? (START_EVENT_DEF_TO_TYPE[defLocal] ?? 'default') : 'default',
    };
  }
  if (tag === 'endEvent') {
    const defLocal = findFirstEventDefinitionChild(el)?.localName ?? null;
    return {
      ...makeNode(id, 'BPMNEndEvent', name, owner),
      eventType: defLocal ? (END_EVENT_DEF_TO_TYPE[defLocal] ?? 'default') : 'default',
    };
  }
  if (tag === 'intermediateCatchEvent' || tag === 'intermediateThrowEvent') {
    const defLocal = findFirstEventDefinitionChild(el)?.localName ?? null;
    return {
      ...makeNode(id, 'BPMNIntermediateEvent', name, owner),
      eventType: intermediateEventTypeFor(tag, defLocal),
    };
  }
  return null;
}

function detectLoopMarker(el: Element): string {
  if (childByLocalName(el, 'standardLoopCharacteristics')) return 'loop';
  const mi = childByLocalName(el, 'multiInstanceLoopCharacteristics');
  if (mi) return mi.getAttribute('isSequential') === 'true' ? 'sequential multi instance' : 'parallel multi instance';
  return 'none';
}

// Factory: bounds are zero here — filled in by the DI walk (Step 3).
function makeNode(id: string, type: string, name: string, owner: string | undefined): AnyBPMNElement {
  return {
    id,
    type,
    name: name ?? '',
    owner: owner ?? null,
    bounds: { x: 0, y: 0, width: 0, height: 0 },
  } as unknown as AnyBPMNElement;
}

function makeEdge(el: Element, flowType: AnyBPMNFlow['flowType']): AnyBPMNFlow {
  const id = el.getAttribute('id') ?? '';
  const name = el.getAttribute('name') ?? '';
  const source = el.getAttribute('sourceRef') ?? '';
  const target = el.getAttribute('targetRef') ?? '';
  return {
    id,
    type: 'BPMNFlow',
    name,
    owner: null,
    bounds: { x: 0, y: 0, width: 0, height: 0 },
    path: [],
    source: { direction: 'Right', element: source },
    target: { direction: 'Left', element: target },
    isManuallyLayouted: false,
    flowType,
  } as unknown as AnyBPMNFlow;
}

function makeAssocEdge(el: Element, source: string, target: string, flowType: AnyBPMNFlow['flowType']): AnyBPMNFlow {
  const id = el.getAttribute('id') ?? '';
  return {
    id,
    type: 'BPMNFlow',
    name: '',
    owner: null,
    bounds: { x: 0, y: 0, width: 0, height: 0 },
    path: [],
    source: { direction: 'Right', element: source },
    target: { direction: 'Left', element: target },
    isManuallyLayouted: false,
    flowType,
  } as unknown as AnyBPMNFlow;
}

// ─── DI walk ────────────────────────────────────────────────────────────────

interface DiMaps {
  bounds: Map<string, AbsoluteBounds>;
  waypoints: Map<string, Array<{ x: number; y: number }>>;
}

function parseDiagramInterchange(root: Element): DiMaps {
  const out: DiMaps = { bounds: new Map(), waypoints: new Map() };

  // BPMN 2.0.2 § 12 (p. 367): every BPMN element gets a BPMNShape or BPMNEdge in
  // the BPMNPlane. Multi-plane files (subprocess drill-down) are rare; for
  // round-trip with our exporter we only need the primary plane.
  for (const diag of childrenByLocalName(root, 'BPMNDiagram')) {
    for (const plane of childrenByLocalName(diag, 'BPMNPlane')) {
      for (const shape of childrenByLocalName(plane, 'BPMNShape')) {
        const ref = shape.getAttribute('bpmnElement') ?? '';
        const b = childByLocalName(shape, 'Bounds');
        if (!ref || !b) continue;
        out.bounds.set(ref, {
          x: parseFloat(b.getAttribute('x') ?? '0'),
          y: parseFloat(b.getAttribute('y') ?? '0'),
          width: parseFloat(b.getAttribute('width') ?? '0'),
          height: parseFloat(b.getAttribute('height') ?? '0'),
        });
      }
      for (const edge of childrenByLocalName(plane, 'BPMNEdge')) {
        const ref = edge.getAttribute('bpmnElement') ?? '';
        if (!ref) continue;
        const pts = childrenByLocalName(edge, 'waypoint').map((w) => ({
          x: parseFloat(w.getAttribute('x') ?? '0'),
          y: parseFloat(w.getAttribute('y') ?? '0'),
        }));
        if (pts.length >= 2) out.waypoints.set(ref, pts);
      }
    }
  }
  return out;
}

// ─── Coordinate transform (§4 of the guide) ─────────────────────────────────

function applyBoundsToNodes(nodes: AnyBPMNElement[], di: DiMaps, warnings: ParseWarning[]): void {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const abs = di.bounds;

  // Apply absolute first (defensive: a node not in DI gets zeroed bounds; we
  // grid-layout them below if any are missing).
  for (const n of nodes) {
    const b = abs.get(n.id);
    if (b) n.bounds = { x: b.x, y: b.y, width: b.width, height: b.height };
  }

  // Fallback grid layout for nodes without DI (I2).
  const missing = nodes.filter((n) => !abs.get(n.id));
  if (missing.length > 0) {
    warnings.push({ code: 'di-missing', message: `${missing.length} element(s) had no BPMN DI shape; auto-laid-out` });
    let col = 0,
      row = 0;
    for (const n of missing) {
      n.bounds = { x: 80 + col * 200, y: 60 + row * 120, width: 120, height: 60 };
      col += 1;
      if (col === 6) {
        col = 0;
        row += 1;
      }
    }
  }

  // Subtract parent absolute bounds (topological order: pools → lanes → flow nodes / subprocess children).
  const ordered = topologicalOwnerOrder(nodes);
  for (const n of ordered) {
    if (!n.owner) continue;
    const parent = byId.get(n.owner);
    if (!parent) continue;
    const parentAbs = abs.get(parent.id);
    if (!parentAbs) continue;
    n.bounds = {
      x: n.bounds.x - parentAbs.x,
      y: n.bounds.y - parentAbs.y,
      width: n.bounds.width,
      height: n.bounds.height,
    };
  }
}

function topologicalOwnerOrder(nodes: AnyBPMNElement[]): AnyBPMNElement[] {
  // Stable: pools (no owner) → lanes (owner = pool) → flow nodes / data / artifacts.
  // We sort by a depth derived from the owner chain.
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const depthOf = (n: AnyBPMNElement): number => {
    let d = 0;
    let cur: AnyBPMNElement | undefined = n;
    const seen = new Set<string>();
    while (cur?.owner && !seen.has(cur.id)) {
      seen.add(cur.id);
      cur = byId.get(cur.owner);
      d += 1;
    }
    return d;
  };
  return [...nodes].sort((a, b) => depthOf(a) - depthOf(b));
}

function applyBoundsToEdges(edges: AnyBPMNFlow[], di: DiMaps, warnings: ParseWarning[]): void {
  for (const e of edges) {
    const pts = di.waypoints.get(e.id);
    if (!pts || pts.length < 2) {
      warnings.push({ code: 'edge-di-missing', message: `Edge ${e.id} has no waypoints; using zero-length path` });
      continue;
    }
    const xs = pts.map((p) => p.x),
      ys = pts.map((p) => p.y);
    const x = Math.min(...xs),
      y = Math.min(...ys);
    const width = Math.max(...xs) - x,
      height = Math.max(...ys) - y;
    e.bounds = { x, y, width, height };
    e.path = pts.map((p) => ({ x: p.x - x, y: p.y - y })) as any;
  }
}

// ─── Top-level entry point ──────────────────────────────────────────────────

export function bpmnXmlToApollon(xml: string): ImportResult {
  if (!xml || !xml.trim()) {
    throw new Error('Empty BPMN file');
  }

  const dom = new DOMParser().parseFromString(xml, 'application/xml');

  // DOMParser embeds <parsererror> on bad XML.
  const errEl = dom.getElementsByTagName('parsererror')[0];
  if (errEl) throw new Error(`Failed to parse BPMN XML: ${errEl.textContent?.trim() ?? 'malformed XML'}`);

  const root = dom.documentElement;
  if (!root || root.localName !== 'definitions') {
    throw new Error('Not a BPMN 2.0 document (missing <bpmn:definitions> root)');
  }

  const ctx: SemanticContext = { warnings: [], skipped: [], nodes: [], edges: [], defaultFlowByOwner: new Map() };
  parseDefinitions(root, ctx);

  const di = parseDiagramInterchange(root);
  applyBoundsToNodes(ctx.nodes, di, ctx.warnings);
  applyBoundsToEdges(ctx.edges, di, ctx.warnings);

  // Resolve default flows (BPMN 2.0.2 § 8.3.13, spec-strict source check from 04A1).
  const elementById = new Map(ctx.nodes.map((n) => [n.id, n]));
  for (const [sourceId, flowId] of ctx.defaultFlowByOwner.entries()) {
    const source = elementById.get(sourceId);
    if (!canCarryDefault(source)) {
      ctx.warnings.push({
        code: 'default-flow-illegal-source',
        message: `Source ${sourceId} (${source?.type ?? 'unknown'}) cannot carry a default sequence flow; dropping default="${flowId}"`,
      });
      continue;
    }
    const flow = ctx.edges.find((e) => e.id === flowId);
    if (!flow) {
      ctx.warnings.push({
        code: 'default-flow-missing',
        message: `default="${flowId}" on ${sourceId} points to no flow`,
      });
      continue;
    }
    if (flow.flowType !== 'sequence') {
      ctx.warnings.push({
        code: 'default-flow-wrong-type',
        message: `Flow ${flowId} marked default but flowType=${flow.flowType}; ignoring`,
      });
      continue;
    }
    flow.isDefault = true;
  }

  // Emit UMLModel.
  const elements: Record<string, UMLElement> = {};
  for (const n of ctx.nodes) elements[n.id] = n;
  const relationships: Record<string, UMLRelationship> = {};
  for (const e of ctx.edges) relationships[e.id] = e;

  // Canvas bounds: bounding box of all top-level (owner=null) shapes + edges.
  const topLevel = ctx.nodes.filter((n) => !n.owner);
  const size = computeCanvasSize(topLevel, ctx.edges);

  const model: UMLModel = {
    version: '3.0.0',
    type: UMLDiagramType.BPMN,
    size,
    interactive: { elements: {}, relationships: {} },
    elements,
    relationships,
    assessments: {},
  };

  return { model, warnings: ctx.warnings, skipped: ctx.skipped };
}

function computeCanvasSize(topLevel: AnyBPMNElement[], edges: AnyBPMNFlow[]): { width: number; height: number } {
  let maxX = 0,
    maxY = 0;
  for (const n of topLevel) {
    maxX = Math.max(maxX, n.bounds.x + n.bounds.width);
    maxY = Math.max(maxY, n.bounds.y + n.bounds.height);
  }
  for (const e of edges) {
    maxX = Math.max(maxX, e.bounds.x + e.bounds.width);
    maxY = Math.max(maxY, e.bounds.y + e.bounds.height);
  }
  return { width: Math.max(800, Math.ceil(maxX + 80)), height: Math.max(600, Math.ceil(maxY + 80)) };
}
