/**
 * BPMN Diagram Modifier
 * Handles incremental modify_model operations for base BPMN process diagrams.
 *
 * Supports base BPMN node/flow edits plus pool/lane updates used by
 * AgenticSwarm lane metadata. New nodes are placed to the right of existing content
 * (BPMN reads left-to-right); flow geometry is a placeholder that the editor's
 * layouter recomputes (isManuallyLayouted: false).
 */

import { DiagramModifier, ModelModification, ModifierHelpers } from './base';
import { BESSERModel } from '../UMLModelingService';

const BPMN_NODE_TYPES = [
  'BPMNTask',
  'BPMNStartEvent',
  'BPMNEndEvent',
  'BPMNIntermediateEvent',
  'BPMNGateway',
  'BPMNCallActivity',
  'BPMNSubprocess',
  'BPMNTransaction',
];
const EVENT_ELEMENT_TYPES = new Set(['BPMNStartEvent', 'BPMNEndEvent', 'BPMNIntermediateEvent']);
const TASK_TYPES = new Set(['default', 'user', 'service', 'send', 'receive', 'manual', 'business-rule', 'script']);
const GATEWAY_TYPES = new Set(['exclusive', 'parallel', 'inclusive', 'event-based', 'complex']);

type BPMNNodeRecord = {
  id: string;
  type: string;
  name: string;
  owner: string | null;
  isAgentic?: boolean;
  reflectionMode?: string;
  trustScore?: number;
  agentDiagramRef?: string;
  gatewayRole?: string;
  governanceDsl?: string;
  bounds: { x: number; y: number; width: number; height: number };
  taskType?: string;
  gatewayType?: string;
  eventType?: string;
  marker?: string;
};

type BPMNFlowRecord = {
  source: { element: string };
  target: { element: string };
};

export class BPMNDiagramModifier implements DiagramModifier {
  getDiagramType() {
    return 'BPMN' as const;
  }

  canHandle(action: string): boolean {
    return [
      'add_task',
      'add_gateway',
      'add_event',
      'add_flow',
      'modify_node',
      'remove_flow',
      'remove_element', 
      'add_pool',
      'add_swimlane',
      'modify_swimlane',
      'remove_swimlane',
      'remove_pool'
    ].includes(action);
  }

  applyModification(model: BESSERModel, modification: ModelModification): BESSERModel {
    const updated = ModifierHelpers.cloneModel(model);
    if (!updated.relationships) updated.relationships = {};

    switch (modification.action) {
      case 'add_task':
        return this.addTask(updated, modification);
      case 'add_gateway':
        return this.addGateway(updated, modification);
      case 'add_event':
        return this.addEvent(updated, modification);
      case 'add_flow':
        return this.addFlow(updated, modification);
      case 'modify_node':
        return this.modifyNode(updated, modification);
      case 'remove_flow':
        return this.removeFlow(updated, modification);
      case 'remove_element':
        return this.removeElement(updated, modification);
      case 'add_pool': 
        return this.addPool(updated, modification);
      case 'add_swimlane': 
        return this.addSwimlane(updated, modification);
      case 'modify_swimlane': 
        return this.modifySwimlane(updated, modification);
      case 'remove_swimlane': 
        return this.removeSwimlane(updated, modification);
      case 'remove_pool': 
        return this.removePool(updated, modification);
      default:
        throw new Error(`Unsupported action for BPMN: ${modification.action}`);
    }
  }

  /** Place new nodes to the right of existing content, near the vertical mean. */
  private nextPosition(model: BESSERModel): { x: number; y: number } {
    let maxRight = 0;
    let sumY = 0;
    let count = 0;
    for (const el of Object.values(model.elements) as BPMNNodeRecord[]) {
      if (!BPMN_NODE_TYPES.includes(el.type)) continue;
      const b = el.bounds || ({} as BPMNNodeRecord['bounds']);
      maxRight = Math.max(maxRight, (b.x || 0) + (b.width || 0));
      sumY += b.y || 0;
      count += 1;
    }
    return { x: count ? maxRight + 60 : 0, y: count ? Math.round(sumY / count) : 0 };
  }

  private findNode(model: BESSERModel, name?: string): string | null {
    if (!name) return null;
    for (const t of BPMN_NODE_TYPES) {
      const id = ModifierHelpers.findElementByName(model, name, t);
      if (id) return id;
    }
    return null;
  }

  /** Resolve a node reference that may be an Apollon element id or a name. */
  private resolveNode(model: BESSERModel, ref?: string): string | null {
    if (!ref) return null;
    // Direct id hit (the agent now emits stable ids).
    const candidate = model.elements[ref] as BPMNNodeRecord | undefined;
    if (candidate && BPMN_NODE_TYPES.includes(candidate.type)) {
      return ref;
    }
    // Fallback: match by display name (user phrasing).
    return this.findNode(model, ref);
  }

