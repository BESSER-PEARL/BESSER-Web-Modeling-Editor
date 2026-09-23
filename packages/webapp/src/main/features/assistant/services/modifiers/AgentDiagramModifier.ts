/**
 * Agent Diagram Modifier
 * Handles all modification operations for Agent Diagrams
 */

import { AgentComponentType, UMLModel, normalizeAgentComponents } from '@besser/wme';
import { DiagramModifier, ModelModification, ModifierHelpers } from './base';
import { BESSERModel } from '../UMLModelingService';
import { buildAgentStateBody } from '../converters/AgentDiagramConverter';

/**
 * An agent model as the modifier edits it: canvas `elements` plus the off-canvas
 * `components` (intents, LLMs, RAG databases, tools, skills, workspaces, GUIs).
 */
type AgentModel = BESSERModel & { components?: Record<string, any> };

/** Agent actions carry type-specific fields not declared on the shared ModificationChanges. */
type AgentChanges = Record<string, any>;

function componentsOf(model: AgentModel): Record<string, any> {
  if (!model.components) model.components = {};
  return model.components;
}

export class AgentDiagramModifier implements DiagramModifier {
  getDiagramType() {
    return 'AgentDiagram' as const;
  }

  canHandle(action: string): boolean {
    return [
      'add_state',
      'add_intent',
      'modify_state',
      'modify_intent',
      'add_transition',
      'remove_element',
      'remove_transition',
      'add_state_body',
      'add_rag_element',
      'add_llm',
      'add_tool',
      'add_skill',
      'add_workspace',
      'add_gui',
    ].includes(action);
  }

  applyModification(model: AgentModel, modification: ModelModification): BESSERModel {
    // Older models kept intents, LLMs, ... on the canvas (`elements`); move them into
    // `components` first so every action below works on one format.
    const updatedModel = normalizeAgentComponents(
      ModifierHelpers.cloneModel(model) as unknown as UMLModel,
    ) as unknown as AgentModel;
    // add_llm/add_tool/add_skill/add_workspace/add_gui are agent-only actions, not in the shared union.
    const action: string = modification.action;

    switch (action) {
      case 'add_state':
        return this.addState(updatedModel, modification);
      case 'add_intent':
        return this.addIntent(updatedModel, modification);
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
      case 'add_rag_element':
        return this.addRagElement(updatedModel, modification);
      case 'add_llm':
        return this.addLLM(updatedModel, modification);
      case 'add_tool':
        return this.addTool(updatedModel, modification);
      case 'add_skill':
        return this.addSkill(updatedModel, modification);
      case 'add_workspace':
        return this.addWorkspace(updatedModel, modification);
      case 'add_gui':
        return this.addGUI(updatedModel, modification);
      case 'remove_element':
        return this.removeElement(updatedModel, modification);
      default:
        throw new Error(`Unsupported action for AgentDiagram: ${action}`);
    }
  }

  /**
   * Add a new agent state with optional reply bodies
   */
  private addState(model: AgentModel, modification: ModelModification): BESSERModel {
    const changes = modification.changes as AgentChanges;
    const target = modification.target;

    // Auto-position: find max Y of existing elements and place below
    let maxY = 0;
    for (const element of Object.values(model.elements)) {
      const bottom = (element.bounds?.y || 0) + (element.bounds?.height || 0);
      if (bottom > maxY) maxY = bottom;
    }
    const pos = { x: 100, y: maxY + 40 };

    const stateId = ModifierHelpers.generateUniqueId('state');
    const bodies: string[] = [];
    const fallbackBodies: string[] = [];

    // Estimate width from reply text lengths
    const replies: any[] = changes.replies || [];
    let stateWidth = 210;
    for (const reply of replies) {
      const text = typeof reply === 'string' ? reply : reply?.text || '';
      const estimated = text.length * 8 + 40;
      if (estimated > stateWidth) stateWidth = estimated;
    }
    const bodyWidth = stateWidth - 1;

    // Create state body elements from replies (same builder as add_state_body and the converter)
    let currentY = pos.y + 41;
    for (const reply of replies) {
      const bodyId = ModifierHelpers.generateUniqueId('body');
      bodies.push(bodyId);
      model.elements[bodyId] = buildAgentStateBody(reply, {
        id: bodyId,
        owner: stateId,
        elementType: 'AgentStateBody',
        bounds: { x: pos.x + 0.5, y: currentY, width: bodyWidth, height: 30 },
      });
      currentY += 30;
    }

    const totalHeight = Math.max(70, currentY - pos.y);

    model.elements[stateId] = {
      id: stateId,
      name: target.stateName || changes.name || '',
      type: 'AgentState',
      stateType: 'standard',
      owner: null,
      bounds: { x: pos.x, y: pos.y, width: stateWidth, height: totalHeight },
      fallbackBodyEnabled: fallbackBodies.length > 0,
      actions: bodies,
      fallbackActions: fallbackBodies,
      bodies,
      fallbackBodies,
    };

    return model;
  }

