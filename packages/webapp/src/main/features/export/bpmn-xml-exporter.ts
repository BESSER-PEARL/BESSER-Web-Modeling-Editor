import type { UMLModel, BesserNode, BesserEdge } from '@besser/wme';

// BPMN 2.0 XML exporter (v4 {nodes, edges} shape).
//
// Ported from develop's `features/export/bpmn-xml-exporter.ts`, re-targeted from
// the v3 `{elements, relationships}` UMLModel to the migration's v4 shape:
//   - nodes carry `type` as lowerCamelCase RF strings (`bpmnTask`, `bpmnPool`, …),
//     containment via top-level `parentId`, and positions RELATIVE to their parent
//     (React Flow convention);
//   - edges carry one of four `type` strings (`BPMNSequenceFlow` / `BPMNMessageFlow`
//     / `BPMNAssociationFlow` / `BPMNDataAssociationFlow`) instead of a single
//     `BPMNFlow` + `flowType`, plus `data.isDefault` for default sequence flows.
//
// Produces a BPMN 2.0 Collaboration + Process XML with BPMN DI (layout round-trip).
// Node bounds in the DI section are ABSOLUTE — reconstructed by summing each node's
// relative position up its `parentId` chain. No external XML library — BPMN is
// shallow enough to emit as strings.

const POOL_TYPE = 'bpmnPool';
const SWIMLANE_TYPE = 'bpmnSwimlane';

const FLOW_NODE_TYPES: ReadonlySet<string> = new Set([
  'bpmnTask',
  'bpmnSubprocess',
  'bpmnTransaction',
  'bpmnCallActivity',
  'bpmnStartEvent',
  'bpmnIntermediateEvent',
  'bpmnEndEvent',
  'bpmnGateway',
]);

const DATA_TYPES: ReadonlySet<string> = new Set(['bpmnDataObject', 'bpmnDataStore']);
const ARTIFACT_TYPES: ReadonlySet<string> = new Set(['bpmnAnnotation', 'bpmnGroup']);

type FlowKind = 'sequence' | 'message' | 'association' | 'data association';

export interface ExportOptions {
  targetNamespace?: string;
}

export interface ExportResult {
  xml: string;
  skipped: Array<{ id: string; type: string; reason: string }>;
}

// ─── v4 accessors ────────────────────────────────────────────────────────────

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function nodeName(node: BesserNode): string {
  return str(node.data?.name) || str(node.data?.label);
}

function edgeName(edge: BesserEdge): string {
  return str(edge.data?.name) || str(edge.data?.label);
}

function flowKindOf(edgeType: string): FlowKind {
  switch (edgeType) {
    case 'BPMNMessageFlow':
      return 'message';
    case 'BPMNAssociationFlow':
      return 'association';
    case 'BPMNDataAssociationFlow':
      return 'data association';
    default:
      return 'sequence';
  }
}

// Default-flow source eligibility (BPMN 2.0.2 § 8.3.13): an Activity, or an
// Exclusive / Inclusive / Complex gateway. Mirrors develop's shared
// `canSourceCarryDefault`, expressed against v4 node types.
function canSourceCarryDefault(node: BesserNode | undefined): boolean {
  if (!node) return false;
  const t = node.type as string;
  if (t === 'bpmnTask' || t === 'bpmnSubprocess' || t === 'bpmnTransaction' || t === 'bpmnCallActivity') {
    return true;
  }
  if (t !== 'bpmnGateway') return false;
  const gw = str(node.data?.gatewayType) || 'exclusive';
  return gw === 'exclusive' || gw === 'inclusive' || gw === 'complex';
}

// ─── Public entry points ─────────────────────────────────────────────────────

/**
 * Serialize a v4 BPMN UMLModel to a BPMN 2.0 XML string. This is the signature
 * `useGeneratorExecution.ts`'s `'bpmn'` case and the round-trip test call
 * directly. Elements not mapped to standard BPMN 2.0 are silently dropped; use
 * {@link apollonBpmnToXmlDetailed} if you need the skipped report.
 */
