import { UMLModel, UMLElement, UMLRelationship } from '@besser/wme';

// BPMN 2.0 XML exporter. See .adem/bpmn/bpmn-xml-export-guide.md for design decisions.
//
// Produces a BPMN 2.0 Collaboration + Process XML with BPMN DI (layout round-trip).
// Elements not mapped to standard BPMN 2.0 are skipped and reported in `skipped`.
// No external XML library — BPMN is shallow enough to emit as strings.

type BpmnElementType =
  | 'BPMNPool'
  | 'BPMNSwimlane'
  | 'BPMNTask'
  | 'BPMNSubprocess'
  | 'BPMNTransaction'
  | 'BPMNCallActivity'
  | 'BPMNStartEvent'
  | 'BPMNIntermediateEvent'
  | 'BPMNEndEvent'
  | 'BPMNGateway'
  | 'BPMNAnnotation'
  | 'BPMNGroup'
  | 'BPMNDataObject'
  | 'BPMNDataStore';

const FLOW_NODE_TYPES: ReadonlySet<string> = new Set([
  'BPMNTask',
  'BPMNSubprocess',
  'BPMNTransaction',
  'BPMNCallActivity',
  'BPMNStartEvent',
  'BPMNIntermediateEvent',
  'BPMNEndEvent',
  'BPMNGateway',
]);

const DATA_TYPES: ReadonlySet<string> = new Set(['BPMNDataObject', 'BPMNDataStore']);
const ARTIFACT_TYPES: ReadonlySet<string> = new Set(['BPMNAnnotation', 'BPMNGroup']);

interface AnyBPMNElement extends UMLElement {
  taskType?: string;
  marker?: string;
  gatewayType?: string;
  eventType?: string;
}

interface AnyBPMNFlow extends UMLRelationship {
  flowType?: string;
  isDefault?: boolean;
}

export interface ExportOptions {
  targetNamespace?: string;
}

export interface ExportResult {
  xml: string;
  skipped: Array<{ id: string; type: string; reason: string }>;
}