  /**
   * Add a new intent with optional training phrases (goes to components, no bounds)
   */
  private addIntent(model: AgentModel, modification: ModelModification): BESSERModel {
    const changes = modification.changes as AgentChanges;
    const target = modification.target;

    const intentId = ModifierHelpers.generateUniqueId('intent');
    const bodies: string[] = [];
    const phrases = changes.trainingPhrases || [];

    for (const phrase of phrases) {
      const bodyId = ModifierHelpers.generateUniqueId('intentBody');
      bodies.push(bodyId);
      componentsOf(model)[bodyId] = {
        id: bodyId,
        name: phrase,
        type: AgentComponentType.AgentIntentBody,
        owner: intentId,
      };
    }

    componentsOf(model)[intentId] = {
      id: intentId,
      name: target.intentName || changes.intentName || changes.name || '',
      type: AgentComponentType.AgentIntent,
      owner: null,
      intent_description: changes.intentDescription || '',
      bodies,
    };

    return model;
  }

  /**
   * Modify state properties (rename, etc.)
   */
  private modifyState(model: AgentModel, modification: ModelModification): BESSERModel {
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
  private modifyIntent(model: AgentModel, modification: ModelModification): BESSERModel {
    const { intentId, intentName } = modification.target;
    const targetId = intentId || this.findIntentIdByName(model, intentName!);
    const components = model.components || {};

    if (targetId && components[targetId]) {
      if (modification.changes.name) {
        components[targetId].name = modification.changes.name;
      }
      if (modification.changes.text) {
        this.addIntentTrainingPhrase(model, targetId, modification.changes.text);
      }
    }

    return model;
  }

  /**
   * Add a training phrase to an intent (intent lives in components, no bounds)
   */
  private addIntentTrainingPhrase(model: AgentModel, intentId: string, phrase: string): void {
    const intentElement = componentsOf(model)[intentId];
    if (!intentElement || intentElement.type !== AgentComponentType.AgentIntent) return;

    const bodyId = ModifierHelpers.generateUniqueId('intentBody');
    const bodies = intentElement.bodies || [];

    componentsOf(model)[bodyId] = {
      id: bodyId,
      name: phrase,
      type: AgentComponentType.AgentIntentBody,
      owner: intentId,
    };

    intentElement.bodies = [...bodies, bodyId];
  }

  /**
   * Add state body (reply)
   */
  private addStateBody(model: AgentModel, modification: ModelModification): BESSERModel {
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
    // Support both 'actions' (new key) and 'bodies' (legacy key)
    const bodies = stateElement.actions || stateElement.bodies || [];

    // Calculate position for new body
    let newY = stateElement.bounds.y + 41;
    if (bodies.length > 0) {
      const lastBodyId = bodies[bodies.length - 1];
      if (model.elements[lastBodyId]) {
        const lastBody = model.elements[lastBodyId];
        newY = lastBody.bounds.y + lastBody.bounds.height;
      }
    }

    const newBody = buildAgentStateBody(modification.changes, {
      id: bodyId,
      owner: targetId,
      elementType: 'AgentStateBody',
      bounds: { x: stateElement.bounds.x + 0.5, y: newY, width: 209, height: 30 },
    });
    if (!newBody.name) newBody.name = 'New reply';

    model.elements[bodyId] = newBody;

    // Update state to include new body (keep both keys in sync)
    const updatedBodies = [...bodies, bodyId];
    stateElement.actions = updatedBodies;
    stateElement.bodies = updatedBodies;
    
    // Update state height
    stateElement.bounds.height = Math.max(70, newY - stateElement.bounds.y + 40);

    return model;
  }

  /**
   * Add transition between states or from intent to state
   */
  private addTransition(model: AgentModel, modification: ModelModification): BESSERModel {
    if (!model.relationships) {
      model.relationships = {};
    }

    const changes = modification.changes as AgentChanges;
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
      source: { direction: 'Right', element: sourceId },
      target: { direction: 'Left', element: targetId },
      isManuallyLayouted: false,
    };

    if (!isInitialTransition) {
      const condition = changes.condition || 'when_intent_matched';
      transition.transitionType = 'predefined';
      if (condition === 'when_intent_matched') {
        transition.predefined = {
          predefinedType: 'when_intent_matched',
          intentName: changes.intentName || changes.name || '',
        };
      } else if (condition === 'when_no_intent_matched') {
        transition.predefined = { predefinedType: 'when_no_intent_matched' };
      } else {
        transition.predefined = { predefinedType: condition };
      }
      transition.custom = { condition: [] };
    }

    model.relationships[transitionId] = transition;

    return model;
  }

