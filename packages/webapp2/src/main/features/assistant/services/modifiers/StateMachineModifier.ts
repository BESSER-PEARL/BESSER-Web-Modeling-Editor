/**
 * State Machine Modifier
 * Handles all modification operations for State Machine Diagrams
 */

import { DiagramModifier, ModelModification, ModifierHelpers } from './base';
import { BESSERModel } from '../UMLModelingService';

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
      case 'add_state':
        return this.addState(updatedModel, modification);
      case 'modify_state':
        return this.modifyState(updatedModel, modification);
      case 'add_transition':
        return this.addTransition(updatedModel, modification);
      case 'remove_transition':
        return this.removeTransition(updatedModel, modification);
      case 'add_code_block':
        return this.addCodeBlock(updatedModel, modification);
      case 'remove_element':
        return this.removeElement(updatedModel, modification);
      default:
        throw new Error(`Unsupported action for StateMachineDiagram: ${modification.action}`);
    }
  }

  private addState(model: BESSERModel, modification: ModelModification): BESSERModel {
    const changes = modification.changes;
    const stateType = (changes.stateType || changes.name || '').toLowerCase();

    // Auto-position: find max Y of existing elements and place below
    let maxY = 0;
    for (const element of Object.values(model.elements)) {
      const bottom = (element.bounds?.y || 0) + (element.bounds?.height || 0);
      if (bottom > maxY) maxY = bottom;
    }
    const pos = { x: 100, y: maxY + 40 };

    const stateId = ModifierHelpers.generateUniqueId('state');

    // StateInitialNode and StateFinalNode are simple circles
    if (stateType === 'initial') {
      model.elements[stateId] = {
        type: 'StateInitialNode',
        id: stateId,
        name: '',
        owner: null,
        bounds: { x: pos.x, y: pos.y, width: 45, height: 45 }
      };
      return model;
    }

    if (stateType === 'final') {
      model.elements[stateId] = {
        type: 'StateFinalNode',
        id: stateId,
        name: '',
        owner: null,
        bounds: { x: pos.x, y: pos.y, width: 45, height: 45 }
      };
      return model;
    }

    // Regular State with body elements for entry/do/exit actions
    const bodies: string[] = [];
    const fallbackBodies: string[] = [];
    let currentY = pos.y + 41;

    if (changes.entryAction) {
      const bodyId = ModifierHelpers.generateUniqueId('body');
      bodies.push(bodyId);
      model.elements[bodyId] = {
        id: bodyId,
        name: `entry / ${changes.entryAction}`,
        type: 'StateBody',
        owner: stateId,
        bounds: { x: pos.x + 0.5, y: currentY, width: 159, height: 30 }
      };
      currentY += 30;
    }

    if (changes.doActivity) {
      const bodyId = ModifierHelpers.generateUniqueId('body');
      bodies.push(bodyId);
      model.elements[bodyId] = {
        id: bodyId,
        name: `do / ${changes.doActivity}`,
        type: 'StateBody',
        owner: stateId,
        bounds: { x: pos.x + 0.5, y: currentY, width: 159, height: 30 }
      };
      currentY += 30;
    }

    if (changes.exitAction) {
      const bodyId = ModifierHelpers.generateUniqueId('body');
      bodies.push(bodyId);
      model.elements[bodyId] = {
        id: bodyId,
        name: `exit / ${changes.exitAction}`,
        type: 'StateBody',
        owner: stateId,
        bounds: { x: pos.x + 0.5, y: currentY, width: 159, height: 30 }
      };
      currentY += 30;
    }

    const totalHeight = Math.max(100, currentY - pos.y);

    model.elements[stateId] = {
      type: 'State',
      id: stateId,
      name: modification.target.stateName || changes.name || '',
      owner: null,
      bounds: { x: pos.x, y: pos.y, width: 160, height: totalHeight },
      bodies,
      fallbackBodies
    };

    return model;
  }

  private modifyState(model: BESSERModel, modification: ModelModification): BESSERModel {
    const { stateId, stateName } = modification.target;
    const targetId = stateId
      || ModifierHelpers.findElementByName(model, stateName!, 'State')
      || ModifierHelpers.findElementByName(model, stateName!, 'StateInitialNode')
      || ModifierHelpers.findElementByName(model, stateName!, 'StateFinalNode');

    if (targetId && model.elements[targetId]) {
      if (modification.changes.name) {
        model.elements[targetId].name = modification.changes.name;
      }
    }

    return model;
  }

  private addTransition(model: BESSERModel, modification: ModelModification): BESSERModel {
    if (!model.relationships) {
      model.relationships = {};
    }

    const sourceId = ModifierHelpers.findElementByName(model, modification.changes.source!, 'State')
      ?? ModifierHelpers.findElementByName(model, modification.changes.source!, 'StateInitialNode')
      ?? ModifierHelpers.findElementByName(model, modification.changes.source!, 'StateFinalNode');
    const targetId = ModifierHelpers.findElementByName(model, modification.changes.target!, 'State')
      ?? ModifierHelpers.findElementByName(model, modification.changes.target!, 'StateFinalNode')
      ?? ModifierHelpers.findElementByName(model, modification.changes.target!, 'StateInitialNode');

    if (!sourceId || !targetId) {
      throw new Error('Could not locate source or target state for transition.');
    }

    const transitionId = ModifierHelpers.generateUniqueId('transition');

    model.relationships[transitionId] = {
      id: transitionId,
      type: 'StateTransition',
      source: {
        element: sourceId,
        direction: 'Right'
      },
      target: {
        element: targetId,
        direction: 'Left'
      },
      name: modification.changes.label || modification.changes.name || '',
      bounds: { x: 0, y: 0, width: 100, height: 1 },
      path: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      isManuallyLayouted: false
    };

    return model;
  }

  private removeTransition(model: BESSERModel, modification: ModelModification): BESSERModel {
    const { transitionId } = modification.target;

    if (transitionId && model.relationships?.[transitionId]) {
      delete model.relationships[transitionId];
    }

    return model;
  }

  private addCodeBlock(model: BESSERModel, modification: ModelModification): BESSERModel {
    const changes = modification.changes;

    // Auto-position: find max Y of existing elements and place below
    let maxY = 0;
    for (const element of Object.values(model.elements)) {
      const bottom = (element.bounds?.y || 0) + (element.bounds?.height || 0);
      if (bottom > maxY) maxY = bottom;
    }
    const pos = { x: 100, y: maxY + 40 };

    const stateId = ModifierHelpers.generateUniqueId('codeblock');

    model.elements[stateId] = {
      type: 'StateCodeBlock',
      id: stateId,
      name: changes.name || modification.target.stateName || 'Code',
      code: changes.code || '',
      language: changes.language || 'python',
      owner: null,
      bounds: { x: pos.x, y: pos.y, width: 200, height: 150 }
    };

    return model;
  }

  private removeElement(model: BESSERModel, modification: ModelModification): BESSERModel {
    const { stateId, stateName } = modification.target;
    const targetId = stateId
      || ModifierHelpers.findElementByName(model, stateName!, 'State')
      || ModifierHelpers.findElementByName(model, stateName!, 'StateInitialNode')
      || ModifierHelpers.findElementByName(model, stateName!, 'StateFinalNode');

    if (targetId) {
      return ModifierHelpers.removeElementWithChildren(model, targetId);
    }

    return model;
  }
}
