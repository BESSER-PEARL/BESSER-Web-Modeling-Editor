/**
 * Agent Diagram Modifier (v4-native)
 *
 * SA-7b.2: walks v4 `model.nodes[]` / `model.edges[]` directly — no v3↔v4
 * conversion seam.
 *
 * v4 AgentDiagram shape (per docs/source/migrations/uml-v4-shape.md and
 * docs/source/migrations/parity-final/agentDiagram.md):
 *   - `AgentState` has inline `data.bodies[]` and `data.fallbackBodies[]`
 *     row arrays (`{id, name}` plus optional `replyType`, `code`, RAG
 *     fields). v3 AgentStateBody / AgentStateFallbackBody collapse into
 *     these rows.
 *   - `AgentIntent` has inline `data.bodies[]` (training phrases) plus
 *     `data.intent_description`. v3 AgentIntentBody / IntentDescription
 *     collapse into these rows.
 *   - `AgentRagElement` is its own node (no children to collapse).
 *   - Edge type `AgentStateTransition` carries the canonical
 *     `{transitionType, predefined, custom, params, points}` data shape.
 *     `AgentStateTransitionInit` is the initial-state marker edge — no
 *     extra payload.
 */
import type { BesserEdge, BesserNode } from '@besser/wme';
import { DiagramModifier, ModelModification, ModifierHelpers } from './base';
import { BESSERModel } from '../UMLModelingService';

type BodyRow = {
  id: string;
  name: string;
  replyType?: string;
  ragDatabaseName?: string;
  code?: string;
  kind?: string;
};

