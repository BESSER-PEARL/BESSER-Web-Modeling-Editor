/**
 * BPMN Diagram Modifier
 * Handles incremental modify_model operations for base BPMN process diagrams.
 *
 * Base BPMN only (tasks, gateways, events, sequence flows) — no pools/lanes or
 * agentic fields.  New nodes are placed to the right of existing content
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
  owner: null;
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
    model.elements[id] = {
      id,
      type: 'BPMNTask',
      name: m.target.nodeName || m.changes.name || 'Task',
      owner: null,
      bounds: { x, y, width: 140, height: 60 },
      taskType,
      marker: 'none',
    };
    return model;
  }

  private addGateway(model: BESSERModel, m: ModelModification): BESSERModel {
    const { x, y } = this.nextPosition(model);
    const id = m.target.nodeId || ModifierHelpers.generateUniqueId('bpmn');
    const gatewayType = GATEWAY_TYPES.has(String(m.changes.gatewayType)) ? m.changes.gatewayType : 'exclusive';
    model.elements[id] = {
      id,
      type: 'BPMNGateway',
      name: m.target.nodeName || m.changes.name || '',
      owner: null,
      bounds: { x, y, width: 40, height: 40 },
      gatewayType,
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
    model.elements[id] = {
      id,
      type,
      name: m.target.nodeName || m.changes.name || '',
      owner: null,
      bounds: { x, y, width: 40, height: 40 },
      eventType,
    };
    return model;
  }

  private addFlow(model: BESSERModel, m: ModelModification): BESSERModel {
    const sourceId = this.resolveNode(model, m.changes.source);
    const targetId = this.resolveNode(model, m.changes.target);
    if (!sourceId || !targetId) {
      throw new Error('Could not locate source or target node for the sequence flow.');
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
      source: { element: sourceId, direction: 'Right' },
      target: { element: targetId, direction: 'Left' },
      isManuallyLayouted: false,
      flowType: 'sequence',
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
}
