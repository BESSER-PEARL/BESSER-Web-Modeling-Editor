import { describe, it, expect } from 'vitest';
import { UMLModel, normalizeAgentComponents } from '@besser/wme';
import { AgentDiagramModifier } from '../../main/features/assistant/services/modifiers/AgentDiagramModifier';
import { AgentDiagramConverter } from '../../main/features/assistant/services/converters/AgentDiagramConverter';
import type { ModelModification } from '../../main/features/assistant/services/modifiers/base';
import type { BESSERModel } from '../../main/features/assistant/services/UMLModelingService';

type AgentTestModel = BESSERModel & { components?: Record<string, any> };

const emptyAgentModel = (): AgentTestModel => ({
  version: '4.0.0',
  id: 'agent',
  title: 'Agent',
  type: 'AgentDiagram' as UMLModel['type'],
  nodes: [],
  edges: [],
  assessments: {},
});

const modifier = new AgentDiagramModifier();
const apply = (model: AgentTestModel, modification: Record<string, unknown>): AgentTestModel =>
  modifier.applyModification(model, modification as unknown as ModelModification) as AgentTestModel;

/** The inline action rows of every AgentState node (v4 `data.bodies`). */
const bodiesOf = (model: AgentTestModel): Record<string, any>[] =>
  model.nodes.filter((n) => n.type === 'AgentState').flatMap((n) => (n.data.bodies as Record<string, any>[]) ?? []);

const stateNode = (id: string, name: string) => ({
  id,
  type: 'AgentState' as any,
  position: { x: 0, y: 0 },
  width: 100,
  height: 30,
  measured: { width: 100, height: 30 },
  data: { name, bodies: [], fallbackBodies: [] },
});

/** The body payload, without the per-call identity. */
const payload = (body: Record<string, any>) => {
  const { id: _id, ...rest } = body;
  return rest;
};

const REPLIES: Record<string, unknown>[] = [
  { text: 'Hello', replyType: 'text' },
  {
    text: 'Answer', replyType: 'llm', llm_name: 'gpt', system_message: 'Be brief', storeInSession: 'answer',
    sendReply: false, inputPromptMode: 'custom', customInputPrompt: 'Q: {x}',
  },
  { text: 'Docs', replyType: 'rag', ragDatabaseName: 'kb', llm_name: 'gpt', inputPromptMode: 'custom', storeInSession: 'r' },
  {
    text: 'Query', replyType: 'db_reply', dbSelectionType: 'custom', dbCustomName: 'sales', dbQueryMode: 'sql',
    dbOperation: 'select', dbSqlQuery: 'SELECT 1', llm_name: 'gpt', storeInSession: 'rows', sendReply: false,
  },
  { text: 'Crawl', replyType: 'web_crawl_llm', initial_url: 'https://x.org', llm_name: 'gpt', storeInSession: 'page' },
  { text: 'md', replyType: 'ws_markdown', ws_message: '# Hi' },
  { text: 'opts', replyType: 'ws_options', ws_options: 'a,b' },
  { text: 'loc', replyType: 'ws_location', ws_latitude: 1.5, ws_longitude: 2.5 },
  { text: 'form', replyType: 'gui_reply', guiId: 'signup' },
];

describe('AgentDiagramModifier add_state / add_state_body', () => {
  it.each(REPLIES.map((reply) => [reply.replyType as string, reply]))(
    'add_state and add_state_body build identical %s bodies',
    (_type, reply) => {
      const viaState = apply(emptyAgentModel(), {
        type: 'single', action: 'add_state', target: { stateName: 'S' }, changes: { replies: [reply] },
      });
      const [stateBody] = bodiesOf(viaState);

      const withState = apply(emptyAgentModel(), { type: 'single', action: 'add_state', target: { stateName: 'S' }, changes: {} });
      const viaBody = apply(withState, { type: 'single', action: 'add_state_body', target: { stateName: 'S' }, changes: reply });
      const [addedBody] = bodiesOf(viaBody);

      expect(payload(stateBody)).toEqual(payload(addedBody));
    },
  );

  it('add_state keeps every type-specific reply field (not only llm_name / system_message)', () => {
    const model = apply(emptyAgentModel(), {
      type: 'single', action: 'add_state', target: { stateName: 'S' }, changes: { replies: [REPLIES[3], REPLIES[7]] },
    });
    const [db, location] = bodiesOf(model) as any[];
    expect(db).toMatchObject({ actionType: 'DBAction', dbCustomName: 'sales', dbSqlQuery: 'SELECT 1', storeInSession: 'rows', sendReply: false });
    expect(location).toMatchObject({ actionType: 'WebSocketReplyLocationAction', ws_latitude: 1.5, ws_longitude: 2.5 });
  });
});