const AGENT_STATE = 'AgentState';
const AGENT_INTENT = 'AgentIntent';
const AGENT_RAG = 'AgentRagElement';
const STATE_INITIAL = 'StateInitialNode';

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
    ].includes(action);
  }

  applyModification(model: BESSERModel, modification: ModelModification): BESSERModel {
    const updatedModel = ModifierHelpers.cloneModel(model);

    switch (modification.action) {
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
      case 'remove_element':
        return this.removeElement(updatedModel, modification);
      default:
        throw new Error(`Unsupported action for AgentDiagram: ${modification.action}`);
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  private nextPosition(model: BESSERModel): { x: number; y: number } {
    let maxY = 0;
    for (const n of ModifierHelpers.nodes(model)) {
      const bottom = (n.position?.y ?? 0) + (n.height ?? 0);
      if (bottom > maxY) maxY = bottom;
    }
    return { x: 100, y: maxY + 40 };
  }

  private findNodeByNameAndType(
    model: BESSERModel,
    name: string,
    type: string,
  ): BesserNode | undefined {
    return ModifierHelpers.findNodeByName(model, name, type);
  }

  private findStateNode(model: BESSERModel, name: string): BesserNode | undefined {
    return this.findNodeByNameAndType(model, name, AGENT_STATE);
  }

  private findIntentNode(model: BESSERModel, name: string): BesserNode | undefined {
    return this.findNodeByNameAndType(model, name, AGENT_INTENT);
  }

  private findInitialNode(model: BESSERModel): BesserNode | undefined {
    return ModifierHelpers.findNodesByType(model, STATE_INITIAL)[0];
  }

  // ─── Action handlers ────────────────────────────────────────────────────

  private addState(model: BESSERModel, modification: ModelModification): BESSERModel {
    const changes = modification.changes;
    const target = modification.target;
    const pos = this.nextPosition(model);

    const replies = changes.replies || [];
    let stateWidth = 210;
    for (const r of replies) {
      const estimated = (r.text || '').length * 8 + 40;
      if (estimated > stateWidth) stateWidth = estimated;
    }

    const bodies: BodyRow[] = replies.map((reply) => {
      const row: BodyRow = {
        id: ModifierHelpers.generateUniqueId('body'),
        name: reply.text || '',
        replyType: reply.replyType || 'text',
      };
      if (reply.ragDatabaseName) row.ragDatabaseName = reply.ragDatabaseName;
      return row;
    });

    const totalHeight = Math.max(70, 41 + bodies.length * 30);
    const stateName = target.stateName || changes.name || '';

    const stateId = ModifierHelpers.generateUniqueId('state');
    const node: BesserNode = {
      id: stateId,
      type: AGENT_STATE as any,
      position: pos,
      width: stateWidth,
      height: totalHeight,
      measured: { width: stateWidth, height: totalHeight },
      data: {
        name: stateName,
        bodies,
        fallbackBodies: [] as BodyRow[],
        replyType: 'text',
      },
    };

    ModifierHelpers.addNode(model, node);
    return model;
  }

  private addIntent(model: BESSERModel, modification: ModelModification): BESSERModel {
    const changes = modification.changes;
    const target = modification.target;
    const pos = this.nextPosition(model);

    const phrases = changes.trainingPhrases || [];
    let intentWidth = 230;
    for (const p of phrases) {
      const estimated = (p || '').length * 8 + 40;
      if (estimated > intentWidth) intentWidth = estimated;
    }

    const bodies: BodyRow[] = phrases.map((phrase) => ({
      id: ModifierHelpers.generateUniqueId('intentBody'),
      name: phrase,
    }));

    const totalHeight = Math.max(130, 41 + bodies.length * 30 + 10);
    const intentName = target.intentName || changes.intentName || changes.name || '';

    const intentId = ModifierHelpers.generateUniqueId('intent');
    const node: BesserNode = {
      id: intentId,
      type: AGENT_INTENT as any,
      position: pos,
      width: intentWidth,
      height: totalHeight,
      measured: { width: intentWidth, height: totalHeight },
      data: {
        name: intentName,
        bodies,
        intent_description: '',
      },
    };

    ModifierHelpers.addNode(model, node);
    return model;
  }

  private modifyState(model: BESSERModel, modification: ModelModification): BESSERModel {
    const { stateId, stateName } = modification.target;
    const node = (stateId ? ModifierHelpers.findNodeById(model, stateId) : undefined) ||
      (stateName ? this.findStateNode(model, stateName) : undefined);
    if (node && modification.changes.name) {
      (node.data as any).name = modification.changes.name;
    }
    return model;
  }

  private modifyIntent(model: BESSERModel, modification: ModelModification): BESSERModel {
    const { intentId, intentName } = modification.target;
    const node = (intentId ? ModifierHelpers.findNodeById(model, intentId) : undefined) ||
      (intentName ? this.findIntentNode(model, intentName) : undefined);
    if (!node) return model;

    const data = node.data as any;
    if (modification.changes.name) data.name = modification.changes.name;

    // `text` is the LLM's idiom for "append a training phrase".
    if (modification.changes.text) {
      const bodies: BodyRow[] = Array.isArray(data.bodies) ? data.bodies : [];
      bodies.push({
        id: ModifierHelpers.generateUniqueId('intentBody'),
        name: modification.changes.text,
      });
      data.bodies = bodies;
      // Grow the node card visually so the new body row fits.
      node.height = Math.max(130, 41 + bodies.length * 30 + 10);
      node.measured = { width: node.width, height: node.height };
    }

    return model;
  }

  private addStateBody(model: BESSERModel, modification: ModelModification): BESSERModel {
    const { stateId, stateName } = modification.target;
    const node = (stateId ? ModifierHelpers.findNodeById(model, stateId) : undefined) ||
      (stateName ? this.findStateNode(model, stateName) : undefined);

    if (!node) {
      throw new Error(`State not found: ${stateName || stateId}`);
    }
    if ((node.type as string) !== AGENT_STATE) {
      throw new Error('Target is not an AgentState');
    }

    const data = node.data as any;
    const bodies: BodyRow[] = Array.isArray(data.bodies) ? data.bodies : [];
    const newBody: BodyRow = {
      id: ModifierHelpers.generateUniqueId('body'),
      name: modification.changes.text || 'New reply',
      replyType: modification.changes.replyType || 'text',
    };
    if (modification.changes.ragDatabaseName) newBody.ragDatabaseName = modification.changes.ragDatabaseName;
    if (modification.changes.code) newBody.code = modification.changes.code;
    bodies.push(newBody);
    data.bodies = bodies;

    node.height = Math.max(70, 41 + bodies.length * 30);
    node.measured = { width: node.width, height: node.height };

    return model;
  }

  /**
   * Add a transition between states / intents (or from the initial node).
   *
   * Source/target resolution priority:
   *  - "initial" or empty string → the StateInitialNode (any) → init edge
   *  - otherwise look up by AgentState name first, then AgentIntent name
   */
  private addTransition(model: BESSERModel, modification: ModelModification): BESSERModel {
    const changes = modification.changes;
    const target = modification.target;

    const sourceName = changes.source || target.stateName || target.intentName || '';
    const targetName = changes.target || (changes as any).targetClass || '';
    if (!targetName) {
      throw new Error('Transition requires a target state name.');
    }

    let sourceNode: BesserNode | undefined;
    if (!sourceName || sourceName.toLowerCase() === 'initial') {
      sourceNode = this.findInitialNode(model);
    } else {
      sourceNode = this.findStateNode(model, sourceName) || this.findIntentNode(model, sourceName);
    }
    const targetNode = this.findStateNode(model, targetName);

    if (!sourceNode || !targetNode) {
      throw new Error(`Could not locate source (${sourceName}) or target (${targetName}) for transition.`);
    }

    const isInit = (sourceNode.type as string) === STATE_INITIAL;
    const transitionId = ModifierHelpers.generateUniqueId('transition');

    // Build canonical v4 transition data. `predefined` / `custom` are
    // populated based on whether the source is an AgentIntent (intent
    // match) or has a free-form condition.
    const transitionData: Record<string, unknown> = {
      name: changes.label || changes.name || '',
      params: {} as Record<string, string>,
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      isManuallyLayouted: false,
    };

    if (!isInit) {
      if ((sourceNode.type as string) === AGENT_INTENT) {
        const intentName = (sourceNode.data as any)?.name || sourceName || '';
        transitionData.transitionType = 'predefined';
        transitionData.predefined = {
          predefinedType: 'when_intent_matched',
          intentName,
        };
      } else if (changes.condition) {
        transitionData.transitionType = 'custom';
        transitionData.custom = {
          event: 'ReceiveTextEvent',
          condition: [changes.condition],
        };
      } else {
        transitionData.transitionType = 'predefined';
        transitionData.predefined = { predefinedType: 'auto' };
      }
    }

    const edge: BesserEdge = {
      id: transitionId,
      source: sourceNode.id,
      target: targetNode.id,
      type: (isInit ? 'AgentStateTransitionInit' : 'AgentStateTransition') as any,
      sourceHandle: 'Right',
      targetHandle: 'Left',
      data: transitionData as any,
    };

    ModifierHelpers.addEdge(model, edge);
    return model;
  }

  private removeTransition(model: BESSERModel, modification: ModelModification): BESSERModel {
    const m = model as any;
    const { transitionId } = modification.target;

    if (transitionId) {
      m.edges = (m.edges ?? []).filter((e: BesserEdge) => e.id !== transitionId);
      return model;
    }

    const sourceName = modification.changes?.source;
    const targetName = modification.changes?.target;
    if (sourceName && targetName) {
      const src = this.findStateNode(model, sourceName) || this.findIntentNode(model, sourceName);
      const tgt = this.findStateNode(model, targetName);
      if (src && tgt) {
        m.edges = (m.edges ?? []).filter(
          (e: BesserEdge) => !(e.source === src.id && e.target === tgt.id),
        );
      }
    }

    return model;
  }

  private addRagElement(model: BESSERModel, modification: ModelModification): BESSERModel {
    const target = modification.target;
    const changes = modification.changes;
    const pos = this.nextPosition(model);

    const ragId = ModifierHelpers.generateUniqueId('rag');
    const data: Record<string, unknown> = {
      name: target.name || changes.name || 'RAG DB',
    };
    if (changes.ragDatabaseName) data.ragDatabaseName = changes.ragDatabaseName;

    const node: BesserNode = {
      id: ragId,
      type: AGENT_RAG as any,
      position: pos,
      width: 140,
      height: 120,
      measured: { width: 140, height: 120 },
      data,
    };

    ModifierHelpers.addNode(model, node);
    return model;
  }

  private removeElement(model: BESSERModel, modification: ModelModification): BESSERModel {
    const { stateId, stateName, intentId, intentName } = modification.target;

    if (stateId || stateName) {
      const node = (stateId ? ModifierHelpers.findNodeById(model, stateId) : undefined) ||
        (stateName ? this.findStateNode(model, stateName) : undefined);
      if (node) return ModifierHelpers.removeNodeWithChildren(model, node.id);
    }

    if (intentId || intentName) {
      const node = (intentId ? ModifierHelpers.findNodeById(model, intentId) : undefined) ||
        (intentName ? this.findIntentNode(model, intentName) : undefined);
      if (node) return ModifierHelpers.removeNodeWithChildren(model, node.id);
    }

    return model;
  }
}
