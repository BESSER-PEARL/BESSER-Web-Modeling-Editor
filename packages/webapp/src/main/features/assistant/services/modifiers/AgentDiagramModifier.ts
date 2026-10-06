/**
 * Agent Diagram Modifier (v4-native)
 *
 * Walks v4 `model.nodes[]` / `model.edges[]` for canvas items and the
 * top-level `model.components` map for off-canvas agent components (per
 * docs/source/migrations/uml-v4-shape.md → AgentDiagram):
 *   - `AgentState` has inline `data.bodies[]` / `data.fallbackBodies[]`
 *     action rows ({id, name, replyType, actionType, …}); built by the same
 *     `buildAgentStateBody` the converter uses.
 *   - Intents (+ `AgentIntentBody` training sentences), LLMs, RAG databases,
 *     tools, skills, workspaces and GUIs are flat `model.components`
 *     entries (no position). Older models that kept them on the canvas are
 *     migrated first by the library's `normalizeAgentComponents`.
 *   - `AgentStateTransition` edges carry the canonical
 *     `{transitionType, predefined | custom, params, points}` data.
 *   - The entry state is `data.initial` on the state; the legacy
 *     `StateInitialNode` + `AgentStateTransitionInit` pair is only used when
 *     the model still carries the marker.
 */
import { AgentComponentType, normalizeAgentComponents } from '@besser/wme';
import type { BesserEdge, BesserNode, UMLModel } from '@besser/wme';
import { DiagramModifier, ModelModification, ModifierHelpers } from './base';
import { BESSERModel } from '../UMLModelingService';
import { estimateAgentNodeWidth } from '../shared/v4Builders';
import {
  AgentBodyRow,
  AgentComponentEntry,
  agentStateHeight,
  buildAgentComponent,
  buildAgentStateBody,
  buildIntentComponents,
} from '../converters/AgentDiagramConverter';

/** Agent actions carry type-specific fields not declared on the shared ModificationChanges. */
type AgentChanges = Record<string, any>;

const AGENT_STATE = 'AgentState';
const STATE_INITIAL = 'StateInitialNode';