  private addTask(model: BESSERModel, m: ModelModification): BESSERModel {
    const { x, y } = this.nextPosition(model);
    const id = m.target.nodeId || ModifierHelpers.generateUniqueId('bpmn');
    const taskType = TASK_TYPES.has(String(m.changes.taskType)) ? m.changes.taskType : 'default';
    const owner = this.findLane(model, m.changes.owner);
    model.elements[id] = {
      id,
      type: 'BPMNTask',
      name: m.target.nodeName || m.changes.name || 'Task',
      owner,
      bounds: { x, y, width: 140, height: 60 },
      taskType,
      marker: 'none',
      isAgentic: m.changes.isAgentic === true,
      reflectionMode: m.changes.reflectionMode || 'none',
      trustScore: typeof m.changes.trustScore === 'number' ? m.changes.trustScore : 0,
      ...(m.changes.agentDiagramRef ? { agentDiagramRef: m.changes.agentDiagramRef } : {}),
    };
    return model;
  }

  private addGateway(model: BESSERModel, m: ModelModification): BESSERModel {
    const { x, y } = this.nextPosition(model);
    const id = m.target.nodeId || ModifierHelpers.generateUniqueId('bpmn');
    const gatewayType = GATEWAY_TYPES.has(String(m.changes.gatewayType)) ? m.changes.gatewayType : 'exclusive';
    const owner = this.findLane(model, m.changes.owner);
    model.elements[id] = {
      id,
      type: 'BPMNGateway',
      name: m.target.nodeName || m.changes.name || '',
      owner,
      bounds: { x, y, width: 40, height: 40 },
      gatewayType,
      isAgentic: m.changes.isAgentic === true,
      gatewayRole: m.changes.gatewayRole || 'diverging',
      trustScore: typeof m.changes.trustScore === 'number' ? m.changes.trustScore : 0,
      ...(m.changes.governanceDsl?.trim()
        ? { governanceDsl: m.changes.governanceDsl }
        : {}),
    };
    return model;
  }

  private addEvent(model: BESSERModel, m: ModelModification): BESSERModel {
    const { x, y } = this.nextPosition(model);
    const id = m.target.nodeId || ModifierHelpers.generateUniqueId('bpmn');
    const kind = String(m.changes.eventKind || '').toLowerCase();
    const type =
      kind === 'start' ? 'BPMNStartEvent' : kind === 'intermediate' ? 'BPMNIntermediateEvent' : 'BPMNEndEvent';
    const eventType = typeof m.changes.eventType === 'string' && m.changes.eventType ? m.changes.eventType : 'default';
    const owner = this.findLane(model, m.changes.owner);
    model.elements[id] = {
      id,
      type,
      name: m.target.nodeName || m.changes.name || '',
      owner,
      bounds: { x, y, width: 40, height: 40 },
      eventType,
    };
    return model;
  }

  private addFlow(model: BESSERModel, m: ModelModification): BESSERModel {
    const sourceId = this.resolveNode(model, m.changes.source);
    const targetId = this.resolveNode(model, m.changes.target);
    if (!sourceId || !targetId) {
      throw new Error('Could not locate source or target node for the BPMN flow.');
    }

    // The model agent never provides flowType. Infer ordinary BPMN sequence/message
    // rendering from the actual WME ownership hierarchy instead.
    const sourcePoolId = this.findOwningPoolForNode(model, sourceId);
    const targetPoolId = this.findOwningPoolForNode(model, targetId);
    const isCrossPool = (
      sourcePoolId !== null
      && targetPoolId !== null
      && sourcePoolId !== targetPoolId
    );

    let sourceDirection = 'Right';
    let targetDirection = 'Left';

    if (isCrossPool) {
      const sourcePool = model.elements[sourcePoolId] as { bounds?: { y?: number } };
      const targetPool = model.elements[targetPoolId] as { bounds?: { y?: number } };
      const sourceAboveTarget = (sourcePool.bounds?.y ?? 0) <= (targetPool.bounds?.y ?? 0);

      sourceDirection = sourceAboveTarget ? 'Down' : 'Up';
      targetDirection = sourceAboveTarget ? 'Up' : 'Down';
    }

    const id = ModifierHelpers.generateUniqueId('flow');
    model.relationships[id] = {
      id,
      type: 'BPMNFlow',
      name: m.changes.label || m.changes.name || '',
      owner: null,
      bounds: { x: 0, y: 0, width: 100, height: 1 },
      path: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      source: { element: sourceId, direction: sourceDirection },
      target: { element: targetId, direction: targetDirection },
      isManuallyLayouted: false,
      flowType: isCrossPool ? 'message' : 'sequence',
      isDefault: false,
    };
    return model;
  }

