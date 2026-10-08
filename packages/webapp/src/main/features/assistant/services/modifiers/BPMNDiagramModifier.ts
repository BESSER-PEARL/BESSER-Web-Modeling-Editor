/**
 * BPMN Diagram Modifier (v4-native)
 *
 * Handles incremental modify_model operations for base BPMN process diagrams by
 * walking v4 `model.nodes[]` / `model.edges[]` directly.
 *
 * Two action vocabularies are accepted:
 *   - the BPMN-specific one the modeling agent emits (`add_task`,
 *     `add_gateway`, `add_event`, `add_flow`, `modify_node`, `remove_flow`,
 *     `remove_element`) with `target.nodeId` / `target.nodeName` /
 *     `target.flowId`, and
 *   - the generic state-machine-style one (`add_state`, `modify_state`,
 *     `add_transition`, `remove_transition`) with `target.stateId` /
 *     `target.stateName`, where the BPMN node kind is inferred from
 *     `changes.stateType`.
 *
 * Pools and lanes are edited with `add_pool`, `add_swimlane`,
 * `modify_swimlane`, `remove_swimlane` and `remove_pool`. Agentic task /
 * gateway / lane fields live on `node.data` under their v3 names; a new node
 * goes into the lane named by `changes.owner`.
 *
 * Node references may be a node id (the agent emits stable ids) or a display
 * name; an id hit always wins over a name match. Tasks, gateways, events and
 * the activity containers (call activity, sub-process, transaction) are all
 * valid flow endpoints; the flow subtype is resolved from its endpoints via
 * the library's `resolveBpmnEdgeType`.
 *
 * New nodes are placed to the right of existing content (BPMN reads
 * left-to-right); flow geometry is placeholder that the editor's layouter
 * recomputes on load. A flow between nodes of different pools is a message
 * flow.
 */

import type { BesserEdge, BesserNode } from '@besser/wme';
import { clampMultiplicity, clampTrustScore, migrateLegacyRole, resolveBpmnEdgeType } from '@besser/wme';
import { DiagramModifier, ModelModification, ModifierHelpers } from './base';
import { BESSERModel } from '../UMLModelingService';
import { bpmnGatewayAgenticData, bpmnLaneAgenticData, bpmnTaskAgenticData } from '../shared/v4Builders';

const BPMN_NODE_TYPES = [
  'bpmnTask',
  'bpmnStartEvent',
  'bpmnEndEvent',
  'bpmnIntermediateEvent',
  'bpmnGateway',
  'bpmnCallActivity',
  'bpmnSubprocess',
  'bpmnTransaction',
];
const EVENT_NODE_TYPES = new Set(['bpmnStartEvent', 'bpmnEndEvent', 'bpmnIntermediateEvent']);
const TASK_TYPES = new Set([
  'default', 'user', 'service', 'send', 'receive', 'manual', 'business-rule', 'businessRule', 'script',
]);
const GATEWAY_TYPES = new Set(['exclusive', 'parallel', 'inclusive', 'event-based', 'complex']);

const TASK_W = 140;
const TASK_H = 60;
const EVENT_SIZE = 40;
const POOL_HEADER_WIDTH = 40;
const POOL_GAP = 40;
const LANE_HEIGHT = 150;

export class BPMNDiagramModifier implements DiagramModifier {
  getDiagramType() {
    return 'BPMN' as const;
  }

  canHandle(action: string): boolean {
    return [
      // BPMN vocabulary (modeling agent)
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
      'remove_pool',
      // Generic state-machine-style vocabulary
      'add_state',
      'modify_state',
      'add_transition',
      'remove_transition',
    ].includes(action);
  }