export function apollonBpmnToXml(model: UMLModel, opts: ExportOptions = {}): string {
  return apollonBpmnToXmlDetailed(model, opts).xml;
}

export function apollonBpmnToXmlDetailed(model: UMLModel, opts: ExportOptions = {}): ExportResult {
  const targetNs = opts.targetNamespace ?? 'http://besser-pearl.org/bpmn';
  const skipped: ExportResult['skipped'] = [];

  const nodes = (model.nodes ?? []) as BesserNode[];
  const edges = (model.edges ?? []) as BesserEdge[];

  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  // Absolute position: sum the relative position up the parentId chain.
  function absPos(node: BesserNode): { x: number; y: number } {
    let x = node.position?.x ?? 0;
    let y = node.position?.y ?? 0;
    let pid = node.parentId;
    const seen = new Set<string>();
    while (pid && !seen.has(pid)) {
      seen.add(pid);
      const p = nodeById.get(pid);
      if (!p) break;
      x += p.position?.x ?? 0;
      y += p.position?.y ?? 0;
      pid = p.parentId;
    }
    return { x, y };
  }
  function absBounds(node: BesserNode): { x: number; y: number; width: number; height: number } {
    const p = absPos(node);
    return { x: p.x, y: p.y, width: node.width ?? 0, height: node.height ?? 0 };
  }
  function absCenter(nodeId: string): { x: number; y: number } {
    const n = nodeById.get(nodeId);
    if (!n) return { x: 0, y: 0 };
    const b = absBounds(n);
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  }

  // Default-flow map: source-node-id → default-flow-id (first wins).
  const defaultFlowBySource = new Map<string, string>();
  for (const edge of edges) {
    if (
      flowKindOf(edge.type as string) === 'sequence' &&
      edge.data?.isDefault === true &&
      edge.source &&
      !defaultFlowBySource.has(edge.source) &&
      canSourceCarryDefault(nodeById.get(edge.source))
    ) {
      defaultFlowBySource.set(edge.source, edge.id);
    }
  }

  const pools = nodes.filter((n) => n.type === POOL_TYPE);
  const swimlanes = nodes.filter((n) => n.type === SWIMLANE_TYPE);
  const flowNodes = nodes.filter((n) => FLOW_NODE_TYPES.has(n.type as string));
  const dataNodes = nodes.filter((n) => DATA_TYPES.has(n.type as string));
  const artifacts = nodes.filter((n) => ARTIFACT_TYPES.has(n.type as string));

  for (const n of nodes) {
    const t = n.type as string;
    if (t !== POOL_TYPE && t !== SWIMLANE_TYPE && !FLOW_NODE_TYPES.has(t) && !DATA_TYPES.has(t) && !ARTIFACT_TYPES.has(t)) {
      skipped.push({ id: n.id, type: t, reason: 'not mapped to BPMN 2.0' });
    }
  }

  const poolById = new Map(pools.map((p) => [p.id, p]));

  // Resolve which pool (process) a node belongs to by walking parentId.
  function resolvePoolId(node: BesserNode): string | null {
    let pid = node.parentId;
    const seen = new Set<string>();
    while (pid && !seen.has(pid)) {
      seen.add(pid);
      const owner = nodeById.get(pid);
      if (!owner) return null;
      if (owner.type === POOL_TYPE) return owner.id;
      pid = owner.parentId;
    }
    return null;
  }

  const processIdFor = (poolId: string | null) => (poolId ? `Process_${poolId}` : 'Process_default');

  const flowNodesByProcess = groupByProcess(flowNodes, resolvePoolId, processIdFor);
  const dataByProcess = groupByProcess(dataNodes, resolvePoolId, processIdFor);
  const artifactsByProcess = groupByProcess(artifacts, resolvePoolId, processIdFor);

  // Group lanes by pool (a lane's direct/eventual pool owner).
  const lanesByPool = new Map<string, BesserNode[]>();
  for (const lane of swimlanes) {
    const poolId = resolvePoolId(lane) ?? (lane.parentId && poolById.has(lane.parentId) ? lane.parentId : null);
    if (!poolId) continue;
    const bucket = lanesByPool.get(poolId) ?? [];
    bucket.push(lane);
    lanesByPool.set(poolId, bucket);
  }

  // The direct lane owner (if any) of a flow node — for <flowNodeRef>.
  function laneOwnerId(node: BesserNode): string | null {
    let pid = node.parentId;
    const seen = new Set<string>();
    while (pid && !seen.has(pid)) {
      seen.add(pid);
      const owner = nodeById.get(pid);
      if (!owner) return null;
      if (owner.type === SWIMLANE_TYPE) return owner.id;
      if (owner.type === POOL_TYPE) return null;
      pid = owner.parentId;
    }
    return null;
  }

  // Group relationships.
  const sequenceFlowsByProcess = new Map<string, BesserEdge[]>();
  const associationsByProcess = new Map<string, BesserEdge[]>();
  const dataAssociationsByTarget = new Map<string, BesserEdge[]>();
  const messageFlows: BesserEdge[] = [];

  for (const edge of edges) {
    const srcEl = nodeById.get(edge.source);
    const tgtEl = nodeById.get(edge.target);
    if (!srcEl || !tgtEl) {
      skipped.push({ id: edge.id, type: edge.type as string, reason: 'dangling source or target' });
      continue;
    }
    const kind = flowKindOf(edge.type as string);
    if (kind === 'message') {
      messageFlows.push(edge);
    } else if (kind === 'association') {
      const pid = processIdFor(resolvePoolId(srcEl) ?? resolvePoolId(tgtEl));
      pushMap(associationsByProcess, pid, edge);
    } else if (kind === 'data association') {
      const flowNodeEnd = DATA_TYPES.has(srcEl.type as string) ? tgtEl : srcEl;
      pushMap(dataAssociationsByTarget, flowNodeEnd.id, edge);
    } else {
      const pid = processIdFor(resolvePoolId(srcEl) ?? resolvePoolId(tgtEl));
      pushMap(sequenceFlowsByProcess, pid, edge);
    }
  }

  // ─── Assembly ──────────────────────────────────────────────────────────────

  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(
    '<bpmn:definitions ' +
      'xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" ' +
      'xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" ' +
      'xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" ' +
      'xmlns:di="http://www.omg.org/spec/DD/20100524/DI" ' +
      'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
      `id="Definitions_1" targetNamespace="${escapeAttr(targetNs)}">`,
  );

  // Data store top-level definitions.
  const dataStores = dataNodes.filter((d) => d.type === 'bpmnDataStore');
  for (const ds of dataStores) {
    lines.push(`  <bpmn:dataStore id="DataStore_${xid(ds.id)}" name="${escapeAttr(nodeName(ds))}" />`);
  }

  // Group categories top-level.
  const groups = artifacts.filter((a) => a.type === 'bpmnGroup');
  for (const g of groups) {
    lines.push(`  <bpmn:category id="Category_${xid(g.id)}">`);
    lines.push(`    <bpmn:categoryValue id="Category_${xid(g.id)}_val" value="${escapeAttr(nodeName(g))}" />`);
    lines.push(`  </bpmn:category>`);
  }

  // Collaboration (emit when any pool exists).
  const hasCollaboration = pools.length > 0;
  const collaborationId = 'Collaboration_1';
  if (hasCollaboration) {
    lines.push(`  <bpmn:collaboration id="${collaborationId}">`);
    for (const pool of pools) {
      lines.push(
        `    <bpmn:participant id="${xid(pool.id)}" name="${escapeAttr(nodeName(pool))}" processRef="${processIdFor(pool.id)}" />`,
      );
    }
    for (const mf of messageFlows) {
      lines.push(
        `    <bpmn:messageFlow id="${xid(mf.id)}" name="${escapeAttr(edgeName(mf))}" ` +
          `sourceRef="${xid(mf.source)}" targetRef="${xid(mf.target)}" />`,
      );
    }
    lines.push(`  </bpmn:collaboration>`);
  }

  // One process per pool. Plus an implicit default process for pool-less content.
  const processIds: string[] = pools.map((p) => processIdFor(p.id));
  if (
    flowNodesByProcess.has('Process_default') ||
    dataByProcess.has('Process_default') ||
    artifactsByProcess.has('Process_default')
  ) {
    processIds.push('Process_default');
  }

  for (const pid of processIds) {
    const isDefault = pid === 'Process_default';
    const poolId = isDefault ? null : pid.replace(/^Process_/, '');
    const lanes = poolId ? (lanesByPool.get(poolId) ?? []) : [];

    lines.push(`  <bpmn:process id="${pid}" isExecutable="false">`);

    if (lanes.length > 0) {
      lines.push(`    <bpmn:laneSet id="LaneSet_${xid(poolId!)}">`);
      for (const lane of lanes) {
        lines.push(`      <bpmn:lane id="${xid(lane.id)}" name="${escapeAttr(nodeName(lane))}">`);
        for (const node of flowNodes) {
          if (laneOwnerId(node) === lane.id) {
            lines.push(`        <bpmn:flowNodeRef>${xid(node.id)}</bpmn:flowNodeRef>`);
          }
        }
        lines.push(`      </bpmn:lane>`);
      }
      lines.push(`    </bpmn:laneSet>`);
    }

    const processFlowNodes = flowNodesByProcess.get(pid) ?? [];
    for (const node of processFlowNodes) {
      emitFlowNode(lines, node, dataAssociationsByTarget.get(node.id) ?? [], nodeById, defaultFlowBySource);
    }

    const processData = dataByProcess.get(pid) ?? [];
    for (const d of processData) {
      if (d.type === 'bpmnDataObject') {
        lines.push(
          `    <bpmn:dataObjectReference id="${xid(d.id)}" name="${escapeAttr(nodeName(d))}" dataObjectRef="DataObject_${xid(d.id)}" />`,
        );
        lines.push(`    <bpmn:dataObject id="DataObject_${xid(d.id)}" />`);
      } else if (d.type === 'bpmnDataStore') {
        lines.push(
          `    <bpmn:dataStoreReference id="${xid(d.id)}" name="${escapeAttr(nodeName(d))}" dataStoreRef="DataStore_${xid(d.id)}" />`,
        );
      }
    }

    const processArtifacts = artifactsByProcess.get(pid) ?? [];
    for (const a of processArtifacts) {
      if (a.type === 'bpmnAnnotation') {
        lines.push(`    <bpmn:textAnnotation id="${xid(a.id)}">`);
        lines.push(`      <bpmn:text>${escapeText(nodeName(a))}</bpmn:text>`);
        lines.push(`    </bpmn:textAnnotation>`);
      } else if (a.type === 'bpmnGroup') {
        lines.push(`    <bpmn:group id="${xid(a.id)}" categoryValueRef="Category_${xid(a.id)}_val" />`);
      }
    }

    const seqs = sequenceFlowsByProcess.get(pid) ?? [];
    for (const edge of seqs) {
      lines.push(
        `    <bpmn:sequenceFlow id="${xid(edge.id)}" name="${escapeAttr(edgeName(edge))}" ` +
          `sourceRef="${xid(edge.source)}" targetRef="${xid(edge.target)}" />`,
      );
    }

    const assocs = associationsByProcess.get(pid) ?? [];
    for (const edge of assocs) {
      lines.push(
        `    <bpmn:association id="${xid(edge.id)}" ` +
          `sourceRef="${xid(edge.source)}" targetRef="${xid(edge.target)}" ` +
          `associationDirection="None" />`,
      );
    }

    lines.push(`  </bpmn:process>`);
  }

  // ─── BPMN DI ───────────────────────────────────────────────────────────────

  lines.push(`  <bpmndi:BPMNDiagram id="BPMNDiagram_1">`);
  const planeRef = hasCollaboration ? collaborationId : (processIds[0] ?? 'Process_default');
  lines.push(`    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="${xid(planeRef)}">`);

  for (const pool of pools) {
    lines.push(shapeXml(pool.id, absBounds(pool), { isHorizontal: true }));
  }
  for (const lane of swimlanes) {
    lines.push(shapeXml(lane.id, absBounds(lane), { isHorizontal: true }));
  }
  for (const node of flowNodes) {
    lines.push(shapeXml(node.id, absBounds(node)));
  }
  for (const d of dataNodes) {
    lines.push(shapeXml(d.id, absBounds(d)));
  }
  for (const a of artifacts) {
    lines.push(shapeXml(a.id, absBounds(a)));
  }

  for (const edge of edges) {
    if (!nodeById.get(edge.source) || !nodeById.get(edge.target)) continue;
    lines.push(edgeXml(edge, absCenter));
  }

  lines.push(`    </bpmndi:BPMNPlane>`);
  lines.push(`  </bpmndi:BPMNDiagram>`);
  lines.push(`</bpmn:definitions>`);

  return { xml: lines.join('\n'), skipped };
}