  private modifyNode(model: BESSERModel, m: ModelModification): BESSERModel {
    const id = this.resolveNode(model, m.target.nodeId) ?? this.resolveNode(model, m.target.nodeName);
    if (id && model.elements[id]) {
      const el = model.elements[id] as BPMNNodeRecord;
      if (m.changes.name) el.name = m.changes.name;
      if (m.changes.taskType && el.type === 'BPMNTask' && TASK_TYPES.has(m.changes.taskType)) {
        el.taskType = m.changes.taskType;
      }
      if (m.changes.gatewayType && el.type === 'BPMNGateway' && GATEWAY_TYPES.has(m.changes.gatewayType)) {
        el.gatewayType = m.changes.gatewayType;
      }
      if (m.changes.eventType && EVENT_ELEMENT_TYPES.has(el.type)) {
        el.eventType = m.changes.eventType;
      }
      if (el.type === 'BPMNTask') {
        if (typeof m.changes.isAgentic === 'boolean') el.isAgentic = m.changes.isAgentic;
        if (typeof m.changes.reflectionMode === 'string') el.reflectionMode = m.changes.reflectionMode;
        if (typeof m.changes.trustScore === 'number') el.trustScore = m.changes.trustScore;
        if (typeof m.changes.agentDiagramRef === 'string') el.agentDiagramRef = m.changes.agentDiagramRef;
      }

      if (el.type === 'BPMNGateway') {
        if (typeof m.changes.isAgentic === 'boolean') el.isAgentic = m.changes.isAgentic;
        if (typeof m.changes.gatewayRole === 'string') el.gatewayRole = m.changes.gatewayRole;
        if (typeof m.changes.trustScore === 'number') el.trustScore = m.changes.trustScore;
        if (typeof m.changes.governanceDsl === 'string') el.governanceDsl = m.changes.governanceDsl;
      }
    }
    return model;
  }

  private removeFlow(model: BESSERModel, m: ModelModification): BESSERModel {
    const { flowId } = m.target;
    if (flowId && model.relationships?.[flowId]) {
      delete model.relationships[flowId];
      return model;
    }
    const src = this.resolveNode(model, m.changes.source);
    const tgt = this.resolveNode(model, m.changes.target);
    if (src && tgt && model.relationships) {
      for (const [rid, rel] of Object.entries(model.relationships) as [string, BPMNFlowRecord][]) {
        if (rel.source?.element === src && rel.target?.element === tgt) {
          delete model.relationships[rid];
          break;
        }
      }
    }
    return model;
  }

  private removeElement(model: BESSERModel, m: ModelModification): BESSERModel {
    const id = this.resolveNode(model, m.target.nodeId) ?? this.resolveNode(model, m.target.nodeName);
    if (!id) {
      throw new Error(`Could not find a node matching "${m.target.nodeName ?? m.target.nodeId ?? ''}" to remove.`);
    }
    return ModifierHelpers.removeElementWithChildren(model, id);
  }

  private findPool(model: BESSERModel, ref?: string): string | null {
    if (!ref) return null;
    if (model.elements[ref]?.type === 'BPMNPool') return ref;
    const lower = ref.toLowerCase();
    for (const [id, el] of Object.entries(model.elements)) {
      if ((el as any).type === 'BPMNPool' && ((el as any).name || '').toLowerCase() === lower) return id;
    }
    return null;
  }

  private findLane(model: BESSERModel, ref?: string): string | null {
    if (!ref) return null;
    if (model.elements[ref]?.type === 'BPMNSwimlane') return ref;
    const lower = ref.toLowerCase();
    for (const [id, el] of Object.entries(model.elements)) {
      if ((el as any).type === 'BPMNSwimlane' && ((el as any).name || '').toLowerCase() === lower) return id;
    }
    return null;
  }

  private findOwningPoolForNode(model: BESSERModel, nodeId: string): string | null {
    const node = model.elements[nodeId] as BPMNNodeRecord | undefined;
    if (!node || !node.owner) return null;

    const owner = model.elements[node.owner] as { type?: string; owner?: string } | undefined;
    if (!owner) return null;

    // Support a node directly owned by a pool.
    if (owner.type === 'BPMNPool') return node.owner;

    // Normal Agentic BPMN case: node -> lane -> pool.
    if (
      owner.type === 'BPMNSwimlane'
      && typeof owner.owner === 'string'
      && model.elements[owner.owner]?.type === 'BPMNPool'
    ) {
      return owner.owner;
    }

    return null;
  }