describe('AgentDiagramModifier component actions', () => {
  const cases: Array<[string, Record<string, unknown>, Record<string, unknown>]> = [
    ['add_llm', { name: 'gpt-4o', provider: 'ollama', num_previous_messages: 3 }, { type: 'AgentLLM', name: 'gpt-4o', provider: 'ollama', num_previous_messages: 3 }],
    ['add_tool', { name: 'search', description: 'd', code: 'def search(session): pass' }, { type: 'AgentTool', name: 'search', code: 'def search(session): pass' }],
    ['add_skill', { name: 'tone', content: 'Be kind' }, { type: 'AgentSkill', name: 'tone', content: 'Be kind' }],
    ['add_workspace', { name: 'repo', path: './repo', writable: false }, { type: 'AgentWorkspace', path: './repo', writable: false, max_read_bytes: 200000 }],
    ['add_gui', { gui_id: 'signup', is_form: true }, { type: 'AgentGUI', gui_id: 'signup', name: 'signup', is_form: true, persist: true }],
  ];

  it.each(cases)('%s adds one off-canvas component', (action, changes, expected) => {
    const model = apply(emptyAgentModel(), { type: 'single', action, target: {}, changes });
    expect(model.nodes).toHaveLength(0);
    const components = Object.values(model.components ?? {});
    expect(components).toHaveLength(1);
    expect(components[0]).toMatchObject({ owner: null, ...expected });
    expect(components[0].bounds).toBeUndefined();
  });

  it('handles every component action', () => {
    for (const [action] of cases) expect(modifier.canHandle(action)).toBe(true);
  });
});

describe('AgentDiagramConverter components section', () => {
  const spec = {
    intents: [{ intentName: 'greet', trainingPhrases: ['hi', 'hello'] }],
    states: [{ stateName: 'Welcome', replies: [{ text: 'Hi!', replyType: 'text' }] }],
    transitions: [
      { source: 'initial', target: 'Welcome' },
      { source: 'Welcome', target: 'Welcome', condition: 'when_intent_matched', conditionValue: 'greet' },
    ],
    llms: [{ name: 'gpt-4o', provider: 'openai' }],
    ragElements: [{ name: 'kb' }],
    tools: [{ name: 'search' }],
    skills: [{ name: 'tone', content: 'c' }],
    workspaces: [{ name: 'repo', path: '.' }],
    guis: [{ gui_id: 'signup', is_form: true }],
  };

  it('puts every component in `components` and only canvas items in `nodes`', () => {
    const model = new AgentDiagramConverter().convertCompleteSystem(spec) as AgentTestModel;
    const componentTypes = Object.values(model.components ?? {}).map((c: any) => c.type).sort();
    expect(componentTypes).toEqual(
      ['AgentGUI', 'AgentIntent', 'AgentIntentBody', 'AgentIntentBody', 'AgentLLM', 'AgentRagElement', 'AgentSkill', 'AgentTool', 'AgentWorkspace'].sort(),
    );
    expect(model.nodes.map((n) => n.type).sort()).toEqual(['AgentState', 'StateInitialNode']);
    expect(bodiesOf(model)).toHaveLength(1);
    expect(Object.values(model.components ?? {}).every((c: any) => c.bounds === undefined)).toBe(true);
  });

  it('round-trips through normalizeAgentComponents and the modifier unchanged', () => {
    const model = new AgentDiagramConverter().convertCompleteSystem(spec) as AgentTestModel;
    const normalized = normalizeAgentComponents(model as unknown as UMLModel);
    expect(normalized.components).toEqual(model.components);
    expect(normalized.nodes).toEqual(model.nodes);

    // The modifier finds converter-built intents in `components`.
    const renamed = apply(model, { type: 'single', action: 'modify_intent', target: { intentName: 'greet' }, changes: { name: 'hello' } });
    expect(Object.values(renamed.components ?? {}).some((c: any) => c.type === 'AgentIntent' && c.name === 'hello')).toBe(true);
  });

  it('builds converter state bodies with the same builder as the modifier', () => {
    const reply = REPLIES[1];
    const converted = new AgentDiagramConverter().convertCompleteSystem({ states: [{ stateName: 'S', replies: [reply] }] }) as AgentTestModel;
    const viaModifier = apply(emptyAgentModel(), { type: 'single', action: 'add_state', target: { stateName: 'S' }, changes: { replies: [reply] } });
    expect(payload(bodiesOf(converted)[0])).toEqual(payload(bodiesOf(viaModifier)[0]));
  });
});

