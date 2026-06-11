/**
 * Agent Diagram Converter (v4-native)
 *
 * Converts simplified agent system specifications straight into the
 * canonical v4 shape ({version: '4.0.0', nodes[], edges[]}). Node/edge
 * shapes are identical to what the editor produces (per
 * `docs/source/migrations/uml-v4-shape.md`):
 *   - `AgentState` carries inline `data.bodies[]` / `data.fallbackBodies[]`
 *     rows ({id, name, replyType, ragDatabaseName?, …}),
 *   - `AgentIntent` carries inline `data.training_phrases[]` rows plus
 *     `data.intent_description`,
 *   - `AgentRagElement` / `StateInitialNode` are standalone nodes,
 *   - transitions are `AgentStateTransition` edges with the canonical
 *     `{transitionType, predefined | custom}` data shape
 *     (`AgentStateTransitionInit` from the initial node carries none).
 */

import type { BesserEdge, BesserNode } from '@besser/wme';
import { DiagramConverter, PositionGenerator, generateUniqueId } from './base';
import { createEmptyV4Model, directionToHandle, estimateAgentNodeWidth } from '../shared/v4Builders';

type AgentBodyRow = {
  id: string;
  name: string;
  replyType?: string;
  ragDatabaseName?: string;
};

type TrainingPhraseRow = { id: string; name: string };

export class AgentDiagramConverter implements DiagramConverter {
  private positionGenerator = new PositionGenerator();

  getDiagramType() {
    return 'AgentDiagram' as const;
  }

  convertSingleElement(
    spec: any,
    position?: { x: number; y: number },
  ): { nodes: BesserNode[]; edges: BesserEdge[] } {
    const pos = position || this.positionGenerator.getNextPosition();

    // Check if this is a state or an intent
    let node: BesserNode;
    if (spec.type === 'intent' || spec.intentBodies) {
      node = this.createIntentNode(spec, pos);
    } else if (spec.type === 'initial') {
      node = this.createInitialNode(pos);
    } else {
      node = this.createStateNode(spec, pos);
    }

    return { nodes: [node], edges: [] };
  }

  private createInitialNode(pos: { x: number; y: number }): BesserNode {
    return {
      id: generateUniqueId('initial'),
      type: 'StateInitialNode' as any,
      position: { x: pos.x, y: pos.y },
      width: 45,
      height: 45,
      measured: { width: 45, height: 45 },
      data: { name: '' },
    };
  }

  private createStateNode(spec: any, pos: { x: number; y: number }): BesserNode {
    // Collect all text lines to estimate width
    const allTexts: string[] = [];
    (spec.bodies || spec.replies || []).forEach((b: any) => allTexts.push(typeof b === 'string' ? b : b.text || ''));
    (spec.fallbackBodies || []).forEach((f: any) => allTexts.push(typeof f === 'string' ? f : f.text || ''));
    const stateWidth = estimateAgentNodeWidth(allTexts, 210);

    // Inline body rows (replies)
    const bodies: AgentBodyRow[] = (spec.bodies || spec.replies || []).map((body: any) => {
      const row: AgentBodyRow = {
        id: generateUniqueId('body'),
        name: typeof body === 'string' ? body : body.text || '',
        replyType: (typeof body === 'object' && body.replyType) || 'text',
      };
      if (typeof body === 'object' && body.ragDatabaseName) {
        row.ragDatabaseName = body.ragDatabaseName;
      }
      return row;
    });

    // Inline fallback-body rows
    const fallbackBodies: AgentBodyRow[] = (spec.fallbackBodies || []).map((fallback: any) => ({
      id: generateUniqueId('fallback'),
      name: typeof fallback === 'string' ? fallback : fallback.text || '',
    }));

    const totalHeight = Math.max(70, 41 + (bodies.length + fallbackBodies.length) * 30);

    return {
      id: generateUniqueId('state'),
      type: 'AgentState' as any,
      position: { x: pos.x, y: pos.y },
      width: stateWidth,
      height: totalHeight,
      measured: { width: stateWidth, height: totalHeight },
      data: {
        name: spec.stateName || spec.name,
        replyType: 'text',
        bodies,
        fallbackBodies,
      },
    };
  }

  private createIntentNode(spec: any, pos: { x: number; y: number }): BesserNode {
    const phrases: any[] = spec.trainingPhrases || spec.intentBodies || spec.bodies || [];

    // Collect all text lines to estimate width
    const allTexts = phrases.map((p: any) => (typeof p === 'string' ? p : p.text || ''));
    const intentWidth = estimateAgentNodeWidth(allTexts, 230);

    // Inline training-phrase rows
    const trainingPhrases: TrainingPhraseRow[] = phrases.map((phrase: any) => ({
      id: generateUniqueId('intentBody'),
      name: typeof phrase === 'string' ? phrase : phrase.text,
    }));

    const totalHeight = Math.max(130, 41 + trainingPhrases.length * 30 + 10);

    return {
      id: generateUniqueId('intent'),
      type: 'AgentIntent' as any,
      position: { x: pos.x, y: pos.y },
      width: intentWidth,
      height: totalHeight,
      measured: { width: intentWidth, height: totalHeight },
      data: {
        name: spec.intentName || spec.name,
        intent_description: spec.description || '',
        training_phrases: trainingPhrases,
      },
    };
  }

