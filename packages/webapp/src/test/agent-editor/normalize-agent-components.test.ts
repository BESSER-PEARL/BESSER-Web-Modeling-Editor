import { AgentComponentType, normalizeAgentComponents, UMLModel } from '@besser/wme';

type AnyRecord = Record<string, any>;

const node = (id: string, type: string, data: AnyRecord, x = 0, y = 0): AnyRecord => ({
  id,
  type,
  position: { x, y },
  width: 160,
  height: 60,
  measured: { width: 160, height: 60 },
  data,
});

/**
 * An agent diagram as saved by the React Flow editor before components moved off-canvas:
 * the intent (with inline training phrases), RAG, tool, skill, workspace and LLM are
 * canvas nodes next to the state and the initial node.
 */
function legacyV4AgentModel(): AnyRecord {
  return {
    version: '4.0.0',
    id: 'agent',
    title: 'Agent',
    type: 'AgentDiagram',
    assessments: {},
    nodes: [
      node('state1', 'AgentState', { name: 'Greeting', bodies: [{ id: 'body1', name: 'Hello!', replyType: 'text' }], fallbackBodies: [] }),
      node('init', 'StateInitialNode', { name: '' }, 300),
      node('intent1', 'AgentIntent', {
        name: 'greet',
        intent_description: 'User says hi',
        training_phrases: [{ id: 'ib1', name: 'hi' }, { id: 'ib2', name: 'hello' }],
      }, 400),
      node('rag1', 'AgentRagElement', { name: 'docs' }, 600),
      node('tool1', 'AgentTool', { name: 'search', description: 'web search' }, 600, 100),
      node('skill1', 'AgentSkill', { name: 'triage' }, 600, 200),
      node('ws1', 'AgentWorkspace', { name: 'repo', path: '/tmp' }, 600, 300),
      node('llm1', 'AgentLLM', { name: 'gpt', provider: 'openai' }),
    ],
    edges: [
      { id: 'e1', source: 'init', target: 'state1', type: 'AgentStateTransitionInit', sourceHandle: 'right', targetHandle: 'left', data: { points: [] } },
      // A legacy edge touching a canvas intent — components are not connectable.
      { id: 'e2', source: 'intent1', target: 'state1', type: 'AgentStateTransition', sourceHandle: 'right', targetHandle: 'left', data: { points: [] } },
    ],
  };
}

const COMPONENT_IDS = ['intent1', 'ib1', 'ib2', 'rag1', 'tool1', 'skill1', 'ws1', 'llm1'];

describe('normalizeAgentComponents (v4)', () => {
  it('moves legacy component nodes from nodes into components (without geometry)', () => {
    const input = legacyV4AgentModel();
    const result = normalizeAgentComponents(input as UMLModel);

    expect(result.nodes.map((n) => n.id).sort()).toEqual(['init', 'state1']);
    expect(Object.keys(result.components ?? {}).sort()).toEqual([...COMPONENT_IDS].sort());
    for (const component of Object.values(result.components ?? {})) {
      expect(component).not.toHaveProperty('position');
      expect(component).not.toHaveProperty('bounds');
    }
    // Payload fields survive; inline training phrases become AgentIntentBody components.
    expect(result.components?.intent1).toMatchObject({
      type: 'AgentIntent', name: 'greet', owner: null, bodies: ['ib1', 'ib2'], intent_description: 'User says hi',
    });
    expect(result.components?.intent1).not.toHaveProperty('training_phrases');
    expect(result.components?.ib1).toMatchObject({ type: 'AgentIntentBody', owner: 'intent1', name: 'hi' });
    expect(result.components?.llm1).toMatchObject({ provider: 'openai' });
    expect(result.components?.ws1).toMatchObject({ path: '/tmp' });
    // Canvas nodes are untouched; edges touching a moved node are dropped.
    expect(result.nodes.find((n) => n.id === 'state1')).toEqual(input.nodes[0]);
    expect(result.edges.map((e) => e.id)).toEqual(['e1']);
  });

  it('does not mutate its input', () => {
    const input = legacyV4AgentModel();
    const snapshot = JSON.parse(JSON.stringify(input));
    normalizeAgentComponents(input as UMLModel);
    expect(input).toEqual(snapshot);
  });

  it('is idempotent', () => {
    const once = normalizeAgentComponents(legacyV4AgentModel() as UMLModel);
    const twice = normalizeAgentComponents(once);
    expect(twice).toBe(once);
    expect(twice).toEqual(once);
  });

  it('migrates a legacy top-level agentComponents map and drops the legacy field', () => {
    const input: AnyRecord = {
      ...legacyV4AgentModel(),
      nodes: [legacyV4AgentModel().nodes[0]],
      edges: [],
      agentComponents: {
        gui1: { id: 'gui1', name: '', type: 'AgentGUI', owner: null, bounds: { x: 0, y: 0, width: 1, height: 1 }, gui_id: 'form', is_form: true },
      },
    };
    const result = normalizeAgentComponents(input as UMLModel);
    expect(result).not.toHaveProperty('agentComponents');
    expect(result.components?.gui1).toEqual({ id: 'gui1', name: '', type: 'AgentGUI', owner: null, gui_id: 'form', is_form: true });
  });

  it('keeps entries already in components over legacy copies with the same id', () => {
    const input: AnyRecord = legacyV4AgentModel();
    input.components = { tool1: { id: 'tool1', name: 'search-v2', type: 'AgentTool', owner: null } };
    const result = normalizeAgentComponents(input as UMLModel);
    expect(result.components?.tool1.name).toBe('search-v2');
    expect(result.nodes.some((n) => n.id === 'tool1')).toBe(false);
  });

  it('is a no-op for new-format agent models and for other diagram types', () => {
    const agent = normalizeAgentComponents(legacyV4AgentModel() as UMLModel);
    expect(normalizeAgentComponents(agent)).toBe(agent);

    const classDiagram: AnyRecord = { ...legacyV4AgentModel(), type: 'ClassDiagram' };
    expect(normalizeAgentComponents(classDiagram as UMLModel)).toBe(classDiagram);
  });

  it('exposes the component type names used by the components panel', () => {
    expect(Object.values(AgentComponentType).sort()).toEqual(
      ['AgentGUI', 'AgentIntent', 'AgentIntentBody', 'AgentLLM', 'AgentRagElement', 'AgentSkill', 'AgentTool', 'AgentWorkspace'],
    );
  });
});