  applyModification(model: BESSERModel, modification: ModelModification): BESSERModel {
    const updated = ModifierHelpers.cloneModel(model);

    switch (modification.action) {
      case 'add_task':
        return this.addTask(updated, modification);
      case 'add_gateway':
        return this.addGateway(updated, modification);
      case 'add_event':
        return this.addEvent(updated, modification);
      case 'add_state':
        return this.addNode(updated, modification);
      case 'add_flow':
      case 'add_transition':
        return this.addFlow(updated, modification);
      case 'modify_node':
      case 'modify_state':
        return this.modifyNode(updated, modification);
      case 'remove_flow':
      case 'remove_transition':
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

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  /**
   * Place new nodes to the right of existing BPMN content, near the vertical
   * mean. Children of pools / lanes store positions relative to their parent,
   * so measure in canvas coordinates; the new node is top-level (absolute).
   */
  private nextPosition(model: BESSERModel): { x: number; y: number } {
    let maxRight = 0;
    let sumY = 0;
    let count = 0;
    for (const node of ModifierHelpers.nodes(model)) {
      if (!BPMN_NODE_TYPES.includes(node.type)) continue;
      const { x, y } = this.absolutePosition(model, node);
      maxRight = Math.max(maxRight, x + (node.width || 0));
      sumY += y;
      count += 1;
    }
    return { x: count ? maxRight + 60 : 0, y: count ? Math.round(sumY / count) : 0 };
  }

  private absolutePosition(model: BESSERModel, node: BesserNode): { x: number; y: number } {
    let x = node.position?.x || 0;
    let y = node.position?.y || 0;
    let parent = node.parentId ? ModifierHelpers.findNodeById(model, node.parentId) : undefined;
    for (let depth = 0; parent && depth < 64; depth++) {
      x += parent.position?.x || 0;
      y += parent.position?.y || 0;
      parent = parent.parentId ? ModifierHelpers.findNodeById(model, parent.parentId) : undefined;
    }
    return { x, y };
  }

  private normalizeType(rawType?: string): string {
    const t = (rawType || '').toLowerCase().replace(/[\s_-]/g, '');
    if (t === 'startevent' || t === 'start' || t === 'startnode') return 'bpmnStartEvent';
    if (t === 'endevent' || t === 'end' || t === 'endnode') return 'bpmnEndEvent';
    if (t === 'intermediateevent' || t === 'intermediate') return 'bpmnIntermediateEvent';
    if (t === 'gateway' || t === 'gate') return 'bpmnGateway';
    if (t === 'subprocess') return 'bpmnSubprocess';
    if (t === 'transaction') return 'bpmnTransaction';
    if (t === 'callactivity') return 'bpmnCallActivity';
    return 'bpmnTask';
  }

  private findBpmnNodeByName(model: BESSERModel, name?: string): BesserNode | undefined {
    if (!name) return undefined;
    for (const type of BPMN_NODE_TYPES) {
      const hit = ModifierHelpers.findNodeByName(model, name, type);
      if (hit) return hit;
    }
    return undefined;
  }

  /**
   * Resolve a node reference that may be a node id or a display name. A
   * direct id hit wins (the agent emits stable ids); the name match is the
   * fallback for user phrasing.
   */
  private resolveNode(model: BESSERModel, ref?: string): BesserNode | undefined {
    if (!ref) return undefined;
    const byId = ModifierHelpers.findNodeById(model, ref);
    if (byId && BPMN_NODE_TYPES.includes(byId.type)) return byId;
    return this.findBpmnNodeByName(model, ref);
  }

  /** Resolve the node addressed by a modification's target (id first, then name). */
  private resolveTargetNode(model: BESSERModel, m: ModelModification): BesserNode | undefined {
    const t = m.target || {};
    return (
      this.resolveNode(model, t.nodeId) ??
      this.resolveNode(model, t.stateId) ??
      this.resolveNode(model, t.nodeName) ??
      this.resolveNode(model, t.stateName) ??
      this.resolveNode(model, t.name)
    );
  }

  /** Reuse the id the agent proposed when it is free; otherwise mint one. */
  private newNodeId(model: BESSERModel, proposed?: string): string {
    if (proposed && proposed.trim() && !ModifierHelpers.findNodeById(model, proposed)) {
      return proposed.trim();
    }
    return ModifierHelpers.generateUniqueId('bpmn');
  }

  /**
   * Build a flow node. Without a lane it is top-level, right of the existing
   * content; inside a lane it goes right of the lane's children, and the lane,
   * its sibling lanes and its pool widen to keep it inside.
   */
  private buildNode(
    model: BESSERModel,
    type: string,
    name: string,
    data: Record<string, unknown>,
    proposedId?: string,
    lane?: BesserNode,
  ): BesserNode {
    const isSmall = EVENT_NODE_TYPES.has(type) || type === 'bpmnGateway';
    const width = isSmall ? EVENT_SIZE : TASK_W;
    const height = isSmall ? EVENT_SIZE : TASK_H;
    const node: BesserNode = {
      id: this.newNodeId(model, proposedId),
      type: type as any,
      position: this.nextPosition(model),
      width,
      height,
      measured: { width, height },
      data: { name, ...data },
    };
    if (lane) {
      const children = ModifierHelpers.nodes(model).filter((n) => n.parentId === lane.id);
      const right = Math.max(0, ...children.map((n) => (n.position?.x || 0) + (n.width || 0)));
      node.parentId = lane.id;
      node.position = {
        x: children.length ? right + 60 : 40,
        y: Math.max(0, Math.round(((lane.height || 0) - height) / 2)),
      };
      this.widenLane(model, lane, node.position.x + width + 40);
    }
    return node;
  }

  private widenLane(model: BESSERModel, lane: BesserNode, minWidth: number): void {
    const delta = minWidth - (lane.width || 0);
    if (delta <= 0) return;
    const pool = this.owningPool(model, lane);
    const resized = pool
      ? [pool, ...ModifierHelpers.nodes(model).filter((n) => n.type === 'bpmnSwimlane' && n.parentId === pool.id)]
      : [lane];
    for (const n of resized) {
      n.width = (n.width || 0) + delta;
      n.measured = { width: n.width, height: n.height };
    }
  }

  /** The pool a node sits in (directly or through a lane), if any. */
  private owningPool(model: BESSERModel, node: BesserNode): BesserNode | undefined {
    let parent = node.parentId ? ModifierHelpers.findNodeById(model, node.parentId) : undefined;
    for (let depth = 0; parent && depth < 64; depth++) {
      if (parent.type === 'bpmnPool') return parent;
      parent = parent.parentId ? ModifierHelpers.findNodeById(model, parent.parentId) : undefined;
    }
    return undefined;
  }

  private findPool(model: BESSERModel, ref?: string): BesserNode | undefined {
    return ModifierHelpers.resolveNodeRef(model, ref, ['bpmnPool']);
  }

  private findLane(model: BESSERModel, ref?: string): BesserNode | undefined {
    return ModifierHelpers.resolveNodeRef(model, ref, ['bpmnSwimlane']);
  }

  /** The lane a new node goes into; a named lane that does not exist is an error. */
  private ownerLane(model: BESSERModel, ref?: string): BesserNode | undefined {
    if (!ref) return undefined;
    const lane = this.findLane(model, ref);
    if (!lane) throw new Error(`Lane '${ref}' not found in the model.`);
    return lane;
  }

  // ------------------------------------------------------------------
  // Action handlers
  // ------------------------------------------------------------------

  private addTask(model: BESSERModel, m: ModelModification): BESSERModel {
    const taskType = TASK_TYPES.has(String(m.changes.taskType)) ? m.changes.taskType : 'default';
    const name = m.target.nodeName || m.changes.name || 'Task';
    const lane = this.ownerLane(model, m.changes.owner);
    // A reviewer lane that does not resolve is dropped, not an error.
    const reviewerLaneId = this.findLane(model, m.changes.reflectionReviewerLaneId)?.id;
    const data = { taskType, marker: 'none', ...bpmnTaskAgenticData(m.changes, reviewerLaneId) };
    ModifierHelpers.addNode(model, this.buildNode(model, 'bpmnTask', name, data, m.target.nodeId, lane));
    return model;
  }

  private addGateway(model: BESSERModel, m: ModelModification): BESSERModel {
    const gatewayType = GATEWAY_TYPES.has(String(m.changes.gatewayType)) ? m.changes.gatewayType : 'exclusive';
    const name = m.target.nodeName || m.changes.name || '';
    const lane = this.ownerLane(model, m.changes.owner);
    const data = { gatewayType, ...bpmnGatewayAgenticData(m.changes) };
    ModifierHelpers.addNode(model, this.buildNode(model, 'bpmnGateway', name, data, m.target.nodeId, lane));
    return model;
  }

  private addEvent(model: BESSERModel, m: ModelModification): BESSERModel {
    const kind = String(m.changes.eventKind || '').toLowerCase();
    const type =
      kind === 'start' ? 'bpmnStartEvent' : kind === 'intermediate' ? 'bpmnIntermediateEvent' : 'bpmnEndEvent';
    const eventType = typeof m.changes.eventType === 'string' && m.changes.eventType ? m.changes.eventType : 'default';
    const name = m.target.nodeName || m.changes.name || '';
    const lane = this.ownerLane(model, m.changes.owner);
    ModifierHelpers.addNode(model, this.buildNode(model, type, name, { eventType }, m.target.nodeId, lane));
    return model;
  }

  /** Generic `add_state`: the BPMN node kind is inferred from `changes.stateType`. */
  private addNode(model: BESSERModel, m: ModelModification): BESSERModel {
    const changes = m.changes;
    const type = this.normalizeType(changes.stateType || changes.name);
    const name = m.target.stateName || m.target.nodeName || changes.name || (type === 'bpmnTask' ? 'Task' : '');

    const data: Record<string, unknown> = {};
    if (type === 'bpmnTask') {
      const taskType = changes.taskType ?? changes.type;
      data.taskType = TASK_TYPES.has(String(taskType)) ? taskType : 'default';
      data.marker = 'none';
    } else if (type === 'bpmnGateway') {
      data.gatewayType = GATEWAY_TYPES.has(String(changes.gatewayType)) ? changes.gatewayType : 'exclusive';
    } else if (EVENT_NODE_TYPES.has(type)) {
      data.eventType = typeof changes.eventType === 'string' && changes.eventType ? changes.eventType : 'default';
    } else if (type === 'bpmnSubprocess' || type === 'bpmnTransaction') {
      data.isExpanded = false;
    } else if (type === 'bpmnCallActivity') {
      data.calledElement = '';
    }

    ModifierHelpers.addNode(model, this.buildNode(model, type, name, data, m.target.nodeId ?? m.target.stateId));
    return model;
  }

  private modifyNode(model: BESSERModel, m: ModelModification): BESSERModel {
    const target = this.resolveTargetNode(model, m);
    if (!target) return model;

    const data = target.data as any;
    const c = m.changes;
    if (c.name) data.name = c.name;

    // Explicit per-kind fields (BPMN vocabulary) — only applied to the matching node kind.
    if (c.taskType && target.type === 'bpmnTask' && TASK_TYPES.has(c.taskType)) {
      data.taskType = c.taskType;
    }
    if (c.gatewayType && target.type === 'bpmnGateway' && GATEWAY_TYPES.has(c.gatewayType)) {
      data.gatewayType = c.gatewayType;
    }
    if (c.eventType && EVENT_NODE_TYPES.has(target.type)) {
      data.eventType = c.eventType;
    }

    if (target.type === 'bpmnTask') {
      if (typeof c.isAgentic === 'boolean') data.isAgentic = c.isAgentic;
      if (typeof c.reflectionMode === 'string') data.reflectionMode = c.reflectionMode;
      if (typeof c.trustScore === 'number') data.trustScore = clampTrustScore(c.trustScore);
      if (typeof c.agentDiagramRef === 'string') data.agentDiagramRef = c.agentDiagramRef;
      const reviewerLane = this.findLane(model, c.reflectionReviewerLaneId);
      if (reviewerLane) data.reflectionReviewerLaneId = reviewerLane.id;
    }
    if (target.type === 'bpmnGateway') {
      if (typeof c.isAgentic === 'boolean') data.isAgentic = c.isAgentic;
      if (typeof c.gatewayRole === 'string') data.gatewayRole = c.gatewayRole;
      if (typeof c.trustScore === 'number') data.trustScore = clampTrustScore(c.trustScore);
      if (typeof c.governanceDsl === 'string') data.governanceDsl = c.governanceDsl;
    }

    // Generic `changes.type` (state-machine vocabulary) — routed by node kind.
    if (c.type) {
      if (target.type === 'bpmnTask' && TASK_TYPES.has(c.type)) {
        data.taskType = c.type;
      } else if (target.type === 'bpmnGateway' && GATEWAY_TYPES.has(c.type)) {
        data.gatewayType = c.type;
      } else if (EVENT_NODE_TYPES.has(target.type)) {
        data.eventType = c.type;
      }
    }
    return model;
  }

  private addFlow(model: BESSERModel, m: ModelModification): BESSERModel {
    const source = this.resolveNode(model, m.changes.source) ?? this.resolveNode(model, m.target.nodeId);
    const target = this.resolveNode(model, m.changes.target);
    if (!source || !target) {
      throw new Error('Could not locate source or target node for the BPMN flow.');
    }
    const name = m.changes.label || m.changes.name || '';
    // The agent never sends a flow kind: a flow across pools is a message flow.
    const sourcePool = this.owningPool(model, source);
    const targetPool = this.owningPool(model, target);
    const crossPool = !!sourcePool && !!targetPool && sourcePool.id !== targetPool.id;
    const downward = crossPool && (sourcePool.position?.y || 0) <= (targetPool.position?.y || 0);
    const edge: BesserEdge = {
      id: ModifierHelpers.generateUniqueId('flow'),
      source: source.id,
      target: target.id,
      type: (crossPool
        ? 'BPMNMessageFlow'
        : resolveBpmnEdgeType(source.type, target.type, 'BPMNSequenceFlow')) as any,
      sourceHandle: crossPool ? (downward ? 'bottom' : 'top') : 'right',
      targetHandle: crossPool ? (downward ? 'top' : 'bottom') : 'left',
      data: {
        label: name,
        name,
        isDefault: false,
        isManuallyLayouted: false,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ],
      },
    };
    ModifierHelpers.addEdge(model, edge);
    return model;
  }

  private removeFlow(model: BESSERModel, m: ModelModification): BESSERModel {
    const mm = model as any;
    const flowId = m.target.flowId || m.target.transitionId;
    if (flowId && ModifierHelpers.findEdgeById(model, flowId)) {
      mm.edges = (mm.edges ?? []).filter((e: BesserEdge) => e.id !== flowId);
      return model;
    }
    const source = this.resolveNode(model, m.changes.source);
    const target = this.resolveNode(model, m.changes.target);
    if (source && target) {
      let removed = false;
      mm.edges = (mm.edges ?? []).filter((e: BesserEdge) => {
        if (!removed && e.source === source.id && e.target === target.id) {
          removed = true;
          return false;
        }
        return true;
      });
    }
    return model;
  }

  private removeElement(model: BESSERModel, m: ModelModification): BESSERModel {
    const target = this.resolveTargetNode(model, m);
    if (!target) {
      const t = m.target || {};
      throw new Error(
        `Could not find a node matching "${t.nodeName ?? t.nodeId ?? t.stateName ?? t.stateId ?? ''}" to remove.`,
      );
    }
    return ModifierHelpers.removeNodeWithChildren(model, target.id);
  }

  private addPool(model: BESSERModel, m: ModelModification): BESSERModel {
    // Stack below the existing top-level content.
    const topLevel = ModifierHelpers.nodes(model).filter((n) => !n.parentId);
    const y = topLevel.length
      ? Math.max(...topLevel.map((n) => (n.position?.y || 0) + (n.height || 0))) + POOL_GAP
      : 0;
    const width = 750;
    const height = 200;
    ModifierHelpers.addNode(model, {
      id: ModifierHelpers.generateUniqueId('pool'),
      type: 'bpmnPool' as any,
      position: { x: 0, y },
      width,
      height,
      measured: { width, height },
      data: { name: m.target.nodeName || m.changes.name || 'Pool' },
    });
    return model;
  }

  private addSwimlane(model: BESSERModel, m: ModelModification): BESSERModel {
    const pool = this.findPool(model, m.changes.poolName);
    if (m.changes.poolName && !pool) {
      throw new Error(`Pool '${m.changes.poolName}' not found in the model.`);
    }
    // Stack below the pool's existing lanes (positions are pool-relative).
    let laneY = 0;
    if (pool) {
      for (const n of ModifierHelpers.nodes(model)) {
        if (n.type === 'bpmnSwimlane' && n.parentId === pool.id) {
          laneY = Math.max(laneY, (n.position?.y || 0) + (n.height || 0));
        }
      }
    }
    const width = (pool?.width ?? 750) - POOL_HEADER_WIDTH;
    const lane: BesserNode = {
      id: ModifierHelpers.generateUniqueId('lane'),
      type: 'bpmnSwimlane' as any,
      position: { x: POOL_HEADER_WIDTH, y: laneY },
      width,
      height: LANE_HEIGHT,
      measured: { width, height: LANE_HEIGHT },
      data: { name: m.target.nodeName || m.changes.name || 'Lane', ...bpmnLaneAgenticData(m.changes) },
    };
    if (pool) {
      lane.parentId = pool.id;
      pool.height = Math.max(pool.height || 0, laneY + LANE_HEIGHT);
      pool.measured = { width: pool.width, height: pool.height };
    }
    ModifierHelpers.addNode(model, lane);
    return model;
  }

  private requireLane(model: BESSERModel, m: ModelModification): BesserNode {
    const lane = this.findLane(model, m.target.swimlaneName) ?? this.findLane(model, m.target.nodeName);
    if (!lane) {
      throw new Error(`Lane '${m.target.swimlaneName ?? m.target.nodeName ?? ''}' not found in the model.`);
    }
    return lane;
  }

  private modifySwimlane(model: BESSERModel, m: ModelModification): BESSERModel {
    const data = this.requireLane(model, m).data as any;
    const c = m.changes;
    if (c.name) data.name = c.name;
    if (c.role) data.role = migrateLegacyRole(c.role);
    if (typeof c.trustScore === 'number') data.trustScore = clampTrustScore(c.trustScore);
    if (typeof c.multiplicity === 'number') data.multiplicity = clampMultiplicity(c.multiplicity);
    if (typeof c.isAgentic === 'boolean') data.isAgentic = c.isAgentic;
    if (typeof c.agentDiagramRef === 'string') data.agentDiagramRef = c.agentDiagramRef.trim();
    return model;
  }

  /** Removes the lane with everything it contains and every flow touching it. */
  private removeSwimlane(model: BESSERModel, m: ModelModification): BESSERModel {
    return ModifierHelpers.removeNodeWithChildren(model, this.requireLane(model, m).id);
  }

  /** Removes the pool with its lanes, their contents and every flow touching them. */
  private removePool(model: BESSERModel, m: ModelModification): BESSERModel {
    const pool = this.findPool(model, m.target.poolName) ?? this.findPool(model, m.target.nodeName);
    if (!pool) {
      throw new Error(`Pool '${m.target.poolName ?? m.target.nodeName ?? ''}' not found in the model.`);
    }
    return ModifierHelpers.removeNodeWithChildren(model, pool.id);
  }
}