function componentsOf(model: BESSERModel): Record<string, AgentComponentEntry> {
  const m = model as UMLModel;
  if (!m.components) m.components = {};
  return m.components as Record<string, AgentComponentEntry>;
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
      'add_intent_training_phrase',
      'add_rag_element',
      'add_llm',
      'add_tool',
      'add_skill',
      'add_workspace',
      'add_gui',
    ].includes(action);
  }

  applyModification(model: BESSERModel, modification: ModelModification): BESSERModel {
    // Older models kept intents, LLMs, ... on the canvas (`nodes`); move them into
    // `components` first so every action below works on one format.
    const updatedModel = normalizeAgentComponents(ModifierHelpers.cloneModel(model) as UMLModel) as BESSERModel;
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
      case 'add_intent_training_phrase':
        return this.addTrainingPhraseToIntent(updatedModel, modification);
      case 'add_rag_element':
        return this.addComponent(updatedModel, buildAgentComponent.rag(this.componentSpec(modification)));
      case 'add_llm':
        return this.addComponent(updatedModel, buildAgentComponent.llm(this.componentSpec(modification)));
      case 'add_tool':
        return this.addComponent(updatedModel, buildAgentComponent.tool(this.componentSpec(modification)));
      case 'add_skill':
        return this.addComponent(updatedModel, buildAgentComponent.skill(this.componentSpec(modification)));
      case 'add_workspace':
        return this.addComponent(updatedModel, buildAgentComponent.workspace(this.componentSpec(modification)));
      case 'add_gui':
        return this.addComponent(updatedModel, buildAgentComponent.gui(this.componentSpec(modification)));
      case 'remove_element':
        return this.removeElement(updatedModel, modification);
      default:
        throw new Error(`Unsupported action for AgentDiagram: ${action}`);
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

  private findStateNode(model: BESSERModel, name: string): BesserNode | undefined {
    return ModifierHelpers.findNodeByName(model, name, AGENT_STATE);
  }

  private findInitialNode(model: BESSERModel): BesserNode | undefined {
    return ModifierHelpers.findNodesByType(model, STATE_INITIAL)[0];
  }

  private findIntent(model: BESSERModel, intentId?: string, intentName?: string): AgentComponentEntry | undefined {
    const components = componentsOf(model);
    if (intentId && components[intentId]?.type === AgentComponentType.AgentIntent) return components[intentId];
    if (!intentName) return undefined;
    return Object.values(components).find(
      (component) => component.type === AgentComponentType.AgentIntent && component.name === intentName,
    );
  }

  /** The endpoint node a transition names: "initial" → the StateInitialNode, else an AgentState. */
  private findEndpoint(model: BESSERModel, name: string): BesserNode | undefined {
    return name.toLowerCase() === 'initial' ? this.findInitialNode(model) : this.findStateNode(model, name);
  }

  /** v4 "initial → state": `data.initial`, single-select like the state inspector. */
  private setInitialState(model: BESSERModel, target: BesserNode, initial: boolean): BESSERModel {
    for (const node of ModifierHelpers.findNodesByType(model, AGENT_STATE)) {
      const data = node.data as any;
      if (node.id === target.id) data.initial = initial;
      else if (initial && data.initial) data.initial = false;
    }
    return model;
  }

  /** `changes` + the target's `name` (the assistant may name a component on either). */
  private componentSpec(modification: ModelModification): AgentChanges {
    const changes = modification.changes as AgentChanges;
    const targetName = (modification.target as AgentChanges).name;
    return { ...changes, name: targetName || changes.name };
  }

  private addComponent(model: BESSERModel, component: AgentComponentEntry): BESSERModel {
    componentsOf(model)[component.id] = component;
    return model;
  }

  // ─── Action handlers ────────────────────────────────────────────────────

  private addState(model: BESSERModel, modification: ModelModification): BESSERModel {
    const changes = modification.changes as AgentChanges;
    const target = modification.target;
    const pos = this.nextPosition(model);

    const replies: any[] = changes.replies || [];
    const stateWidth = estimateAgentNodeWidth(
      replies.map((r) => (typeof r === 'string' ? r : r?.text)),
      210,
    );
    // Same builder as add_state_body and the converter.
    const bodies: AgentBodyRow[] = replies.map((reply) => buildAgentStateBody(reply, ModifierHelpers.generateUniqueId('body')));
    const totalHeight = agentStateHeight(bodies.length);

    const node: BesserNode = {
      id: ModifierHelpers.generateUniqueId('state'),
      type: AGENT_STATE as any,
      position: pos,
      width: stateWidth,
      height: totalHeight,
      measured: { width: stateWidth, height: totalHeight },
      data: {
        name: target.stateName || changes.name || '',
        stateType: 'standard',
        replyType: 'text',
        fallbackBodyEnabled: false,
        bodies,
        fallbackBodies: [] as AgentBodyRow[],
      },
    };

    ModifierHelpers.addNode(model, node);
    return model;
  }

  /** Add an intent (off-canvas component) with optional training phrases. */
  private addIntent(model: BESSERModel, modification: ModelModification): BESSERModel {
    const changes = modification.changes as AgentChanges;
    const target = modification.target;
    const { components } = buildIntentComponents({
      intentName: target.intentName || changes.intentName || changes.name || '',
      trainingPhrases: changes.trainingPhrases || [],
      intentDescription: changes.intentDescription || changes.intent_description || '',
    });
    Object.assign(componentsOf(model), components);
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

  /** Rename an intent and/or append a training phrase (`changes.text`). */
  private modifyIntent(model: BESSERModel, modification: ModelModification): BESSERModel {
    const { intentId, intentName } = modification.target;
    const intent = this.findIntent(model, intentId, intentName);
    if (!intent) return model;

    if (modification.changes.name) intent.name = modification.changes.name;
    if (modification.changes.text) this.addIntentTrainingPhrase(model, intent, modification.changes.text);
    return model;
  }

  /** add_intent_training_phrase: add one example phrase (changes.trainingPhrase) to an existing intent. */
  private addTrainingPhraseToIntent(model: BESSERModel, modification: ModelModification): BESSERModel {
    const { intentId, intentName } = modification.target;
    const intent = this.findIntent(model, intentId, intentName);
    if (!intent) {
      throw new Error(`Intent not found: ${intentName || intentId}`);
    }
    const changes = modification.changes as AgentChanges;
    const phrase = changes.trainingPhrase || changes.text;
    if (!phrase) {
      throw new Error('add_intent_training_phrase requires changes.trainingPhrase');
    }
    this.addIntentTrainingPhrase(model, intent, phrase);
    return model;
  }

  private addIntentTrainingPhrase(model: BESSERModel, intent: AgentComponentEntry, phrase: string): void {
    const bodyId = ModifierHelpers.generateUniqueId('intentBody');
    componentsOf(model)[bodyId] = {
      id: bodyId,
      name: phrase,
      type: AgentComponentType.AgentIntentBody,
      owner: intent.id,
    };
    const bodies = Array.isArray(intent.bodies) ? (intent.bodies as string[]) : [];
    intent.bodies = [...bodies, bodyId];
  }

  /** Add an action row (reply) to a state. */
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
    const bodies: AgentBodyRow[] = Array.isArray(data.bodies) ? data.bodies : [];
    const fallbackCount = Array.isArray(data.fallbackBodies) ? data.fallbackBodies.length : 0;
    const newBody = buildAgentStateBody(modification.changes, ModifierHelpers.generateUniqueId('body'));
    if (!newBody.name) newBody.name = 'New reply';
    bodies.push(newBody);
    data.bodies = bodies;

    node.height = agentStateHeight(bodies.length + fallbackCount);
    node.measured = { width: node.width, height: node.height };
    return model;
  }

  /**
   * Add a transition between two states (or from the initial node). The
   * modeling assistant names both endpoints on the target
   * (`target.sourceStateName` / `target.targetStateName`; "initial" is the
   * entry node); `changes.source` / `changes.target` are accepted too.
   */
  private addTransition(model: BESSERModel, modification: ModelModification): BESSERModel {
    const changes = modification.changes as AgentChanges;
    const target = modification.target;
    const sourceName: string | undefined = target.sourceStateName || changes.source;
    const targetName: string | undefined = target.targetStateName || changes.target;

    if (!sourceName || !targetName) {
      throw new Error('Transition requires target.sourceStateName and target.targetStateName.');
    }

    const sourceNode = this.findEndpoint(model, sourceName);
    const targetNode = this.findStateNode(model, targetName);
    if (targetNode && !sourceNode && sourceName.toLowerCase() === 'initial') {
      return this.setInitialState(model, targetNode, true);
    }
    if (!sourceNode || !targetNode) {
      throw new Error(`Could not locate source (${sourceName}) or target (${targetName}) for transition.`);
    }

    const isInit = (sourceNode.type as string) === STATE_INITIAL;
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
      const condition: string = changes.condition || 'when_intent_matched';
      if (condition === 'custom_transition') {
        transitionData.transitionType = 'custom';
        transitionData.custom = {
          event: changes.event || 'WildcardEvent',
          condition: changes.conditionValue ? [String(changes.conditionValue)] : [],
        };
      } else {
        const predefined: Record<string, unknown> = { predefinedType: condition };
        if (condition === 'when_intent_matched') {
          predefined.intentName = changes.intentName || changes.conditionValue || changes.name || '';
        } else if (condition === 'when_file_received') {
          predefined.fileType = changes.fileType || changes.conditionValue || '';
        } else if (condition === 'when_form_submitted') {
          predefined.formGuiId = changes.formGuiId || changes.guiId || changes.conditionValue || '';
        } else if (changes.conditionValue !== undefined && condition !== 'auto' && condition !== 'when_no_intent_matched') {
          predefined.conditionValue = changes.conditionValue;
        }
        transitionData.transitionType = 'predefined';
        transitionData.predefined = predefined;
      }
    }

    const edge: BesserEdge = {
      id: ModifierHelpers.generateUniqueId('transition'),
      source: sourceNode.id,
      target: targetNode.id,
      type: (isInit ? 'AgentStateTransitionInit' : 'AgentStateTransition') as any,
      sourceHandle: 'right',
      targetHandle: 'left',
      data: transitionData as any,
    };

    ModifierHelpers.addEdge(model, edge);
    return model;
  }

  private removeTransition(model: BESSERModel, modification: ModelModification): BESSERModel {
    const m = model as any;
    const edges: BesserEdge[] = m.edges ?? [];
    const { transitionId } = modification.target;

    if (transitionId) {
      if (!edges.some((e) => e.id === transitionId)) {
        throw new Error(`Transition not found: ${transitionId}`);
      }
      m.edges = edges.filter((e) => e.id !== transitionId);
      return model;
    }

    const sourceName: string | undefined = modification.target?.sourceStateName || modification.changes?.source;
    const targetName: string | undefined = modification.target?.targetStateName || modification.changes?.target;
    if (!sourceName || !targetName) {
      throw new Error(
        'remove_transition requires target.transitionId, or target.sourceStateName and target.targetStateName.',
      );
    }
    const src = this.findEndpoint(model, sourceName);
    const tgt = this.findStateNode(model, targetName);
    if (tgt && !src && sourceName.toLowerCase() === 'initial' && (tgt.data as any)?.initial) {
      return this.setInitialState(model, tgt, false);
    }
    const match = src && tgt ? edges.find((e) => e.source === src.id && e.target === tgt.id) : undefined;
    if (!match) {
      throw new Error(`No transition from ${sourceName} to ${targetName}.`);
    }
    m.edges = edges.filter((e) => e.id !== match.id);
    return model;
  }

  /** Remove a state (canvas node) or an intent (component, with its training phrases). */
  private removeElement(model: BESSERModel, modification: ModelModification): BESSERModel {
    const { stateId, stateName, intentId, intentName } = modification.target;

    if (stateId || stateName) {
      const node = (stateId ? ModifierHelpers.findNodeById(model, stateId) : undefined) ||
        (stateName ? this.findStateNode(model, stateName) : undefined);
      if (node) return ModifierHelpers.removeNodeWithChildren(model, node.id);
    }

    if (intentId || intentName) {
      const intent = this.findIntent(model, intentId, intentName);
      if (intent) {
        const components = componentsOf(model);
        for (const [id, component] of Object.entries(components)) {
          if (id === intent.id || component.owner === intent.id) delete components[id];
        }
      }
    }

    return model;
  }
}
