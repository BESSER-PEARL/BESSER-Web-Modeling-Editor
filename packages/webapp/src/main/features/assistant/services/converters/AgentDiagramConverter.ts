/**
 * Agent Diagram Converter (v4-native)
 *
 * Converts simplified agent system specifications straight into the
 * canonical v4 shape ({version: '4.0.0', nodes[], edges[], components}).
 * Shapes are identical to what the editor and the agent Components page
 * produce (per `docs/source/migrations/uml-v4-shape.md` → AgentDiagram):
 *   - canvas: `AgentState` nodes carry inline `data.bodies[]` /
 *     `data.fallbackBodies[]` action rows ({id, name, replyType, actionType,
 *     …type-specific fields}), plus the `StateInitialNode` marker and the
 *     `AgentStateTransition(Init)` edges with the canonical
 *     `{transitionType, predefined | custom}` data,
 *   - off-canvas: intents (+ their `AgentIntentBody` training sentences),
 *     LLMs, RAG databases, tools, skills, workspaces and GUIs are flat
 *     entries in the top-level `model.components` map (no position).
 */

import { AgentComponentType } from '@besser/wme';
import type { BesserEdge, BesserNode } from '@besser/wme';
import { DiagramConverter, PositionGenerator, generateUniqueId } from './base';
import { createEmptyV4Model, directionToHandle, estimateAgentNodeWidth } from '../shared/v4Builders';

/** Maps the editor's `replyType` values to metamodel action class names (`actionType`). */
export const REPLY_TYPE_TO_ACTION_TYPE: Record<string, string> = {
  text: 'TextReplyAction',
  llm: 'LLMReplyAction',
  llm_chat: 'LLMChatAction',
  rag: 'RAGReplyAction',
  db_reply: 'DBAction',
  code: 'CustomCodeAction',
  web_crawl_llm: 'WebCrawlLLMAction',
  ws_markdown: 'WebSocketReplyMarkdownAction',
  ws_html: 'WebSocketReplyHTMLAction',
  ws_speech: 'WebSocketReplySpeechAction',
  ws_options: 'WebSocketReplyOptionsAction',
  ws_location: 'WebSocketReplyLocationAction',
  ws_file: 'WebSocketReplyFileAction',
  ws_image: 'WebSocketReplyImageAction',
  ws_dataframe: 'WebSocketReplyDataframeAction',
  ws_plotly: 'WebSocketReplyPlotlyAction',
  gui_reply: 'GUIReplyAction',
};

/** One inline AgentState action row (v4 `data.bodies[]` / `data.fallbackBodies[]`). */
export type AgentBodyRow = { id: string; name: string; replyType: string; actionType: string; [field: string]: unknown };

/** An off-canvas agent component entry (v4 `model.components[id]`). */
export type AgentComponentEntry = { id: string; type: string; name: string; owner: string | null; [field: string]: unknown };

/**
 * Build one agent state action row from an assistant reply spec — a plain
 * string (text reply) or an object with `replyType` and the type-specific
 * fields. Shared by the converter and by AgentDiagramModifier (`add_state`
 * and `add_state_body`) so every path produces identical rows.
 */