// ─── Grouping helpers ────────────────────────────────────────────────────────

function pushMap<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const bucket = map.get(key) ?? [];
  bucket.push(value);
  map.set(key, bucket);
}

function groupByProcess(
  nodes: BesserNode[],
  resolvePoolId: (n: BesserNode) => string | null,
  processIdFor: (poolId: string | null) => string,
): Map<string, BesserNode[]> {
  const out = new Map<string, BesserNode[]>();
  for (const node of nodes) {
    pushMap(out, processIdFor(resolvePoolId(node)), node);
  }
  return out;
}

// ─── Emit helpers ────────────────────────────────────────────────────────────

function emitFlowNode(
  lines: string[],
  node: BesserNode,
  dataAssociations: BesserEdge[],
  nodeById: Map<string, BesserNode>,
  defaultFlowBySource: Map<string, string>,
): void {
  const id = xid(node.id);
  const name = escapeAttr(nodeName(node));
  const defFlow = defaultFlowBySource.get(node.id);
  const defAttr = defFlow ? ` default="${xid(defFlow)}"` : '';

  if (node.type === 'bpmnTask') {
    const tag = taskElementName(str(node.data?.taskType) || 'default');
    const loop = taskLoopCharacteristics(str(node.data?.marker) || 'none');
    const hasChildren = loop !== null || dataAssociations.length > 0;
    if (!hasChildren) {
      lines.push(`    <bpmn:${tag} id="${id}" name="${name}"${defAttr} />`);
    } else {
      lines.push(`    <bpmn:${tag} id="${id}" name="${name}"${defAttr}>`);
      if (loop) lines.push(`      ${loop}`);
      emitDataAssociations(lines, dataAssociations, nodeById);
      lines.push(`    </bpmn:${tag}>`);
    }
    return;
  }

  if (node.type === 'bpmnSubprocess' || node.type === 'bpmnTransaction' || node.type === 'bpmnCallActivity') {
    const tag =
      node.type === 'bpmnSubprocess' ? 'subProcess' : node.type === 'bpmnTransaction' ? 'transaction' : 'callActivity';
    const called =
      node.type === 'bpmnCallActivity' && str(node.data?.calledElement)
        ? ` calledElement="${escapeAttr(str(node.data?.calledElement))}"`
        : '';
    if (dataAssociations.length === 0) {
      lines.push(`    <bpmn:${tag} id="${id}" name="${name}"${called}${defAttr} />`);
    } else {
      lines.push(`    <bpmn:${tag} id="${id}" name="${name}"${called}${defAttr}>`);
      emitDataAssociations(lines, dataAssociations, nodeById);
      lines.push(`    </bpmn:${tag}>`);
    }
    return;
  }

  if (node.type === 'bpmnStartEvent') {
    const def = startEventDefinition(str(node.data?.eventType) || 'default');
    if (!def && dataAssociations.length === 0) {
      lines.push(`    <bpmn:startEvent id="${id}" name="${name}" />`);
    } else {
      lines.push(`    <bpmn:startEvent id="${id}" name="${name}">`);
      if (def) lines.push(`      ${def}`);
      emitDataAssociations(lines, dataAssociations, nodeById);
      lines.push(`    </bpmn:startEvent>`);
    }
    return;
  }

  if (node.type === 'bpmnIntermediateEvent') {
    const [tag, def] = intermediateEventDefinition(str(node.data?.eventType) || 'default');
    if (!def && dataAssociations.length === 0) {
      lines.push(`    <bpmn:${tag} id="${id}" name="${name}" />`);
    } else {
      lines.push(`    <bpmn:${tag} id="${id}" name="${name}">`);
      if (def) lines.push(`      ${def}`);
      emitDataAssociations(lines, dataAssociations, nodeById);
      lines.push(`    </bpmn:${tag}>`);
    }
    return;
  }

  if (node.type === 'bpmnEndEvent') {
    const def = endEventDefinition(str(node.data?.eventType) || 'default');
    if (!def && dataAssociations.length === 0) {
      lines.push(`    <bpmn:endEvent id="${id}" name="${name}" />`);
    } else {
      lines.push(`    <bpmn:endEvent id="${id}" name="${name}">`);
      if (def) lines.push(`      ${def}`);
      emitDataAssociations(lines, dataAssociations, nodeById);
      lines.push(`    </bpmn:endEvent>`);
    }
    return;
  }

  if (node.type === 'bpmnGateway') {
    const tag = gatewayElementName(str(node.data?.gatewayType) || 'exclusive');
    lines.push(`    <bpmn:${tag} id="${id}" name="${name}"${defAttr} />`);
    return;
  }
}

