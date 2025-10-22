/**
 * Agent Diagram Modifier
 * Handles all modification operations for Agent Diagrams
 */

import { DiagramModifier, ModelModification, ModifierHelpers } from './base';
import { BESSERModel } from '../UMLModelingService';

export class AgentDiagramModifier implements DiagramModifier {
  getDiagramType() {
    return 'AgentDiagram' as const;
  }

  canHandle(action: string): boolean {
    return [
      'modify_state',
      'modify_intent',
      'add_transition',
      'remove_element',
      'remove_transition',
      'add_state_body'
    ].includes(action);
  }

  applyModification(model: BESSERModel, modification: ModelModification): BESSERModel {
    const updatedModel = ModifierHelpers.cloneModel(model);

    switch (modification.action) {
      case 'modify_state':
        return this.modifyState(updatedModel, modification);
      case 'modify_intent':
        return this.modifyIntent(updatedModel, modification);
      case 'add_transition':
        return this.addTransition(updatedModel, modification);
      case 'remove_transition':
        return this.removeTransition(updatedModel, modification);
      case 'add_state_body':
        return this.addStateBody(updatedModel, modification);
      case 'remove_element':
        return this.removeElement(updatedModel, modification);
      default:
        throw new Error(`Unsupported action for AgentDiagram: ${modification.action}`);
    }
  }

  /**
   * Modify state properties (rename, etc.)
   */
  private modifyState(model: BESSERModel, modification: ModelModification): BESSERModel {
    const { stateId, stateName } = modification.target;
    const targetId = stateId || this.findStateIdByName(model, stateName!);

    if (targetId && model.elements[targetId]) {
      if (modification.changes.name) {
        model.elements[targetId].name = modification.changes.name;
      }
    }

    return model;
  }

  /**
   * Modify intent properties (rename, add training phrases)
   */
  private modifyIntent(model: BESSERModel, modification: ModelModification): BESSERModel {
    const { intentId, intentName } = modification.target;
    const targetId = intentId || this.findIntentIdByName(model, intentName!);

    if (targetId && model.elements[targetId]) {
      if (modification.changes.name) {
        model.elements[targetId].name = modification.changes.name;
      }
      
      // Add training phrase if specified
      if (modification.changes.text) {
        this.addIntentTrainingPhrase(model, targetId, modification.changes.text);
      }
    }

    return model;
  }

  /**
   * Add a training phrase to an intent
   */
  private addIntentTrainingPhrase(model: BESSERModel, intentId: string, phrase: string): void {
    const intent = model.elements[intentId];
    if (!intent || intent.type !== 'AgentIntent') return;

    const bodyId = ModifierHelpers.generateUniqueId('intentBody');
    const intentElement = model.elements[intentId];
    const bodies = intentElement.bodies || [];
    
    // Calculate position for new body
    const lastBodyId = bodies[bodies.length - 1];
    let newY = intentElement.bounds.y + 41;
    
    if (lastBodyId && model.elements[lastBodyId]) {
      const lastBody = model.elements[lastBodyId];
      newY = lastBody.bounds.y + lastBody.bounds.height;
    }

    // Create new training phrase body
    model.elements[bodyId] = {
      id: bodyId,
      name: phrase,
      type: 'AgentIntentBody',
      owner: intentId,
      bounds: { 
        x: intentElement.bounds.x + 0.5, 
        y: newY, 
        width: 229, 
        height: 30 
      }
    };

    // Update intent to include new body
    intentElement.bodies = [...bodies, bodyId];
    
    // Update intent height
    intentElement.bounds.height = Math.max(130, newY - intentElement.bounds.y + 40);
  }

  /**
   * Add state body (reply)
   */
  private addStateBody(model: BESSERModel, modification: ModelModification): BESSERModel {
    const { stateId, stateName } = modification.target;
    const targetId = stateId || this.findStateIdByName(model, stateName!);

    if (!targetId || !model.elements[targetId]) {
      throw new Error(`State not found: ${stateName || stateId}`);
    }

    const stateElement = model.elements[targetId];
    if (stateElement.type !== 'AgentState') {
      throw new Error('Target is not an AgentState');
    }

    const bodyId = ModifierHelpers.generateUniqueId('body');
    const bodies = stateElement.bodies || [];
    
    // Calculate position for new body
    let newY = stateElement.bounds.y + 41;
    if (bodies.length > 0) {
      const lastBodyId = bodies[bodies.length - 1];
      if (model.elements[lastBodyId]) {
        const lastBody = model.elements[lastBodyId];
        newY = lastBody.bounds.y + lastBody.bounds.height;
      }
    }

    // Create new state body
    model.elements[bodyId] = {
      id: bodyId,
      name: modification.changes.text || 'New reply',
      type: 'AgentStateBody',
      owner: targetId,
      bounds: { 
        x: stateElement.bounds.x + 0.5, 
        y: newY, 
        width: 209, 
        height: 30 
      },
      replyType: modification.changes.replyType || 'text'
    };

    // Update state to include new body
    stateElement.bodies = [...bodies, bodyId];
    
    // Update state height
    stateElement.bounds.height = Math.max(70, newY - stateElement.bounds.y + 40);

    return model;
  }