export function buildAgentStateBody(raw: any, id: string): AgentBodyRow {
  const body = typeof raw === 'string' ? { text: raw, replyType: 'text' } : raw || {};
  const replyType: string = body.replyType || 'text';
  const actionType = REPLY_TYPE_TO_ACTION_TYPE[replyType] || 'TextReplyAction';

  const row: AgentBodyRow = {
    id,
    name: body.text || '',
    replyType,
    actionType,
    useSessionVars: false,
  };

  // LLM / LLMChat fields
  if (actionType === 'LLMReplyAction' || actionType === 'LLMChatAction') {
    row.system_message = body.system_message || '';
    row.llm_name = body.llm_name || '';
    row.systemPromptUseSessionVars = false;
    row.storeInSession = body.storeInSession || '';
    row.sendReply = body.sendReply !== false;
    row.inputPromptMode = body.inputPromptMode || 'last_user_message';
    row.customInputPrompt = body.customInputPrompt || '';
    row.customInputPromptUseSessionVars = false;
  }

  // RAG fields
  if (actionType === 'RAGReplyAction') {
    row.ragDatabaseName = body.ragDatabaseName || '';
    row.llm_name = body.llm_name || '';
    row.inputPromptMode = body.inputPromptMode || 'last_user_message';
    row.storeInSession = body.storeInSession || '';
    row.sendReply = body.sendReply !== false;
  }

  // DB fields
  if (actionType === 'DBAction') {
    row.dbSelectionType = body.dbSelectionType || 'default';
    row.dbCustomName = body.dbCustomName || '';
    row.dbQueryMode = body.dbQueryMode || 'llm_query';
    row.dbOperation = body.dbOperation || 'any';
    row.dbSqlQuery = body.dbSqlQuery || '';
    row.llm_name = body.llm_name || '';
    row.inputPromptMode = body.inputPromptMode || 'last_user_message';
    row.storeInSession = body.storeInSession || '';
    row.sendReply = body.sendReply !== false;
  }

  // WebCrawlLLM fields
  if (actionType === 'WebCrawlLLMAction') {
    row.initial_url = body.initial_url || '';
    row.llm_name = body.llm_name || '';
    row.storeInSession = body.storeInSession || '';
    row.sendReply = body.sendReply !== false;
  }

  // Custom code: v4 code rows carry the source on `code`
  if (actionType === 'CustomCodeAction' && (body.code || body.text)) {
    row.code = body.code || body.text || '';
  }

  // WebSocket message fields
  if (['WebSocketReplyMarkdownAction', 'WebSocketReplyHTMLAction', 'WebSocketReplySpeechAction'].includes(actionType)) {
    row.ws_message = body.ws_message || body.text || '';
  }
  if (actionType === 'WebSocketReplyOptionsAction') {
    row.ws_options = body.ws_options || '';
  }
  if (actionType === 'WebSocketReplyLocationAction') {
    row.ws_latitude = body.ws_latitude ?? 0;
    row.ws_longitude = body.ws_longitude ?? 0;
  }

  // GUI reply field
  if (actionType === 'GUIReplyAction') {
    row.guiId = body.guiId || body.gui_id || '';
  }

  return row;
}

/** Build an intent component plus one `AgentIntentBody` component per training phrase. */
export function buildIntentComponents(spec: any): { intent: AgentComponentEntry; components: Record<string, AgentComponentEntry> } {
  const intentId = generateUniqueId('intent');
  const bodies: string[] = [];
  const components: Record<string, AgentComponentEntry> = {};

  (spec.trainingPhrases || spec.intentBodies || spec.bodies || []).forEach((phrase: any) => {
    const bodyId = generateUniqueId('intentBody');
    bodies.push(bodyId);
    components[bodyId] = {
      id: bodyId,
      name: typeof phrase === 'string' ? phrase : phrase?.text || '',
      type: AgentComponentType.AgentIntentBody,
      owner: intentId,
    };
  });

  const intent: AgentComponentEntry = {
    id: intentId,
    name: spec.intentName || spec.name || '',
    type: AgentComponentType.AgentIntent,
    owner: null,
    intent_description: spec.intentDescription || spec.intent_description || spec.description || '',
    bodies,
  };
  components[intentId] = intent;
  return { intent, components };
}

