import { UMLDiagramType } from '@besser/wme';
import type { UMLModel, BesserNode, BesserEdge, DiagramNodeType, DiagramEdgeType } from '@besser/wme';
import { uuid } from '../../shared/utils/uuid';

// BPMN 2.0 XML importer (v4 {nodes, edges} shape). Inverse of bpmn-xml-exporter.ts.
//
// Ported from develop's `features/import/bpmn-xml-importer.ts`, re-targeted from
// the v3 `{elements, relationships}` UMLModel to the migration's v4 shape:
//   - every node is a React Flow `BesserNode` with a lowerCamelCase `type`
//     (`bpmnTask`, `bpmnPool`, `bpmnSwimlane`, …), containment via top-level
//     `parentId`, and a position RELATIVE to its direct parent;
//   - every edge is a `BesserEdge` with one of four `type` strings
//     (`BPMNSequenceFlow` / `BPMNMessageFlow` / `BPMNAssociationFlow` /
//     `BPMNDataAssociationFlow`), name in both `data.name` and `data.label`,
//     and `data.isDefault` for default sequence flows.
//
// The XML parsing / element classification / lane+pool nesting reconstruction /
// `default="…"` handling are faithful to develop; only the node/edge construction
// is re-targeted to v4 objects.

export interface ParseWarning {
  code: string;
  message: string;
}

export interface SkippedElement {
  xmlTag: string;
  id?: string;
  reason?: string;
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

// Default-flow source eligibility (BPMN 2.0.2 § 8.3.13): an Activity, or an
// Exclusive / Inclusive / Complex gateway. Expressed against v4 node types.
function canSourceCarryDefault(node: WorkNode | undefined): boolean {
  if (!node) return false;
  const t = node.type;
  if (t === 'bpmnTask' || t === 'bpmnSubprocess' || t === 'bpmnTransaction' || t === 'bpmnCallActivity') {
    return true;
  }
  if (t !== 'bpmnGateway') return false;
  const gw = String(node.data.gatewayType ?? 'exclusive');
  return gw === 'exclusive' || gw === 'inclusive' || gw === 'complex';
}

// ─── DOM helpers (namespace-agnostic via localName) ─────────────────────────

function getLocalName(el: Element): string {
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

// ─── Internal work types (closed-over by the parser) ────────────────────────

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface WorkNode {
  id: string;
  type: string; // v4 lowerCamelCase
  data: Record<string, unknown>; // includes `name` + type-specific fields
  parentId?: string;
  bounds: Bounds; // ABSOLUTE during parsing; converted to relative on emit
}

interface WorkEdge {
  id: string;
  type: DiagramEdgeType | string; // one of the four BPMN flow strings
  source: string;
  target: string;
  name: string;
  flowKind: 'sequence' | 'message' | 'association' | 'data association';
  isDefault?: boolean;
  points: Array<{ x: number; y: number }>; // ABSOLUTE waypoints
}

interface SemanticContext {
  warnings: ParseWarning[];
  skipped: SkippedElement[];
  nodes: WorkNode[];
  edges: WorkEdge[];
  defaultFlowByOwner: Map<string, string>; // sourceNodeId → defaultFlowId
}

function edgeTypeForKind(kind: WorkEdge['flowKind']): DiagramEdgeType | string {
  switch (kind) {
    case 'message':
      return 'BPMNMessageFlow';
    case 'association':
      return 'BPMNAssociationFlow';
    case 'data association':
      return 'BPMNDataAssociationFlow';
    default:
      return 'BPMNSequenceFlow';
  }
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
        ctx.nodes.push(makeNode(poolId, 'bpmnPool', name, undefined));
      }
    }
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
  // 1) Lane set → swimlanes (parent = poolId). Collect flowNodeRef map.
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
      ctx.nodes.push(makeNode(laneId, 'bpmnSwimlane', name, poolId));
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

    const def = child.getAttribute('default');
    if (def) ctx.defaultFlowByOwner.set(id, def);

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

  // 5) Data + artifacts (parented directly to the pool).
  for (const ref of childrenByLocalName(proc, 'dataObjectReference')) {
    ctx.nodes.push(
      makeNode(ref.getAttribute('id') ?? '', 'bpmnDataObject', ref.getAttribute('name') ?? '', poolId ?? undefined),
    );
  }
  for (const ref of childrenByLocalName(proc, 'dataStoreReference')) {
    ctx.nodes.push(
      makeNode(ref.getAttribute('id') ?? '', 'bpmnDataStore', ref.getAttribute('name') ?? '', poolId ?? undefined),
    );
  }
  for (const ta of childrenByLocalName(proc, 'textAnnotation')) {
    const text = childByLocalName(ta, 'text')?.textContent ?? '';
    ctx.nodes.push(makeNode(ta.getAttribute('id') ?? '', 'bpmnAnnotation', text, poolId ?? undefined));
  }
  for (const g of childrenByLocalName(proc, 'group')) {
    ctx.nodes.push(makeNode(g.getAttribute('id') ?? '', 'bpmnGroup', g.getAttribute('name') ?? '', poolId ?? undefined));
  }
}