  /**
   * Add transition between states or from intent to state
   */
  private addTransition(model: BESSERModel, modification: ModelModification): BESSERModel {
    if (!model.relationships) {
      model.relationships = {};
    }

    const changes = modification.changes;
    const target = modification.target;

    const sourceName = changes.source || target.stateName || target.intentName;
    const targetName = changes.target || target.targetClass;

    if (!sourceName || !targetName) {
      throw new Error('Transition requires both source and target (state or intent names).');
    }

    // Find source (could be state, intent, or initial node)
    let sourceId: string | null = null;
    if (sourceName.toLowerCase() === 'initial') {
      sourceId = this.findInitialNodeId(model);
    } else {
      sourceId = this.findStateIdByName(model, sourceName) || 
                 this.findIntentIdByName(model, sourceName);
    }

    // Find target (should be state)
    const targetId = this.findStateIdByName(model, targetName);

    if (!sourceId || !targetId) {
      throw new Error(`Could not locate source (${sourceName}) or target (${targetName}) for transition.`);
    }

    const transitionId = ModifierHelpers.generateUniqueId('transition');
    const sourceElement = model.elements[sourceId];
    const isInitialTransition = sourceElement?.type === 'StateInitialNode';

    const transition: any = {
      id: transitionId,
      name: changes.label || changes.name || '',
      type: isInitialTransition ? 'AgentStateTransitionInit' : 'AgentStateTransition',
      owner: null,
      bounds: { x: 0, y: 0, width: 100, height: 1 },
      path: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      source: {
        direction: 'Right',
        element: sourceId
      },
      target: {
        direction: 'Left',
        element: targetId
      },
      isManuallyLayouted: false
    };

    // Add condition for intent-based transitions
    if (changes.condition || sourceElement?.type === 'AgentIntent') {
      transition.condition = changes.condition || 'intent_matched';
      transition.conditionValue = changes.name || sourceElement?.name || '';
    }

    model.relationships[transitionId] = transition;

    return model;
  }

  /**
   * Remove transition
   */
  private removeTransition(model: BESSERModel, modification: ModelModification): BESSERModel {
    const { transitionId } = modification.target;

    if (transitionId && model.relationships?.[transitionId]) {
      delete model.relationships[transitionId];
    } else if (modification.changes.source && modification.changes.target) {
      // Find transition by source and target
      const sourceName = modification.changes.source;
      const targetName = modification.changes.target;
      
      const sourceId = this.findStateIdByName(model, sourceName) || 
                       this.findIntentIdByName(model, sourceName);
      const targetId = this.findStateIdByName(model, targetName);

      if (sourceId && targetId && model.relationships) {
        for (const [relId, rel] of Object.entries(model.relationships)) {
          if (rel.source?.element === sourceId && rel.target?.element === targetId) {
            delete model.relationships[relId];
            break;
          }
        }
      }
    }

    return model;
  }

  /**
   * Remove element (state, intent, or their bodies)
   */
  private removeElement(model: BESSERModel, modification: ModelModification): BESSERModel {
    const { stateId, stateName, intentId, intentName } = modification.target;

    // Remove state
    if (stateId || stateName) {
      const targetId = stateId || this.findStateIdByName(model, stateName!);
      if (targetId) {
        return ModifierHelpers.removeElementWithChildren(model, targetId);
      }
    }

    // Remove intent
    if (intentId || intentName) {
      const targetId = intentId || this.findIntentIdByName(model, intentName!);
      if (targetId) {
        return ModifierHelpers.removeElementWithChildren(model, targetId);
      }
    }

    return model;
  }

  // Helper methods
  private findStateIdByName(model: BESSERModel, stateName: string): string | null {
    return ModifierHelpers.findElementByName(model, stateName, 'AgentState');
  }

  private findIntentIdByName(model: BESSERModel, intentName: string): string | null {
    return ModifierHelpers.findElementByName(model, intentName, 'AgentIntent');
  }

  private findInitialNodeId(model: BESSERModel): string | null {
    const results = ModifierHelpers.findElementsByType(model, 'StateInitialNode');
    return results.length > 0 ? results[0].id : null;
  }
}