  private addPool(model: BESSERModel, m: ModelModification): BESSERModel {
    const id = ModifierHelpers.generateUniqueId('pool');
    const name = (m.target as any).nodeName || m.changes?.name || 'Pool';
    model.elements[id] = {
      id, type: 'BPMNPool', name, owner: null,
      bounds: { x: 0, y: 0, width: 750, height: 200 },
    };
    return model;
  }

  private addSwimlane(model: BESSERModel, m: ModelModification): BESSERModel {
    const poolId = this.findPool(model, (m.changes as any)?.poolName);
    const id = ModifierHelpers.generateUniqueId('lane');
    const name = (m.target as any).nodeName || m.changes?.name || 'Lane';
    // Stack below existing lanes in the pool
    let laneY = poolId && model.elements[poolId] ? (model.elements[poolId] as any).bounds?.y || 0 : 0;
    for (const el of Object.values(model.elements)) {
      if ((el as any).type === 'BPMNSwimlane' && (el as any).owner === poolId) {
        const b = (el as any).bounds || {};
        laneY = Math.max(laneY, b.y + b.height);
      }
    }
    const laneW = poolId && model.elements[poolId] ? ((model.elements[poolId] as any).bounds?.width || 750) - 40 : 710;
    const laneX = poolId && model.elements[poolId] ? ((model.elements[poolId] as any).bounds?.x || 0) + 40 : 40;
    model.elements[id] = {
      id, type: 'BPMNSwimlane', name, owner: poolId,
      bounds: { x: laneX, y: laneY, width: laneW, height: 150 },
      isAgentic: (m.changes as any)?.isAgentic !== false,
      role: (m.changes as any)?.role || 'solution',
      trustScore: (m.changes as any)?.trustScore ?? 0,
      multiplicity: (m.changes as any)?.multiplicity ?? 1,
      ...(typeof (m.changes as any)?.agentDiagramRef === 'string'
        && (m.changes as any).agentDiagramRef.trim()
        ? { agentDiagramRef: (m.changes as any).agentDiagramRef.trim() }
        : {}),
    };
    // Expand pool height
    if (poolId && model.elements[poolId]) {
      const pb = (model.elements[poolId] as any).bounds;
      pb.height = Math.max(pb.height, laneY + 150 - pb.y);
    }
    return model;
  }

  private modifySwimlane(model: BESSERModel, m: ModelModification): BESSERModel {
    const id = this.findLane(model, (m.target as any)?.swimlaneName)
            ?? this.findLane(model, (m.target as any)?.nodeName);
    if (id && model.elements[id]) {
      const el = model.elements[id] as any;
      if (m.changes?.name) el.name = m.changes.name;
      if ((m.changes as any)?.role) el.role = (m.changes as any).role;
      if (typeof (m.changes as any)?.trustScore === 'number') el.trustScore = (m.changes as any).trustScore;
      if (typeof (m.changes as any)?.multiplicity === 'number') el.multiplicity = (m.changes as any).multiplicity;
      if (typeof (m.changes as any)?.isAgentic === 'boolean') el.isAgentic = (m.changes as any).isAgentic;
      if (typeof (m.changes as any)?.agentDiagramRef === 'string') {
        el.agentDiagramRef = (m.changes as any).agentDiagramRef.trim();
      }
    }
    return model;
  }

  private removeSwimlane(model: BESSERModel, m: ModelModification): BESSERModel {
    const id = this.findLane(model, (m.target as any)?.swimlaneName)
            ?? this.findLane(model, (m.target as any)?.nodeName);
    if (!id) return model;
    // Remove all elements owned by this lane
    for (const [eid, el] of Object.entries(model.elements)) {
      if ((el as any).owner === id) delete model.elements[eid];
    }
    return ModifierHelpers.removeElementWithChildren(model, id);
  }

  private removePool(model: BESSERModel, m: ModelModification): BESSERModel {
    const id = this.findPool(model, (m.target as any)?.poolName)
            ?? this.findPool(model, (m.target as any)?.nodeName);
    if (!id) return model;
    // Remove all lanes (and their contents) owned by this pool
    const lanes = Object.entries(model.elements)
      .filter(([, el]) => (el as any).owner === id && (el as any).type === 'BPMNSwimlane')
      .map(([lid]) => lid);
    for (const laneId of lanes) {
      for (const [eid, el] of Object.entries(model.elements)) {
        if ((el as any).owner === laneId) delete model.elements[eid];
      }
      delete model.elements[laneId];
    }
    return ModifierHelpers.removeElementWithChildren(model, id);
  }
}
