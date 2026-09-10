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
 * Node references may be a node id (the agent emits stable ids) or a display
 * name; an id hit always wins over a name match. Tasks, gateways, events and
 * the activity containers (call activity, sub-process, transaction) are all
 * valid flow endpoints; the flow subtype is resolved from its endpoints via
 * the library's `resolveBpmnEdgeType`.
 *
 * New nodes are placed to the right of existing content (BPMN reads
 * left-to-right); flow geometry is placeholder that the editor's layouter
 * recomputes on load.
 */

import type { BesserEdge, BesserNode } from '@besser/wme';
import { resolveBpmnEdgeType } from '@besser/wme';
import { DiagramModifier, ModelModification, ModifierHelpers } from './base';
import { BESSERModel } from '../UMLModelingService';

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
      default:
        throw new Error(`Unsupported action for BPMN: ${modification.action}`);
    }
  }

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  /** Place new nodes to the right of existing BPMN content, near the vertical mean. */
  private nextPosition(model: BESSERModel): { x: number; y: number } {
    let maxRight = 0;
    let sumY = 0;
    let count = 0;
    for (const node of ModifierHelpers.nodes(model)) {
      if (!BPMN_NODE_TYPES.includes(node.type)) continue;
      maxRight = Math.max(maxRight, (node.position?.x || 0) + (node.width || 0));
      sumY += node.position?.y || 0;
      count += 1;
    }
    return { x: count ? maxRight + 60 : 0, y: count ? Math.round(sumY / count) : 0 };
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

  private buildNode(
    model: BESSERModel,
    type: string,
    name: string,
    data: Record<string, unknown>,
    proposedId?: string,
  ): BesserNode {
    const { x, y } = this.nextPosition(model);
    const isSmall = EVENT_NODE_TYPES.has(type) || type === 'bpmnGateway';
    const width = isSmall ? EVENT_SIZE : TASK_W;
    const height = isSmall ? EVENT_SIZE : TASK_H;
    return {
      id: this.newNodeId(model, proposedId),
      type: type as any,
      position: { x, y },
      width,
      height,
      measured: { width, height },
      data: { name, ...data },
    };
  }

  // ------------------------------------------------------------------
  // Action handlers
  // ------------------------------------------------------------------

  private addTask(model: BESSERModel, m: ModelModification): BESSERModel {
    const taskType = TASK_TYPES.has(String(m.changes.taskType)) ? m.changes.taskType : 'default';
    const name = m.target.nodeName || m.changes.name || 'Task';
    ModifierHelpers.addNode(
      model,
      this.buildNode(model, 'bpmnTask', name, { taskType, marker: 'none' }, m.target.nodeId),
    );
    return model;
  }

  private addGateway(model: BESSERModel, m: ModelModification): BESSERModel {
    const gatewayType = GATEWAY_TYPES.has(String(m.changes.gatewayType)) ? m.changes.gatewayType : 'exclusive';
    const name = m.target.nodeName || m.changes.name || '';
    ModifierHelpers.addNode(model, this.buildNode(model, 'bpmnGateway', name, { gatewayType }, m.target.nodeId));
    return model;
  }

  private addEvent(model: BESSERModel, m: ModelModification): BESSERModel {
    const kind = String(m.changes.eventKind || '').toLowerCase();
    const type =
      kind === 'start' ? 'bpmnStartEvent' : kind === 'intermediate' ? 'bpmnIntermediateEvent' : 'bpmnEndEvent';
    const eventType = typeof m.changes.eventType === 'string' && m.changes.eventType ? m.changes.eventType : 'default';
    const name = m.target.nodeName || m.changes.name || '';
    ModifierHelpers.addNode(model, this.buildNode(model, type, name, { eventType }, m.target.nodeId));
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
    const edge: BesserEdge = {
      id: ModifierHelpers.generateUniqueId('flow'),
      source: source.id,
      target: target.id,
      type: resolveBpmnEdgeType(source.type, target.type, 'BPMNSequenceFlow') as any,
      sourceHandle: 'right',
      targetHandle: 'left',
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
}
