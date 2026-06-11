/**
 * State Machine Diagram Converter (v4-native)
 *
 * Converts simplified state machine specifications straight into the
 * canonical v4 shape ({version: '4.0.0', nodes[], edges[]}). Node/edge
 * shapes are identical to what the editor produces:
 *   - `State` carries inline `data.bodies[]` / `data.fallbackBodies[]`
 *     rows ({id, name}) — StateBody / StateFallbackBody are NOT separate
 *     nodes,
 *   - `StateInitialNode` / `StateFinalNode` / `StateCodeBlock` remain
 *     top-level nodes,
 *   - transitions are `StateTransition` edges; the trigger/guard/effect
 *     label lives on `edge.data.name`.
 */

import type { BesserEdge, BesserNode } from '@besser/wme';
import { DiagramConverter, PositionGenerator, generateUniqueId } from './base';
import { createEmptyV4Model, directionToHandle } from '../shared/v4Builders';

type BodyRow = { id: string; name: string };

export class StateMachineConverter implements DiagramConverter {
  private positionGenerator = new PositionGenerator();

  getDiagramType() {
    return 'StateMachineDiagram' as const;
  }

  convertSingleElement(
    spec: any,
    position?: { x: number; y: number },
  ): { nodes: BesserNode[]; edges: BesserEdge[] } {
    const pos = position || this.positionGenerator.getNextPosition();
    const stateId = generateUniqueId('state');

    const stateType = this.getStateType(spec.stateType);

    // StateInitialNode and StateFinalNode are simple circles
    if (stateType === 'StateInitialNode' || stateType === 'StateFinalNode') {
      return {
        nodes: [{
          id: stateId,
          type: stateType as any,
          position: { x: pos.x, y: pos.y },
          width: 45,
          height: 45,
          measured: { width: 45, height: 45 },
          data: { name: '' },
        }],
        edges: [],
      };
    }

    // State carries inline body / fallback-body rows (entry/do/exit actions)
    const bodies: BodyRow[] = [];
    const fallbackBodies: BodyRow[] = [];

    if (spec.entryAction) {
      bodies.push({ id: generateUniqueId('body'), name: `entry / ${spec.entryAction}` });
    }
    if (spec.doActivity) {
      bodies.push({ id: generateUniqueId('body'), name: `do / ${spec.doActivity}` });
    }
    if (spec.exitAction) {
      bodies.push({ id: generateUniqueId('body'), name: `exit / ${spec.exitAction}` });
    }
    if (spec.fallbackAction) {
      fallbackBodies.push({ id: generateUniqueId('fallback'), name: spec.fallbackAction });
    }

    const totalHeight = Math.max(100, 41 + (bodies.length + fallbackBodies.length) * 30);

    return {
      nodes: [{
        id: stateId,
        type: 'State' as any,
        position: { x: pos.x, y: pos.y },
        width: 160,
        height: totalHeight,
        measured: { width: 160, height: totalHeight },
        data: {
          name: spec.stateName || '',
          bodies,
          fallbackBodies,
        },
      }],
      edges: [],
    };
  }

  convertCompleteSystem(systemSpec: any) {
    this.positionGenerator.reset();
    const model = createEmptyV4Model('StateMachineDiagram', systemSpec.systemName || systemSpec.name || '');
    const nodes: BesserNode[] = model.nodes;
    const edges: BesserEdge[] = model.edges;
    const stateIdMap: Record<string, string> = {};
    const nodeById: Record<string, BesserNode> = {};

    // Create states with their inline bodies
    systemSpec.states?.forEach((stateSpec: any) => {
      const position = stateSpec.position || this.positionGenerator.getNextPosition();
      const { nodes: stateNodes } = this.convertSingleElement(stateSpec, position);
      const stateNode = stateNodes[0];
      stateIdMap[stateSpec.stateName || 'initial'] = stateNode.id;
      nodeById[stateNode.id] = stateNode;
      nodes.push(stateNode);
    });

    // Create transitions
    systemSpec.transitions?.forEach((transition: any) => {
      const sourceId = stateIdMap[transition.source];
      const targetId = stateIdMap[transition.target];

      if (sourceId && targetId) {
        const transId = generateUniqueId('transition');

        // Build transition label
        let name = '';
        if (transition.trigger) name += transition.trigger;
        if (transition.guard) name += ` [${transition.guard}]`;
        if (transition.effect) name += ` / ${transition.effect}`;

        edges.push({
          id: transId,
          source: sourceId,
          target: targetId,
          type: 'StateTransition' as any,
          sourceHandle: directionToHandle(transition.sourceDirection, 'Right'),
          targetHandle: directionToHandle(transition.targetDirection, 'Left'),
          data: {
            label: name,
            ...(name && { name }),
            isManuallyLayouted: false,
            points: [
              { x: 0, y: 0 },
              { x: 100, y: 0 },
            ],
          },
        });
      }
    });

    // Create code blocks if present
    if (systemSpec.codeBlocks) {
      for (const codeBlock of systemSpec.codeBlocks) {
        const codeBlockPos = this.positionGenerator.getNextPosition();
        const codeBlockId = generateUniqueId('codeblock');
        nodes.push({
          id: codeBlockId,
          type: 'StateCodeBlock' as any,
          position: { x: codeBlockPos.x, y: codeBlockPos.y },
          width: 200,
          height: 150,
          measured: { width: 200, height: 150 },
          data: {
            name: codeBlock.name || 'Code',
            code: codeBlock.code || '',
            language: codeBlock.language || 'python',
          },
        });
      }
    }

    return model;
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