export function apollonBpmnToXml(model: UMLModel, opts: ExportOptions = {}): ExportResult {
  const targetNs = opts.targetNamespace ?? 'http://besser-pearl.org/bpmn';
  const skipped: ExportResult['skipped'] = [];

  const elements = Object.values(model.elements) as AnyBPMNElement[];
  const relationships = Object.values(model.relationships) as AnyBPMNFlow[];

  // Build a map of source-node-id → default-flow-id. Only sequence flows on
  // gateway/activity sources can be default; events cannot. The "one default
  // per source" invariant is enforced upstream (validator/popup); on conflict
  // we keep the first and skip the rest.
  const defaultFlowBySource = new Map<string, string>();
  for (const rel of relationships) {
    if (
      rel.type === 'BPMNFlow' &&
      rel.isDefault &&
      rel.flowType === 'sequence' &&
      rel.source?.element &&
      !defaultFlowBySource.has(rel.source.element)
    ) {
      defaultFlowBySource.set(rel.source.element, rel.id);
    }
  }

  const pools = elements.filter((e) => e.type === 'BPMNPool');
  const swimlanes = elements.filter((e) => e.type === 'BPMNSwimlane');
  const flowNodes = elements.filter((e) => FLOW_NODE_TYPES.has(e.type));
  const dataNodes = elements.filter((e) => DATA_TYPES.has(e.type));
  const artifacts = elements.filter((e) => ARTIFACT_TYPES.has(e.type));

  // Identify unmapped element types (e.g., future SEAA'25 extensions).
  for (const el of elements) {
    if (
      el.type !== 'BPMNPool' &&
      el.type !== 'BPMNSwimlane' &&
      !FLOW_NODE_TYPES.has(el.type) &&
      !DATA_TYPES.has(el.type) &&
      !ARTIFACT_TYPES.has(el.type)
    ) {
      skipped.push({ id: el.id, type: el.type, reason: 'not mapped to BPMN 2.0' });
    }
  }

  // Resolve which process each flow node belongs to. A flow node's lane owner
  // gives us the pool (lane.owner), which becomes a process. Flow nodes outside
  // any pool go into an implicit default process.
  const swimlaneById = new Map(swimlanes.map((l) => [l.id, l]));
  const poolById = new Map(pools.map((p) => [p.id, p]));

  function resolvePoolId(el: AnyBPMNElement): string | null {
    let ownerId = el.owner;
    while (ownerId) {
      const owner = model.elements[ownerId] as AnyBPMNElement | undefined;
      if (!owner) return null;
      if (owner.type === 'BPMNPool') return owner.id;
      ownerId = owner.owner;
    }
    return null;
  }

  const processIdFor = (poolId: string | null) => (poolId ? `Process_${poolId}` : 'Process_default');

  // Group flow nodes by process.
  const flowNodesByProcess = new Map<string, AnyBPMNElement[]>();
  for (const node of flowNodes) {
    const poolId = resolvePoolId(node);
    const pid = processIdFor(poolId);
    const bucket = flowNodesByProcess.get(pid) ?? [];
    bucket.push(node);
    flowNodesByProcess.set(pid, bucket);
  }

  // Group data + artifacts by process too.
  const dataByProcess = new Map<string, AnyBPMNElement[]>();
  for (const node of dataNodes) {
    const poolId = resolvePoolId(node);
    const pid = processIdFor(poolId);
    const bucket = dataByProcess.get(pid) ?? [];
    bucket.push(node);
    dataByProcess.set(pid, bucket);
  }

  const artifactsByProcess = new Map<string, AnyBPMNElement[]>();
  for (const node of artifacts) {
    const poolId = resolvePoolId(node);
    const pid = processIdFor(poolId);
    const bucket = artifactsByProcess.get(pid) ?? [];
    bucket.push(node);
    artifactsByProcess.set(pid, bucket);
  }

  // Group lanes by pool.
  const lanesByPool = new Map<string, AnyBPMNElement[]>();
  for (const lane of swimlanes) {
    const poolId = lane.owner && poolById.has(lane.owner) ? lane.owner : null;
    if (!poolId) continue;
    const bucket = lanesByPool.get(poolId) ?? [];
    bucket.push(lane);
    lanesByPool.set(poolId, bucket);
  }

  // Group relationships: sequence/association/data-association inside a process,
  // message flow inside the collaboration.
  const sequenceFlowsByProcess = new Map<string, AnyBPMNFlow[]>();
  const associationsByProcess = new Map<string, AnyBPMNFlow[]>();
  const dataAssociationsByTarget = new Map<string, AnyBPMNFlow[]>();
  const messageFlows: AnyBPMNFlow[] = [];

  for (const rel of relationships) {
    if (rel.type !== 'BPMNFlow') {
      skipped.push({ id: rel.id, type: rel.type, reason: 'relationship not a BPMNFlow' });
      continue;
    }
    const flowType = rel.flowType ?? 'sequence';
    const srcEl = model.elements[rel.source.element] as AnyBPMNElement | undefined;
    const tgtEl = model.elements[rel.target.element] as AnyBPMNElement | undefined;
    if (!srcEl || !tgtEl) {
      skipped.push({ id: rel.id, type: rel.type, reason: 'dangling source or target' });
      continue;
    }

    if (flowType === 'message') {
      messageFlows.push(rel);
    } else if (flowType === 'association') {
      const pid = processIdFor(resolvePoolId(srcEl) ?? resolvePoolId(tgtEl));
      const bucket = associationsByProcess.get(pid) ?? [];
      bucket.push(rel);
      associationsByProcess.set(pid, bucket);
    } else if (flowType === 'data association') {
      // Nest inside the flow-node side. Convention: the non-data endpoint owns it.
      const flowNodeEnd = DATA_TYPES.has(srcEl.type) ? tgtEl : srcEl;
      const bucket = dataAssociationsByTarget.get(flowNodeEnd.id) ?? [];
      bucket.push(rel);
      dataAssociationsByTarget.set(flowNodeEnd.id, bucket);
    } else {
      // sequence
      const pid = processIdFor(resolvePoolId(srcEl) ?? resolvePoolId(tgtEl));
      const bucket = sequenceFlowsByProcess.get(pid) ?? [];
      bucket.push(rel);
      sequenceFlowsByProcess.set(pid, bucket);
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

  // Data store top-level definitions (one per BPMNDataStore).
  const dataStores = dataNodes.filter((d) => d.type === 'BPMNDataStore');
  for (const ds of dataStores) {
    lines.push(`  <bpmn:dataStore id="DataStore_${xid(ds.id)}" name="${escapeAttr(ds.name)}" />`);
  }

  // Group categories top-level (one per BPMNGroup).
  const groups = artifacts.filter((a) => a.type === 'BPMNGroup');
  for (const g of groups) {
    lines.push(`  <bpmn:category id="Category_${xid(g.id)}">`);
    lines.push(`    <bpmn:categoryValue id="Category_${xid(g.id)}_val" value="${escapeAttr(g.name)}" />`);
    lines.push(`  </bpmn:category>`);
  }

  // Collaboration (always emit if any pool exists).
  const hasCollaboration = pools.length > 0;
  const collaborationId = 'Collaboration_1';
  if (hasCollaboration) {
    lines.push(`  <bpmn:collaboration id="${collaborationId}">`);
    for (const pool of pools) {
      lines.push(
        `    <bpmn:participant id="${xid(pool.id)}" name="${escapeAttr(pool.name)}" processRef="${processIdFor(pool.id)}" />`,
      );
    }
    for (const mf of messageFlows) {
      lines.push(
        `    <bpmn:messageFlow id="${xid(mf.id)}" name="${escapeAttr(mf.name || '')}" ` +
          `sourceRef="${xid(mf.source.element)}" targetRef="${xid(mf.target.element)}" />`,
      );
    }
    lines.push(`  </bpmn:collaboration>`);
  }

  // One process per pool. Plus an implicit default process if any flow nodes are pool-less.
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

    // Lane set.
    if (lanes.length > 0) {
      lines.push(`    <bpmn:laneSet id="LaneSet_${xid(poolId!)}">`);
      for (const lane of lanes) {
        lines.push(`      <bpmn:lane id="${xid(lane.id)}" name="${escapeAttr(lane.name)}">`);
        for (const node of flowNodes) {
          if (node.owner === lane.id) {
            lines.push(`        <bpmn:flowNodeRef>${xid(node.id)}</bpmn:flowNodeRef>`);
          }
        }
        lines.push(`      </bpmn:lane>`);
      }
      lines.push(`    </bpmn:laneSet>`);
    }

    // Flow nodes.
    const processFlowNodes = flowNodesByProcess.get(pid) ?? [];
    for (const node of processFlowNodes) {
      emitFlowNode(lines, node, dataAssociationsByTarget.get(node.id) ?? [], model, defaultFlowBySource);
    }

    // Data nodes.
    const processData = dataByProcess.get(pid) ?? [];
    for (const d of processData) {
      if (d.type === 'BPMNDataObject') {
        lines.push(
          `    <bpmn:dataObjectReference id="${xid(d.id)}" name="${escapeAttr(d.name)}" dataObjectRef="DataObject_${xid(d.id)}" />`,
        );
        lines.push(`    <bpmn:dataObject id="DataObject_${xid(d.id)}" />`);
      } else if (d.type === 'BPMNDataStore') {
        lines.push(
          `    <bpmn:dataStoreReference id="${xid(d.id)}" name="${escapeAttr(d.name)}" dataStoreRef="DataStore_${xid(d.id)}" />`,
        );
      }
    }

    // Artifacts.
    const processArtifacts = artifactsByProcess.get(pid) ?? [];
    for (const a of processArtifacts) {
      if (a.type === 'BPMNAnnotation') {
        lines.push(`    <bpmn:textAnnotation id="${xid(a.id)}">`);
        lines.push(`      <bpmn:text>${escapeText(a.name)}</bpmn:text>`);
        lines.push(`    </bpmn:textAnnotation>`);
      } else if (a.type === 'BPMNGroup') {
        lines.push(`    <bpmn:group id="${xid(a.id)}" categoryValueRef="Category_${xid(a.id)}_val" />`);
      }
    }

    // Sequence flows.
    const seqs = sequenceFlowsByProcess.get(pid) ?? [];
    for (const rel of seqs) {
      lines.push(
        `    <bpmn:sequenceFlow id="${xid(rel.id)}" name="${escapeAttr(rel.name || '')}" ` +
          `sourceRef="${xid(rel.source.element)}" targetRef="${xid(rel.target.element)}" />`,
      );
    }

    // Associations.
    const assocs = associationsByProcess.get(pid) ?? [];
    for (const rel of assocs) {
      lines.push(
        `    <bpmn:association id="${xid(rel.id)}" ` +
          `sourceRef="${xid(rel.source.element)}" targetRef="${xid(rel.target.element)}" ` +
          `associationDirection="None" />`,
      );
    }

    lines.push(`  </bpmn:process>`);
  }

  // ─── BPMN DI ───────────────────────────────────────────────────────────────

  lines.push(`  <bpmndi:BPMNDiagram id="BPMNDiagram_1">`);
  const planeRef = hasCollaboration ? collaborationId : (processIds[0] ?? 'Process_default');
  lines.push(`    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="${xid(planeRef)}">`);

  // Shapes for pools, lanes, flow nodes, data, annotations, groups.
  for (const pool of pools) {
    lines.push(shapeXml(pool.id, pool.bounds, { isHorizontal: true }));
  }
  for (const lane of swimlanes) {
    lines.push(shapeXml(lane.id, lane.bounds, { isHorizontal: true }));
  }
  for (const node of flowNodes) {
    lines.push(shapeXml(node.id, node.bounds));
  }
  for (const d of dataNodes) {
    lines.push(shapeXml(d.id, d.bounds));
  }
  for (const a of artifacts) {
    lines.push(shapeXml(a.id, a.bounds));
  }

  // Edges for every relationship that made it into the model (sequence, message,
  // association, data association). We skip data associations here because they
  // nest inside flow nodes — the DI edge is still useful for round-trip, so emit
  // it.
  for (const rel of relationships) {
    if (rel.type !== 'BPMNFlow') continue;
    const srcEl = model.elements[rel.source.element];
    const tgtEl = model.elements[rel.target.element];
    if (!srcEl || !tgtEl) continue;
    lines.push(edgeXml(rel));
  }

  lines.push(`    </bpmndi:BPMNPlane>`);
  lines.push(`  </bpmndi:BPMNDiagram>`);

  lines.push(`</bpmn:definitions>`);

  return { xml: lines.join('\n'), skipped };
}

// ─── Emit helpers ────────────────────────────────────────────────────────────

function emitFlowNode(
  lines: string[],
  node: AnyBPMNElement,
  dataAssociations: AnyBPMNFlow[],
  model: UMLModel,
  defaultFlowBySource: Map<string, string>,
): void {
  const id = xid(node.id);
  const name = escapeAttr(node.name || '');
  const defFlow = defaultFlowBySource.get(node.id);
  const defAttr = defFlow ? ` default="${xid(defFlow)}"` : '';

  if (node.type === 'BPMNTask') {
    const tag = taskElementName(node.taskType ?? 'default');
    const loop = taskLoopCharacteristics(node.marker ?? 'none');
    const hasChildren = loop !== null || dataAssociations.length > 0;
    if (!hasChildren) {
      lines.push(`    <bpmn:${tag} id="${id}" name="${name}"${defAttr} />`);
    } else {
      lines.push(`    <bpmn:${tag} id="${id}" name="${name}"${defAttr}>`);
      if (loop) lines.push(`      ${loop}`);
      emitDataAssociations(lines, dataAssociations, model);
      lines.push(`    </bpmn:${tag}>`);
    }
    return;
  }

  if (node.type === 'BPMNSubprocess' || node.type === 'BPMNTransaction' || node.type === 'BPMNCallActivity') {
    const tag =
      node.type === 'BPMNSubprocess' ? 'subProcess' : node.type === 'BPMNTransaction' ? 'transaction' : 'callActivity';
    if (dataAssociations.length === 0) {
      lines.push(`    <bpmn:${tag} id="${id}" name="${name}"${defAttr} />`);
    } else {
      lines.push(`    <bpmn:${tag} id="${id}" name="${name}"${defAttr}>`);
      emitDataAssociations(lines, dataAssociations, model);
      lines.push(`    </bpmn:${tag}>`);
    }
    return;
  }

  if (node.type === 'BPMNStartEvent') {
    const def = startEventDefinition(node.eventType ?? 'default');
    if (!def && dataAssociations.length === 0) {
      lines.push(`    <bpmn:startEvent id="${id}" name="${name}" />`);
    } else {
      lines.push(`    <bpmn:startEvent id="${id}" name="${name}">`);
      if (def) lines.push(`      ${def}`);
      emitDataAssociations(lines, dataAssociations, model);
      lines.push(`    </bpmn:startEvent>`);
    }
    return;
  }

  if (node.type === 'BPMNIntermediateEvent') {
    const [tag, def] = intermediateEventDefinition(node.eventType ?? 'default');
    if (!def && dataAssociations.length === 0) {
      lines.push(`    <bpmn:${tag} id="${id}" name="${name}" />`);
    } else {
      lines.push(`    <bpmn:${tag} id="${id}" name="${name}">`);
      if (def) lines.push(`      ${def}`);
      emitDataAssociations(lines, dataAssociations, model);
      lines.push(`    </bpmn:${tag}>`);
    }
    return;
  }

  if (node.type === 'BPMNEndEvent') {
    const def = endEventDefinition(node.eventType ?? 'default');
    if (!def && dataAssociations.length === 0) {
      lines.push(`    <bpmn:endEvent id="${id}" name="${name}" />`);
    } else {
      lines.push(`    <bpmn:endEvent id="${id}" name="${name}">`);
      if (def) lines.push(`      ${def}`);
      emitDataAssociations(lines, dataAssociations, model);
      lines.push(`    </bpmn:endEvent>`);
    }
    return;
  }

  if (node.type === 'BPMNGateway') {
    const tag = gatewayElementName(node.gatewayType ?? 'exclusive');
    lines.push(`    <bpmn:${tag} id="${id}" name="${name}"${defAttr} />`);
    return;
  }
}

function emitDataAssociations(lines: string[], assocs: AnyBPMNFlow[], model: UMLModel): void {
  for (const rel of assocs) {
    const srcType = model.elements[rel.source.element]?.type;
    const isInput = srcType ? DATA_TYPES.has(srcType) : false;
    const tag = isInput ? 'dataInputAssociation' : 'dataOutputAssociation';
    const ref = isInput ? rel.source.element : rel.target.element;
    lines.push(`      <bpmn:${tag} id="${xid(rel.id)}">`);
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
  // Returns [tag, definition]. tag is intermediateCatchEvent or intermediateThrowEvent.
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

function edgeXml(rel: AnyBPMNFlow): string {
  // Waypoints are in element-local coordinates (relative to rel.bounds).
  // Convert to absolute by adding rel.bounds.x/y.
  const pts =
    Array.isArray(rel.path) && rel.path.length >= 2
      ? rel.path.map((p) => ({ x: (p.x ?? 0) + rel.bounds.x, y: (p.y ?? 0) + rel.bounds.y }))
      : [
          { x: rel.bounds.x, y: rel.bounds.y },
          { x: rel.bounds.x + rel.bounds.width, y: rel.bounds.y + rel.bounds.height },
        ];
  const waypoints = pts.map((p) => `      <di:waypoint x="${numAttr(p.x)}" y="${numAttr(p.y)}" />`).join('\n');
  return (
    `    <bpmndi:BPMNEdge id="${xid(rel.id)}_di" bpmnElement="${xid(rel.id)}">\n` +
    waypoints +
    `\n    </bpmndi:BPMNEdge>`
  );
}

// ─── String helpers ──────────────────────────────────────────────────────────

// IDs in BPMN XML must be valid NCName. Apollon UUIDs start with a digit sometimes,
// so prefix with an underscore to guarantee the leading character is a letter
// (underscore is valid for NCName start).
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