function emitDataAssociations(lines: string[], assocs: BesserEdge[], nodeById: Map<string, BesserNode>): void {
  for (const edge of assocs) {
    const srcType = nodeById.get(edge.source)?.type as string | undefined;
    const isInput = srcType ? DATA_TYPES.has(srcType) : false;
    const tag = isInput ? 'dataInputAssociation' : 'dataOutputAssociation';
    const ref = isInput ? edge.source : edge.target;
    lines.push(`      <bpmn:${tag} id="${xid(edge.id)}">`);
    if (isInput) {
      lines.push(`        <bpmn:sourceRef>${xid(ref)}</bpmn:sourceRef>`);
    } else {
      lines.push(`        <bpmn:targetRef>${xid(ref)}</bpmn:targetRef>`);
    }
    lines.push(`      </bpmn:${tag}>`);
  }
}

function taskElementName(taskType: string): string {
  switch (taskType) {
    case 'user':
      return 'userTask';
    case 'service':
      return 'serviceTask';
    case 'send':
      return 'sendTask';
    case 'receive':
      return 'receiveTask';
    case 'manual':
      return 'manualTask';
    case 'business-rule':
    case 'businessRule':
      return 'businessRuleTask';
    case 'script':
      return 'scriptTask';
    default:
      return 'task';
  }
}

