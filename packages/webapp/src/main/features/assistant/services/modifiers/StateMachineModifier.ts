/**
 * State Machine Modifier (v4-native)
 *
 * Walks v4 `model.nodes[]` / `model.edges[]` directly.
 *
 * v4 State diagram: State has `data.bodies[]` and `data.fallbackBodies[]` rows
 * (StateBody/StateFallbackBody collapse onto the parent state — they are NOT
 * separate nodes). Initial / Final / Code-Block nodes remain top-level.
 */

import type { BesserEdge, BesserNode } from '@besser/wme';
import { DiagramModifier, ModelModification, ModifierHelpers } from './base';
import { BESSERModel } from '../UMLModelingService';

type BodyRow = { id: string; name: string };

export class StateMachineModifier implements DiagramModifier {
  getDiagramType() {
    return 'StateMachineDiagram' as const;
  }

  canHandle(action: string): boolean {
    return [
      'add_state',
      'modify_state',
      'add_transition',
      'remove_element',
      'remove_transition',
      'add_code_block'
    ].includes(action);
  }

  applyModification(model: BESSERModel, modification: ModelModification): BESSERModel {
    const updatedModel = ModifierHelpers.cloneModel(model);

    switch (modification.action) {
      case 'add_state':         return this.addState(updatedModel, modification);
      case 'modify_state':      return this.modifyState(updatedModel, modification);
      case 'add_transition':    return this.addTransition(updatedModel, modification);
      case 'remove_transition': return this.removeTransition(updatedModel, modification);
      case 'add_code_block':    return this.addCodeBlock(updatedModel, modification);
      case 'remove_element':    return this.removeElement(updatedModel, modification);
      default:
        throw new Error(`Unsupported action for StateMachineDiagram: ${modification.action}`);
    }
  }

  private nextPosition(model: BESSERModel): { x: number; y: number } {
    let maxY = 0;
    for (const node of ModifierHelpers.nodes(model)) {
      const bottom = (node.position?.y || 0) + (node.height || 0);
      if (bottom > maxY) maxY = bottom;
    }
    return { x: 100, y: maxY + 40 };
  }

  private addState(model: BESSERModel, modification: ModelModification): BESSERModel {
    const changes = modification.changes;
    const stateType = (changes.stateType || changes.name || '').toLowerCase();
    const pos = this.nextPosition(model);
    const stateId = ModifierHelpers.generateUniqueId('state');

    if (stateType === 'initial') {
      const node: BesserNode = {
        id: stateId,
        type: 'StateInitialNode' as any,
        position: pos,
        width: 45,
        height: 45,
        measured: { width: 45, height: 45 },
        data: { name: '' },
      };
      ModifierHelpers.addNode(model, node);
      return model;
    }

    if (stateType === 'final') {
      const node: BesserNode = {
        id: stateId,
        type: 'StateFinalNode' as any,
        position: pos,
        width: 45,
        height: 45,
        measured: { width: 45, height: 45 },
        data: { name: '' },
      };
      ModifierHelpers.addNode(model, node);
      return model;
    }

    const bodies: BodyRow[] = [];
    const fallbackBodies: BodyRow[] = [];
    if (changes.entryAction) bodies.push({ id: ModifierHelpers.generateUniqueId('body'), name: `entry / ${changes.entryAction}` });
    if (changes.doActivity) bodies.push({ id: ModifierHelpers.generateUniqueId('body'), name: `do / ${changes.doActivity}` });
    if (changes.exitAction) bodies.push({ id: ModifierHelpers.generateUniqueId('body'), name: `exit / ${changes.exitAction}` });

    const totalHeight = Math.max(100, 41 + bodies.length * 30);
    const stateName = modification.target.stateName || changes.name || '';
    const node: BesserNode = {
      id: stateId,
      type: 'State' as any,
      position: pos,
      width: 160,
      height: totalHeight,
      measured: { width: 160, height: totalHeight },
      data: {
        name: stateName,
        bodies,
        fallbackBodies,
      },
    };
    ModifierHelpers.addNode(model, node);
    return model;
  }

