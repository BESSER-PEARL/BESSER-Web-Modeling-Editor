/**
 * Agent Diagram Converter  
 * Converts simplified agent system specifications to Apollon format
 * Architecture: AgentState with bodies/fallbackBodies, AgentIntent with bodies, AgentStateTransition
 */

import { DiagramConverter, PositionGenerator, generateUniqueId } from './base';

export class AgentDiagramConverter implements DiagramConverter {
  private positionGenerator = new PositionGenerator();

  getDiagramType() {
    return 'AgentDiagram' as const;
  }

  convertSingleElement(spec: any, position?: { x: number; y: number }) {
    const pos = position || this.positionGenerator.getNextPosition();
    
    // Check if this is a state or an intent
    if (spec.type === 'intent' || spec.intentBodies) {
      return this.createIntent(spec, pos);
    } else if (spec.type === 'initial') {
      return this.createInitialNode(pos);
    } else {
      return this.createState(spec, pos);
    }
  }

  private createInitialNode(pos: { x: number; y: number }) {
    const nodeId = generateUniqueId('initial');
    return {
      initialNode: {
        id: nodeId,
        name: '',
        type: 'StateInitialNode',
        owner: null,
        bounds: { x: pos.x, y: pos.y, width: 45, height: 45 }
      }
    };
  }

  private createState(spec: any, pos: { x: number; y: number }) {
    const stateId = generateUniqueId('state');
    const bodies: string[] = [];
    const fallbackBodies: string[] = [];
    const bodyElements: Record<string, any> = {};
    
    // Create state bodies
    let currentY = pos.y + 41;
    (spec.bodies || spec.replies || []).forEach((body: any) => {
      const bodyId = generateUniqueId('body');
      bodies.push(bodyId);
      
      bodyElements[bodyId] = {
        id: bodyId,
        name: body.text || body,
        type: 'AgentStateBody',
        owner: stateId,
        bounds: { x: pos.x + 0.5, y: currentY, width: 209, height: 30 },
        replyType: body.replyType || 'text'
      };
      currentY += 30;
    });
    
    // Create fallback bodies if present
    (spec.fallbackBodies || []).forEach((fallback: any) => {
      const fallbackId = generateUniqueId('fallback');
      fallbackBodies.push(fallbackId);
      
      bodyElements[fallbackId] = {
        id: fallbackId,
        name: fallback.text || fallback,
        type: 'AgentStateFallbackBody',
        owner: stateId,
        bounds: { x: pos.x + 0.5, y: currentY, width: 209, height: 30 }
      };
      currentY += 30;
    });
    
    const totalHeight = Math.max(70, currentY - pos.y);
    
    const stateElement = {
      id: stateId,
      name: spec.stateName || spec.name,
      type: 'AgentState',
      owner: null,
      bounds: { x: pos.x, y: pos.y, width: 210, height: totalHeight },
      bodies,
      fallbackBodies
    };
    
    return {
      state: stateElement,
      bodies: bodyElements
    };
  }

  private createIntent(spec: any, pos: { x: number; y: number }) {
    const intentId = generateUniqueId('intent');
    const bodies: string[] = [];
    const bodyElements: Record<string, any> = {};
    
    // Create intent bodies (training phrases)
    let currentY = pos.y + 41;
    (spec.trainingPhrases || spec.intentBodies || spec.bodies || []).forEach((phrase: any) => {
      const bodyId = generateUniqueId('intentBody');
      bodies.push(bodyId);
      
      bodyElements[bodyId] = {
        id: bodyId,
        name: typeof phrase === 'string' ? phrase : phrase.text,
        type: 'AgentIntentBody',
        owner: intentId,
        bounds: { x: pos.x + 0.5, y: currentY, width: 229, height: 30 }
      };
      currentY += 30;
    });
    
    const totalHeight = Math.max(130, currentY - pos.y + 10);
    
    const intentElement = {
      id: intentId,
      name: spec.intentName || spec.name,
      type: 'AgentIntent',
      owner: null,
      bounds: { x: pos.x, y: pos.y, width: 230, height: totalHeight },
      bodies
    };
    
    return {
      intent: intentElement,
      bodies: bodyElements
    };
  }

  convertCompleteSystem(systemSpec: any) {
    this.positionGenerator.reset();
    const allElements: Record<string, any> = {};
    const allRelationships: Record<string, any> = {};
    const elementIdMap: Record<string, string> = {};
    
    // Create initial node if specified
    if (systemSpec.hasInitialNode !== false) {
      const initialPos = { x: -470, y: -30 };
      const initial = this.createInitialNode(initialPos);
      allElements[initial.initialNode.id] = initial.initialNode;
      elementIdMap['initial'] = initial.initialNode.id;
    }
    
    // Create intents (at top, negative Y)
    let intentX = -640;
    (systemSpec.intents || []).forEach((intentSpec: any) => {
      const position = { x: intentX, y: -350 };
      const completeElement = this.createIntent(intentSpec, position);
      elementIdMap[intentSpec.intentName || intentSpec.name] = completeElement.intent.id;
      
      allElements[completeElement.intent.id] = completeElement.intent;
      Object.assign(allElements, completeElement.bodies);
      
      intentX += 260; // Space intents horizontally
    });
    
    // Create states
    (systemSpec.states || []).forEach((stateSpec: any, index: number) => {
      const position = this.positionGenerator.getNextPosition(index);
      const completeElement = this.createState(stateSpec, position);
      elementIdMap[stateSpec.stateName || stateSpec.name] = completeElement.state.id;
      
      allElements[completeElement.state.id] = completeElement.state;
      Object.assign(allElements, completeElement.bodies);
    });
    
    // Create transitions
    (systemSpec.transitions || []).forEach((transition: any) => {
      const sourceId = elementIdMap[transition.source];
      const targetId = elementIdMap[transition.target];
      
      if (sourceId && targetId) {
        const transId = generateUniqueId('transition');
        const sourceElement = allElements[sourceId];
        const isInitialTransition = sourceElement?.type === 'StateInitialNode';
        
        allRelationships[transId] = {
          id: transId,
          name: transition.label || '',
          type: isInitialTransition ? 'AgentStateTransitionInit' : 'AgentStateTransition',
          owner: null,
          bounds: { x: 0, y: 0, width: 100, height: 1 },
          path: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
          source: {
            direction: transition.sourceDirection || 'Right',
            element: sourceId
          },
          target: {
            direction: transition.targetDirection || 'Left',
            element: targetId
          },
          isManuallyLayouted: false
        };
        
        // Add condition fields for intent-based transitions
        if (transition.condition) {
          allRelationships[transId].condition = transition.condition;
          allRelationships[transId].conditionValue = transition.conditionValue || '';
        }
      }
    });
    
    return {
      version: "3.0.0",
      type: "AgentDiagram",
      size: { width: 1080, height: 400 },
      elements: allElements,
      relationships: allRelationships,
      interactive: { elements: {}, relationships: {} },
      assessments: {}
    };
  }
}