function taskLoopCharacteristics(marker: string): string | null {
  switch (marker) {
    case 'parallel multi instance':
      return '<bpmn:multiInstanceLoopCharacteristics isSequential="false" />';
    case 'sequential multi instance':
      return '<bpmn:multiInstanceLoopCharacteristics isSequential="true" />';
    case 'loop':
      return '<bpmn:standardLoopCharacteristics />';
    default:
      return null;
  }
}

function gatewayElementName(gatewayType: string): string {
  switch (gatewayType) {
    case 'parallel':
      return 'parallelGateway';
    case 'inclusive':
      return 'inclusiveGateway';
    case 'event-based':
      return 'eventBasedGateway';
    case 'complex':
      return 'complexGateway';
    default:
      return 'exclusiveGateway';
  }
}

function startEventDefinition(eventType: string): string | null {
  switch (eventType) {
    case 'message':
      return '<bpmn:messageEventDefinition />';
    case 'timer':
      return '<bpmn:timerEventDefinition />';
    case 'signal':
      return '<bpmn:signalEventDefinition />';
    case 'conditional':
      return '<bpmn:conditionalEventDefinition />';
    case 'escalation':
      return '<bpmn:escalationEventDefinition />';
    case 'error':
      return '<bpmn:errorEventDefinition />';
    case 'compensation':
      return '<bpmn:compensateEventDefinition />';
    case 'link':
      return '<bpmn:linkEventDefinition />';
    default:
      return null;
  }
}

