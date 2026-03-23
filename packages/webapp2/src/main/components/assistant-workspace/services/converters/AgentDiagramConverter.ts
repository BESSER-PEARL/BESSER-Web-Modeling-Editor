/**
 * Agent Diagram Converter  
 * Converts simplified agent system specifications to Apollon format
 * Architecture: AgentState with bodies/fallbackBodies, AgentIntent with bodies, AgentStateTransition
 */

import { DiagramConverter, PositionGenerator, generateUniqueId } from './base';

/**
 * Estimate the rendered width of an element based on its longest text line.
 * The editor auto-sizes elements, so we must match that to avoid overlaps.
 */
function estimateWidth(texts: string[], baseWidth: number): number {
  let maxW = baseWidth;
  for (const text of texts) {
    if (text) {
      // ~8px per character + padding, matching editor font metrics
      const estimated = text.length * 8 + 40;
      maxW = Math.max(maxW, estimated);
    }
  }
  return Math.max(maxW, baseWidth);
}

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

    // Collect all text lines to estimate width
    const allTexts: string[] = [];
    (spec.bodies || spec.replies || []).forEach((b: any) => allTexts.push(typeof b === 'string' ? b : b.text || ''));
    (spec.fallbackBodies || []).forEach((f: any) => allTexts.push(typeof f === 'string' ? f : f.text || ''));
    const stateWidth = estimateWidth(allTexts, 210);
    const bodyWidth = stateWidth - 1;

    // Create state bodies
    let currentY = pos.y + 41;
    (spec.bodies || spec.replies || []).forEach((body: any) => {
      const bodyId = generateUniqueId('body');
      bodies.push(bodyId);

      const bodyElement: any = {
        id: bodyId,
        name: body.text || body,
        type: 'AgentStateBody',
        owner: stateId,
        bounds: { x: pos.x + 0.5, y: currentY, width: bodyWidth, height: 30 },
        replyType: body.replyType || 'text'
      };
      if (body.ragDatabaseName) {
        bodyElement.ragDatabaseName = body.ragDatabaseName;
      }
      bodyElements[bodyId] = bodyElement;
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
        bounds: { x: pos.x + 0.5, y: currentY, width: bodyWidth, height: 30 }
      };
      currentY += 30;
    });

    const totalHeight = Math.max(70, currentY - pos.y);

    const stateElement = {
      id: stateId,
      name: spec.stateName || spec.name,
      type: 'AgentState',
      owner: null,
      bounds: { x: pos.x, y: pos.y, width: stateWidth, height: totalHeight },
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

    // Collect all text lines to estimate width
    const allTexts: string[] = [];
    (spec.trainingPhrases || spec.intentBodies || spec.bodies || []).forEach((p: any) =>
      allTexts.push(typeof p === 'string' ? p : p.text || '')
    );
    const intentWidth = estimateWidth(allTexts, 230);
    const bodyWidth = intentWidth - 1;

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
        bounds: { x: pos.x + 0.5, y: currentY, width: bodyWidth, height: 30 }
      };
      currentY += 30;
    });

    const totalHeight = Math.max(130, currentY - pos.y + 10);

    const intentElement = {
      id: intentId,
      name: spec.intentName || spec.name,
      type: 'AgentIntent',
      owner: null,
      bounds: { x: pos.x, y: pos.y, width: intentWidth, height: totalHeight },
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
      const initialPos =
        systemSpec.initialNode?.position ||
        systemSpec.initialPosition ||
        { x: -470, y: -30 };
      const initial = this.createInitialNode(initialPos);
      allElements[initial.initialNode.id] = initial.initialNode;
      elementIdMap['initial'] = initial.initialNode.id;
    }
    
    // Create intents (at top, negative Y)
    let intentX = -640;
    (systemSpec.intents || []).forEach((intentSpec: any) => {
      const position = intentSpec.position || { x: intentX, y: -350 };
      const completeElement = this.createIntent(intentSpec, position);
      elementIdMap[intentSpec.intentName || intentSpec.name] = completeElement.intent.id;
      
      allElements[completeElement.intent.id] = completeElement.intent;
      Object.assign(allElements, completeElement.bodies);
      
      if (!intentSpec.position) {
        intentX += 260; // Space intents horizontally
      }
    });
    
    // Create states
    (systemSpec.states || []).forEach((stateSpec: any) => {
      const position = stateSpec.position || this.positionGenerator.getNextPosition();
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
    
    // Create RAG elements if present
    if (systemSpec.ragElements) {
      let ragX = -640;
      for (const ragSpec of systemSpec.ragElements) {
        const ragId = generateUniqueId('rag');
        allElements[ragId] = {
          type: 'AgentRagElement',
          id: ragId,
          name: ragSpec.name || 'RAG DB',
          owner: null,
          bounds: { x: ragX, y: -500, width: 140, height: 120 }
        };
        ragX += 180;
      }
    }

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