  /**
   * Remove transition
   */
  private removeTransition(model: AgentModel, modification: ModelModification): BESSERModel {
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
   * Add a RAG knowledge base component (goes to components, no bounds)
   */
  private addRagElement(model: AgentModel, modification: ModelModification): BESSERModel {
    const ch = modification.changes as AgentChanges;
    const target = modification.target;
    const ragId = ModifierHelpers.generateUniqueId('rag');

    componentsOf(model)[ragId] = {
      id: ragId,
      type: AgentComponentType.AgentRagElement,
      name: target.name || ch.name || 'RAG DB',
      owner: null,
      llm_name: ch.llm_name || '',
      llm_prompt: ch.llm_prompt || '',
      k: ch.k ?? 4,
      embedding_provider: ch.embedding_provider || 'openai',
    };

    return model;
  }

  /**
   * Add an LLM configuration component (goes to components, no bounds)
   */
  private addLLM(model: AgentModel, modification: ModelModification): BESSERModel {
    const ch = modification.changes as AgentChanges;
    const target = modification.target;
    const llmId = ModifierHelpers.generateUniqueId('llm');

    componentsOf(model)[llmId] = {
      id: llmId,
      type: AgentComponentType.AgentLLM,
      name: target.name || ch.name || 'LLM',
      owner: null,
      provider: ch.provider || 'openai',
      num_previous_messages: ch.num_previous_messages ?? 1,
      global_context: ch.global_context || '',
    };

    return model;
  }

  /**
   * Add a tool component (goes to components, no bounds)
   */
  private addTool(model: AgentModel, modification: ModelModification): BESSERModel {
    const ch = modification.changes as AgentChanges;
    const target = modification.target;
    const toolId = ModifierHelpers.generateUniqueId('tool');

    componentsOf(model)[toolId] = {
      id: toolId,
      type: AgentComponentType.AgentTool,
      name: target.name || ch.name || 'Tool',
      owner: null,
      description: ch.description || '',
      code: ch.code || '',
    };

    return model;
  }

  /**
   * Add a skill component (goes to components, no bounds)
   */
  private addSkill(model: AgentModel, modification: ModelModification): BESSERModel {
    const ch = modification.changes as AgentChanges;
    const target = modification.target;
    const skillId = ModifierHelpers.generateUniqueId('skill');

    componentsOf(model)[skillId] = {
      id: skillId,
      type: AgentComponentType.AgentSkill,
      name: target.name || ch.name || 'Skill',
      owner: null,
      content: ch.content || '',
      description: ch.description || '',
    };

    return model;
  }

  /**
   * Add a workspace component (goes to components, no bounds)
   */
  private addWorkspace(model: AgentModel, modification: ModelModification): BESSERModel {
    const ch = modification.changes as AgentChanges;
    const target = modification.target;
    const wsId = ModifierHelpers.generateUniqueId('workspace');

    componentsOf(model)[wsId] = {
      id: wsId,
      type: AgentComponentType.AgentWorkspace,
      name: target.name || ch.name || 'Workspace',
      owner: null,
      path: ch.path || '',
      description: ch.description || '',
      writable: ch.writable !== false,
      max_read_bytes: 200000,
    };

    return model;
  }

  /**
   * Add a GUI page component (goes to components, no bounds)
   */
  private addGUI(model: AgentModel, modification: ModelModification): BESSERModel {
    const ch = modification.changes as AgentChanges;
    const target = modification.target;
    const guiId = ModifierHelpers.generateUniqueId('gui');
    const guiPageId = ch.gui_id || target.name || ch.name || 'gui_page';

    componentsOf(model)[guiId] = {
      id: guiId,
      type: AgentComponentType.AgentGUI,
      name: guiPageId,
      owner: null,
      gui_id: guiPageId,
      persist: ch.persist !== false,
      is_form: ch.is_form === true,
      width: ch.width || '',
    };

    return model;
  }

  /**
   * Remove element (state, intent, or their bodies)
   */
  private removeElement(model: AgentModel, modification: ModelModification): BESSERModel {
    const { stateId, stateName, intentId, intentName } = modification.target;

    // Remove state
    if (stateId || stateName) {
      const targetId = stateId || this.findStateIdByName(model, stateName!);
      if (targetId) {
        return ModifierHelpers.removeElementWithChildren(model, targetId);
      }
    }

    // Remove intent (lives in components in the new format)
    if (intentId || intentName) {
      const targetId = intentId || this.findIntentIdByName(model, intentName!);
      if (targetId) {
        if (model.components && componentsOf(model)[targetId]) {
          const intent = componentsOf(model)[targetId];
          for (const bodyId of (intent.bodies || [])) {
            delete componentsOf(model)[bodyId];
          }
          delete componentsOf(model)[targetId];
        } else {
          return ModifierHelpers.removeElementWithChildren(model, targetId);
        }
      }
    }

    return model;
  }

  // Helper methods
  private findStateIdByName(model: BESSERModel, stateName: string): string | null {
    return ModifierHelpers.findElementByName(model, stateName, 'AgentState');
  }

  private findIntentIdByName(model: AgentModel, intentName: string): string | null {
    // Intents now live in components (new format)
    if (model.components) {
      for (const [id, comp] of Object.entries(model.components)) {
        if (comp.type === AgentComponentType.AgentIntent && comp.name === intentName) {
          return id;
        }
      }
    }
    // Fallback: legacy format where intents were in elements
    return ModifierHelpers.findElementByName(model, intentName, AgentComponentType.AgentIntent);
  }

  private findInitialNodeId(model: BESSERModel): string | null {
    const results = ModifierHelpers.findElementsByType(model, 'StateInitialNode');
    return results.length > 0 ? results[0].id : null;
  }
}