/** Component builders shared with the modifier's `add_*` component actions. */
export const buildAgentComponent = {
  rag(spec: any): AgentComponentEntry {
    return {
      id: generateUniqueId('rag'),
      type: AgentComponentType.AgentRagElement,
      name: spec.name || 'RAG DB',
      owner: null,
      llm_name: spec.llm_name || '',
      llm_prompt: spec.llm_prompt || '',
      k: spec.k ?? 4,
      num_previous_messages: spec.num_previous_messages ?? 0,
      embedding_provider: spec.embedding_provider || 'openai',
      embedding_base_url: spec.embedding_base_url || '',
      embedding_model: spec.embedding_model || '',
      use_hybrid_rag: spec.use_hybrid_rag === true,
      bm25_weight: typeof spec.bm25_weight === 'number' ? spec.bm25_weight : 0.6,
    };
  },
  llm(spec: any): AgentComponentEntry {
    return {
      id: generateUniqueId('llm'),
      type: AgentComponentType.AgentLLM,
      name: spec.name || 'LLM',
      owner: null,
      provider: spec.provider || 'openai',
      parameters: spec.parameters && typeof spec.parameters === 'object' ? spec.parameters : {},
      num_previous_messages: spec.num_previous_messages ?? 1,
      global_context: spec.global_context || '',
    };
  },
  tool(spec: any): AgentComponentEntry {
    return {
      id: generateUniqueId('tool'),
      type: AgentComponentType.AgentTool,
      name: spec.name || 'Tool',
      owner: null,
      description: spec.description || '',
      code: spec.code || '',
    };
  },
  skill(spec: any): AgentComponentEntry {
    return {
      id: generateUniqueId('skill'),
      type: AgentComponentType.AgentSkill,
      name: spec.name || 'Skill',
      owner: null,
      content: spec.content || '',
      description: spec.description || '',
    };
  },
  workspace(spec: any): AgentComponentEntry {
    return {
      id: generateUniqueId('workspace'),
      type: AgentComponentType.AgentWorkspace,
      name: spec.name || 'Workspace',
      owner: null,
      path: spec.path || '',
      description: spec.description || '',
      writable: spec.writable !== false,
      max_read_bytes: spec.max_read_bytes ?? 200000,
    };
  },
  gui(spec: any): AgentComponentEntry {
    const guiPageId = spec.gui_id || spec.name || 'gui_page';
    return {
      id: generateUniqueId('gui'),
      type: AgentComponentType.AgentGUI,
      name: guiPageId,
      owner: null,
      gui_id: guiPageId,
      persist: spec.persist !== false,
      is_form: spec.is_form === true,
      width: spec.width || '',
      guiModel: null,
    };
  },
};

/** Inline AgentState row height (px) — matches the AgentState node renderer. */
export const agentStateHeight = (rowCount: number): number => Math.max(70, 41 + rowCount * 30);

export class AgentDiagramConverter implements DiagramConverter {
  private positionGenerator = new PositionGenerator();

  getDiagramType() {
    return 'AgentDiagram' as const;
  }

  /**
   * One spec → a merge fragment `{nodes, edges, components}`. An intent is
   * an off-canvas component, so its fragment carries no nodes.
   */
  convertSingleElement(
    spec: any,
    position?: { x: number; y: number },
  ): { nodes: BesserNode[]; edges: BesserEdge[]; components: Record<string, AgentComponentEntry> } {
    if (spec.type === 'intent' || spec.intentBodies) {
      return { nodes: [], edges: [], components: buildIntentComponents(spec).components };
    }
    const pos = position || this.positionGenerator.getNextPosition();
    const node = spec.type === 'initial' ? this.createInitialNode(pos) : this.createStateNode(spec, pos);
    return { nodes: [node], edges: [], components: {} };
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
    const replies: any[] = spec.bodies || spec.replies || [];
    const fallbacks: any[] = spec.fallbackBodies || [];

    const allTexts: string[] = [];
    replies.forEach((b: any) => allTexts.push(typeof b === 'string' ? b : b?.text || ''));
    fallbacks.forEach((f: any) => allTexts.push(typeof f === 'string' ? f : f?.text || ''));
    const stateWidth = estimateAgentNodeWidth(allTexts, 210);

    const bodies = replies.map((body) => buildAgentStateBody(body, generateUniqueId('body')));
    const fallbackBodies = fallbacks.map((body) => buildAgentStateBody(body, generateUniqueId('fallback')));
    const totalHeight = agentStateHeight(bodies.length + fallbackBodies.length);

    return {
      id: generateUniqueId('state'),
      type: 'AgentState' as any,
      position: { x: pos.x, y: pos.y },
      width: stateWidth,
      height: totalHeight,
      measured: { width: stateWidth, height: totalHeight },
      data: {
        name: spec.stateName || spec.name,
        stateType: 'standard',
        replyType: 'text',
        fallbackBodyEnabled: fallbackBodies.length > 0,
        bodies,
        fallbackBodies,
      },
    };
  }