  convertCompleteSystem(systemSpec: any) {
    this.positionGenerator.reset();
    const model = createEmptyV4Model('AgentDiagram', systemSpec.systemName || systemSpec.name || '');
    const nodes: BesserNode[] = model.nodes;
    const edges: BesserEdge[] = model.edges;
    const elementIdMap: Record<string, string> = {};
    const nodeById: Record<string, BesserNode> = {};

    const pushNode = (node: BesserNode) => {
      nodes.push(node);
      nodeById[node.id] = node;
    };

    // Create initial node if specified
    if (systemSpec.hasInitialNode !== false) {
      const initialPos =
        systemSpec.initialNode?.position ||
        systemSpec.initialPosition ||
        { x: -470, y: -30 };
      const initial = this.createInitialNode(initialPos);
      pushNode(initial);
      elementIdMap['initial'] = initial.id;
    }

    // Create intents (at top, negative Y)
    let intentX = -640;
    (systemSpec.intents || []).forEach((intentSpec: any) => {
      const position = intentSpec.position || { x: intentX, y: -350 };
      const intentNode = this.createIntentNode(intentSpec, position);
      elementIdMap[intentSpec.intentName || intentSpec.name] = intentNode.id;
      pushNode(intentNode);

      if (!intentSpec.position) {
        intentX += 260; // Space intents horizontally
      }
    });

    // Create states
    (systemSpec.states || []).forEach((stateSpec: any) => {
      const position = stateSpec.position || this.positionGenerator.getNextPosition();
      const stateNode = this.createStateNode(stateSpec, position);
      elementIdMap[stateSpec.stateName || stateSpec.name] = stateNode.id;
      pushNode(stateNode);
    });

    // Create transitions
    (systemSpec.transitions || []).forEach((transition: any) => {
      const sourceId = elementIdMap[transition.source];
      const targetId = elementIdMap[transition.target];

      if (sourceId && targetId) {
        const transId = generateUniqueId('transition');
        const sourceNode = nodeById[sourceId];
        const isInitialTransition = (sourceNode?.type as string) === 'StateInitialNode';
        const label = transition.label || '';

        edges.push({
          id: transId,
          source: sourceId,
          target: targetId,
          type: (isInitialTransition ? 'AgentStateTransitionInit' : 'AgentStateTransition') as any,
          sourceHandle: directionToHandle(transition.sourceDirection, 'Right'),
          targetHandle: directionToHandle(transition.targetDirection, 'Left'),
          data: {
            label,
            ...(label && { name: label }),
            isManuallyLayouted: false,
            points: [
              { x: 0, y: 0 },
              { x: 100, y: 0 },
            ],
            // Canonical v4 transition condition (init edges carry none)
            ...(isInitialTransition ? {} : this.buildTransitionConditionData(transition, sourceNode)),
          },
        });
      }
    });

    // Create RAG elements if present
    if (systemSpec.ragElements) {
      let ragX = -640;
      for (const ragSpec of systemSpec.ragElements) {
        pushNode({
          id: generateUniqueId('rag'),
          type: 'AgentRagElement' as any,
          position: { x: ragX, y: -500 },
          width: 140,
          height: 120,
          measured: { width: 140, height: 120 },
          data: { name: ragSpec.name || 'RAG DB' },
        });
        ragX += 180;
      }
    }

    return model;
  }

  /**
   * Lift the spec's flat `condition` / `conditionValue` pair into the
   * canonical v4 `{transitionType, predefined | custom}` data. Mirrors the
   * legacy-flat handling of `liftAgentTransitionDataToV4` in the library's
   * versionConverter so natively-emitted edges match migrated ones.
   */
  private buildTransitionConditionData(transition: any, sourceNode?: BesserNode): Record<string, unknown> {
    const condition: string | undefined = transition.condition;
    const conditionValue = transition.conditionValue;
    const sourceIsIntent = (sourceNode?.type as string) === 'AgentIntent';
    const sourceName = (sourceNode?.data as any)?.name || '';

    if (condition === 'custom_transition') {
      return {
        transitionType: 'custom',
        custom: {
          event: 'WildcardEvent',
          condition: conditionValue ? [String(conditionValue)] : [],
        },
      };
    }

    if (condition) {
      const predefined: Record<string, unknown> = { predefinedType: condition };
      if (condition === 'when_intent_matched') {
        predefined.intentName = conditionValue || (sourceIsIntent ? sourceName : '');
      } else if (condition === 'when_file_received') {
        predefined.fileType = conditionValue || '';
      } else if (conditionValue !== undefined) {
        predefined.conditionValue = conditionValue;
      }
      return { transitionType: 'predefined', predefined };
    }

    // No explicit condition: transitions out of an intent match that intent;
    // state-to-state transitions fall back to automatic.
    if (sourceIsIntent) {
      return {
        transitionType: 'predefined',
        predefined: { predefinedType: 'when_intent_matched', intentName: sourceName },
      };
    }
    return {
      transitionType: 'predefined',
      predefined: { predefinedType: 'auto' },
    };
  }
}