  private modifyState(model: BESSERModel, modification: ModelModification): BESSERModel {
    const { stateId, stateName } = modification.target;
    let target: BesserNode | undefined;
    if (stateId) target = ModifierHelpers.findNodeById(model, stateId);
    if (!target && stateName) {
      target = ModifierHelpers.findNodeByName(model, stateName, 'State')
        || ModifierHelpers.findNodeByName(model, stateName, 'StateInitialNode')
        || ModifierHelpers.findNodeByName(model, stateName, 'StateFinalNode');
    }
    if (target && modification.changes.name) {
      (target.data as any).name = modification.changes.name;
    }
    return model;
  }

  private addTransition(model: BESSERModel, modification: ModelModification): BESSERModel {
    const m = model as any;
    if (!Array.isArray(m.edges)) m.edges = [];

    const sourceName = modification.changes.source!;
    const targetName = modification.changes.target!;

    const sourceNode = ModifierHelpers.findNodeByName(model, sourceName, 'State')
      || ModifierHelpers.findNodeByName(model, sourceName, 'StateInitialNode')
      || ModifierHelpers.findNodeByName(model, sourceName, 'StateFinalNode')
      || (sourceName === '' ? ModifierHelpers.findNodesByType(model, 'StateInitialNode')[0] : undefined);
    const targetNode = ModifierHelpers.findNodeByName(model, targetName, 'State')
      || ModifierHelpers.findNodeByName(model, targetName, 'StateFinalNode')
      || ModifierHelpers.findNodeByName(model, targetName, 'StateInitialNode');

    if (!sourceNode || !targetNode) {
      throw new Error('Could not locate source or target state for transition.');
    }

    const transitionId = ModifierHelpers.generateUniqueId('transition');
    const edge: BesserEdge = {
      id: transitionId,
      source: sourceNode.id,
      target: targetNode.id,
      type: 'StateTransition' as any,
      sourceHandle: 'Right',
      targetHandle: 'Left',
      data: {
        name: modification.changes.label || modification.changes.name || '',
        params: {},
        points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
        isManuallyLayouted: false,
      },
    };
    m.edges.push(edge);
    return model;
  }

  private removeTransition(model: BESSERModel, modification: ModelModification): BESSERModel {
    const { transitionId } = modification.target;
    if (!transitionId) return model;
    const m = model as any;
    m.edges = (m.edges ?? []).filter((e: BesserEdge) => e.id !== transitionId);
    return model;
  }

  private addCodeBlock(model: BESSERModel, modification: ModelModification): BESSERModel {
    const changes = modification.changes;
    const pos = this.nextPosition(model);
    const codeBlockId = ModifierHelpers.generateUniqueId('codeblock');
    const node: BesserNode = {
      id: codeBlockId,
      type: 'StateCodeBlock' as any,
      position: pos,
      width: 200,
      height: 150,
      measured: { width: 200, height: 150 },
      data: {
        name: changes.name || modification.target.stateName || 'Code',
        code: changes.code || '',
        language: changes.language || 'python',
      },
    };
    ModifierHelpers.addNode(model, node);
    return model;
  }

  private removeElement(model: BESSERModel, modification: ModelModification): BESSERModel {
    const { stateId, stateName } = modification.target;
    let target: BesserNode | undefined;
    if (stateId) target = ModifierHelpers.findNodeById(model, stateId);
    if (!target && stateName) {
      target = ModifierHelpers.findNodeByName(model, stateName, 'State')
        || ModifierHelpers.findNodeByName(model, stateName, 'StateInitialNode')
        || ModifierHelpers.findNodeByName(model, stateName, 'StateFinalNode');
    }
    if (target) return ModifierHelpers.removeNodeWithChildren(model, target.id);
    return model;
  }
}