  convertCompleteSystem(systemSpec: any) {
    this.positionGenerator.reset();
    const model = createEmptyV4Model('AgentDiagram', systemSpec.systemName || systemSpec.name || '');
    const nodes: BesserNode[] = model.nodes;
    const edges: BesserEdge[] = model.edges;
    const components: Record<string, AgentComponentEntry> = {};
    const nodeIdByName: Record<string, string> = {};
    const nodeById: Record<string, BesserNode> = {};

    const pushNode = (node: BesserNode) => {
      nodes.push(node);
      nodeById[node.id] = node;
    };

    // Initial node (canvas)
    if (systemSpec.hasInitialNode !== false) {
      const initialPos = systemSpec.initialNode?.position || systemSpec.initialPosition || { x: -470, y: -30 };
      const initial = this.createInitialNode(initialPos);
      pushNode(initial);
      nodeIdByName['initial'] = initial.id;
    }

    // Intents → components (off-canvas)
    (systemSpec.intents || []).forEach((intentSpec: any) => {
      Object.assign(components, buildIntentComponents(intentSpec).components);
    });

    // States → canvas nodes
    (systemSpec.states || []).forEach((stateSpec: any) => {
      const position = stateSpec.position || this.positionGenerator.getNextPosition();
      const stateNode = this.createStateNode(stateSpec, position);
      nodeIdByName[stateSpec.stateName || stateSpec.name] = stateNode.id;
      pushNode(stateNode);
    });

    // Transitions — only between canvas nodes. An intent-sourced transition
    // (legacy spec, intents were canvas nodes) has no canvas source: skip it.
    (systemSpec.transitions || []).forEach((transition: any) => {
      const sourceId = nodeIdByName[transition.source];
      const targetId = nodeIdByName[transition.target];
      if (!sourceId || !targetId) return;

      const sourceNode = nodeById[sourceId];
      const isInitialTransition = (sourceNode?.type as string) === 'StateInitialNode';
      const label = transition.label || '';

      edges.push({
        id: generateUniqueId('transition'),
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
          ...(isInitialTransition ? {} : buildTransitionConditionData(transition)),
        },
      });
    });

    // Remaining agent components (off-canvas)
    const add = (entry: AgentComponentEntry) => {
      components[entry.id] = entry;
    };
    (systemSpec.ragElements || []).forEach((spec: any) => add(buildAgentComponent.rag(spec)));
    (systemSpec.llms || []).forEach((spec: any) => add(buildAgentComponent.llm(spec)));
    (systemSpec.tools || []).forEach((spec: any) => add(buildAgentComponent.tool(spec)));
    (systemSpec.skills || []).forEach((spec: any) => add(buildAgentComponent.skill(spec)));
    (systemSpec.workspaces || []).forEach((spec: any) => add(buildAgentComponent.workspace(spec)));
    (systemSpec.guis || []).forEach((spec: any) => add(buildAgentComponent.gui(spec)));

    model.components = components;
    return model;
  }
}

/**
 * Lift a spec's flat `condition` / `conditionValue` pair (or the modeling
 * agent's `intentName`) into the canonical v4 `{transitionType, predefined |
 * custom}` data. Mirrors the legacy-flat handling of
 * `liftAgentTransitionDataToV4` in the library's versionConverter.
 */
export function buildTransitionConditionData(transition: any): Record<string, unknown> {
  const condition: string | undefined = transition.condition;
  const conditionValue = transition.conditionValue;

  if (condition === 'custom_transition') {
    return {
      transitionType: 'custom',
      custom: {
        event: transition.event || 'WildcardEvent',
        condition: conditionValue ? [String(conditionValue)] : [],
      },
    };
  }

  if (condition) {
    const predefined: Record<string, unknown> = { predefinedType: condition };
    if (condition === 'when_intent_matched') {
      predefined.intentName = transition.intentName || conditionValue || '';
    } else if (condition === 'when_file_received') {
      predefined.fileType = transition.fileType || conditionValue || '';
    } else if (condition === 'when_form_submitted') {
      predefined.formGuiId = transition.formGuiId || transition.guiId || conditionValue || '';
    } else if (condition !== 'when_no_intent_matched' && condition !== 'auto' && conditionValue !== undefined) {
      predefined.conditionValue = conditionValue;
    }
    return { transitionType: 'predefined', predefined };
  }

  if (transition.intentName) {
    return {
      transitionType: 'predefined',
      predefined: { predefinedType: 'when_intent_matched', intentName: transition.intentName },
    };
  }
  return { transitionType: 'predefined', predefined: { predefinedType: 'auto' } };
}