function intermediateEventDefinition(eventType: string): [string, string | null] {
  switch (eventType) {
    case 'message-catch':
      return ['intermediateCatchEvent', '<bpmn:messageEventDefinition />'];
    case 'message-throw':
      return ['intermediateThrowEvent', '<bpmn:messageEventDefinition />'];
    case 'timer-catch':
      return ['intermediateCatchEvent', '<bpmn:timerEventDefinition />'];
    case 'timer-throw':
      return ['intermediateThrowEvent', '<bpmn:timerEventDefinition />'];
    case 'escalation-throw':
      return ['intermediateThrowEvent', '<bpmn:escalationEventDefinition />'];
    case 'conditional-catch':
      return ['intermediateCatchEvent', '<bpmn:conditionalEventDefinition />'];
    case 'link-catch':
      return ['intermediateCatchEvent', '<bpmn:linkEventDefinition />'];
    case 'link-throw':
      return ['intermediateThrowEvent', '<bpmn:linkEventDefinition />'];
    case 'compensation-throw':
      return ['intermediateThrowEvent', '<bpmn:compensateEventDefinition />'];
    case 'signal-catch':
      return ['intermediateCatchEvent', '<bpmn:signalEventDefinition />'];
    case 'signal-throw':
      return ['intermediateThrowEvent', '<bpmn:signalEventDefinition />'];
    default:
      return ['intermediateCatchEvent', null];
  }
}

