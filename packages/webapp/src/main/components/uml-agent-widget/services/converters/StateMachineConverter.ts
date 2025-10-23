/**
 * 
 * State Machine Diagram Converter
 * Converts simplified state machine specifications to Apollon format
 */

import { DiagramConverter, PositionGenerator, generateUniqueId } from './base';

export class StateMachineConverter implements DiagramConverter {
  private positionGenerator = new PositionGenerator();

  getDiagramType() {
    return 'StateMachineDiagram' as const;
  }

  convertSingleElement(spec: any, position?: { x: number; y: number }) {
    const pos = position || this.positionGenerator.getNextPosition();
    const stateId = generateUniqueId('state');
    
    const stateType = this.getStateType(spec.stateType);
    
    // StateInitialNode and StateFinalNode are simple circles
    if (stateType === 'StateInitialNode' || stateType === 'StateFinalNode') {
      return {
        state: {
          type: stateType,
          id: stateId,
          name: '',
          owner: null,
          bounds: { x: pos.x, y: pos.y, width: 45, height: 45 }
        }
      };
    }
    
    // State has bodies and fallbackBodies
    const bodies: string[] = [];
    const fallbackBodies: string[] = [];
    const bodyElements: Record<string, any> = {};
    
    // Create body elements (entry/do/exit actions)
    let currentY = pos.y + 41; // Start below state name
    
    if (spec.entryAction) {
      const bodyId = generateUniqueId('body');
      bodies.push(bodyId);
      bodyElements[bodyId] = {
        id: bodyId,
        name: `entry / ${spec.entryAction}`,
        type: 'StateBody',
        owner: stateId,
        bounds: { x: pos.x + 0.5, y: currentY, width: 159, height: 30 }
      };
      currentY += 30;
    }
    
    if (spec.doActivity) {
      const bodyId = generateUniqueId('body');
      bodies.push(bodyId);
      bodyElements[bodyId] = {
        id: bodyId,
        name: `do / ${spec.doActivity}`,
        type: 'StateBody',
        owner: stateId,
        bounds: { x: pos.x + 0.5, y: currentY, width: 159, height: 30 }
      };
      currentY += 30;
    }
    
    if (spec.exitAction) {
      const bodyId = generateUniqueId('body');
      bodies.push(bodyId);
      bodyElements[bodyId] = {
        id: bodyId,
        name: `exit / ${spec.exitAction}`,
        type: 'StateBody',
        owner: stateId,
        bounds: { x: pos.x + 0.5, y: currentY, width: 159, height: 30 }
      };
      currentY += 30;
    }
    
    // Create fallback body if specified
    if (spec.fallbackAction) {
      const fallbackId = generateUniqueId('fallback');
      fallbackBodies.push(fallbackId);
      bodyElements[fallbackId] = {
        id: fallbackId,
        name: spec.fallbackAction,
        type: 'StateFallbackBody',
        owner: stateId,
        bounds: { x: pos.x + 0.5, y: currentY, width: 159, height: 30 }
      };
      currentY += 30;
    }
    
    const totalHeight = Math.max(100, currentY - pos.y);
    
    const stateElement = {
      type: 'State',
      id: stateId,
      name: spec.stateName || '',
      owner: null,
      bounds: { x: pos.x, y: pos.y, width: 160, height: totalHeight },
      bodies,
      fallbackBodies
    };
    
    return {
      state: stateElement,
      bodies: bodyElements
    };
  }

  convertCompleteSystem(systemSpec: any) {
    this.positionGenerator.reset();
    const allElements: Record<string, any> = {};
    const allRelationships: Record<string, any> = {};
    const stateIdMap: Record<string, string> = {};
    
    // Create states with their bodies
    systemSpec.states?.forEach((stateSpec: any, index: number) => {
      const position = this.positionGenerator.getNextPosition(index);
      const completeElement = this.convertSingleElement(stateSpec, position);
      stateIdMap[stateSpec.stateName || 'initial'] = completeElement.state.id;
      
      // Add state element
      allElements[completeElement.state.id] = completeElement.state;
      
      // Add body and fallback body elements
      if (completeElement.bodies) {
        Object.assign(allElements, completeElement.bodies);
      }
    });
    
    // Create transitions
    systemSpec.transitions?.forEach((transition: any) => {
      const sourceId = stateIdMap[transition.source];
      const targetId = stateIdMap[transition.target];
      
      if (sourceId && targetId) {
        const transId = generateUniqueId('transition');
        const sourceElement = allElements[sourceId];
        const isInitialTransition = sourceElement?.type === 'StateInitialNode';
        
        // Build transition label
        let name = '';
        if (transition.trigger) name += transition.trigger;
        if (transition.guard) name += ` [${transition.guard}]`;
        if (transition.effect) name += ` / ${transition.effect}`;
        
        allRelationships[transId] = {
          id: transId,
          type: isInitialTransition ? 'StateTransitionInit' : 'StateTransition',
          name,
          owner: null,
          bounds: { x: 0, y: 0, width: 100, height: 1 },
          path: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
          source: {
            direction: 'Right',
            element: sourceId,
            bounds: { x: 0, y: 0, width: 0, height: 0 }
          },
          target: {
            direction: 'Left',
            element: targetId,
            bounds: { x: 0, y: 0, width: 0, height: 0 }
          },
          isManuallyLayouted: false
        };
        
        // Add condition fields for regular transitions
        if (!isInitialTransition && transition.condition) {
          allRelationships[transId].condition = transition.condition;
          allRelationships[transId].conditionValue = transition.conditionValue || '';
        }
      }
    });
    
    return {
      version: "3.0.0",
      type: "StateMachineDiagram",
      size: { width: 1080, height: 400 },
      elements: allElements,
      relationships: allRelationships,
      interactive: { elements: {}, relationships: {} },
      assessments: {}
    };
  }

  private getStateType(stateType: string): string {
    switch (stateType?.toLowerCase()) {
      case 'initial':
        return 'StateInitialNode';
      case 'final':
        return 'StateFinalNode';
      default:
        return 'State';
    }
  }
}
