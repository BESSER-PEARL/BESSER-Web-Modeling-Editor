import { AgentComponentType, AgentElementType, normalizeAgentComponents, UMLModel } from '@besser/wme';

type AnyRecord = Record<string, any>;

const bounds = (x = 0, y = 0) => ({ x, y, width: 160, height: 60 });

/**
 * An agent diagram as saved by the develop branch before components moved off-canvas:
 * intents (+ training-sentence bodies), RAG, tool, skill, workspace and LLM live in `elements`
 * next to the canvas state and its body.
 */
function developFormatAgentModel(): AnyRecord {
  return {
    version: '3.0.0',
    type: 'AgentDiagram',
    size: { width: 800, height: 600 },
    interactive: { elements: {}, relationships: {} },
    assessments: {},
    relationships: {},
    elements: {
      state1: { id: 'state1', name: 'Greeting', type: 'AgentState', owner: null, bounds: bounds(), bodies: ['body1'], fallbackBodies: [] },
      body1: { id: 'body1', name: 'Hello!', type: 'AgentStateBody', owner: 'state1', bounds: bounds(0, 40), replyType: 'text' },
      init: { id: 'init', name: '', type: 'StateInitialNode', owner: null, bounds: bounds(300, 0) },
      intent1: {
        id: 'intent1', name: 'greet', type: 'AgentIntent', owner: null, bounds: bounds(400, 0),
        bodies: ['ib1', 'ib2'], intent_description: 'User says hi',
      },
      ib1: { id: 'ib1', name: 'hi', type: 'AgentIntentBody', owner: 'intent1', bounds: bounds(400, 40) },
      ib2: { id: 'ib2', name: 'hello', type: 'AgentIntentBody', owner: 'intent1', bounds: bounds(400, 70) },
      rag1: { id: 'rag1', name: 'docs', type: 'AgentRagElement', owner: null, bounds: bounds(600, 0) },
      tool1: { id: 'tool1', name: 'search', type: 'AgentTool', owner: null, bounds: bounds(600, 100), description: 'web search' },
      skill1: { id: 'skill1', name: 'triage', type: 'AgentSkill', owner: null, bounds: bounds(600, 200) },
      ws1: { id: 'ws1', name: 'repo', type: 'AgentWorkspace', owner: null, bounds: bounds(600, 300), path: '/tmp' },
      llm1: { id: 'llm1', name: 'gpt', type: 'AgentLLM', owner: null, bounds: bounds(), provider: 'openai' },
    },
  };
}

const COMPONENT_IDS = ['intent1', 'ib1', 'ib2', 'rag1', 'tool1', 'skill1', 'ws1', 'llm1'];

describe('normalizeAgentComponents', () => {
  it('moves develop-format components from elements into components (without bounds)', () => {
    const input = developFormatAgentModel();
    const result = normalizeAgentComponents(input as UMLModel);

    expect(Object.keys(result.elements).sort()).toEqual(['body1', 'init', 'state1']);
    expect(Object.keys(result.components ?? {}).sort()).toEqual([...COMPONENT_IDS].sort());
    for (const component of Object.values(result.components ?? {})) {
      expect(component).not.toHaveProperty('bounds');
    }
    // Payload fields survive, including the intent → training-sentence links.
    expect(result.components?.intent1).toMatchObject({ bodies: ['ib1', 'ib2'], intent_description: 'User says hi' });
    expect(result.components?.ib1).toMatchObject({ owner: 'intent1', name: 'hi' });
    expect(result.components?.llm1).toMatchObject({ provider: 'openai' });
    // Canvas elements are untouched.
    expect(result.elements.state1).toEqual(input.elements.state1);
  });

  it('does not mutate its input', () => {
    const input = developFormatAgentModel();
    const snapshot = JSON.parse(JSON.stringify(input));
    normalizeAgentComponents(input as UMLModel);
    expect(input).toEqual(snapshot);
  });

  it('is idempotent', () => {
    const once = normalizeAgentComponents(developFormatAgentModel() as UMLModel);
    const twice = normalizeAgentComponents(once);
    expect(twice).toBe(once);
    expect(twice).toEqual(once);
  });

  it('migrates a legacy top-level agentComponents map and drops the legacy field', () => {
    const input: AnyRecord = {
      ...developFormatAgentModel(),
      elements: { state1: developFormatAgentModel().elements.state1 },
      agentComponents: {
        gui1: { id: 'gui1', name: '', type: 'AgentGUI', owner: null, bounds: bounds(), gui_id: 'form', is_form: true },
      },
    };
    const result = normalizeAgentComponents(input as UMLModel);
    expect(result).not.toHaveProperty('agentComponents');
    expect(result.components?.gui1).toEqual({ id: 'gui1', name: '', type: 'AgentGUI', owner: null, gui_id: 'form', is_form: true });
  });

  it('keeps entries already in components over legacy copies with the same id', () => {
    const input: AnyRecord = developFormatAgentModel();
    input.components = { tool1: { id: 'tool1', name: 'search-v2', type: 'AgentTool', owner: null } };
    const result = normalizeAgentComponents(input as UMLModel);
    expect(result.components?.tool1.name).toBe('search-v2');
    expect(result.elements).not.toHaveProperty('tool1');
  });

  it('is a no-op for new-format agent models and for other diagram types', () => {
    const agent = normalizeAgentComponents(developFormatAgentModel() as UMLModel);
    expect(normalizeAgentComponents(agent)).toBe(agent);

    const classDiagram: AnyRecord = {
      ...developFormatAgentModel(),
      type: 'ClassDiagram',
    };
    expect(normalizeAgentComponents(classDiagram as UMLModel)).toBe(classDiagram);
  });

  it('exposes the component type names used by the components panel', () => {
    expect(Object.values(AgentComponentType).sort()).toEqual(
      ['AgentGUI', 'AgentIntent', 'AgentIntentBody', 'AgentLLM', 'AgentRagElement', 'AgentSkill', 'AgentTool', 'AgentWorkspace'],
    );
    expect(AgentElementType.AgentState).toBe('AgentState');
  });
});