describe('AgentDiagramModifier on old-format models (components on the canvas)', () => {
  // Pre-Components-page v4 models rendered intents as canvas nodes with
  // inline `data.training_phrases` rows.
  const legacyModel = (): AgentTestModel => {
    const model = emptyAgentModel();
    model.nodes = [
      stateNode('state', 'Welcome'),
      {
        id: 'intent',
        type: 'AgentIntent' as any,
        position: { x: 0, y: 0 },
        width: 100,
        height: 30,
        measured: { width: 100, height: 30 },
        data: { name: 'greet', intent_description: '', training_phrases: [{ id: 'phrase', name: 'hi' }] },
      },
    ];
    return model;
  };

  it('moves legacy intents into components and still edits them', () => {
    const result = apply(legacyModel(), {
      type: 'single', action: 'modify_intent', target: { intentName: 'greet' }, changes: { text: 'hello' },
    });
    expect(result.nodes.find((n) => n.id === 'intent')).toBeUndefined();
    expect(result.components?.intent.bodies).toHaveLength(2);
    expect(Object.values(result.components ?? {}).filter((c: any) => c.type === 'AgentIntentBody')).toHaveLength(2);
  });

  it('removes a legacy intent with its training phrases', () => {
    const result = apply(legacyModel(), { type: 'single', action: 'remove_element', target: { intentName: 'greet' }, changes: {} });
    expect(result.components).toEqual({});
    expect(result.nodes.map((n) => n.id)).toEqual(['state']);
  });

  it('add_intent_training_phrase appends one phrase to the intent', () => {
    expect(modifier.canHandle('add_intent_training_phrase')).toBe(true);
    const result = apply(legacyModel(), {
      type: 'single', action: 'add_intent_training_phrase', target: { intentName: 'greet' },
      changes: { trainingPhrase: 'good morning' },
    });
    const intent = result.components?.intent;
    expect(intent.bodies).toHaveLength(2);
    const added = result.components?.[intent.bodies[1]];
    expect(added).toMatchObject({ name: 'good morning', type: 'AgentIntentBody', owner: 'intent' });
  });

  it('add_transition connects the states the assistant names on the target', () => {
    const model = legacyModel();
    model.nodes.push(stateNode('other', 'Help'));
    const result = apply(model, {
      type: 'single', action: 'add_transition',
      target: { sourceStateName: 'Welcome', targetStateName: 'Help' },
      changes: { condition: 'when_intent_matched', intentName: 'greet' },
    });
    const [transition] = result.edges as any[];
    expect(transition).toMatchObject({
      type: 'AgentStateTransition',
      source: 'state',
      target: 'other',
      data: {
        transitionType: 'predefined',
        predefined: { predefinedType: 'when_intent_matched', intentName: 'greet' },
      },
    });

    const removed = apply(result, {
      type: 'single', action: 'remove_transition',
      target: { sourceStateName: 'Welcome', targetStateName: 'Help' }, changes: {},
    });
    expect(removed.edges).toEqual([]);
  });

  it('add_transition and remove_transition fail clearly when endpoints are missing', () => {
    expect(() => apply(legacyModel(), {
      type: 'single', action: 'add_transition', target: { sourceStateName: 'Welcome' }, changes: {},
    })).toThrow('target.sourceStateName and target.targetStateName');
    expect(() => apply(legacyModel(), {
      type: 'single', action: 'remove_transition',
      target: { sourceStateName: 'Welcome', targetStateName: 'Welcome' }, changes: {},
    })).toThrow('No transition from Welcome to Welcome');
  });

  it('add_intent_training_phrase rejects an unknown intent or a missing phrase', () => {
    expect(() => apply(legacyModel(), {
      type: 'single', action: 'add_intent_training_phrase', target: { intentName: 'nope' },
      changes: { trainingPhrase: 'x' },
    })).toThrow('Intent not found');
    expect(() => apply(legacyModel(), {
      type: 'single', action: 'add_intent_training_phrase', target: { intentName: 'greet' }, changes: {},
    })).toThrow('trainingPhrase');
  });
});