function endEventDefinition(eventType: string): string | null {
  switch (eventType) {
    case 'message':
      return '<bpmn:messageEventDefinition />';
    case 'escalation':
      return '<bpmn:escalationEventDefinition />';
    case 'error':
      return '<bpmn:errorEventDefinition />';
    case 'compensation':
      return '<bpmn:compensateEventDefinition />';
    case 'signal':
      return '<bpmn:signalEventDefinition />';
    case 'terminate':
      return '<bpmn:terminateEventDefinition />';
    default:
      return null;
  }
}

// ─── DI helpers ──────────────────────────────────────────────────────────────

function shapeXml(
  bpmnId: string,
  bounds: { x: number; y: number; width: number; height: number },
  extra?: { isHorizontal?: boolean },
): string {
  const isH = extra?.isHorizontal ? ' isHorizontal="true"' : '';
  return (
    `    <bpmndi:BPMNShape id="${xid(bpmnId)}_di" bpmnElement="${xid(bpmnId)}"${isH}>\n` +
    `      <dc:Bounds x="${numAttr(bounds.x)}" y="${numAttr(bounds.y)}" width="${numAttr(bounds.width)}" height="${numAttr(bounds.height)}" />\n` +
    `    </bpmndi:BPMNShape>`
  );
}

function edgeXml(edge: BesserEdge, absCenter: (nodeId: string) => { x: number; y: number }): string {
  const rawPts = Array.isArray(edge.data?.points) ? (edge.data.points as Array<{ x?: number; y?: number }>) : [];
  const pts =
    rawPts.length >= 2
      ? rawPts.map((p) => ({ x: p.x ?? 0, y: p.y ?? 0 }))
      : [absCenter(edge.source), absCenter(edge.target)];
  const waypoints = pts.map((p) => `      <di:waypoint x="${numAttr(p.x)}" y="${numAttr(p.y)}" />`).join('\n');
  return `    <bpmndi:BPMNEdge id="${xid(edge.id)}_di" bpmnElement="${xid(edge.id)}">\n` + waypoints + `\n    </bpmndi:BPMNEdge>`;
}

// ─── String helpers ──────────────────────────────────────────────────────────

// IDs in BPMN XML must be a valid NCName. Prefix with `_` when the leading
// character isn't a letter or underscore (UUIDs often start with a digit).
function xid(id: string): string {
  const safe = String(id).replace(/[^A-Za-z0-9_.-]/g, '_');
  return /^[A-Za-z_]/.test(safe) ? safe : `_${safe}`;
}

function escapeAttr(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeText(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function numAttr(n: number): string {
  return Number.isFinite(n) ? String(Math.round(n * 100) / 100) : '0';
}