function createFlowNode(
  el: Element,
  tag: string,
  id: string,
  name: string,
  owner: string | undefined,
): WorkNode | null {
  if (tag in TASK_ELEMENT_TO_TYPE) {
    const n = makeNode(id, 'bpmnTask', name, owner);
    n.data.taskType = TASK_ELEMENT_TO_TYPE[tag];
    n.data.marker = detectLoopMarker(el);
    return n;
  }
  if (tag === 'subProcess') {
    const n = makeNode(id, 'bpmnSubprocess', name, owner);
    n.data.isExpanded = false;
    return n;
  }
  if (tag === 'transaction') {
    const n = makeNode(id, 'bpmnTransaction', name, owner);
    n.data.isExpanded = false;
    return n;
  }
  if (tag === 'callActivity') {
    const n = makeNode(id, 'bpmnCallActivity', name, owner);
    n.data.calledElement = el.getAttribute('calledElement') ?? '';
    return n;
  }
  if (tag in GATEWAY_ELEMENT_TO_TYPE) {
    const n = makeNode(id, 'bpmnGateway', name, owner);
    n.data.gatewayType = GATEWAY_ELEMENT_TO_TYPE[tag];
    return n;
  }
  if (tag === 'startEvent') {
    const defLocal = findFirstEventDefinitionChild(el)?.localName ?? null;
    const n = makeNode(id, 'bpmnStartEvent', name, owner);
    n.data.eventType = defLocal ? (START_EVENT_DEF_TO_TYPE[defLocal] ?? 'default') : 'default';
    return n;
  }
  if (tag === 'endEvent') {
    const defLocal = findFirstEventDefinitionChild(el)?.localName ?? null;
    const n = makeNode(id, 'bpmnEndEvent', name, owner);
    n.data.eventType = defLocal ? (END_EVENT_DEF_TO_TYPE[defLocal] ?? 'default') : 'default';
    return n;
  }
  if (tag === 'intermediateCatchEvent' || tag === 'intermediateThrowEvent') {
    const defLocal = findFirstEventDefinitionChild(el)?.localName ?? null;
    const n = makeNode(id, 'bpmnIntermediateEvent', name, owner);
    n.data.eventType = intermediateEventTypeFor(tag, defLocal);
    return n;
  }
  return null;
}

function detectLoopMarker(el: Element): string {
  if (childByLocalName(el, 'standardLoopCharacteristics')) return 'loop';
  const mi = childByLocalName(el, 'multiInstanceLoopCharacteristics');
  if (mi) return mi.getAttribute('isSequential') === 'true' ? 'sequential multi instance' : 'parallel multi instance';
  return 'none';
}

// Factory: bounds are zero here — filled in by the DI walk.
function makeNode(id: string, type: string, name: string, owner: string | undefined): WorkNode {
  return {
    id,
    type,
    data: { name: name ?? '' },
    ...(owner ? { parentId: owner } : {}),
    bounds: { x: 0, y: 0, width: 0, height: 0 },
  };
}

function makeEdge(el: Element, flowKind: WorkEdge['flowKind']): WorkEdge {
  const id = el.getAttribute('id') ?? '';
  const name = el.getAttribute('name') ?? '';
  const source = el.getAttribute('sourceRef') ?? '';
  const target = el.getAttribute('targetRef') ?? '';
  return { id, type: edgeTypeForKind(flowKind), source, target, name, flowKind, points: [] };
}

function makeAssocEdge(el: Element, source: string, target: string, flowKind: WorkEdge['flowKind']): WorkEdge {
  const id = el.getAttribute('id') ?? '';
  return { id, type: edgeTypeForKind(flowKind), source, target, name: '', flowKind, points: [] };
}

// ─── DI walk ────────────────────────────────────────────────────────────────

interface DiMaps {
  bounds: Map<string, Bounds>;
  waypoints: Map<string, Array<{ x: number; y: number }>>;
}

