/**
 * Agent Diagram Converter
 * Converts simplified agent system specifications to Apollon format.
 * New format: intents/intent-bodies go to `components` (no bounds);
 * states/state-bodies stay in `elements` (with bounds).
 */

import { DiagramConverter, PositionGenerator, generateUniqueId } from './base';

function estimateWidth(texts: string[], baseWidth: number): number {
  let maxW = baseWidth;
  for (const text of texts) {
    if (text) {
      const estimated = text.length * 8 + 40;
      maxW = Math.max(maxW, estimated);
    }
  }
  return Math.max(maxW, baseWidth);
}

const REPLY_TYPE_TO_ACTION_TYPE: Record<string, string> = {
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

export class AgentDiagramConverter implements DiagramConverter {
  private positionGenerator = new PositionGenerator();

  getDiagramType() {
    return 'AgentDiagram' as const;
  }

  convertSingleElement(spec: any, position?: { x: number; y: number }) {
    const pos = position || this.positionGenerator.getNextPosition();

    if (spec.type === 'intent' || spec.intentBodies) {
      const result = this.createIntent(spec);
      return {
        version: '3.0.0',
        type: 'AgentDiagram',
        size: { width: 1080, height: 400 },
        elements: {},
        relationships: {},
        interactive: { elements: {}, relationships: {} },
        assessments: {},
        components: result.components,
      };
    } else if (spec.type === 'initial') {
      const result = this.createInitialNode(pos);
      return {
        version: '3.0.0',
        type: 'AgentDiagram',
        size: { width: 1080, height: 400 },
        elements: { [result.initialNode.id]: result.initialNode },
        relationships: {},
        interactive: { elements: {}, relationships: {} },
        assessments: {},
        components: {},
      };
    } else {
      const result = this.createState(spec, pos);
      const elements: Record<string, any> = { [result.state.id]: result.state };
      Object.assign(elements, result.bodies);
      return {
        version: '3.0.0',
        type: 'AgentDiagram',
        size: { width: 1080, height: 400 },
        elements,
        relationships: {},
        interactive: { elements: {}, relationships: {} },
        assessments: {},
        components: {},
      };
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
        bounds: { x: pos.x, y: pos.y, width: 45, height: 45 },
      },
    };
  }

  private createState(spec: any, pos: { x: number; y: number }) {
    const stateId = generateUniqueId('state');
    const actionIds: string[] = [];
    const fallbackActionIds: string[] = [];
    const bodyElements: Record<string, any> = {};

    const allTexts: string[] = [];
    (spec.bodies || spec.replies || []).forEach((b: any) =>
      allTexts.push(typeof b === 'string' ? b : b.text || ''),
    );
    (spec.fallbackBodies || []).forEach((f: any) =>
      allTexts.push(typeof f === 'string' ? f : f.text || ''),
    );
    const stateWidth = estimateWidth(allTexts, 210);
    const bodyWidth = stateWidth - 1;

    let currentY = pos.y + 41;

    const buildBodyElement = (raw: any, elementType: 'AgentStateBody' | 'AgentStateFallbackBody', id: string) => {
      const body = typeof raw === 'string' ? { text: raw, replyType: 'text' } : raw;
      const replyType: string = body.replyType || 'text';
      const actionType = REPLY_TYPE_TO_ACTION_TYPE[replyType] || 'TextReplyAction';

      const el: any = {
        id,
        name: body.text || '',
        type: elementType,
        owner: stateId,
        bounds: { x: pos.x + 0.5, y: currentY, width: bodyWidth, height: 30 },
        actionType,
        replyType,
        useSessionVars: false,
      };

      // LLM / LLMChat fields
      if (actionType === 'LLMReplyAction' || actionType === 'LLMChatAction') {
        el.system_message = body.system_message || '';
        el.llm_name = body.llm_name || '';
        el.systemPromptUseSessionVars = false;
        el.storeInSession = body.storeInSession || '';
        el.sendReply = body.sendReply !== false;
        el.inputPromptMode = body.inputPromptMode || 'last_user_message';
        el.customInputPrompt = body.customInputPrompt || '';
        el.customInputPromptUseSessionVars = false;
      }

      // RAG fields
      if (actionType === 'RAGReplyAction') {
        el.ragDatabaseName = body.ragDatabaseName || '';
        el.llm_name = body.llm_name || '';
        el.inputPromptMode = body.inputPromptMode || 'last_user_message';
        el.storeInSession = body.storeInSession || '';
        el.sendReply = body.sendReply !== false;
      }

      // DB fields
      if (actionType === 'DBAction') {
        el.dbSelectionType = body.dbSelectionType || 'default';
        el.dbCustomName = body.dbCustomName || '';
        el.dbQueryMode = body.dbQueryMode || 'llm_query';
        el.dbOperation = body.dbOperation || 'any';
        el.dbSqlQuery = body.dbSqlQuery || '';
        el.llm_name = body.llm_name || '';
        el.inputPromptMode = body.inputPromptMode || 'last_user_message';
        el.storeInSession = body.storeInSession || '';
        el.sendReply = body.sendReply !== false;
      }

      // WebCrawlLLM fields
      if (actionType === 'WebCrawlLLMAction') {
        el.initial_url = body.initial_url || '';
        el.llm_name = body.llm_name || '';
        el.storeInSession = body.storeInSession || '';
        el.sendReply = body.sendReply !== false;
      }

      // WebSocket message fields
      if (['WebSocketReplyMarkdownAction', 'WebSocketReplyHTMLAction', 'WebSocketReplySpeechAction'].includes(actionType)) {
        el.ws_message = body.ws_message || body.text || '';
      }
      if (actionType === 'WebSocketReplyOptionsAction') {
        el.ws_options = body.ws_options || '';
      }
      if (actionType === 'WebSocketReplyLocationAction') {
        el.ws_latitude = body.ws_latitude ?? 0;
        el.ws_longitude = body.ws_longitude ?? 0;
      }

      // GUI reply field
      if (actionType === 'GUIReplyAction') {
        el.guiId = body.guiId || body.gui_id || '';
      }

      return el;
    };

    (spec.bodies || spec.replies || []).forEach((body: any) => {
      const bodyId = generateUniqueId('body');
      actionIds.push(bodyId);
      bodyElements[bodyId] = buildBodyElement(body, 'AgentStateBody', bodyId);
      currentY += 30;
    });

    (spec.fallbackBodies || []).forEach((fallback: any) => {
      const fallbackId = generateUniqueId('fallback');
      fallbackActionIds.push(fallbackId);
      bodyElements[fallbackId] = buildBodyElement(fallback, 'AgentStateFallbackBody', fallbackId);
      currentY += 30;
    });

    const totalHeight = Math.max(70, currentY - pos.y);

    const stateElement = {
      id: stateId,
      name: spec.stateName || spec.name,
      type: 'AgentState',
      stateType: 'standard',
      owner: null,
      bounds: { x: pos.x, y: pos.y, width: stateWidth, height: totalHeight },
      fallbackBodyEnabled: fallbackActionIds.length > 0,
      actions: actionIds,
      fallbackActions: fallbackActionIds,
      bodies: actionIds,
      fallbackBodies: fallbackActionIds,
    };

    return {
      state: stateElement,
      bodies: bodyElements,
    };
  }

  private createIntent(spec: any) {
    const intentId = generateUniqueId('intent');
    const bodies: string[] = [];
    const componentElements: Record<string, any> = {};

    (spec.trainingPhrases || spec.intentBodies || spec.bodies || []).forEach((phrase: any) => {
      const bodyId = generateUniqueId('intentBody');
      bodies.push(bodyId);
      componentElements[bodyId] = {
        id: bodyId,
        name: typeof phrase === 'string' ? phrase : phrase.text,
        type: 'AgentIntentBody',
        owner: intentId,
      };
    });

    const intentElement = {
      id: intentId,
      name: spec.intentName || spec.name,
      type: 'AgentIntent',
      owner: null,
      intent_description: spec.intentDescription || spec.intent_description || '',
      bodies,
    };
    componentElements[intentId] = intentElement;

    return {
      intent: intentElement,
      components: componentElements,
    };
  }

  convertCompleteSystem(systemSpec: any) {
    this.positionGenerator.reset();
    const allElements: Record<string, any> = {};
    const allComponents: Record<string, any> = {};
    const allRelationships: Record<string, any> = {};
    const elementIdMap: Record<string, string> = {};

    // Initial node → elements (has canvas bounds)
    if (systemSpec.hasInitialNode !== false) {
      const initialPos =
        systemSpec.initialNode?.position ||
        systemSpec.initialPosition ||
        { x: -470, y: -30 };
      const initial = this.createInitialNode(initialPos);
      allElements[initial.initialNode.id] = initial.initialNode;
      elementIdMap['initial'] = initial.initialNode.id;
    }

    // Intents → components (no bounds)
    (systemSpec.intents || []).forEach((intentSpec: any) => {
      const result = this.createIntent(intentSpec);
      elementIdMap[intentSpec.intentName || intentSpec.name] = result.intent.id;
      Object.assign(allComponents, result.components);
    });

    // States → elements (with bounds)
    (systemSpec.states || []).forEach((stateSpec: any) => {
      const position = stateSpec.position || this.positionGenerator.getNextPosition();
      const completeElement = this.createState(stateSpec, position);
      elementIdMap[stateSpec.stateName || stateSpec.name] = completeElement.state.id;
      allElements[completeElement.state.id] = completeElement.state;
      Object.assign(allElements, completeElement.bodies);
    });

    // Transitions
    (systemSpec.transitions || []).forEach((transition: any) => {
      const sourceId = elementIdMap[transition.source];
      const targetId = elementIdMap[transition.target];

      if (sourceId && targetId) {
        const transId = generateUniqueId('transition');
        const sourceElement = allElements[sourceId];
        const isInitialTransition = sourceElement?.type === 'StateInitialNode';

        const rel: any = {
          id: transId,
          name: transition.label || '',
          type: isInitialTransition ? 'AgentStateTransitionInit' : 'AgentStateTransition',
          owner: null,
          bounds: { x: 0, y: 0, width: 100, height: 1 },
          path: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
          ],
          source: {
            direction: transition.sourceDirection || 'Right',
            element: sourceId,
          },
          target: {
            direction: transition.targetDirection || 'Left',
            element: targetId,
          },
          isManuallyLayouted: false,
        };

        if (!isInitialTransition && transition.condition) {
          rel.transitionType = 'predefined';
          if (transition.condition === 'when_intent_matched') {
            rel.predefined = {
              predefinedType: 'when_intent_matched',
              intentName: transition.conditionValue || '',
            };
          } else if (transition.condition === 'when_no_intent_matched') {
            rel.predefined = { predefinedType: 'when_no_intent_matched' };
          } else {
            rel.predefined = {
              predefinedType: transition.condition,
              conditionValue: transition.conditionValue || '',
            };
          }
          rel.custom = { condition: [] };
        }

        allRelationships[transId] = rel;
      }
    });

    // All agent components → allComponents (no bounds)

    for (const ragSpec of (systemSpec.ragElements || [])) {
      const ragId = generateUniqueId('rag');
      allComponents[ragId] = {
        id: ragId,
        type: 'AgentRagElement',
        name: ragSpec.name || 'RAG DB',
        owner: null,
        llm_name: ragSpec.llm_name || '',
        llm_prompt: ragSpec.llm_prompt || '',
        k: ragSpec.k ?? 4,
        embedding_provider: ragSpec.embedding_provider || 'openai',
      };
    }

    for (const llmSpec of (systemSpec.llms || [])) {
      const llmId = generateUniqueId('llm');
      allComponents[llmId] = {
        id: llmId,
        type: 'AgentLLM',
        name: llmSpec.name,
        owner: null,
        provider: llmSpec.provider || 'openai',
        num_previous_messages: llmSpec.num_previous_messages ?? 1,
        global_context: llmSpec.global_context || '',
      };
    }

    for (const toolSpec of (systemSpec.tools || [])) {
      const toolId = generateUniqueId('tool');
      allComponents[toolId] = {
        id: toolId,
        type: 'AgentTool',
        name: toolSpec.name,
        owner: null,
        description: toolSpec.description || '',
        code: toolSpec.code || '',
      };
    }

    for (const skillSpec of (systemSpec.skills || [])) {
      const skillId = generateUniqueId('skill');
      allComponents[skillId] = {
        id: skillId,
        type: 'AgentSkill',
        name: skillSpec.name,
        owner: null,
        content: skillSpec.content || '',
        description: skillSpec.description || '',
      };
    }

    for (const wsSpec of (systemSpec.workspaces || [])) {
      const wsId = generateUniqueId('workspace');
      allComponents[wsId] = {
        id: wsId,
        type: 'AgentWorkspace',
        name: wsSpec.name,
        owner: null,
        path: wsSpec.path || '',
        description: wsSpec.description || '',
        writable: wsSpec.writable !== false,
        max_read_bytes: wsSpec.max_read_bytes ?? 200000,
      };
    }

    for (const guiSpec of (systemSpec.guis || [])) {
      const guiId = generateUniqueId('gui');
      allComponents[guiId] = {
        id: guiId,
        type: 'AgentGUI',
        name: guiSpec.gui_id || guiSpec.name || '',
        owner: null,
        gui_id: guiSpec.gui_id || '',
        persist: guiSpec.persist !== false,
        is_form: guiSpec.is_form === true,
        width: guiSpec.width || '',
      };
    }

    return {
      version: '3.0.0',
      type: 'AgentDiagram',
      size: { width: 1080, height: 400 },
      elements: allElements,
      relationships: allRelationships,
      interactive: { elements: {}, relationships: {} },
      assessments: {},
      components: allComponents,
    };
  }
}
