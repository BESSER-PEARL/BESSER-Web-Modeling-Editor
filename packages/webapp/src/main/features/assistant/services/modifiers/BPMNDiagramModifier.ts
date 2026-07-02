/**
 * BPMN Diagram Modifier (v4-native)
 *
 * Handles incremental modify_model operations for base BPMN process diagrams by
 * walking v4 `model.nodes[]` / `model.edges[]` directly.
 *
 * Re-targets develop's v3 (elements/relationships) BPMNDiagramModifier to the
 * migration's v4 shape and to the generic action vocabulary the assistant
 * already emits (`add_state`, `modify_state`, `add_transition`,
 * `remove_transition`, `remove_element`): an `add_state` becomes a BPMN
 * node whose kind is inferred from `changes.stateType`, and an `add_transition`
 * becomes a BPMN flow edge whose subtype is resolved from its endpoints.
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

export class BPMNDiagramModifier implements DiagramModifier {
  getDiagramType() {
    return 'BPMN' as const;
  }

  canHandle(action: string): boolean {
    return [
      'add_state',
      'modify_state',
      'add_transition',
      'remove_transition',
      'remove_element',
    ].includes(action);
  }

  applyModification(model: BESSERModel, modification: ModelModification): BESSERModel {
    const updated = ModifierHelpers.cloneModel(model);

    switch (modification.action) {
      case 'add_state':
        return this.addNode(updated, modification);
      case 'modify_state':
        return this.modifyNode(updated, modification);
      case 'add_transition':
        return this.addFlow(updated, modification);
      case 'remove_transition':
        return this.removeFlow(updated, modification);
      case 'remove_element':
        return this.removeElement(updated, modification);
      default:
        throw new Error(`Unsupported action for BPMN: ${modification.action}`);
    }
  }

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

  private findBpmnNode(model: BESSERModel, name?: string): BesserNode | undefined {
    if (!name) return undefined;
    for (const type of BPMN_NODE_TYPES) {
      const hit = ModifierHelpers.findNodeByName(model, name, type);
      if (hit) return hit;
    }
    return undefined;
  }

  /** Resolve a node reference that may be a node id or a display name. */
  private resolveNode(model: BESSERModel, ref?: string): BesserNode | undefined {
    if (!ref) return undefined;
    const byId = ModifierHelpers.findNodeById(model, ref);
    if (byId && BPMN_NODE_TYPES.includes(byId.type)) return byId;
    return this.findBpmnNode(model, ref);
  }

  private addNode(model: BESSERModel, m: ModelModification): BESSERModel {
    const changes = m.changes;
    const type = this.normalizeType(changes.stateType || changes.name);
    const { x, y } = this.nextPosition(model);
    const id = ModifierHelpers.generateUniqueId('bpmn');
    const name = m.target.stateName || changes.name || (type === 'bpmnTask' ? 'Task' : '');

    const isSmall = EVENT_NODE_TYPES.has(type) || type === 'bpmnGateway';
    const width = isSmall ? 40 : 140;
    const height = isSmall ? 40 : 60;

    const data: Record<string, unknown> = { name };
    if (type === 'bpmnTask') {
      data.taskType = TASK_TYPES.has(String(changes.type)) ? changes.type : 'default';
      data.marker = 'none';
    } else if (type === 'bpmnGateway') {
      data.gatewayType = 'exclusive';
    } else if (EVENT_NODE_TYPES.has(type)) {
      data.eventType = 'default';
    } else if (type === 'bpmnSubprocess' || type === 'bpmnTransaction') {
      data.isExpanded = false;
    } else if (type === 'bpmnCallActivity') {
      data.calledElement = '';
    }

    const node: BesserNode = {
      id,
      type: type as any,
      position: { x, y },
      width,
      height,
      measured: { width, height },
      data,
    };
    ModifierHelpers.addNode(model, node);
    return model;
  }

  private modifyNode(model: BESSERModel, m: ModelModification): BESSERModel {
    let target: BesserNode | undefined;
    if (m.target.stateId) target = ModifierHelpers.findNodeById(model, m.target.stateId);
    if (!target) target = this.resolveNode(model, m.target.stateName);
    if (target && m.changes.name) {
      (target.data as any).name = m.changes.name;
    }
    if (target && m.changes.type) {
      if (target.type === 'bpmnTask' && TASK_TYPES.has(m.changes.type)) {
        (target.data as any).taskType = m.changes.type;
      } else if (target.type === 'bpmnGateway' && GATEWAY_TYPES.has(m.changes.type)) {
        (target.data as any).gatewayType = m.changes.type;
      } else if (EVENT_NODE_TYPES.has(target.type)) {
        (target.data as any).eventType = m.changes.type;
      }
    }
    return model;
  }

  private addFlow(model: BESSERModel, m: ModelModification): BESSERModel {
    const source = this.resolveNode(model, m.changes.source);
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
    if (m.target.transitionId) {
      mm.edges = (mm.edges ?? []).filter((e: BesserEdge) => e.id !== m.target.transitionId);
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
    let target: BesserNode | undefined;
    if (m.target.stateId) target = ModifierHelpers.findNodeById(model, m.target.stateId);
    if (!target) target = this.resolveNode(model, m.target.stateName);
    if (!target) {
      throw new Error(
        `Could not find a node matching "${m.target.stateName ?? m.target.stateId ?? ''}" to remove.`,
      );
    }
    return ModifierHelpers.removeNodeWithChildren(model, target.id);
  }
}