function parseDiagramInterchange(root: Element): DiMaps {
  const out: DiMaps = { bounds: new Map(), waypoints: new Map() };
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

function applyBoundsToNodes(nodes: WorkNode[], di: DiMaps, warnings: ParseWarning[]): void {
  const abs = di.bounds;
  for (const n of nodes) {
    const b = abs.get(n.id);
    if (b) n.bounds = { x: b.x, y: b.y, width: b.width, height: b.height };
  }
  // Fallback grid layout for nodes without DI.
  const missing = nodes.filter((n) => !abs.get(n.id));
  if (missing.length > 0) {
    warnings.push({ code: 'di-missing', message: `${missing.length} element(s) had no BPMN DI shape; auto-laid-out` });
    let col = 0;
    let row = 0;
    for (const n of missing) {
      n.bounds = { x: 80 + col * 200, y: 60 + row * 120, width: 120, height: 60 };
      col += 1;
      if (col === 6) {
        col = 0;
        row += 1;
      }
    }
  }
}

function applyWaypointsToEdges(edges: WorkEdge[], di: DiMaps, warnings: ParseWarning[]): void {
  for (const e of edges) {
    const pts = di.waypoints.get(e.id);
    if (!pts || pts.length < 2) {
      warnings.push({ code: 'edge-di-missing', message: `Edge ${e.id} has no waypoints; using empty path` });
      continue;
    }
    e.points = pts.map((p) => ({ x: p.x, y: p.y }));
  }
}

function centerOnOrigin(nodes: WorkNode[], edges: WorkEdge[]): void {
  if (nodes.length === 0) return;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.bounds.x);
    minY = Math.min(minY, n.bounds.y);
    maxX = Math.max(maxX, n.bounds.x + n.bounds.width);
    maxY = Math.max(maxY, n.bounds.y + n.bounds.height);
  }
  const dx = -Math.round((minX + maxX) / 2);
  const dy = -Math.round((minY + maxY) / 2);
  if (dx === 0 && dy === 0) return;
  for (const n of nodes) {
    n.bounds = { x: n.bounds.x + dx, y: n.bounds.y + dy, width: n.bounds.width, height: n.bounds.height };
  }
  for (const e of edges) {
    e.points = e.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
  }
}

// ─── Top-level entry point ──────────────────────────────────────────────────

export function bpmnXmlToApollon(xml: string): ImportResult {
  if (!xml || !xml.trim()) {
    throw new Error('Empty BPMN file');
  }

  const dom = new DOMParser().parseFromString(xml, 'application/xml');

  const errEl = dom.getElementsByTagName('parsererror')[0];
  if (errEl) throw new Error('Not a valid XML file');

  const root = dom.documentElement;
  if (!root || root.localName !== 'definitions') {
    throw new Error('Not a BPMN 2.0 document');
  }

  const ctx: SemanticContext = { warnings: [], skipped: [], nodes: [], edges: [], defaultFlowByOwner: new Map() };
  parseDefinitions(root, ctx);

  const di = parseDiagramInterchange(root);
  applyBoundsToNodes(ctx.nodes, di, ctx.warnings);
  applyWaypointsToEdges(ctx.edges, di, ctx.warnings);
  centerOnOrigin(ctx.nodes, ctx.edges);

  // Resolve default flows (BPMN 2.0.2 § 8.3.13).
  const nodeById = new Map(ctx.nodes.map((n) => [n.id, n]));
  for (const [sourceId, flowId] of ctx.defaultFlowByOwner.entries()) {
    const source = nodeById.get(sourceId);
    if (!canSourceCarryDefault(source)) {
      ctx.warnings.push({
        code: 'default-flow-illegal-source',
        message: `Source ${sourceId} (${source?.type ?? 'unknown'}) cannot carry a default sequence flow; dropping default="${flowId}"`,
      });
      continue;
    }
    const flow = ctx.edges.find((e) => e.id === flowId);
    if (!flow) {
      ctx.warnings.push({ code: 'default-flow-missing', message: `default="${flowId}" on ${sourceId} points to no flow` });
      continue;
    }
    if (flow.flowKind !== 'sequence') {
      ctx.warnings.push({
        code: 'default-flow-wrong-type',
        message: `Flow ${flowId} marked default but flowKind=${flow.flowKind}; ignoring`,
      });
      continue;
    }
    flow.isDefault = true;
  }

  // Convert work objects → v4 nodes/edges. Child positions are RELATIVE to their
  // direct parent's absolute position (React Flow convention).
  const absBoundsById = new Map(ctx.nodes.map((n) => [n.id, n.bounds]));
  const nodes: BesserNode[] = ctx.nodes.map((n) => {
    const parentAbs = n.parentId ? absBoundsById.get(n.parentId) : undefined;
    const position = parentAbs
      ? { x: n.bounds.x - parentAbs.x, y: n.bounds.y - parentAbs.y }
      : { x: n.bounds.x, y: n.bounds.y };
    const node: BesserNode = {
      id: n.id,
      type: n.type as DiagramNodeType,
      position,
      width: n.bounds.width,
      height: n.bounds.height,
      measured: { width: n.bounds.width, height: n.bounds.height },
      data: n.data,
      ...(n.parentId ? { parentId: n.parentId } : {}),
    };
    return node;
  });

  const edges: BesserEdge[] = ctx.edges.map((e) => {
    const edge: BesserEdge = {
      id: e.id,
      source: e.source,
      target: e.target,
      type: e.type as DiagramEdgeType,
      sourceHandle: '',
      targetHandle: '',
      data: {
        label: e.name,
        name: e.name,
        ...(e.isDefault ? { isDefault: true } : {}),
        points: e.points,
      },
    };
    return edge;
  });

  const model: UMLModel = {
    version: '4.0.0',
    id: uuid(),
    title: 'Imported BPMN',
    type: UMLDiagramType.BPMN,
    nodes,
    edges,
    assessments: {},
    interactive: { elements: {}, relationships: {} },
  };

  return { model, warnings: ctx.warnings, skipped: ctx.skipped };
}
