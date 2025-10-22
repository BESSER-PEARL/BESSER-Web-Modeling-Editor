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
      'modify_state',
      'add_transition',
      'remove_element',
      'remove_transition'
    ].includes(action);
  }

  applyModification(model: BESSERModel, modification: ModelModification): BESSERModel {
    const updatedModel = ModifierHelpers.cloneModel(model);

    switch (modification.action) {
      case 'modify_state':
        return this.modifyState(updatedModel, modification);
      case 'add_transition':
        return this.addTransition(updatedModel, modification);
      case 'remove_transition':
        return this.removeTransition(updatedModel, modification);
      case 'remove_element':
        return this.removeElement(updatedModel, modification);
      default:
        throw new Error(`Unsupported action for StateMachineDiagram: ${modification.action}`);
    }
  }

  private modifyState(model: BESSERModel, modification: ModelModification): BESSERModel {
    const { stateId, stateName } = modification.target;
    const targetId = stateId || ModifierHelpers.findElementByName(model, stateName!, 'State');

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

    const sourceId = ModifierHelpers.findElementByName(model, modification.changes.source!, 'State');
    const targetId = ModifierHelpers.findElementByName(model, modification.changes.target!, 'State');

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

  private removeElement(model: BESSERModel, modification: ModelModification): BESSERModel {
    const { stateId, stateName } = modification.target;
    const targetId = stateId || ModifierHelpers.findElementByName(model, stateName!, 'State');

    if (targetId) {
      return ModifierHelpers.removeElementWithChildren(model, targetId);
    }

    return model;
  }
}
